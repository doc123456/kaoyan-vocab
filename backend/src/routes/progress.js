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

function addTime(date, amount, unit) {
  const next = new Date(date);
  if (unit === 'minutes') next.setMinutes(next.getMinutes() + amount);
  if (unit === 'hours') next.setHours(next.getHours() + amount);
  if (unit === 'days') next.setTime(next.getTime() + amount * 24 * 60 * 60 * 1000);
  return next;
}

function calculateProgress(currentProgress, isCorrect, responseTime, studyMode, correctStreak) {
  const currentLevel = currentProgress.mastery_level || 0;
  const isAssistedMode = studyMode === 'sentence';

  if (!isCorrect) {
    return {
      masteryLevel: Math.max(0, currentLevel - 1),
      nextReviewAt: addTime(new Date(), 5, 'minutes'),
      reviewGraduated: 0
    };
  }

  const levelGain = isAssistedMode ? 1 : (responseTime < 3500 ? 2 : 1);
  const maxLevel = isAssistedMode ? 3 : 5;
  const masteryLevel = Math.min(maxLevel, currentLevel + levelGain);

  const reviewDaysByStreak = {
    1: 1,
    2: 3,
    3: 5,
    4: 7,
    5: 9,
    6: 11
  };

  if (correctStreak > 6) {
    return {
      masteryLevel: 6,
      nextReviewAt: null,
      reviewGraduated: 1
    };
  }

  return {
    masteryLevel,
    nextReviewAt: addTime(new Date(), reviewDaysByStreak[correctStreak] || 1, 'days'),
    reviewGraduated: 0
  };
}

function updateMistakeBook(db, meaningId, isCorrect) {
  const existing = queryToObjects(db.exec('SELECT * FROM mistake_book WHERE meaning_id = ?', [meaningId]))[0];

  if (!isCorrect) {
    if (existing) {
      db.run(`
        UPDATE mistake_book
        SET active = 1,
            consecutive_correct = 0,
            wrong_count = wrong_count + 1,
            last_wrong_at = datetime('now'),
            resolved_at = NULL,
            updated_at = datetime('now')
        WHERE meaning_id = ?
      `, [meaningId]);
    } else {
      db.run(`
        INSERT INTO mistake_book (meaning_id, active, consecutive_correct, wrong_count, last_wrong_at, updated_at)
        VALUES (?, 1, 0, 1, datetime('now'), datetime('now'))
      `, [meaningId]);
    }

    return {
      in_mistake_book: true,
      consecutive_correct: 0
    };
  }

  if (!existing || existing.active !== 1) {
    return {
      in_mistake_book: false,
      consecutive_correct: existing ? existing.consecutive_correct : 0
    };
  }

  const consecutiveCorrect = (existing.consecutive_correct || 0) + 1;
  const shouldResolve = consecutiveCorrect >= 3;

  db.run(`
    UPDATE mistake_book
    SET active = ?,
        consecutive_correct = ?,
        resolved_at = CASE WHEN ? = 1 THEN datetime('now') ELSE resolved_at END,
        updated_at = datetime('now')
    WHERE meaning_id = ?
  `, [shouldResolve ? 0 : 1, consecutiveCorrect, shouldResolve ? 1 : 0, meaningId]);

  return {
    in_mistake_book: !shouldResolve,
    consecutive_correct: consecutiveCorrect
  };
}

// 获取所有学习进度
router.get('/', (req, res) => {
  try {
    const result = req.db.exec(`
      SELECT 
        up.*,
        m.part_of_speech,
        m.meaning_cn,
        w.word
      FROM user_progress up
      JOIN meanings m ON up.meaning_id = m.id
      JOIN words w ON m.word_id = w.id
      ORDER BY up.next_review_at ASC
    `);
    
    res.json(queryToObjects(result));
  } catch (error) {
    console.error('获取学习进度失败:', error);
    res.status(500).json({ error: '获取学习进度失败' });
  }
});

// 获取待复习的单词
router.get('/review', (req, res) => {
  try {
    const result = req.db.exec(`
      SELECT 
        up.*,
        m.part_of_speech,
        m.meaning_cn,
        w.word,
        w.phonetic_uk,
        w.phonetic_us
      FROM user_progress up
      JOIN meanings m ON up.meaning_id = m.id
      JOIN words w ON m.word_id = w.id
      WHERE COALESCE(up.review_graduated, 0) = 0
        AND (
          datetime(replace(replace(up.next_review_at, 'T', ' '), 'Z', '')) <= datetime('now')
          OR up.next_review_at IS NULL
        )
      ORDER BY up.next_review_at ASC
      LIMIT 20
    `);
    
    const reviewItems = queryToObjects(result);
    
    // 获取每个释义的例句
    for (let item of reviewItems) {
      const examplesResult = req.db.exec('SELECT * FROM examples WHERE meaning_id = ?', [item.meaning_id]);
      item.examples = queryToObjects(examplesResult);
    }
    
    res.json(reviewItems);
  } catch (error) {
    console.error('获取待复习单词失败:', error);
    res.status(500).json({ error: '获取待复习单词失败' });
  }
});

// 更新学习进度
router.post('/:meaningId', (req, res) => {
  try {
    const { meaningId } = req.params;
    const { is_correct, response_time, study_mode } = req.body;
    
    // 检查进度记录是否存在
    const progressResult = req.db.exec('SELECT * FROM user_progress WHERE meaning_id = ?', [meaningId]);
    let progress = queryToObjects(progressResult);
    
    if (progress.length === 0) {
      // 创建新的进度记录
      req.db.run('INSERT INTO user_progress (meaning_id, correct_count, incorrect_count, correct_streak, avg_response_time, review_graduated) VALUES (?, 0, 0, 0, 0, 0)', [meaningId]);
      
      const newProgressResult = req.db.exec('SELECT * FROM user_progress WHERE meaning_id = ?', [meaningId]);
      progress = queryToObjects(newProgressResult);
    }
    
    const currentProgress = progress[0];
    
    // 计算新的统计数据
    const newCorrectCount = is_correct ? currentProgress.correct_count + 1 : currentProgress.correct_count;
    const newIncorrectCount = is_correct ? currentProgress.incorrect_count : currentProgress.incorrect_count + 1;
    const newCorrectStreak = is_correct ? (currentProgress.correct_streak || 0) + 1 : 0;
    const totalAttempts = newCorrectCount + newIncorrectCount;
    const newAvgResponseTime = (currentProgress.avg_response_time * (totalAttempts - 1) + response_time) / totalAttempts;
    
    const { masteryLevel, nextReviewAt, reviewGraduated } = calculateProgress(currentProgress, is_correct, response_time, study_mode, newCorrectStreak);
    
    // 更新进度
    req.db.run(`
      UPDATE user_progress 
      SET 
        mastery_level = ?,
        correct_count = ?,
        incorrect_count = ?,
        correct_streak = ?,
        avg_response_time = ?,
        last_reviewed_at = datetime('now'),
        next_review_at = ?,
        review_graduated = ?
      WHERE meaning_id = ?
    `, [masteryLevel, newCorrectCount, newIncorrectCount, newCorrectStreak, newAvgResponseTime, nextReviewAt ? nextReviewAt.toISOString() : null, reviewGraduated, meaningId]);
    
    // 记录学习日志
    req.db.run(`
      INSERT INTO study_logs (meaning_id, is_correct, response_time, study_mode)
      VALUES (?, ?, ?, ?)
    `, [meaningId, is_correct ? 1 : 0, response_time, study_mode]);

    const mistakeState = updateMistakeBook(req.db, meaningId, is_correct);

    req.saveDb();
    
    res.json({ 
      success: true, 
      mastery_level: masteryLevel,
      correct_streak: newCorrectStreak,
      next_review_at: nextReviewAt ? nextReviewAt.toISOString() : null,
      review_graduated: reviewGraduated,
      ...mistakeState
    });
  } catch (error) {
    console.error('更新学习进度失败:', error);
    res.status(500).json({ error: '更新学习进度失败' });
  }
});

module.exports = router;
