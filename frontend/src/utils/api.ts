import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 10000,
});

// 获取所有单词
export const getWords = () => api.get('/words');

// 获取单词详情
export const getWordDetail = (id: number) => api.get(`/words/${id}`);

// 搜索单词
export const searchWords = (keyword: string) => api.get(`/words/search/${keyword}`);

// 获取学习进度
export const getProgress = () => api.get('/progress');

// 获取待复习单词
export const getReviewDue = () => api.get('/progress/review');

// 更新学习进度
export const updateProgress = (meaningId: number, data: {
  is_correct: boolean;
  response_time: number;
  study_mode: string;
}) => api.post(`/progress/${meaningId}`, data);

// 获取传统背单词数据
export const getTraditionalStudyData = (limit?: number, mistakesOnly?: boolean, reviewOnly?: boolean, mode?: string, hardMode?: boolean) => 
  api.get('/study/traditional', { params: { limit, mistakesOnly, reviewOnly, mode, hardMode } });

// 获取例句模式数据
export const getSentenceStudyData = (limit?: number, mistakesOnly?: boolean) => 
  api.get('/study/sentence', { params: { limit, mistakesOnly } });

// 获取词组/固定搭配挖空练习数据
export const getPhraseStudyData = (limit?: number) =>
  api.get('/study/phrases', { params: { limit } });

// 获取填空模式数据
export const getFillBlankStudyData = (limit?: number) => 
  api.get('/study/fill-blank', { params: { limit } });

// 获取统计数据
export const getStats = () => api.get('/stats');

export const getStatsItems = (kind: string) => api.get(`/stats/items/${kind}`);

export const getTestSessions = () => api.get('/stats/tests');

export const getTestStudyData = (limit?: number) =>
  api.get('/study/test', { params: { limit } });

export const saveTestResult = (data: {
  total_count: number;
  correct_count: number;
  duration: number;
}) => api.post('/study/test-result', data);

// 记录学习时间
export const recordStudyTime = (duration: number) => 
  api.post('/stats/study-time', { duration });

export default api;
