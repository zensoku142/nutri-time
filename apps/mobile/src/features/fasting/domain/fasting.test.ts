// ==================== 断食时间规则测试 ====================
// 所有场景都传入固定 now，不读取电脑当前时间，因此无论何时运行都得到相同结果。

import {
  createEatingSession,
  createCyclePlanFromFastingHours,
  createFastingSession,
  DEFAULT_EATING_MINUTES,
  DEFAULT_FASTING_MINUTES,
  formatClockTime,
  formatElapsedMs,
  formatRemainingMs,
  getElapsedMs,
  getRemainingMs,
  getSessionDurationMinutes,
  updateCycleSessionEnd,
  updateCycleSessionStart,
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
  const fastingSession = createFastingSession(FIXED_NOW, 2);
  const eatingSession = createEatingSession(FIXED_NOW, 1);

  expect(fastingSession.startAt).toBe(FIXED_NOW);
  expect(fastingSession.plannedEndAt).toBe(
    FIXED_NOW + 2 * ONE_MINUTE_MS,
  );
  expect(eatingSession.startAt).toBe(FIXED_NOW);
  expect(eatingSession.plannedEndAt).toBe(FIXED_NOW + ONE_MINUTE_MS);
  expect(DEFAULT_FASTING_MINUTES).toBe(16 * 60);
  expect(DEFAULT_EATING_MINUTES).toBe(8 * 60);
});

test('创建进食窗口使用传入时间和正式 8 小时默认时长', () => {
  const session = createEatingSession(FIXED_NOW);

  expect(session).toEqual({
    id: `eating-${FIXED_NOW}`,
    status: 'eating',
    startAt: FIXED_NOW,
    plannedEndAt: FIXED_NOW + 8 * ONE_HOUR_MS,
  });
});

test('自定义 14 小时断食时自动形成 14:10 的完整一天', () => {
  const plan = createCyclePlanFromFastingHours(14);

  expect(plan).toEqual({
    fastingMinutes: 14 * 60,
    eatingMinutes: 10 * 60,
  });
  expect(getSessionDurationMinutes(plan, 'fasting')).toBe(14 * 60);
  expect(getSessionDurationMinutes(plan, 'eating')).toBe(10 * 60);
});

test.each([0, 24, 14.5, Number.NaN])(
  '非法断食小时数 %s 不会生成计划',
  fastingHours => {
    expect(() => createCyclePlanFromFastingHours(fastingHours)).toThrow(
      RangeError,
    );
  },
);

test('修改开始时间时保留会话身份并按计划重算结束时间', () => {
  const originalSession = createFastingSession(FIXED_NOW);
  const adjustedStartAt = FIXED_NOW - 2 * ONE_HOUR_MS;

  expect(
    updateCycleSessionStart(originalSession, adjustedStartAt, 14 * 60),
  ).toEqual({
    ...originalSession,
    startAt: adjustedStartAt,
    plannedEndAt: adjustedStartAt + 14 * ONE_HOUR_MS,
  });
});

test('修改结束时间只更新当前会话，不改变开始时间和会话身份', () => {
  const originalSession = createFastingSession(FIXED_NOW);
  const adjustedEndAt = FIXED_NOW + 15 * ONE_HOUR_MS;

  expect(updateCycleSessionEnd(originalSession, adjustedEndAt)).toEqual({
    ...originalSession,
    plannedEndAt: adjustedEndAt,
  });
});

test('结束时间不晚于开始时间时拒绝生成非法会话', () => {
  const originalSession = createFastingSession(FIXED_NOW);

  expect(() => updateCycleSessionEnd(originalSession, FIXED_NOW)).toThrow(
    '结束时间必须晚于开始时间',
  );
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

test('首页时间优先显示前天、昨天、今日和明天', () => {
  const reference = new Date(2026, 7, 24, 12, 0, 0).getTime();

  expect(
    formatClockTime(new Date(2026, 7, 22, 9, 5, 0).getTime(), reference),
  ).toBe('前天 09:05');
  expect(
    formatClockTime(new Date(2026, 7, 23, 9, 5, 0).getTime(), reference),
  ).toBe('昨天 09:05');
  expect(
    formatClockTime(new Date(2026, 7, 24, 9, 5, 0).getTime(), reference),
  ).toBe('今日 09:05');
  expect(
    formatClockTime(new Date(2026, 7, 25, 1, 30, 0).getTime(), reference),
  ).toBe('明天 01:30');
  expect(
    formatClockTime(new Date(2026, 7, 26, 1, 30, 0).getTime(), reference),
  ).toBe('08/26 01:30');
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
