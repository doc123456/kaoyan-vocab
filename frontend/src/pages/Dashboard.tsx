import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Area, Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Stats, StatsItem, TestSession } from '../types';
import { getStats, getStatsItems, getTestSessions } from '../utils/api';

type DetailKind = 'all' | 'learned' | 'review' | 'mistakes' | 'today' | 'tests';

const forecastTicks = [0, 12 * 60, 24 * 60, 48 * 60, 72 * 60, 96 * 60, 120 * 60];

const formatRelativeForecastTick = (value: number) => {
  if (value === 0) return '现在';
  const hours = value / 60;
  if (hours < 24) return `+${Math.round(hours)}h`;
  return `+${Math.round(hours / 24)}d`;
};

const detailTitles: Record<DetailKind, string> = {
  all: '词书记忆单元',
  learned: '已学习记忆单元',
  review: '待复习记忆单元',
  mistakes: '错题本',
  today: '今日学习记忆单元',
  tests: '测试记录'
};

const formatDuration = (seconds: number) => {
  const safeSeconds = Math.max(0, Math.floor(seconds || 0));
  const minutes = Math.floor(safeSeconds / 60);
  const restSeconds = safeSeconds % 60;
  return `${minutes}分${String(restSeconds).padStart(2, '0')}秒`;
};

const parseUtcDate = (value?: string | null) => {
  if (!value) return null;
  const normalized = value.includes('T') ? value : `${value.replace(' ', 'T')}Z`;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatLocalDateTime = (value: string) => {
  const date = parseUtcDate(value);
  if (!date) return value;

  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).format(date);
};

const formatCountdown = (target: Date | null, now: number) => {
  if (!target) return '暂无计划';
  const diffSeconds = Math.max(0, Math.ceil((target.getTime() - now) / 1000));
  if (diffSeconds === 0) return '即将增加';
  const days = Math.floor(diffSeconds / 86400);
  const hours = Math.floor((diffSeconds % 86400) / 3600);
  const minutes = Math.floor((diffSeconds % 3600) / 60);
  const seconds = diffSeconds % 60;
  if (days > 0) return `${days}天${hours}小时`;
  if (hours > 0) return `${hours}小时${minutes}分`;
  if (minutes > 0) return `${minutes}分${seconds}秒`;
  return `${seconds}秒`;
};

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailKind, setDetailKind] = useState<DetailKind | null>(null);
  const [detailItems, setDetailItems] = useState<StatsItem[]>([]);
  const [testSessions, setTestSessions] = useState<TestSession[]>([]);
  const [now, setNow] = useState(Date.now());
  const [lastReviewRefreshAt, setLastReviewRefreshAt] = useState(0);

  const fetchStats = async () => {
    try {
      const response = await getStats();
      setStats(response.data);
    } catch (error) {
      console.error('获取统计数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    const timer = window.setInterval(fetchStats, 30000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const nextReviewAt = parseUtcDate(stats?.nextReviewAt);
    if (!nextReviewAt || nextReviewAt.getTime() > now) return;
    if (now - lastReviewRefreshAt < 5000) return;
    setLastReviewRefreshAt(now);
    fetchStats();
  }, [lastReviewRefreshAt, now, stats?.nextReviewAt]);

  const openDetail = async (kind: DetailKind) => {
    setDetailKind(kind);
    if (kind === 'tests') {
      const response = await getTestSessions();
      setTestSessions(response.data);
      setDetailItems([]);
      return;
    }

    const response = await getStatsItems(kind);
    setDetailItems(response.data);
    setTestSessions([]);
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-xl text-gray-500">加载中...</div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-xl text-gray-500">获取数据失败</div>
      </div>
    );
  }

  const masteryColors = ['bg-gray-400', 'bg-red-400', 'bg-orange-400', 'bg-yellow-400', 'bg-green-400', 'bg-blue-500', 'bg-violet-600'];
  const masteryTotal = Math.max(stats.learnedMeanings, 1);
  const nextReviewAt = parseUtcDate(stats.nextReviewAt);
  const testScoreData = [...testSessions]
    .sort((a, b) => {
      const left = parseUtcDate(a.created_at)?.getTime() || 0;
      const right = parseUtcDate(b.created_at)?.getTime() || 0;
      return left === right ? a.id - b.id : left - right;
    })
    .map((item, index) => ({
      testNo: index + 1,
      label: `第${index + 1}次`,
      score: item.score,
      time: formatLocalDateTime(item.created_at)
    }));

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-800">学习仪表盘</h1>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <button onClick={() => openDetail('all')} className="rounded-lg bg-white p-5 text-left shadow transition hover:shadow-md">
          <div className="text-sm font-medium text-gray-500">词书总记忆单元</div>
          <div className="mt-2 text-3xl font-bold text-primary-600">{stats.totalMeanings}</div>
          <div className="mt-1 text-sm text-gray-400">{stats.totalWords} 个单词</div>
        </button>
        <button onClick={() => openDetail('learned')} className="rounded-lg bg-white p-5 text-left shadow transition hover:shadow-md">
          <div className="text-sm font-medium text-gray-500">已学习</div>
          <div className="mt-2 text-3xl font-bold text-green-600">{stats.learnedMeanings}</div>
          <div className="mt-1 text-sm text-gray-400">{stats.progressPercentage}% 完成</div>
        </button>
        <button onClick={() => openDetail('review')} className="relative rounded-lg bg-white p-5 text-left shadow transition hover:shadow-md">
          <div className="absolute right-3 top-3 rounded bg-orange-50 px-2 py-1 text-xs text-orange-700">
            {formatCountdown(nextReviewAt, now)}
          </div>
          <div className="text-sm font-medium text-gray-500">待复习</div>
          <div className="mt-2 text-3xl font-bold text-orange-600">{stats.reviewDueCount}</div>
          <div className="mt-1 text-sm text-gray-400">当前已到期</div>
        </button>
        <button onClick={() => openDetail('today')} className="rounded-lg bg-white p-5 text-left shadow transition hover:shadow-md">
          <div className="text-sm font-medium text-gray-500">今日学习</div>
          <div className="mt-2 text-3xl font-bold text-purple-600">{stats.todayLearned}</div>
          <div className="mt-1 text-sm text-gray-400">个记忆单元</div>
        </button>
        <button onClick={() => openDetail('tests')} className="rounded-lg bg-white p-5 text-left shadow transition hover:shadow-md">
          <div className="text-sm font-medium text-gray-500">近 5 次测试均分</div>
          <div className="mt-2 text-3xl font-bold text-blue-600">{stats.recentTestAverage}%</div>
          <div className="mt-1 text-sm text-gray-400">查看所有测试记录</div>
        </button>
        <button onClick={() => openDetail('mistakes')} className="rounded-lg bg-white p-5 text-left shadow transition hover:shadow-md">
          <div className="text-sm font-medium text-gray-500">错题本数量</div>
          <div className="mt-2 text-3xl font-bold text-red-600">{stats.mistakeBookCount}</div>
          <div className="mt-1 text-sm text-gray-400">连续 3 次正确移出</div>
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_1.35fr_1fr]">
        <div className="rounded-lg bg-white p-6 shadow">
          <h2 className="mb-4 text-lg font-semibold text-gray-800">学习进度</h2>
          <div className="mb-4">
            <div className="mb-1 flex justify-between text-sm text-gray-600">
              <span>已学习 {stats.learnedMeanings} / {stats.totalMeanings}</span>
              <span>{stats.progressPercentage}%</span>
            </div>
            <div className="h-4 w-full rounded-full bg-gray-200">
              <div className="h-4 rounded-full bg-primary-600 transition-all duration-500" style={{ width: `${stats.progressPercentage}%` }} />
            </div>
          </div>
          <div className="mt-6">
            <h3 className="mb-3 text-sm font-medium text-gray-600">掌握程度分布</h3>
            <div className="space-y-2">
              {stats.masteryDistribution.map((item) => (
                <div key={item.mastery_level} className="flex items-center">
                  <span className="w-24 text-sm text-gray-500">L{item.mastery_level} {item.label}</span>
                  <div className="mx-2 h-2 flex-1 rounded-full bg-gray-200">
                    <div className={`h-2 rounded-full ${masteryColors[item.mastery_level] || 'bg-blue-600'}`} style={{ width: `${(item.count / masteryTotal) * 100}%` }} />
                  </div>
                  <span className="w-12 text-right text-sm text-gray-600">{item.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-lg bg-white p-6 shadow">
          <h2 className="mb-4 text-lg font-semibold text-gray-800">未来 5 天复习曲线</h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={stats.reviewForecast}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="minutesFromNow" type="number" domain={[0, 120 * 60]} ticks={forecastTicks} tickFormatter={formatRelativeForecastTick} />
                <YAxis allowDecimals={false} />
                <Tooltip
                  labelFormatter={(_, payload) => {
                    const item = payload?.[0]?.payload;
                    return item ? `${item.label}，${item.time}` : '';
                  }}
                />
                <Area type="monotone" dataKey="dueCount" name="累计待复习" fill="#f97316" stroke="#ea580c" fillOpacity={0.2} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-lg bg-white p-6 shadow">
          <h2 className="mb-4 text-lg font-semibold text-gray-800">学习时间</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b py-3">
              <span className="text-gray-600">总学习时间</span>
              <span className="text-lg font-semibold">{stats.totalStudyTime} 分钟</span>
            </div>
            <div className="flex items-center justify-between border-b py-3">
              <span className="text-gray-600">今日学习时间</span>
              <span className="text-lg font-semibold">{stats.todayStudyTime} 分钟</span>
            </div>
            <div className="flex items-center justify-between border-b py-3">
              <span className="text-gray-600">学习天数</span>
              <span className="text-lg font-semibold">{stats.studyDays} 天</span>
            </div>
            <div className="flex items-center justify-between border-b py-3">
              <span className="text-gray-600">日均学习时间</span>
              <span className="text-lg font-semibold">{stats.avgDailyStudyTime} 分钟</span>
            </div>
            <div className="flex items-center justify-between py-3">
              <span className="text-gray-600">预计完成时间</span>
              <span className="text-lg font-semibold">{stats.estimatedDays ? `${stats.estimatedDays} 天` : '待计算'}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-lg bg-white p-6 shadow">
        <h2 className="mb-4 text-lg font-semibold text-gray-800">最近 30 天学习趋势</h2>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={stats.recentStudyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" interval={0} angle={-35} textAnchor="end" height={60} tickFormatter={(value) => value.slice(5)} />
              <YAxis yAxisId="count" allowDecimals={false} />
              <YAxis yAxisId="time" orientation="right" allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Bar yAxisId="count" dataKey="meaningCount" name="记忆单元数量" fill="#3b82f6" />
              <Line yAxisId="time" type="monotone" dataKey="studyTime" name="学习时间（分钟）" stroke="#10b981" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-lg bg-white p-6 shadow">
        <h2 className="mb-3 text-lg font-semibold text-gray-800">学习趋势总结</h2>
        <p className="leading-7 text-gray-700">{stats.learningSummary}</p>
      </div>

      {detailKind && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[80vh] w-full max-w-3xl overflow-hidden rounded-lg bg-white shadow-xl">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-800">{detailTitles[detailKind]}</h2>
              <div className="flex items-center gap-2">
                {detailKind === 'review' && (
                  <Link to="/traditional?review=1" className="rounded bg-primary-600 px-3 py-1 text-sm text-white hover:bg-primary-700">
                    开始复习
                  </Link>
                )}
                {detailKind === 'mistakes' && (
                  <Link to="/traditional?mistakes=1" className="rounded bg-primary-600 px-3 py-1 text-sm text-white hover:bg-primary-700">
                    开始练习
                  </Link>
                )}
                {detailKind === 'tests' && (
                  <Link to="/test" className="rounded bg-primary-600 px-3 py-1 text-sm text-white hover:bg-primary-700">
                    开始测试
                  </Link>
                )}
                <button onClick={() => setDetailKind(null)} className="rounded px-3 py-1 text-gray-500 hover:bg-gray-100">关闭</button>
              </div>
            </div>
            <div className="max-h-[65vh] overflow-y-auto p-6">
              {detailKind === 'tests' ? (
                <div className="space-y-4">
                  {testScoreData.length > 0 && (
                    <div className="rounded-lg border border-gray-100 p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <h3 className="text-base font-semibold text-gray-800">测试分数趋势</h3>
                        <span className="text-xs text-gray-400">按测试时间正序</span>
                      </div>
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <ComposedChart data={testScoreData} margin={{ top: 8, right: 18, bottom: 8, left: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="label" />
                            <YAxis domain={[0, 100]} tickFormatter={(value) => `${value}%`} />
                            <Tooltip
                              formatter={(value) => [`${value}%`, '得分']}
                            />
                            <Line type="monotone" dataKey="score" name="得分" stroke="#2563eb" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                          </ComposedChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}
                  {testSessions.map((item) => (
                    <div key={item.id} className="grid grid-cols-2 gap-3 rounded border border-gray-100 p-3 text-sm md:grid-cols-4">
                      <div>
                        <div className="text-xs text-gray-400">时间</div>
                        <div className="font-medium text-gray-800">{formatLocalDateTime(item.created_at)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-400">得分</div>
                        <div className="font-semibold text-blue-600">{item.score}%</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-400">答对</div>
                        <div className="text-gray-700">{item.correct_count} / {item.total_count}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-400">用时</div>
                        <div className="text-gray-700">{formatDuration(item.duration)}</div>
                      </div>
                    </div>
                  ))}
                  {testSessions.length === 0 && <div className="py-8 text-center text-gray-500">暂无测试记录</div>}
                </div>
              ) : (
                <div className="space-y-2">
                  {detailItems.map((item) => (
                    <div key={item.meaning_id} className="rounded border border-gray-100 p-3">
                      <div className="font-semibold text-gray-800">{item.word}</div>
                      <div className="text-sm text-gray-600">{item.part_of_speech} {item.meaning_cn}</div>
                      <div className="mt-1 text-xs text-gray-400">L{item.mastery_level}{item.next_review_at ? ` · 下次复习 ${item.next_review_at}` : ''}</div>
                    </div>
                  ))}
                  {detailItems.length === 0 && <div className="py-8 text-center text-gray-500">暂无数据</div>}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
