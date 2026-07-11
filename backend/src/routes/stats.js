const express = require('express');
const router = express.Router();

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

function getSingleValue(result) {
  if (!result || result.length === 0) return 0;
  return result[0].values[0][0] || 0;
}

const masteryLabels = ['未掌握', '初学', '认识', '熟悉', '掌握', '精通', '免复习'];

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatHourLabel(date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  return `${month}-${day} ${hour}:${minute}`;
}

function formatRelativeMinutes(minutes) {
  if (minutes === 0) return '现在';
  if (minutes < 60) return `+${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours < 24) return remainingMinutes === 0 ? `+${hours}h` : `+${hours}h${remainingMinutes}m`;
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return remainingHours === 0 ? `+${days}d` : `+${days}d${remainingHours}h`;
}

function getLearningSummary({ recentStudyData, masteryDistribution, mistakeBookCount, recentTestAverage }) {
  const last7 = recentStudyData.slice(-7);
  const previous7 = recentStudyData.slice(-14, -7);
  const last7Meanings = last7.reduce((sum, day) => sum + day.meaningCount, 0);
  const previous7Meanings = previous7.reduce((sum, day) => sum + day.meaningCount, 0);
  const last7Time = last7.reduce((sum, day) => sum + day.studyTime, 0);
  const activeDays = last7.filter(day => day.meaningCount > 0 || day.studyTime > 0).length;
  const learnedTotal = masteryDistribution.reduce((sum, item) => sum + item.count, 0);
  const solidTotal = masteryDistribution
    .filter(item => item.mastery_level >= 3)
    .reduce((sum, item) => sum + item.count, 0);
  const solidRatio = learnedTotal > 0 ? solidTotal / learnedTotal : 0;

  if (activeDays === 0) {
    return '最近 7 天没有新的学习记录，建议先恢复每天 10-15 分钟的短时复习，让复习队列重新滚动起来。';
  }

  if (mistakeBookCount > Math.max(20, learnedTotal * 0.25)) {
    return '错题本占比偏高，最近更适合以错题专练和辅助记忆为主，先把连续正确率拉回来。';
  }

  if (solidRatio >= 0.65 && recentTestAverage >= 80) {
    return '近期掌握度和测试正确率都不错，可以继续推进新记忆单元，同时保留短间隔复习。';
  }

  if (last7Meanings < previous7Meanings * 0.7 && previous7Meanings > 0) {
    return '最近 7 天学习量比前一周明显下降，建议降低单次负担，但保持每天至少一次复习。';
  }

  if (last7Time > 0 && last7Meanings / last7Time < 4) {
    return '最近单位时间新增记忆单元偏少，可能复习压力较大；建议先清理待复习和错题，再继续扩展新词。';
  }

  return '最近学习节奏基本稳定，建议继续保持“新学少量 + 多次复习 + 错题清理”的组合。';
}

router.get('/', (req, res) => {
  try {
    const totalWords = getSingleValue(req.db.exec('SELECT COUNT(*) as count FROM words'));
    const totalMeanings = getSingleValue(req.db.exec('SELECT COUNT(*) as count FROM meanings'));
    const learnedMeanings = getSingleValue(req.db.exec('SELECT COUNT(*) as count FROM user_progress'));
    const masteredMeanings = getSingleValue(req.db.exec('SELECT COUNT(*) as count FROM user_progress WHERE mastery_level >= 3'));
    const reviewDueCount = getSingleValue(req.db.exec(`
      SELECT COUNT(*) as count
      FROM user_progress
      WHERE COALESCE(review_graduated, 0) = 0
        AND (
          datetime(replace(replace(next_review_at, 'T', ' '), 'Z', '')) <= datetime('now')
          OR next_review_at IS NULL
        )
    `));
    const mistakeBookCount = getSingleValue(req.db.exec(`
      SELECT COUNT(*) as count
      FROM mistake_book
      WHERE active = 1
    `));
    const todayLearned = getSingleValue(req.db.exec(`
      SELECT COUNT(DISTINCT meaning_id) as count
      FROM study_logs
      WHERE date(created_at) = date('now')
    `));
    const totalStudyTimeSeconds = getSingleValue(req.db.exec(`
      SELECT COALESCE(SUM(duration), 0) as total
      FROM study_time_logs
    `));
    const totalStudyTime = Math.round((totalStudyTimeSeconds / 60) * 10) / 10;
    const todayStudyTimeSeconds = getSingleValue(req.db.exec(`
      SELECT COALESCE(SUM(duration), 0) as total
      FROM study_time_logs
      WHERE date(created_at, 'localtime') = date('now', 'localtime')
    `));
    const todayStudyTime = Math.round((todayStudyTimeSeconds / 60) * 10) / 10;
    const studyDays = getSingleValue(req.db.exec(`
      SELECT COUNT(DISTINCT date(created_at)) as count
      FROM study_logs
    `));
    const avgDailyStudyTime = studyDays > 0 ? Math.round((totalStudyTime / studyDays) * 10) / 10 : 0;
    const remainingMeanings = totalMeanings - learnedMeanings;
    const dailyAvgLearned = studyDays > 0 ? learnedMeanings / studyDays : 0;
    const estimatedDays = dailyAvgLearned > 0 ? Math.ceil(remainingMeanings / dailyAvgLearned) : null;
    const progressPercentage = totalMeanings > 0 ? parseFloat((learnedMeanings / totalMeanings * 100).toFixed(2)) : 0;

    const masteryResult = req.db.exec(`
      SELECT mastery_level, COUNT(*) as count
      FROM user_progress
      GROUP BY mastery_level
      ORDER BY mastery_level
    `);
    const learnedByLevel = new Map(queryToObjects(masteryResult).map(item => [item.mastery_level, item.count]));
    const masteryDistribution = masteryLabels.map((label, level) => ({
      mastery_level: level,
      label,
      count: learnedByLevel.get(level) || 0
    }));

    const recentStudyRows = queryToObjects(req.db.exec(`
      SELECT
        date(study_logs.created_at) as date,
        COUNT(DISTINCT study_logs.meaning_id) as meaning_count,
        COUNT(DISTINCT w.id) as word_count
      FROM study_logs
      JOIN meanings m ON study_logs.meaning_id = m.id
      JOIN words w ON m.word_id = w.id
      WHERE study_logs.created_at >= datetime('now', '-29 days')
      GROUP BY date(study_logs.created_at)
      ORDER BY date
    `));
    const studyByDate = new Map(recentStudyRows.map(row => [row.date, row]));
    const timeByDate = new Map(queryToObjects(req.db.exec(`
      SELECT
        date(created_at) as date,
        ROUND(COALESCE(SUM(duration), 0) / 60.0, 1) as study_time
      FROM study_time_logs
      WHERE created_at >= datetime('now', '-29 days')
      GROUP BY date(created_at)
      ORDER BY date
    `)).map(row => [row.date, row.study_time]));

    const recentStudyData = [];
    const today = new Date();
    for (let i = 29; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      const dateText = formatDate(date);
      const studyRow = studyByDate.get(dateText) || {};
      recentStudyData.push({
        date: dateText,
        wordCount: studyRow.word_count || 0,
        meaningCount: studyRow.meaning_count || 0,
        studyTime: timeByDate.get(dateText) || 0
      });
    }

    const reviewRows = queryToObjects(req.db.exec(`
      SELECT next_review_at
      FROM user_progress
      WHERE COALESCE(review_graduated, 0) = 0
        AND next_review_at IS NOT NULL
        AND datetime(replace(replace(next_review_at, 'T', ' '), 'Z', '')) <= datetime('now', '+5 days')
      ORDER BY datetime(replace(replace(next_review_at, 'T', ' '), 'Z', '')) ASC
    `));
    const dueTimes = reviewRows
      .map(row => new Date(row.next_review_at).getTime())
      .filter(time => !Number.isNaN(time));
    const reviewForecast = [];
    const now = new Date();
    for (let minutes = 0; minutes <= 120 * 60; minutes += 30) {
      const point = new Date(now.getTime() + minutes * 60 * 1000);
      const pointTime = point.getTime();
      reviewForecast.push({
        minutesFromNow: minutes,
        hoursFromNow: minutes / 60,
        label: formatRelativeMinutes(minutes),
        time: formatHourLabel(point),
        dueCount: dueTimes.filter(time => time <= pointTime).length
      });
    }

    const nextReviewRow = queryToObjects(req.db.exec(`
      SELECT next_review_at
      FROM user_progress
      WHERE COALESCE(review_graduated, 0) = 0
        AND next_review_at IS NOT NULL
        AND datetime(replace(replace(next_review_at, 'T', ' '), 'Z', '')) > datetime('now')
      ORDER BY datetime(replace(replace(next_review_at, 'T', ' '), 'Z', '')) ASC
      LIMIT 1
    `))[0];
    const nextReviewAt = nextReviewRow ? nextReviewRow.next_review_at : null;

    const recentTestRows = queryToObjects(req.db.exec(`
      SELECT score
      FROM test_sessions
      ORDER BY created_at DESC
      LIMIT 5
    `));
    const recentTestAverage = recentTestRows.length > 0
      ? Math.round((recentTestRows.reduce((sum, item) => sum + item.score, 0) / recentTestRows.length) * 10) / 10
      : 0;

    const learningSummary = getLearningSummary({
      recentStudyData,
      masteryDistribution,
      mistakeBookCount,
      recentTestAverage
    });

    res.json({
      totalWords,
      totalMeanings,
      learnedMeanings,
      masteredMeanings,
      reviewDueCount,
      mistakeBookCount,
      todayLearned,
      totalStudyTime,
      todayStudyTime,
      studyDays,
      avgDailyStudyTime,
      estimatedDays,
      progressPercentage,
      masteryDistribution,
      recentStudyData,
      reviewForecast,
      nextReviewAt,
      recentTestAverage,
      learningSummary
    });
  } catch (error) {
    console.error('获取统计数据失败:', error);
    res.status(500).json({ error: '获取统计数据失败' });
  }
});

router.get('/items/:kind', (req, res) => {
  try {
    const { kind } = req.params;
    let sql = `
      SELECT
        m.id as meaning_id,
        w.word,
        m.part_of_speech,
        m.meaning_cn,
        COALESCE(up.mastery_level, 0) as mastery_level,
        up.next_review_at
      FROM meanings m
      JOIN words w ON m.word_id = w.id
      LEFT JOIN user_progress up ON m.id = up.meaning_id
    `;

    if (kind === 'learned') {
      sql += ' WHERE up.meaning_id IS NOT NULL ORDER BY up.last_reviewed_at DESC LIMIT 300';
    } else if (kind === 'today') {
      sql += " JOIN study_logs sl ON m.id = sl.meaning_id WHERE date(sl.created_at) = date('now') GROUP BY m.id ORDER BY MAX(sl.created_at) DESC LIMIT 300";
    } else if (kind === 'review') {
      sql += " WHERE up.meaning_id IS NOT NULL AND COALESCE(up.review_graduated, 0) = 0 AND (datetime(replace(replace(up.next_review_at, 'T', ' '), 'Z', '')) <= datetime('now') OR up.next_review_at IS NULL) ORDER BY up.next_review_at ASC LIMIT 300";
    } else if (kind === 'mistakes') {
      sql += ' JOIN mistake_book mb ON m.id = mb.meaning_id AND mb.active = 1 ORDER BY mb.updated_at DESC LIMIT 300';
    } else {
      sql += ' ORDER BY w.word ASC, m.meaning_index ASC LIMIT 300';
    }

    res.json(queryToObjects(req.db.exec(sql)));
  } catch (error) {
    console.error('获取明细失败:', error);
    res.status(500).json({ error: '获取明细失败' });
  }
});

router.get('/tests', (req, res) => {
  try {
    const result = req.db.exec(`
      SELECT
        id,
        total_count,
        correct_count,
        score,
        duration,
        created_at
      FROM test_sessions
      ORDER BY created_at DESC, id DESC
    `);

    res.json(queryToObjects(result));
  } catch (error) {
    console.error('获取测试记录失败:', error);
    res.status(500).json({ error: '获取测试记录失败' });
  }
});

router.post('/study-time', (req, res) => {
  try {
    const duration = Math.max(0, Math.floor(Number(req.body.duration) || 0));
    if (duration === 0) {
      res.json({ success: true });
      return;
    }

    req.db.run(`
      INSERT INTO study_time_logs (start_time, end_time, duration)
      VALUES (datetime('now', '-' || ? || ' seconds'), datetime('now'), ?)
    `, [duration, duration]);
    req.saveDb();

    res.json({ success: true });
  } catch (error) {
    console.error('记录学习时间失败:', error);
    res.status(500).json({ error: '记录学习时间失败' });
  }
});

module.exports = router;
