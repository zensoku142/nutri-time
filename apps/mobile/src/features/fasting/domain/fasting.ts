// ==================== 断食时间规则 ====================
// 纯函数只根据传入的数据计算，不会偷偷读取当前时间，所以同一组输入总会得到同一结果，测试也不会忽快忽慢。

export type FastingSession = {
  id: string;
  status: 'fasting';
  startAt: number;
  plannedEndAt: number;
};

export const DEFAULT_FASTING_MINUTES = 16 * 60;

const MILLISECONDS_PER_MINUTE = 60 * 1000;
const MILLISECONDS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 60 * SECONDS_PER_MINUTE;

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

export function formatClockTime(timestamp: number): string {
  // Date（把传入时间戳换成本地年月日和时分的工具）这里只转换参数，不会读取当前系统时间。
  const date = new Date(timestamp);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  return `${month}/${day} ${hours}:${minutes}`;
}
