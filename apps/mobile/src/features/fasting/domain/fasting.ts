// ==================== 断食时间规则 ====================
// 纯函数只根据传入的数据计算，不会偷偷读取当前时间，所以同一组输入总会得到同一结果，测试也不会忽快忽慢。

export type FastingSession = {
  id: string;
  status: 'fasting';
  startAt: number;
  plannedEndAt: number;
};

export type EatingSession = {
  id: string;
  status: 'eating';
  startAt: number;
  plannedEndAt: number;
};

export type CompletedFastingSession = {
  id: string;
  startAt: number;
  plannedEndAt: number;
  completedAt: number;
};

// 判别联合（用 status 区分两种合法形状）让后续代码不能把断食和进食窗口的字段混在一起。
export type ActiveCycleSession = FastingSession | EatingSession;

export const DEFAULT_FASTING_MINUTES = 16 * 60;
export const DEFAULT_EATING_MINUTES = 8 * 60;
export const MIN_FASTING_HOURS = 1;
export const MAX_FASTING_HOURS = 23;

export type CyclePlan = {
  fastingMinutes: number;
  eatingMinutes: number;
};

export const DEFAULT_CYCLE_PLAN: CyclePlan = {
  fastingMinutes: DEFAULT_FASTING_MINUTES,
  eatingMinutes: DEFAULT_EATING_MINUTES,
};

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;
const MILLISECONDS_PER_MINUTE = 60 * 1000;
const MILLISECONDS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 60 * SECONDS_PER_MINUTE;
const RELATIVE_DATE_LABELS: Readonly<Record<number, string>> = {
  [-2]: '前天',
  [-1]: '昨天',
  0: '今日',
  1: '明天',
};

// ---------- 会话创建 ----------
export function createFastingSession(
  now: number,
  durationMinutes = DEFAULT_FASTING_MINUTES,
): FastingSession {
  // Unix 毫秒时间戳表示从统一起点累计的毫秒数。手机和手表以后都用这个单位，才不会把秒和毫秒混在一起。
  // 第一阶段同一时间只允许一个活动会话，用开始时间组成 ID 已足够，也不需要为此增加第三方依赖。
  return {
    id: `fasting-${now}`,
    status: 'fasting',
    startAt: now,
    plannedEndAt: now + durationMinutes * MILLISECONDS_PER_MINUTE,
  };
}

export function createEatingSession(
  now: number,
  durationMinutes = DEFAULT_EATING_MINUTES,
): EatingSession {
  // 进食窗口从用户明确结束断食的这一刻开始，不沿用断食目标时间，避免用户晚确认时少掉可进食时间。
  return {
    id: `eating-${now}`,
    status: 'eating',
    startAt: now,
    plannedEndAt: now + durationMinutes * MILLISECONDS_PER_MINUTE,
  };
}

// ---------- 自定义周期 ----------
export function createCyclePlanFromFastingHours(
  fastingHours: number,
): CyclePlan {
  if (
    !Number.isInteger(fastingHours) ||
    fastingHours < MIN_FASTING_HOURS ||
    fastingHours > MAX_FASTING_HOURS
  ) {
    throw new RangeError('断食小时数必须是 1 到 23 之间的整数');
  }

  // 一天仍固定为 24 小时；用户调整断食时长后，进食窗口自动补足剩余时间，避免出现含义不清的空档。
  return {
    fastingMinutes: fastingHours * 60,
    eatingMinutes: (24 - fastingHours) * 60,
  };
}

export function getSessionDurationMinutes(
  plan: CyclePlan,
  status: ActiveCycleSession['status'],
): number {
  return status === 'fasting' ? plan.fastingMinutes : plan.eatingMinutes;
}

export function updateCycleSessionStart(
  session: ActiveCycleSession,
  startAt: number,
  durationMinutes: number,
): ActiveCycleSession {
  // 修改开始时间或计划比例时保留同一个会话 ID，避免把一次连续阶段误认为新建了历史记录。
  return {
    ...session,
    startAt,
    plannedEndAt: startAt + durationMinutes * MILLISECONDS_PER_MINUTE,
  };
}

// ---------- 时间计算 ----------
export function getRemainingMs(plannedEndAt: number, now: number): number {
  // 目标时间到了以后会话仍然保留，但剩余时间锁在零，页面因此不会显示负数。
  return Math.max(0, plannedEndAt - now);
}

export function getElapsedMs(startAt: number, now: number): number {
  // 手机时间若被向前调整到开始之前，已进行时间先按零处理，避免出现负时长。
  return Math.max(0, now - startAt);
}

function formatWholeSeconds(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / SECONDS_PER_HOUR);
  const minutes = Math.floor(
    (totalSeconds % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE,
  );
  const seconds = totalSeconds % SECONDS_PER_MINUTE;

  return [hours, minutes, seconds]
    .map(value => String(value).padStart(2, '0'))
    .join(':');
}

export function formatElapsedMs(elapsedMs: number): string {
  const totalSeconds = Math.floor(
    Math.max(0, elapsedMs) / MILLISECONDS_PER_SECOND,
  );
  return formatWholeSeconds(totalSeconds);
}

export function formatRemainingMs(remainingMs: number): string {
  // 剩余不足一秒时仍显示 00:00:01；只有真实到达目标时间才显示零，避免文字提前宣告结束。
  const totalSeconds = Math.ceil(
    Math.max(0, remainingMs) / MILLISECONDS_PER_SECOND,
  );
  return formatWholeSeconds(totalSeconds);
}

export function formatClockTime(
  timestamp: number,
  referenceTimestamp: number = Date.now(),
): string {
  // Date（把时间戳换成本地年月日和时分的工具）用 referenceTimestamp 判断是不是同一个自然日。
  // 首页传入自己正在显示的 now，跨过午夜时“今日”会自动变成“昨天”，不会误导用户。
  const date = new Date(timestamp);
  const referenceDate = new Date(referenceTimestamp);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  // 先把本地年月日放进 UTC（只借它做天数编号），夏令时出现 23 或 25 小时时也不会把相邻日期算错。
  const calendarDayNumber = Date.UTC(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  );
  const referenceDayNumber = Date.UTC(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate(),
  );
  const dayDifference = Math.round(
    (calendarDayNumber - referenceDayNumber) / MILLISECONDS_PER_DAY,
  );
  const dateLabel = RELATIVE_DATE_LABELS[dayDifference] ?? `${month}/${day}`;

  return `${dateLabel} ${hours}:${minutes}`;
}
