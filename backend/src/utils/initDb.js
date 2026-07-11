const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

// 数据库路径
const dbPath = path.join(__dirname, '../../data/vocab.db');

// 删除旧数据库（如果存在）
if (fs.existsSync(dbPath)) {
  fs.unlinkSync(dbPath);
  console.log('已删除旧数据库');
}

// 辅助函数：获取单个值
function getSingleValue(result) {
  if (!result || result.length === 0) return 0;
  return result[0].values[0][0] || 0;
}

async function initDb() {
  // 初始化 SQL.js
  const SQL = await initSqlJs();
  
  // 创建新数据库
  const db = new SQL.Database();
  
  console.log('正在创建数据库表...');

  // 创建单词表
  db.run(`
    CREATE TABLE words (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      word TEXT NOT NULL UNIQUE,
      phonetic_uk TEXT,
      phonetic_us TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 创建释义表
  db.run(`
    CREATE TABLE meanings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      word_id INTEGER NOT NULL,
      meaning_index INTEGER NOT NULL,
      part_of_speech TEXT,
      meaning_cn TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (word_id) REFERENCES words(id),
      UNIQUE(word_id, meaning_index)
    )
  `);

  // 创建例句表
  db.run(`
    CREATE TABLE examples (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      meaning_id INTEGER NOT NULL,
      sentence_en TEXT NOT NULL,
      sentence_cn TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (meaning_id) REFERENCES meanings(id)
    )
  `);

  // 创建用户学习进度表
  db.run(`
    CREATE TABLE user_progress (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      meaning_id INTEGER NOT NULL UNIQUE,
      mastery_level INTEGER DEFAULT 0,
      correct_count INTEGER DEFAULT 0,
      incorrect_count INTEGER DEFAULT 0,
      correct_streak INTEGER DEFAULT 0,
      avg_response_time REAL DEFAULT 0,
      review_graduated INTEGER DEFAULT 0,
      last_reviewed_at DATETIME,
      next_review_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (meaning_id) REFERENCES meanings(id)
    )
  `);

  // 创建学习日志表
  db.run(`
    CREATE TABLE study_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      meaning_id INTEGER NOT NULL,
      is_correct BOOLEAN NOT NULL,
      response_time INTEGER NOT NULL,
      study_mode TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (meaning_id) REFERENCES meanings(id)
    )
  `);

  // 创建学习时间统计表
  db.run(`
    CREATE TABLE study_time_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      start_time DATETIME NOT NULL,
      end_time DATETIME NOT NULL,
      duration INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  console.log('数据库表创建完成！');

  // 导入词库数据
  console.log('正在导入词库数据...');

  // 读取词库数据
  const vocabDataPath = path.join(__dirname, '../../data/vocab_data.json');
  
  if (!fs.existsSync(vocabDataPath)) {
    console.log('词库数据文件不存在！');
    return;
  }

  const vocabData = JSON.parse(fs.readFileSync(vocabDataPath, 'utf-8'));
  
  let wordCount = 0;
  let meaningCount = 0;
  let exampleCount = 0;

  // 批量插入数据
  for (const item of vocabData) {
    // 插入单词（跳过重复）
    db.run(
      'INSERT OR IGNORE INTO words (word, phonetic_uk, phonetic_us) VALUES (?, ?, ?)',
      [item.word, item.phonetic_uk || null, item.phonetic_us || null]
    );
    
    // 获取单词 ID
    const wordIdResult = db.exec('SELECT id FROM words WHERE word = ?', [item.word]);
    if (!wordIdResult || wordIdResult.length === 0) continue;
    const wordId = wordIdResult[0].values[0][0];
    
    // 检查是否是新插入的单词（避免重复计数）
    const existingResult = db.exec('SELECT COUNT(*) FROM meanings WHERE word_id = ?', [wordId]);
    if (getSingleValue(existingResult) > 0) continue;
    
    wordCount++;
    
    // 插入释义
    if (item.meanings && Array.isArray(item.meanings)) {
      for (let i = 0; i < item.meanings.length; i++) {
        const meaning = item.meanings[i];
        db.run(
          'INSERT INTO meanings (word_id, meaning_index, part_of_speech, meaning_cn) VALUES (?, ?, ?, ?)',
          [wordId, i + 1, meaning.part_of_speech || null, meaning.meaning_cn]
        );
        meaningCount++;
        
        // 获取刚插入的释义 ID
        const meaningIdResult = db.exec('SELECT last_insert_rowid() as id');
        const meaningId = meaningIdResult[0].values[0][0];
        
        // 插入例句
        if (meaning.examples && Array.isArray(meaning.examples)) {
          for (const example of meaning.examples) {
            db.run(
              'INSERT INTO examples (meaning_id, sentence_en, sentence_cn) VALUES (?, ?, ?)',
              [meaningId, example.sentence_en, example.sentence_cn]
            );
            exampleCount++;
          }
        }
      }
    }
  }

  console.log(`数据导入完成！`);
  console.log(`- 单词数量: ${wordCount}`);
  console.log(`- 释义数量: ${meaningCount}`);
  console.log(`- 例句数量: ${exampleCount}`);

  // 保存数据库到文件
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(dbPath, buffer);
  
  console.log('数据库保存完成！');
  
  // 关闭数据库
  db.close();
}

initDb().catch(err => {
  console.error('初始化数据库失败:', err);
  process.exit(1);
});
