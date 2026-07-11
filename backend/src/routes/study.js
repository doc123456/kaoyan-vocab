const express = require('express');
const router = express.Router();

// 辅助函数：将查询结果转换为对象数组
function queryToObjects(result) {
  if (!result || result.length === 0) return [];
  const columns = result[0].columns;
  return result[0].values.map(row => {
    const obj = {};
    columns.forEach((col, i) => {
      obj[col] = row[i];
    });
    return obj;
  });
}

function shuffle(items) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function diversifyByPrefix(items, getWord, limit) {
  const groups = new Map();
  for (const item of items) {
    const prefix = String(getWord(item) || '').slice(0, 3).toLowerCase();
    if (!groups.has(prefix)) groups.set(prefix, []);
    groups.get(prefix).push(item);
  }

  const groupEntries = Array.from(groups.values()).map(group => shuffle(group));
  const result = [];
  while (result.length < limit && groupEntries.some(group => group.length > 0)) {
    for (const group of groupEntries) {
      if (group.length > 0 && result.length < limit) {
        result.push(group.shift());
      }
    }
  }

  return result;
}

function normalizeWordShape(word) {
  return String(word || '').toLowerCase().replace(/[^a-z]/g, '');
}

function levenshteinDistance(a, b) {
  const left = normalizeWordShape(a);
  const right = normalizeWordShape(b);
  if (left === right) return 0;
  if (!left) return right.length;
  if (!right) return left.length;

  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  const current = new Array(right.length + 1);

  for (let i = 1; i <= left.length; i++) {
    current[0] = i;
    for (let j = 1; j <= right.length; j++) {
      const cost = left[i - 1] === right[j - 1] ? 0 : 1;
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + cost
      );
    }
    for (let j = 0; j <= right.length; j++) {
      previous[j] = current[j];
    }
  }

  return previous[right.length];
}

function commonPrefixLength(a, b) {
  const left = normalizeWordShape(a);
  const right = normalizeWordShape(b);
  let count = 0;
  while (count < left.length && count < right.length && left[count] === right[count]) {
    count++;
  }
  return count;
}

function commonSuffixLength(a, b) {
  const left = normalizeWordShape(a);
  const right = normalizeWordShape(b);
  let count = 0;
  while (
    count < left.length &&
    count < right.length &&
    left[left.length - 1 - count] === right[right.length - 1 - count]
  ) {
    count++;
  }
  return count;
}

function wordShapeSimilarity(target, candidate) {
  const left = normalizeWordShape(target);
  const right = normalizeWordShape(candidate);
  if (!left || !right) return 0;

  const maxLength = Math.max(left.length, right.length);
  const editSimilarity = 1 - (levenshteinDistance(left, right) / maxLength);
  const prefixSimilarity = commonPrefixLength(left, right) / maxLength;
  const suffixSimilarity = commonSuffixLength(left, right) / maxLength;
  const lengthSimilarity = 1 - (Math.abs(left.length - right.length) / maxLength);

  return editSimilarity * 0.62 + prefixSimilarity * 0.18 + suffixSimilarity * 0.12 + lengthSimilarity * 0.08;
}

function pickShapeSimilarWrongWords(db, correctWordId, correctWord, limit) {
  const allWordsResult = db.exec(`
    SELECT
      w.id as word_id,
      w.word,
      m.id as meaning_id,
      m.part_of_speech,
      m.meaning_cn
    FROM words w
    JOIN meanings m ON w.id = m.word_id
    WHERE w.id != ?
    GROUP BY w.id
  `, [correctWordId]);

  return shuffle(queryToObjects(allWordsResult)
    .map(item => ({
      ...item,
      shape_similarity: wordShapeSimilarity(correctWord, item.word)
    }))
    .sort((a, b) => b.shape_similarity - a.shape_similarity)
    .slice(0, 10))
    .slice(0, limit);
}

function putCorrectOptionInBalancedPosition(meaning, wrongOptions, correctIndex) {
  const options = wrongOptions.map(opt => ({
    text: opt.meaning_cn,
    is_correct: false
  }));

  options.splice(correctIndex, 0, {
    text: meaning.meaning_cn,
    is_correct: true
  });

  return options.slice(0, 4);
}

function findAnswerToken(sentence, word) {
  const tokens = sentence.match(/[A-Za-z]+(?:'[A-Za-z]+)?/g) || [];
  const lowerWord = word.toLowerCase();
  return tokens.find((token) => {
    const lowerToken = token.toLowerCase();
    return lowerToken === lowerWord ||
      lowerToken === `${lowerWord}s` ||
      lowerToken === `${lowerWord}ed` ||
      lowerToken === `${lowerWord}ing` ||
      lowerToken.startsWith(lowerWord);
  });
}

function createPhraseExercise(item) {
  if (!item.sentence_en) return null;

  const answerToken = findAnswerToken(item.sentence_en, item.word);
  if (!answerToken) return null;

  const sentenceWords = item.sentence_en.match(/[A-Za-z]+(?:'[A-Za-z]+)?/g) || [];
  const answerWordIndex = sentenceWords.findIndex(token => token === answerToken);
  const phraseStart = Math.max(0, answerWordIndex - 2);
  const phraseEnd = Math.min(sentenceWords.length, answerWordIndex + 3);
  const phrase = sentenceWords.slice(phraseStart, phraseEnd).join(' ');
  const blankPhrase = phrase.replace(new RegExp(`\\b${answerToken}\\b`, 'i'), '______');
  const blankSentence = item.sentence_en.replace(new RegExp(`\\b${answerToken}\\b`, 'i'), '______');

  return {
    meaning_id: item.meaning_id,
    word_id: item.word_id,
    word: item.word,
    phonetic_uk: item.phonetic_uk,
    phonetic_us: item.phonetic_us,
    part_of_speech: item.part_of_speech,
    meaning_cn: item.meaning_cn,
    sentence_en: item.sentence_en,
    sentence_cn: item.sentence_cn,
    phrase,
    blank_phrase: blankPhrase,
    blank_sentence: blankSentence,
    answer: answerToken
  };
}

function putPhraseCorrectOptionInBalancedPosition(exercise, wrongAnswers, correctIndex) {
  const options = wrongAnswers.slice(0, 3).map(answer => ({
    text: answer,
    is_correct: false
  }));

  options.splice(correctIndex, 0, {
    text: exercise.answer,
    is_correct: true
  });

  return options.slice(0, 4);
}

// 获取传统背单词模式的数据
router.get('/traditional', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const mistakesOnly = req.query.mistakesOnly === 'true';
    const reviewOnly = req.query.reviewOnly === 'true';
    const requestedMode = ['en-to-cn', 'cn-to-en', 'mixed'].includes(req.query.mode) ? req.query.mode : 'en-to-cn';
    const hardMode = req.query.hardMode === 'true';
    const dueCondition = "COALESCE(up.review_graduated, 0) = 0 AND (datetime(replace(replace(up.next_review_at, 'T', ' '), 'Z', '')) <= datetime('now') OR up.next_review_at IS NULL)";
    
    const result = req.db.exec(`
      SELECT 
        w.id as word_id,
        w.word,
        w.phonetic_uk,
        w.phonetic_us
      FROM meanings m
      JOIN words w ON m.word_id = w.id
      ${reviewOnly ? 'JOIN user_progress up ON m.id = up.meaning_id' : 'LEFT JOIN user_progress up ON m.id = up.meaning_id'}
      ${mistakesOnly ? 'JOIN mistake_book mb ON m.id = mb.meaning_id AND mb.active = 1' : ''}
      WHERE ${mistakesOnly ? '1 = 1' : reviewOnly ? dueCondition : `
        up.meaning_id IS NULL
      `}
      GROUP BY w.id
      ORDER BY 
        MIN(CASE WHEN up.meaning_id IS NULL THEN 0 ELSE 1 END),
        MIN(up.next_review_at),
        RANDOM()
      LIMIT ?
    `, [limit * 5]);
    
    const words = diversifyByPrefix(queryToObjects(result), item => item.word, limit);
    
    for (let word of words) {
      const meaningResult = req.db.exec(`
        SELECT meanings.id as meaning_id, part_of_speech, meaning_cn
        FROM meanings
        ${reviewOnly ? 'JOIN user_progress up ON meanings.id = up.meaning_id' : ''}
        ${mistakesOnly ? 'JOIN mistake_book mb ON meanings.id = mb.meaning_id AND mb.active = 1' : ''}
        WHERE word_id = ?
        ${reviewOnly ? `AND (${dueCondition})` : ''}
        ${!reviewOnly && !mistakesOnly ? 'AND meanings.id NOT IN (SELECT meaning_id FROM user_progress)' : ''}
        ORDER BY meaning_index
      `, [word.word_id]);
      const wordMeanings = queryToObjects(meaningResult);
      const questionMode = requestedMode === 'mixed'
        ? (Math.random() < 0.5 ? 'en-to-cn' : 'cn-to-en')
        : requestedMode;

      const maxCorrectCount = Math.min(3, wordMeanings.length);
      const correctCount = (mistakesOnly || reviewOnly) ? maxCorrectCount : Math.max(1, Math.ceil(Math.random() * maxCorrectCount));
      const correctMeanings = shuffle(wordMeanings).slice(0, correctCount);

      if (questionMode === 'cn-to-en') {
        const correctMeaning = correctMeanings[0] || wordMeanings[0];
        let wrongWords = hardMode
          ? pickShapeSimilarWrongWords(req.db, word.word_id, word.word, 3)
          : [];

        if (wrongWords.length < 3) {
          const existingWrongWordIds = wrongWords.map(item => item.word_id);
          const placeholders = existingWrongWordIds.map(() => '?').join(',');
          const wrongResult = req.db.exec(`
            SELECT
              w.id as word_id,
              w.word,
              m.id as meaning_id,
              m.part_of_speech,
              m.meaning_cn
            FROM words w
            JOIN meanings m ON w.id = m.word_id
            WHERE w.id != ?
            ${existingWrongWordIds.length > 0 ? `AND w.id NOT IN (${placeholders})` : ''}
            GROUP BY w.id
            ORDER BY RANDOM()
            LIMIT ?
          `, [word.word_id, ...existingWrongWordIds, 3 - wrongWords.length]);
          wrongWords = [...wrongWords, ...queryToObjects(wrongResult)];
        }

        word.question_mode = 'cn-to-en';
        word.difficulty = hardMode ? 'hard-shape' : 'normal';
        word.prompt_text = `${correctMeaning.part_of_speech || ''} ${correctMeaning.meaning_cn}`.trim();
        word.prompt_hint = '选择这个中文释义对应的英文单词';
        word.meaning_cn = correctMeaning.meaning_cn;
        word.part_of_speech = correctMeaning.part_of_speech;
        word.meaning_ids = [correctMeaning.meaning_id];
        word.options = shuffle([
          {
            meaning_id: correctMeaning.meaning_id,
            text: word.word,
            meaning_text: `${correctMeaning.part_of_speech || ''} ${correctMeaning.meaning_cn}`.trim(),
            is_correct: true
          },
          ...wrongWords.map(item => ({
            meaning_id: item.meaning_id,
            text: item.word,
            meaning_text: `${item.part_of_speech || ''} ${item.meaning_cn}`.trim(),
            is_correct: false
          }))
        ]);
      } else {
        const wrongResult = req.db.exec(`
          SELECT id as meaning_id, part_of_speech, meaning_cn
          FROM meanings
          WHERE word_id != ?
          ORDER BY RANDOM()
          LIMIT ?
        `, [word.word_id, 4 - correctMeanings.length]);
        const wrongMeanings = queryToObjects(wrongResult);

        word.question_mode = 'en-to-cn';
        word.prompt_text = word.word;
        word.prompt_hint = '选择这个英文单词可能对应的所有中文释义';
        word.meaning_cn = correctMeanings.map(item => item.meaning_cn).join('；');
        word.meaning_ids = correctMeanings.map(item => item.meaning_id);
        word.options = shuffle([
          ...correctMeanings.map(item => ({
            meaning_id: item.meaning_id,
            text: `${item.part_of_speech || ''} ${item.meaning_cn}`.trim(),
            is_correct: true
          })),
          ...wrongMeanings.map(item => ({
            meaning_id: item.meaning_id,
            text: `${item.part_of_speech || ''} ${item.meaning_cn}`.trim(),
            is_correct: false
          }))
        ]);
      }
    }
    
    res.json(words);
  } catch (error) {
    console.error('获取传统背单词数据失败:', error);
    res.status(500).json({ error: '获取传统背单词数据失败' });
  }
});

// 获取例句模式的数据
router.get('/sentence', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const mistakesOnly = req.query.mistakesOnly === 'true';
    
    // 获取包含例句的释义
    const result = req.db.exec(`
      SELECT 
        m.id as meaning_id,
        m.part_of_speech,
        m.meaning_cn,
        w.id as word_id,
        w.word,
        w.phonetic_uk,
        w.phonetic_us,
        COALESCE(up.mastery_level, 0) as mastery_level
      FROM meanings m
      JOIN words w ON m.word_id = w.id
      INNER JOIN examples e ON m.id = e.meaning_id
      LEFT JOIN user_progress up ON m.id = up.meaning_id
      ${mistakesOnly ? 'JOIN mistake_book mb ON m.id = mb.meaning_id AND mb.active = 1' : ''}
      WHERE ${mistakesOnly ? '1 = 1' : `
        up.meaning_id IS NULL 
        OR (
          COALESCE(up.review_graduated, 0) = 0
          AND (
            datetime(replace(replace(up.next_review_at, 'T', ' '), 'Z', '')) <= datetime('now')
            OR up.next_review_at IS NULL
          )
        )
      `}
      GROUP BY m.id
      ORDER BY 
        CASE WHEN up.meaning_id IS NULL THEN 0 ELSE 1 END,
        up.next_review_at ASC,
        RANDOM()
      LIMIT ?
    `, [limit * 5]);
    
    const meanings = diversifyByPrefix(queryToObjects(result), item => item.word, limit);
    
    // 获取每个释义的例句
    for (let meaning of meanings) {
      const examplesResult = req.db.exec('SELECT * FROM examples WHERE meaning_id = ?', [meaning.meaning_id]);
      meaning.examples = queryToObjects(examplesResult);
    }
    
    // 生成选择题选项，正确答案按 A/B/C/D 循环放置，保证整体接近 25%。
    for (let i = 0; i < meanings.length; i++) {
      const meaning = meanings[i];
      // 获取错误选项（其他单词的释义）
      const wrongResult = req.db.exec(`
        SELECT meaning_cn
        FROM meanings
        WHERE id != ?
        ORDER BY RANDOM()
        LIMIT 3
      `, [meaning.meaning_id]);
      
      const wrongOptions = queryToObjects(wrongResult);
      
      meaning.options = putCorrectOptionInBalancedPosition(meaning, wrongOptions, i % 4);
    }
    
    res.json(meanings);
  } catch (error) {
    console.error('获取例句模式数据失败:', error);
    res.status(500).json({ error: '获取例句模式数据失败' });
  }
});

// 获取词组/固定搭配挖空练习
router.get('/phrases', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;

    const result = req.db.exec(`
      SELECT 
        m.id as meaning_id,
        m.part_of_speech,
        m.meaning_cn,
        w.id as word_id,
        w.word,
        w.phonetic_uk,
        w.phonetic_us,
        e.sentence_en,
        e.sentence_cn,
        COALESCE(up.mastery_level, 0) as mastery_level
      FROM meanings m
      JOIN words w ON m.word_id = w.id
      INNER JOIN examples e ON m.id = e.meaning_id
      LEFT JOIN user_progress up ON m.id = up.meaning_id
      WHERE up.meaning_id IS NULL 
         OR (
           COALESCE(up.review_graduated, 0) = 0
           AND (
             datetime(replace(replace(up.next_review_at, 'T', ' '), 'Z', '')) <= datetime('now')
             OR up.next_review_at IS NULL
           )
         )
      ORDER BY 
        CASE WHEN up.meaning_id IS NULL THEN 0 ELSE 1 END,
        up.next_review_at ASC,
        m.id ASC
      LIMIT ?
    `, [limit * 3]);

    const exercises = queryToObjects(result)
      .map(createPhraseExercise)
      .filter(Boolean)
      .slice(0, limit);

    for (let i = 0; i < exercises.length; i++) {
      const exercise = exercises[i];
      const wrongAnswers = exercises
        .map(item => item.answer)
        .filter(answer => answer.toLowerCase() !== exercise.answer.toLowerCase());

      if (wrongAnswers.length < 3) {
        const fallbackResult = req.db.exec(`
          SELECT word
          FROM words
          WHERE lower(word) != lower(?)
          ORDER BY RANDOM()
          LIMIT ?
        `, [exercise.answer, 3 - wrongAnswers.length]);
        wrongAnswers.push(...queryToObjects(fallbackResult).map(item => item.word));
      }

      exercise.options = putPhraseCorrectOptionInBalancedPosition(exercise, wrongAnswers, i % 4);
    }

    res.json(exercises);
  } catch (error) {
    console.error('获取词组练习数据失败:', error);
    res.status(500).json({ error: '获取词组练习数据失败' });
  }
});

// 获取填空模式的数据
router.get('/test', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const result = req.db.exec(`
      SELECT
        w.id as word_id,
        w.word,
        w.phonetic_uk,
        w.phonetic_us
      FROM words w
      ORDER BY RANDOM()
      LIMIT ?
    `, [limit]);

    const words = queryToObjects(result);

    for (let word of words) {
      const meaningResult = req.db.exec(`
        SELECT id as meaning_id, part_of_speech, meaning_cn
        FROM meanings
        WHERE word_id = ?
        ORDER BY meaning_index
      `, [word.word_id]);
      const wordMeanings = queryToObjects(meaningResult);
      const maxCorrectCount = Math.min(3, wordMeanings.length);
      const correctCount = Math.max(1, Math.ceil(Math.random() * maxCorrectCount));
      const correctMeanings = shuffle(wordMeanings).slice(0, correctCount);

      const wrongResult = req.db.exec(`
        SELECT id as meaning_id, part_of_speech, meaning_cn
        FROM meanings
        WHERE word_id != ?
        ORDER BY RANDOM()
        LIMIT ?
      `, [word.word_id, 4 - correctMeanings.length]);
      const wrongMeanings = queryToObjects(wrongResult);

      word.meaning_ids = correctMeanings.map(item => item.meaning_id);
      word.options = shuffle([
        ...correctMeanings.map(item => ({
          meaning_id: item.meaning_id,
          text: `${item.part_of_speech || ''} ${item.meaning_cn}`.trim(),
          is_correct: true
        })),
        ...wrongMeanings.map(item => ({
          meaning_id: item.meaning_id,
          text: `${item.part_of_speech || ''} ${item.meaning_cn}`.trim(),
          is_correct: false
        }))
      ]);
    }

    res.json(words);
  } catch (error) {
    console.error('获取测试数据失败:', error);
    res.status(500).json({ error: '获取测试数据失败' });
  }
});

router.post('/test-result', (req, res) => {
  try {
    const totalCount = Math.max(0, Math.floor(Number(req.body.total_count) || 0));
    const correctCount = Math.max(0, Math.floor(Number(req.body.correct_count) || 0));
    const duration = Math.max(0, Math.floor(Number(req.body.duration) || 0));
    const score = totalCount > 0 ? Math.round((correctCount / totalCount) * 1000) / 10 : 0;

    req.db.run(`
      INSERT INTO test_sessions (total_count, correct_count, score, duration)
      VALUES (?, ?, ?, ?)
    `, [totalCount, correctCount, score, duration]);
    req.saveDb();

    res.json({ success: true, score });
  } catch (error) {
    console.error('保存测试结果失败:', error);
    res.status(500).json({ error: '保存测试结果失败' });
  }
});

router.get('/fill-blank', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    
    // 获取包含例句的释义
    const result = req.db.exec(`
      SELECT 
        m.id as meaning_id,
        m.part_of_speech,
        m.meaning_cn,
        w.id as word_id,
        w.word,
        w.phonetic_uk,
        w.phonetic_us,
        COALESCE(up.mastery_level, 0) as mastery_level
      FROM meanings m
      JOIN words w ON m.word_id = w.id
      INNER JOIN examples e ON m.id = e.meaning_id
      LEFT JOIN user_progress up ON m.id = up.meaning_id
      WHERE up.meaning_id IS NULL 
         OR (
           COALESCE(up.review_graduated, 0) = 0
           AND (
             datetime(replace(replace(up.next_review_at, 'T', ' '), 'Z', '')) <= datetime('now')
             OR up.next_review_at IS NULL
           )
         )
      GROUP BY m.id
      ORDER BY 
        CASE WHEN up.meaning_id IS NULL THEN 0 ELSE 1 END,
        up.next_review_at ASC,
        m.id ASC
      LIMIT ?
    `, [limit]);
    
    const meanings = queryToObjects(result);
    
    // 获取每个释义的例句，并创建填空题
    for (let meaning of meanings) {
      const examplesResult = req.db.exec('SELECT * FROM examples WHERE meaning_id = ?', [meaning.meaning_id]);
      const examples = queryToObjects(examplesResult);
      
      // 将例句中的目标单词替换为下划线
      meaning.examples = examples.map(example => {
        const regex = new RegExp(`\\b${meaning.word}\\b`, 'gi');
        const blankSentence = example.sentence_en.replace(regex, '______');
        return {
          ...example,
          blank_sentence: blankSentence,
          original_word: meaning.word
        };
      });
    }
    
    res.json(meanings);
  } catch (error) {
    console.error('获取填空模式数据失败:', error);
    res.status(500).json({ error: '获取填空模式数据失败' });
  }
});

module.exports = router;
