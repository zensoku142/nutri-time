// ==================== 断食统计规则测试 ====================
// 固定日期让最近七天和连续天数不会随测试当天变化，防止已经修好的日期边界再次出错。

import type {CompletedFastingSession} from '../../fasting/domain/fasting';
import {
  getCompletedDurationMs,
  getDurationParts,
  getFastingStatistics,
} from './statistics';

const HOUR_MS = 60 * 60 * 1000;
const FIXED_NOW = new Date(2026, 7, 23, 20, 0, 0).getTime();

function createSession(
  id: string,
  startAt: number,
  plannedHours: number,
  completedHours: number,
): CompletedFastingSession {
  return {
    id,
    startAt,
    plannedEndAt: startAt + plannedHours * HOUR_MS,
    completedAt: startAt + completedHours * HOUR_MS,
  };
}

test('空记录返回零汇总和完整七天刻度', () => {
  const statistics = getFastingStatistics([], FIXED_NOW);

  expect(statistics).toMatchObject({
    totalCount: 0,
    longestDurationHours: 0,
    consecutiveDays: 0,
    latestSession: null,
  });
  expect(statistics.recentDays).toHaveLength(7);
  expect(statistics.recentDays.map(day => day.label)).toEqual([
    '08/17',
    '08/18',
    '08/19',
    '08/20',
    '08/21',
    '08/22',
    '08/23',
  ]);
});

test('按实际结束时间计算最长时长、最新窗口和是否达标', () => {
  const yesterday = createSession(
    'fasting-yesterday',
    new Date(2026, 7, 22, 2, 0, 0).getTime(),
    16,
    16,
  );
  const today = createSession(
    'fasting-today',
    new Date(2026, 7, 23, 4, 0, 0).getTime(),
    16,
    14,
  );
  const statistics = getFastingStatistics([today, yesterday], FIXED_NOW);

  expect(statistics.totalCount).toBe(2);
  expect(statistics.longestDurationHours).toBe(16);
  expect(statistics.consecutiveDays).toBe(2);
  expect(statistics.latestSession).toEqual(today);
  expect(statistics.recentDays[5]).toMatchObject({
    session: yesterday,
    durationMs: 16 * HOUR_MS,
    goalAchieved: true,
  });
  expect(statistics.recentDays[6]).toMatchObject({
    session: today,
    durationMs: 14 * HOUR_MS,
    goalAchieved: false,
  });
});

test('昨天有记录仍延续连续天数，超过一天没有记录则归零', () => {
  const yesterday = createSession(
    'fasting-yesterday',
    new Date(2026, 7, 22, 2, 0, 0).getTime(),
    16,
    16,
  );
  const dayBeforeYesterday = createSession(
    'fasting-day-before-yesterday',
    new Date(2026, 7, 21, 2, 0, 0).getTime(),
    16,
    16,
  );

  expect(
    getFastingStatistics([yesterday, dayBeforeYesterday], FIXED_NOW)
      .consecutiveDays,
  ).toBe(2);
  expect(
    getFastingStatistics(
      [dayBeforeYesterday],
      new Date(2026, 7, 24, 20, 0, 0).getTime(),
    ).consecutiveDays,
  ).toBe(0);
});

test('异常负时长按零显示，正常时长拆成小时和分钟', () => {
  const invalidClockSession: CompletedFastingSession = {
    id: 'clock-adjusted',
    startAt: FIXED_NOW,
    plannedEndAt: FIXED_NOW + 16 * HOUR_MS,
    completedAt: FIXED_NOW - HOUR_MS,
  };

  expect(getCompletedDurationMs(invalidClockSession)).toBe(0);
  expect(getDurationParts(16 * HOUR_MS + 35 * 60 * 1000)).toEqual({
    hours: 16,
    minutes: 35,
  });
});
