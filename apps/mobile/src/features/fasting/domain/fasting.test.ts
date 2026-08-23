// ==================== 断食时间规则测试 ====================
// 所有场景都传入固定 now，不读取电脑当前时间，因此无论何时运行都得到相同结果。

import {
  createFastingSession,
  DEFAULT_FASTING_MINUTES,
  formatElapsedMs,
  formatRemainingMs,
  getElapsedMs,
  getRemainingMs,
} from './fasting';

const FIXED_NOW = 1_787_313_600_000;
const ONE_SECOND_MS = 1000;
const ONE_MINUTE_MS = 60 * ONE_SECOND_MS;
const ONE_HOUR_MS = 60 * ONE_MINUTE_MS;

test('创建会话使用传入时间和正式 16 小时默认时长', () => {
  const session = createFastingSession(FIXED_NOW);

  expect(DEFAULT_FASTING_MINUTES).toBe(16 * 60);
  expect(session).toEqual({
    id: `fasting-${FIXED_NOW}`,
    status: 'fasting',
    startAt: FIXED_NOW,
    plannedEndAt: FIXED_NOW + 16 * ONE_HOUR_MS,
  });
});

test('测试可以传入短时长，不改变正式默认值', () => {
  const session = createFastingSession(FIXED_NOW, 2);

  expect(session.startAt).toBe(FIXED_NOW);
  expect(session.plannedEndAt).toBe(FIXED_NOW + 2 * ONE_MINUTE_MS);
  expect(DEFAULT_FASTING_MINUTES).toBe(16 * 60);
});

test('刚开始时已进行为零，剩余为完整时长', () => {
  const plannedEndAt = FIXED_NOW + 16 * ONE_HOUR_MS;

  expect(getElapsedMs(FIXED_NOW, FIXED_NOW)).toBe(0);
  expect(getRemainingMs(plannedEndAt, FIXED_NOW)).toBe(16 * ONE_HOUR_MS);
});

test('经过一段时间后分别计算已进行和剩余时间', () => {
  const plannedEndAt = FIXED_NOW + 16 * ONE_HOUR_MS;
  const later = FIXED_NOW + 3 * ONE_HOUR_MS + 17 * ONE_MINUTE_MS;

  expect(getElapsedMs(FIXED_NOW, later)).toBe(
    3 * ONE_HOUR_MS + 17 * ONE_MINUTE_MS,
  );
  expect(getRemainingMs(plannedEndAt, later)).toBe(
    12 * ONE_HOUR_MS + 43 * ONE_MINUTE_MS,
  );
});

test('到达或超过计划结束时间后剩余都保持为零', () => {
  const plannedEndAt = FIXED_NOW + ONE_MINUTE_MS;

  expect(getRemainingMs(plannedEndAt, plannedEndAt)).toBe(0);
  expect(getRemainingMs(plannedEndAt, plannedEndAt + ONE_HOUR_MS)).toBe(0);
});

test('当前时间早于开始时间时已进行按零处理', () => {
  expect(getElapsedMs(FIXED_NOW, FIXED_NOW - ONE_MINUTE_MS)).toBe(0);
});

test('时间显示正确跨过秒、分钟和小时边界', () => {
  expect(formatElapsedMs(0)).toBe('00:00:00');
  expect(formatElapsedMs(59 * ONE_SECOND_MS + 999)).toBe('00:00:59');
  expect(formatElapsedMs(ONE_MINUTE_MS)).toBe('00:01:00');
  expect(formatElapsedMs(ONE_HOUR_MS)).toBe('01:00:00');
  expect(
    formatElapsedMs(25 * ONE_HOUR_MS + 2 * ONE_MINUTE_MS + 3 * ONE_SECOND_MS),
  ).toBe('25:02:03');
});

test('倒计时不足一秒时不会提前显示为零', () => {
  expect(formatRemainingMs(1)).toBe('00:00:01');
  expect(formatRemainingMs(ONE_SECOND_MS)).toBe('00:00:01');
  expect(formatRemainingMs(59 * ONE_SECOND_MS)).toBe('00:00:59');
  expect(formatRemainingMs(ONE_MINUTE_MS)).toBe('00:01:00');
  expect(formatRemainingMs(59 * ONE_MINUTE_MS + 59 * ONE_SECOND_MS)).toBe(
    '00:59:59',
  );
  expect(formatRemainingMs(ONE_HOUR_MS)).toBe('01:00:00');
  expect(formatRemainingMs(0)).toBe('00:00:00');
  expect(formatRemainingMs(-ONE_SECOND_MS)).toBe('00:00:00');
});
