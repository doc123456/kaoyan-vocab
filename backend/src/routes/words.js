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

// 获取所有单词列表
router.get('/', (req, res) => {
  try {
    const result = req.db.exec(`
      SELECT 
        w.id,
        w.word,
        w.phonetic_uk,
        w.phonetic_us,
        COUNT(m.id) as meaning_count
      FROM words w
      LEFT JOIN meanings m ON w.id = m.word_id
      GROUP BY w.id
      ORDER BY w.word
    `);
    
    res.json(queryToObjects(result));
  } catch (error) {
    console.error('获取单词列表失败:', error);
    res.status(500).json({ error: '获取单词列表失败' });
  }
});

// 搜索单词
router.get('/search/:keyword', (req, res) => {
  try {
    const { keyword } = req.params;
    
    const result = req.db.exec(`
      SELECT 
        w.id,
        w.word,
        w.phonetic_uk,
        w.phonetic_us,
        GROUP_CONCAT(DISTINCT m.meaning_cn) as meanings
      FROM words w
      LEFT JOIN meanings m ON w.id = m.word_id
      WHERE w.word LIKE ? OR m.meaning_cn LIKE ?
      GROUP BY w.id
      LIMIT 20
    `, [`%${keyword}%`, `%${keyword}%`]);
    
    res.json(queryToObjects(result));
  } catch (error) {
    console.error('搜索单词失败:', error);
    res.status(500).json({ error: '搜索单词失败' });
  }
});

// 获取单词详情（包含所有释义和例句）
router.get('/:id', (req, res) => {
  try {
    const { id } = req.params;
    
    // 获取单词基本信息
    const wordResult = req.db.exec('SELECT * FROM words WHERE id = ?', [id]);
    const words = queryToObjects(wordResult);
    
    if (words.length === 0) {
      return res.status(404).json({ error: '单词不存在' });
    }
    
    const word = words[0];
    
    // 获取所有释义
    const meaningsResult = req.db.exec('SELECT * FROM meanings WHERE word_id = ? ORDER BY meaning_index', [id]);
    const meanings = queryToObjects(meaningsResult);
    
    // 获取每个释义的例句
    for (let meaning of meanings) {
      const examplesResult = req.db.exec('SELECT * FROM examples WHERE meaning_id = ?', [meaning.id]);
      meaning.examples = queryToObjects(examplesResult);
    }
    
    word.meanings = meanings;
    
    res.json(word);
  } catch (error) {
    console.error('获取单词详情失败:', error);
    res.status(500).json({ error: '获取单词详情失败' });
  }
});

module.exports = router;
