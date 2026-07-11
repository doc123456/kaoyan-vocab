# 项目测试指南

## 测试后端

### 1. 启动后端服务器

```bash
cd backend
npm start
```

### 2. 测试 API 接口

打开新的命令行窗口，使用 curl 测试：

```bash
# 获取所有单词
curl http://localhost:3001/api/words

# 获取统计数据
curl http://localhost:3001/api/stats

# 获取传统背单词数据
curl http://localhost:3001/api/study/traditional

# 获取例句模式数据
curl http://localhost:3001/api/study/sentence
```

## 测试前端

### 1. 启动前端服务器

```bash
cd frontend
npm start
```

### 2. 访问应用

打开浏览器访问 http://localhost:3000

### 3. 测试功能

1. **学习仪表盘**
   - 查看统计数据是否正确显示
   - 查看学习进度图表

2. **传统背单词**
   - 点击"显示释义"查看答案
   - 选择"认识"或"不认识"
   - 验证进度条是否更新

3. **例句模式**
   - 查看例句是否正确显示
   - 选择答案后查看结果
   - 点击"下一题"继续

## 预期结果

### 后端 API 响应

**GET /api/words**
```json
[
  {
    "id": 1,
    "word": "abandon",
    "phonetic_uk": "/əˈbændən/",
    "phonetic_us": "/əˈbændən/",
    "meaning_count": 3
  },
  ...
]
```

**GET /api/stats**
```json
{
  "totalWords": 5,
  "totalMeanings": 12,
  "learnedMeanings": 0,
  "masteredMeanings": 0,
  "reviewDueCount": 12,
  "todayLearned": 0,
  "totalStudyTime": 0,
  "studyDays": 0,
  "avgDailyStudyTime": 0,
  "estimatedDays": null,
  "progressPercentage": 0,
  "masteryDistribution": [],
  "recentStudyData": []
}
```

## 常见问题排查

### 问题 1: 后端启动失败
**错误**: `Cannot find module 'better-sqlite3'`

**解决**: 
```bash
cd backend
npm install
```

### 问题 2: 前端启动失败
**错误**: `Module not found: Error: Can't resolve 'react'`

**解决**:
```bash
cd frontend
npm install
```

### 问题 3: 数据库初始化失败
**错误**: `SQLITE_ERROR: table words already exists`

**解决**: 删除旧数据库后重新初始化
```bash
rm backend/data/vocab.db
cd backend
npm run init-db
```

### 问题 4: API 请求失败
**错误**: `Failed to fetch` 或 `Network Error`

**解决**: 
1. 确保后端服务器正在运行
2. 检查端口是否被占用
3. 检查浏览器控制台是否有错误信息

## 下一步

测试成功后，你可以：

1. **导入更多词库**
   - 从 GitHub 下载考研词库
   - 转换为项目需要的 JSON 格式
   - 替换 `backend/data/vocab_data.json`

2. **自定义样式**
   - 修改 `frontend/src/index.css`
   - 调整 Tailwind 配置

3. **添加新功能**
   - 听力练习模式
   - 单词收藏夹
   - 学习提醒功能

4. **部署到生产环境**
   - 构建前端项目
   - 部署到服务器或云平台