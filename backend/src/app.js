const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const initSqlJs = require('sql.js');

const app = express();
const PORT = process.env.PORT || 3001;

// 数据库路径
const dbPath = path.join(__dirname, '../data/vocab.db');

// 全局数据库实例
let db = null;

// 中间件
app.use(cors());
app.use(express.json());

// 初始化数据库
async function initDb() {
  const SQL = await initSqlJs();
  
  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS mistake_book (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      meaning_id INTEGER NOT NULL UNIQUE,
      active INTEGER DEFAULT 1,
      consecutive_correct INTEGER DEFAULT 0,
      wrong_count INTEGER DEFAULT 0,
      last_wrong_at DATETIME,
      resolved_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (meaning_id) REFERENCES meanings(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS test_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      total_count INTEGER NOT NULL,
      correct_count INTEGER NOT NULL,
      score REAL NOT NULL,
      duration INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const progressColumns = db.exec(`PRAGMA table_info(user_progress)`);
  const progressColumnNames = progressColumns.length > 0
    ? progressColumns[0].values.map(row => row[1])
    : [];
  if (!progressColumnNames.includes('correct_streak')) {
    db.run(`ALTER TABLE user_progress ADD COLUMN correct_streak INTEGER DEFAULT 0`);
  }
  if (!progressColumnNames.includes('review_graduated')) {
    db.run(`ALTER TABLE user_progress ADD COLUMN review_graduated INTEGER DEFAULT 0`);
  }
  db.run(`
    UPDATE user_progress
    SET mastery_level = 6
    WHERE COALESCE(review_graduated, 0) = 1
      AND mastery_level < 6
  `);

  db.run(`
    INSERT OR IGNORE INTO mistake_book (
      meaning_id,
      active,
      consecutive_correct,
      wrong_count,
      last_wrong_at,
      updated_at
    )
    SELECT
      up.meaning_id,
      1,
      0,
      up.incorrect_count,
      up.last_reviewed_at,
      datetime('now')
    FROM user_progress up
    WHERE up.incorrect_count > 0
  `);

  saveDb();
  
  console.log('数据库连接成功');
}

function saveDb() {
  if (!db) return;
  const data = db.export();
  fs.writeFileSync(dbPath, Buffer.from(data));
}

// 数据库中间件
app.use((req, res, next) => {
  req.db = db;
  req.saveDb = saveDb;
  next();
});

// 路由
const wordsRouter = require('./routes/words');
const progressRouter = require('./routes/progress');
const studyRouter = require('./routes/study');
const statsRouter = require('./routes/stats');

app.use('/api/words', wordsRouter);
app.use('/api/progress', progressRouter);
app.use('/api/study', studyRouter);
app.use('/api/stats', statsRouter);

// 错误处理中间件
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: '服务器内部错误' });
});

// 启动服务器
initDb().then(() => {
  app.listen(PORT, () => {
    console.log(`服务器运行在 http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error('启动失败:', err);
  process.exit(1);
});

module.exports = app;
