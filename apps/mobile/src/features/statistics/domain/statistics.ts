// ==================== 断食统计规则 ====================
// 这里把手机保存的完成记录换成页面需要的汇总数字和最近七天数据，不读取存储也不修改原记录。

import type {CompletedFastingSession} from '../../fasting/domain/fasting';

const MILLISECONDS_PER_MINUTE = 60 * 1000;
const MILLISECONDS_PER_HOUR = 60 * MILLISECONDS_PER_MINUTE;
const MILLISECONDS_PER_DAY = 24 * MILLISECONDS_PER_HOUR;
const RECENT_DAY_COUNT = 7;

export type RecentFastingDay = {
  dayStartAt: number;
  label: string;
  session: CompletedFastingSession | null;
  durationMs: number;
  goalAchieved: boolean;
};

export type FastingStatistics = {
  totalCount: number;
  longestDurationHours: number;
  consecutiveDays: number;
  latestSession: CompletedFastingSession | null;
  recentDays: RecentFastingDay[];
};

export function getCompletedDurationMs(
  session: CompletedFastingSession,
): number {
  // 手机时间若在一次断食中被往回调，统计先按零处理，避免页面出现负小时数。
  return Math.max(0, session.completedAt - session.startAt);
}

export function getDurationParts(durationMs: number) {
  const totalMinutes = Math.floor(
    Math.max(0, durationMs) / MILLISECONDS_PER_MINUTE,
  );

  return {
    hours: Math.floor(totalMinutes / 60),
    minutes: totalMinutes % 60,
  };
}

function getLocalDayStart(timestamp: number): number {
  const date = new Date(timestamp);
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  ).getTime();
}

function getCalendarDayNumber(timestamp: number): number {
  const date = new Date(timestamp);

  // 本地年月日先换成固定 24 小时的日历编号，遇到夏令时也不会把相邻日期误判成断档。
  return Math.floor(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) /
      MILLISECONDS_PER_DAY,
  );
}

function formatDayLabel(timestamp: number): string {
  const date = new Date(timestamp);
  return `${String(date.getMonth() + 1).padStart(2, '0')}/${String(
    date.getDate(),
  ).padStart(2, '0')}`;
}

function getConsecutiveDays(
  sessions: CompletedFastingSession[],
  now: number,
): number {
  const completedDayNumbers = Array.from(
    new Set(sessions.map(session => getCalendarDayNumber(session.completedAt))),
  ).sort((left, right) => right - left);

  if (completedDayNumbers.length === 0) {
    return 0;
  }

  const todayNumber = getCalendarDayNumber(now);

  // 今天还没结束断食时允许从昨天继续计算；超过一天没有记录则当前连续天数已经归零。
  if (todayNumber - completedDayNumbers[0] > 1) {
    return 0;
  }

  let consecutiveDays = 1;

  for (let index = 1; index < completedDayNumbers.length; index += 1) {
    if (completedDayNumbers[index - 1] - completedDayNumbers[index] !== 1) {
      break;
    }

    consecutiveDays += 1;
  }

  return consecutiveDays;
}

function getRecentDays(
  sessions: CompletedFastingSession[],
  now: number,
): RecentFastingDay[] {
  const todayStart = getLocalDayStart(now);

  return Array.from({length: RECENT_DAY_COUNT}, (_, index) => {
    const daysAgo = RECENT_DAY_COUNT - index - 1;
    const targetDate = new Date(todayStart);
    targetDate.setDate(targetDate.getDate() - daysAgo);
    const dayStartAt = targetDate.getTime();
    const dayNumber = getCalendarDayNumber(dayStartAt);
    const session =
      sessions
        .filter(
          item => getCalendarDayNumber(item.completedAt) === dayNumber,
        )
        .sort((left, right) => right.completedAt - left.completedAt)[0] ?? null;

    return {
      dayStartAt,
      label: formatDayLabel(dayStartAt),
      session,
      durationMs: session === null ? 0 : getCompletedDurationMs(session),
      goalAchieved:
        session !== null && session.completedAt >= session.plannedEndAt,
    };
  });
}

export function getFastingStatistics(
  sessions: CompletedFastingSession[],
  now: number,
): FastingStatistics {
  const sortedSessions = [...sessions].sort(
    (left, right) => right.completedAt - left.completedAt,
  );
  const longestDurationMs = sortedSessions.reduce(
    (longest, session) =>
      Math.max(longest, getCompletedDurationMs(session)),
    0,
  );

  return {
    totalCount: sortedSessions.length,
    longestDurationHours: Math.floor(
      longestDurationMs / MILLISECONDS_PER_HOUR,
    ),
    consecutiveDays: getConsecutiveDays(sortedSessions, now),
    latestSession: sortedSessions[0] ?? null,
    recentDays: getRecentDays(sortedSessions, now),
  };
}
