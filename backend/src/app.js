const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');
const initSqlJs = require('sql.js');

const app = express();
const PORT = process.env.PORT || 3001;

// 数据库路径
const dbPath = path.join(__dirname, '../data/vocab.db');

// 全局数据库实例
let db = null;
let SQLRuntime = null;
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || '';
const runtimeDbPath = path.join(__dirname, '../data/vocab.db');

function seedDatabaseIfNeeded() {
  if (fs.existsSync(runtimeDbPath)) return Promise.resolve();
  return new Promise((resolve, reject) => {
    execFile(process.execPath, [path.join(__dirname, 'utils/initDb.js')], (error, _stdout, stderr) => {
      if (error) return reject(new Error(stderr || error.message));
      resolve();
    });
  });
}

// 中间件
app.use(cors());
app.use(express.json());

// 初始化数据库
async function initDb() {
  await seedDatabaseIfNeeded();
  SQLRuntime = await initSqlJs();
  const SQL = SQLRuntime;
  
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

async function supabaseRequest(pathname, token, options = {}) {
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY || !token) return null;
  const response = await fetch(`${SUPABASE_URL}${pathname}`, {
    ...options,
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: token,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  if (!response.ok) throw new Error(`Supabase request failed: ${response.status}`);
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

async function loadUserDatabase(req) {
  const authorization = req.headers.authorization;
  if (!authorization || !SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    req.db = db;
    req.saveDb = saveDb;
    return;
  }

  const user = await supabaseRequest('/auth/v1/user', authorization);
  if (!user?.id) {
    req.db = db;
    req.saveDb = saveDb;
    return;
  }

  const rows = await supabaseRequest(`/rest/v1/learning_state?user_id=eq.${encodeURIComponent(user.id)}&select=progress`, authorization);
  const encodedDb = rows?.[0]?.progress?.dbBase64;
  const sourceBytes = encodedDb
    ? Buffer.from(encodedDb, 'base64')
    : Buffer.from(db.export());
  const userDb = new SQLRuntime.Database(sourceBytes);

  req.db = userDb;
  req.saveDb = () => {
    const payload = JSON.stringify({ dbBase64: Buffer.from(userDb.export()).toString('base64') });
    void supabaseRequest(`/rest/v1/learning_state?user_id=eq.${encodeURIComponent(user.id)}`, authorization, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ progress: JSON.parse(payload), updated_at: new Date().toISOString() })
    }).catch(error => console.error('保存云端学习进度失败:', error));
  };
}

// 数据库中间件：登录用户使用自己的云端 SQLite 快照
app.use((req, res, next) => {
  loadUserDatabase(req).then(() => next()).catch(next);
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

// 生产环境由后端同时托管 React 构建产物，访客只需要一个网址。
const frontendBuildPath = path.join(__dirname, '../../frontend/build');
app.use(express.static(frontendBuildPath));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(frontendBuildPath, 'index.html'));
});

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
