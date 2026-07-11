# 考研英语背单词网站

一个基于 React + Node.js 的智能背单词网站，支持传统背单词和例句模式。

## 功能特性

### 学习仪表盘
- 词书可视化展示
- 学习进度统计（已学单词数、学习占比）
- 学习时间统计（总学习时间、日均学习时间）
- 预计完成时间
- 待复习单词数量

### 智能熟练度评估
- 根据选择速度评估记忆强度
- 根据准确率评估掌握程度
- 基于艾宾浩斯遗忘曲线的复习提醒

### 两种学习模式
1. **传统背单词模式**
   - 单词卡片翻转显示
   - 显示音标、释义、例句

2. **例句模式**
   - 长句子中包含目标单词
   - 选择题形式（选择正确释义）
   - 填空题形式（填写单词）
   - 每个意思都有独立例句

### 数据结构
- 1000 个核心考研词汇
- 每个单词 3 个主要意思
- 3000 条记忆单元
- 每个记忆单元有独立例句

## 技术栈

### 前端
- React 18
- TypeScript
- Tailwind CSS
- React Router
- Zustand (状态管理)
- Recharts (图表)

### 后端
- Node.js
- Express
- SQLite (better-sqlite3)
- 艾宾浩斯复习算法

## 项目结构

```
背单词/
├── frontend/          # React 前端
│   ├── src/
│   │   ├── components/  # 组件
│   │   ├── pages/       # 页面
│   │   ├── stores/      # 状态管理
│   │   ├── utils/       # 工具函数
│   │   └── types/       # TypeScript 类型
│   └── package.json
├── backend/           # Node.js 后端
│   ├── src/
│   │   ├── routes/      # API 路由
│   │   ├── models/      # 数据模型
│   │   ├── services/    # 业务逻辑
│   │   └── utils/       # 工具函数
│   ├── data/            # 词库数据
│   └── package.json
└── README.md
```

## 快速开始

### 1. 安装依赖

```bash
# 安装后端依赖
cd backend
npm install

# 安装前端依赖
cd ../frontend
npm install
```

### 2. 初始化数据库

```bash
cd backend
npm run init-db
```

### 3. 启动服务

```bash
# 启动后端（默认端口 3001）
cd backend
npm start

# 启动前端（默认端口 3000）
cd frontend
npm start
```

### 4. 访问应用

打开浏览器访问 http://localhost:3000

## 词库来源

使用开源考研英语词汇库，包含：
- 考研核心词汇约 5500 个
- 每个单词包含：音标、释义、例句、词组

## 贡献

欢迎提交 Issue 和 Pull Request！

## 许可证

MIT License