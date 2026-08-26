// ==================== 禁食页面测试 ====================
// 假时钟（由测试控制的系统时间）可以瞬间走过一秒或 16 小时，不必等待真实时间，也不会改动正式页面时长。
// 存储函数使用 mock（行为可控制的替身），用来证明页面严格等待读写成功，并能显示失败与损坏状态。

import React from 'react';
import {AppState, StyleSheet} from 'react-native';
import ReactTestRenderer from 'react-test-renderer';

import {syncCurrentFasting} from '../../../../modules/wear-data-layer';
import {theme} from '../../../app/theme';
import type {ActiveCycleSession, FastingSession} from '../domain/fasting';
import {
  cancelCycleCompletionNotification,
  isCycleCompletionNotificationScheduled,
  requestCycleNotificationPermission,
  scheduleCycleCompletionNotification,
  startCycleCountdownNotification,
  stopCycleCountdownNotification,
} from '../notifications/fastingNotifications';
import {
  clearCurrentFastingState,
  readCyclePlan,
  readCurrentFastingState,
  resetCurrentCycleData,
  saveCompletedFastingAndCurrentState,
  saveCyclePlan,
  saveCyclePlanAndCurrentState,
  saveCurrentFastingState,
} from '../storage/fastingStorage';
import type {PersistedCycleState} from '../storage/fastingStorage';
import {FastingScreen} from './FastingScreen';

jest.mock('react-native-safe-area-context', () =>
  jest.requireActual('react-native-safe-area-context/jest/mock').default,
);

jest.mock('../storage/fastingStorage', () => ({
  clearCurrentFastingState: jest.fn(),
  readCyclePlan: jest.fn(),
  readCurrentFastingState: jest.fn(),
  resetCurrentCycleData: jest.fn(),
  saveCompletedFastingAndCurrentState: jest.fn(),
  saveCyclePlan: jest.fn(),
  saveCyclePlanAndCurrentState: jest.fn(),
  saveCurrentFastingState: jest.fn(),
}));

jest.mock('../notifications/fastingNotifications', () => ({
  cancelCycleCompletionNotification: jest.fn(),
  isCycleCompletionNotificationScheduled: jest.fn(),
  requestCycleNotificationPermission: jest.fn(),
  scheduleCycleCompletionNotification: jest.fn(),
  startCycleCountdownNotification: jest.fn(),
  stopCycleCountdownNotification: jest.fn(),
}));

jest.mock('../../../../modules/wear-data-layer', () => ({
  syncCurrentFasting: jest.fn(),
}));

const clearCurrentFastingStateMock =
  clearCurrentFastingState as jest.MockedFunction<
    typeof clearCurrentFastingState
  >;
const readCyclePlanMock = readCyclePlan as jest.MockedFunction<
  typeof readCyclePlan
>;
const readCurrentFastingStateMock =
  readCurrentFastingState as jest.MockedFunction<
    typeof readCurrentFastingState
  >;
const saveCurrentFastingStateMock =
  saveCurrentFastingState as jest.MockedFunction<
    typeof saveCurrentFastingState
  >;
const resetCurrentCycleDataMock = resetCurrentCycleData as jest.MockedFunction<
  typeof resetCurrentCycleData
>;
const saveCompletedFastingAndCurrentStateMock =
  saveCompletedFastingAndCurrentState as jest.MockedFunction<
    typeof saveCompletedFastingAndCurrentState
  >;
const saveCyclePlanMock = saveCyclePlan as jest.MockedFunction<
  typeof saveCyclePlan
>;
const saveCyclePlanAndCurrentStateMock =
  saveCyclePlanAndCurrentState as jest.MockedFunction<
    typeof saveCyclePlanAndCurrentState
  >;
const cancelCycleCompletionNotificationMock =
  cancelCycleCompletionNotification as jest.MockedFunction<
    typeof cancelCycleCompletionNotification
  >;
const isCycleCompletionNotificationScheduledMock =
  isCycleCompletionNotificationScheduled as jest.MockedFunction<
    typeof isCycleCompletionNotificationScheduled
  >;
const requestCycleNotificationPermissionMock =
  requestCycleNotificationPermission as jest.MockedFunction<
    typeof requestCycleNotificationPermission
  >;
const scheduleCycleCompletionNotificationMock =
  scheduleCycleCompletionNotification as jest.MockedFunction<
    typeof scheduleCycleCompletionNotification
  >;
const startCycleCountdownNotificationMock =
  startCycleCountdownNotification as jest.MockedFunction<
    typeof startCycleCountdownNotification
  >;
const stopCycleCountdownNotificationMock =
  stopCycleCountdownNotification as jest.MockedFunction<
    typeof stopCycleCountdownNotification
  >;
const syncCurrentFastingMock = jest.mocked(syncCurrentFasting);

const FIXED_NOW = new Date(2026, 7, 23, 20, 0, 0).getTime();
const DEFAULT_FASTING_MS = 16 * 60 * 60 * 1000;
const DEFAULT_EATING_MS = 8 * 60 * 60 * 1000;
const VALID_SESSION: FastingSession = {
  id: `fasting-${FIXED_NOW}`,
  status: 'fasting',
  startAt: FIXED_NOW,
  plannedEndAt: FIXED_NOW + DEFAULT_FASTING_MS,
};
const VALID_EATING_SESSION: ActiveCycleSession = {
  id: `eating-${FIXED_NOW}`,
  status: 'eating',
  startAt: FIXED_NOW,
  plannedEndAt: FIXED_NOW + DEFAULT_EATING_MS,
};
const VALID_PERSISTED_STATE = {
  storageVersion: 2 as const,
  session: VALID_SESSION,
};

function restoredState(
  state: PersistedCycleState = VALID_PERSISTED_STATE,
): Awaited<ReturnType<typeof readCurrentFastingState>> {
  return {status: 'restored', session: state.session, state};
}

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
};

function createDeferred<T>(): Deferred<T> {
  let resolve!: Deferred<T>['resolve'];
  const promise = new Promise<T>(promiseResolve => {
    resolve = promiseResolve;
  });

  return {promise, resolve};
}

async function renderScreen() {
  let renderer: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(<FastingScreen />);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });

  return renderer!;
}

function pressButton(
  renderer: ReactTestRenderer.ReactTestRenderer,
  accessibilityLabel: string,
) {
  ReactTestRenderer.act(() => {
    renderer.root.findByProps({accessibilityLabel}).props.onPress();
  });
}

async function flushPromises() {
  await ReactTestRenderer.act(async () => {
    for (let index = 0; index < 6; index += 1) {
      await Promise.resolve();
    }
  });
}

function getRenderedText(renderer: ReactTestRenderer.ReactTestRenderer) {
  return JSON.stringify(renderer.toJSON());
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  jest.setSystemTime(FIXED_NOW);
  readCurrentFastingStateMock.mockResolvedValue({status: 'empty'});
  readCyclePlanMock.mockResolvedValue({
    status: 'default',
    plan: {fastingMinutes: 16 * 60, eatingMinutes: 8 * 60},
  });
  saveCurrentFastingStateMock.mockResolvedValue();
  saveCompletedFastingAndCurrentStateMock.mockResolvedValue();
  saveCyclePlanMock.mockResolvedValue();
  saveCyclePlanAndCurrentStateMock.mockResolvedValue();
  clearCurrentFastingStateMock.mockResolvedValue();
  resetCurrentCycleDataMock.mockResolvedValue();
  requestCycleNotificationPermissionMock.mockResolvedValue(false);
  scheduleCycleCompletionNotificationMock.mockResolvedValue(
    'notification-1',
  );
  isCycleCompletionNotificationScheduledMock.mockResolvedValue(true);
  cancelCycleCompletionNotificationMock.mockResolvedValue();
  startCycleCountdownNotificationMock.mockResolvedValue();
  stopCycleCountdownNotificationMock.mockResolvedValue();
  syncCurrentFastingMock.mockResolvedValue();
});

afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

test('启动读取完成前只显示 loading，不先闪现 idle', async () => {
  const readDeferred = createDeferred<
    Awaited<ReturnType<typeof readCurrentFastingState>>
  >();
  readCurrentFastingStateMock.mockReturnValue(readDeferred.promise);

  const renderer = await renderScreen();

  expect(getRenderedText(renderer)).toContain('正在恢复周期状态');
  expect(
    renderer.root.findAllByProps({accessibilityLabel: '开始断食'}),
  ).toHaveLength(0);
  expect(
    renderer.root.findAllByProps({
      accessibilityLabel: '当前周期状态：16:8 轻断食',
    }),
  ).toHaveLength(0);

  await ReactTestRenderer.act(async () => {
    readDeferred.resolve({status: 'empty'});
    await readDeferred.promise;
  });

  expect(
    renderer.root.findByProps({accessibilityLabel: '开始断食'}),
  ).toBeDefined();

  ReactTestRenderer.act(() => renderer.unmount());
});

test('没有本地数据时读取完成后进入 idle', async () => {
  const renderer = await renderScreen();

  expect(readCurrentFastingStateMock).toHaveBeenCalledTimes(1);
  expect(getRenderedText(renderer)).toContain('尚未开始');
  expect(
    renderer.root.findByProps({accessibilityLabel: '开始断食'}),
  ).toBeDefined();

  ReactTestRenderer.act(() => renderer.unmount());
});

test('恢复自定义 14:10 计划并用它创建新的 fasting', async () => {
  readCyclePlanMock.mockResolvedValue({
    status: 'restored',
    plan: {fastingMinutes: 14 * 60, eatingMinutes: 10 * 60},
  });
  const renderer = await renderScreen();

  expect(getRenderedText(renderer)).toContain('14:10 · 修改');
  expect(getRenderedText(renderer)).toContain('14:00:00');

  pressButton(renderer, '开始断食');
  await flushPromises();

  expect(saveCurrentFastingStateMock).toHaveBeenCalledWith({
    id: `fasting-${FIXED_NOW}`,
    status: 'fasting',
    startAt: FIXED_NOW,
    plannedEndAt: FIXED_NOW + 14 * 60 * 60 * 1000,
  });

  ReactTestRenderer.act(() => renderer.unmount());
});

test('空闲时可从底部弹层把默认 16:8 修改为 14:10', async () => {
  const renderer = await renderScreen();

  pressButton(renderer, '修改断食和进食时长');
  expect(getRenderedText(renderer)).toContain('修改周期时长');

  pressButton(renderer, '减少断食 1 小时');
  pressButton(renderer, '减少断食 1 小时');
  expect(getRenderedText(renderer)).toContain('14:10');

  pressButton(renderer, '确认修改');
  await flushPromises();

  expect(saveCyclePlanMock).toHaveBeenCalledWith({
    fastingMinutes: 14 * 60,
    eatingMinutes: 10 * 60,
  });
  expect(getRenderedText(renderer)).toContain('14:10 · 修改');

  ReactTestRenderer.act(() => renderer.unmount());
});

test('活动中修改比例会批量保存当前阶段、切换提醒并 urgent 更新 fasting', async () => {
  requestCycleNotificationPermissionMock.mockResolvedValue(true);
  readCurrentFastingStateMock.mockResolvedValue(
    restoredState({
      ...VALID_PERSISTED_STATE,
      completionNotificationId: 'notification-fasting',
    }),
  );
  const renderer = await renderScreen();

  pressButton(renderer, '修改断食和进食时长');
  pressButton(renderer, '减少断食 1 小时');
  pressButton(renderer, '减少断食 1 小时');
  pressButton(renderer, '确认修改');
  await flushPromises();

  const adjustedSession = {
    ...VALID_SESSION,
    plannedEndAt: FIXED_NOW + 14 * 60 * 60 * 1000,
  };
  expect(saveCyclePlanAndCurrentStateMock).toHaveBeenCalledWith(
    {fastingMinutes: 14 * 60, eatingMinutes: 10 * 60},
    {storageVersion: 2, session: adjustedSession},
  );
  expect(cancelCycleCompletionNotificationMock).toHaveBeenCalledWith(
    'notification-fasting',
  );
  expect(scheduleCycleCompletionNotificationMock).toHaveBeenCalledWith(
    adjustedSession.plannedEndAt,
    'fasting',
  );
  expect(syncCurrentFastingMock).toHaveBeenLastCalledWith(
    {
      protocolVersion: 1,
      status: 'fasting',
      sessionId: adjustedSession.id,
      startAt: adjustedSession.startAt,
      plannedEndAt: adjustedSession.plannedEndAt,
      stateChangedAt: FIXED_NOW,
    },
    true,
  );

  ReactTestRenderer.act(() => renderer.unmount());
});

test('修改 fasting 开始时间会保留会话 ID、重算结束时间并切换提醒', async () => {
  requestCycleNotificationPermissionMock.mockResolvedValue(true);
  readCurrentFastingStateMock.mockResolvedValue(
    restoredState({
      ...VALID_PERSISTED_STATE,
      completionNotificationId: 'notification-fasting',
    }),
  );
  const renderer = await renderScreen();

  pressButton(renderer, '修改断食开始时间');
  expect(getRenderedText(renderer)).toContain('修改断食开始时间');
  pressButton(renderer, '选择前一小时');
  pressButton(renderer, '确认修改');
  await flushPromises();

  const adjustedSession = {
    ...VALID_SESSION,
    startAt: FIXED_NOW - 60 * 60 * 1000,
    plannedEndAt: FIXED_NOW + 15 * 60 * 60 * 1000,
  };
  expect(saveCurrentFastingStateMock).toHaveBeenCalledWith(adjustedSession);
  expect(cancelCycleCompletionNotificationMock).toHaveBeenCalledWith(
    'notification-fasting',
  );
  expect(scheduleCycleCompletionNotificationMock).toHaveBeenCalledWith(
    adjustedSession.plannedEndAt,
    'fasting',
  );
  expect(syncCurrentFastingMock).toHaveBeenLastCalledWith(
    expect.objectContaining({
      status: 'fasting',
      startAt: adjustedSession.startAt,
      plannedEndAt: adjustedSession.plannedEndAt,
    }),
    true,
  );

  ReactTestRenderer.act(() => renderer.unmount());
});

test('开始时间晚于当前时间时保持编辑弹层且不写入', async () => {
  readCurrentFastingStateMock.mockResolvedValue(restoredState());
  const renderer = await renderScreen();

  pressButton(renderer, '修改断食开始时间');
  pressButton(renderer, '选择后一小时');
  pressButton(renderer, '确认修改');
  await flushPromises();

  expect(getRenderedText(renderer)).toContain('开始时间不能晚于当前时间');
  expect(saveCurrentFastingStateMock).not.toHaveBeenCalled();
  expect(cancelCycleCompletionNotificationMock).not.toHaveBeenCalled();

  ReactTestRenderer.act(() => renderer.unmount());
});

test('小时滚轮跨过 23 和 00 时不改变日期', async () => {
  readCurrentFastingStateMock.mockResolvedValue(restoredState());
  const renderer = await renderScreen();

  pressButton(renderer, '修改断食开始时间');

  // 当前是 20 点，连续向后四格会回到同一天 00 点；不能偷偷跳到第二天。
  for (let index = 0; index < 4; index += 1) {
    pressButton(renderer, '选择后一小时');
  }

  pressButton(renderer, '确认修改');
  await flushPromises();

  expect(saveCurrentFastingStateMock).toHaveBeenCalledWith(
    expect.objectContaining({
      startAt: new Date(2026, 7, 23, 0, 0, 0).getTime(),
    }),
  );

  ReactTestRenderer.act(() => renderer.unmount());
});

test('分钟滚轮跨过 00 和 59 时不改变小时', async () => {
  readCurrentFastingStateMock.mockResolvedValue(restoredState());
  const renderer = await renderScreen();

  pressButton(renderer, '修改断食开始时间');
  pressButton(renderer, '选择前一小时');
  pressButton(renderer, '选择前一分钟');
  pressButton(renderer, '确认修改');
  await flushPromises();

  // 20:00 先选到 19:00，再把分钟从 00 向前滚到 59，结果必须是 19:59 而不是 18:59。
  expect(saveCurrentFastingStateMock).toHaveBeenCalledWith(
    expect.objectContaining({
      startAt: new Date(2026, 7, 23, 19, 59, 0).getTime(),
    }),
  );

  ReactTestRenderer.act(() => renderer.unmount());
});

test('自定义计划或开始时间保存失败时保留原值和旧提醒', async () => {
  readCurrentFastingStateMock.mockResolvedValue(
    restoredState({
      ...VALID_PERSISTED_STATE,
      completionNotificationId: 'notification-fasting',
    }),
  );
  saveCyclePlanAndCurrentStateMock.mockRejectedValue(
    new Error('plan write failed'),
  );
  const renderer = await renderScreen();

  pressButton(renderer, '修改断食和进食时长');
  pressButton(renderer, '减少断食 1 小时');
  pressButton(renderer, '确认修改');
  await flushPromises();

  expect(getRenderedText(renderer)).toContain('周期时长保存失败');
  expect(getRenderedText(renderer)).toContain('16:8');
  expect(cancelCycleCompletionNotificationMock).not.toHaveBeenCalled();

  pressButton(renderer, '取消修改');
  saveCurrentFastingStateMock.mockRejectedValue(new Error('write failed'));
  pressButton(renderer, '修改断食开始时间');
  pressButton(renderer, '选择前一小时');
  pressButton(renderer, '确认修改');
  await flushPromises();

  expect(getRenderedText(renderer)).toContain('开始时间保存失败');
  expect(cancelCycleCompletionNotificationMock).not.toHaveBeenCalled();

  ReactTestRenderer.act(() => renderer.unmount());
});

test('合法数据恢复为 fasting 并保留原开始和结束时间', async () => {
  const setIntervalSpy = jest.spyOn(globalThis, 'setInterval');
  const clearIntervalSpy = jest.spyOn(globalThis, 'clearInterval');
  readCurrentFastingStateMock.mockResolvedValue(restoredState());

  const renderer = await renderScreen();

  expect(getRenderedText(renderer)).toContain('断食已进行');
  expect(getRenderedText(renderer)).toContain('今日 20:00');
  expect(getRenderedText(renderer)).toContain('明天 12:00');
  expect(getRenderedText(renderer)).toContain('16:00:00');
  expect(setIntervalSpy).toHaveBeenCalledTimes(1);
  expect(syncCurrentFastingMock).toHaveBeenCalledWith(
    {
      protocolVersion: 1,
      status: 'fasting',
      sessionId: VALID_SESSION.id,
      startAt: VALID_SESSION.startAt,
      plannedEndAt: VALID_SESSION.plannedEndAt,
      stateChangedAt: VALID_SESSION.startAt,
    },
    false,
  );

  ReactTestRenderer.act(() => renderer.unmount());
  expect(clearIntervalSpy).toHaveBeenCalledTimes(1);
});

test('合法 eating 数据恢复进食窗口，并向 Wear v1 普通提交 idle', async () => {
  readCurrentFastingStateMock.mockResolvedValue(
    restoredState({storageVersion: 2, session: VALID_EATING_SESSION}),
  );

  const renderer = await renderScreen();

  expect(getRenderedText(renderer)).toContain('进食窗口');
  expect(getRenderedText(renderer)).toContain('08:00:00');
  expect(getRenderedText(renderer)).toContain('明天 04:00');
  expect(syncCurrentFastingMock).toHaveBeenCalledWith(
    {
      protocolVersion: 1,
      status: 'idle',
      stateChangedAt: VALID_EATING_SESSION.startAt,
    },
    false,
  );
  expect(clearCurrentFastingStateMock).not.toHaveBeenCalled();

  ReactTestRenderer.act(() => renderer.unmount());
});

test('恢复时已有有效提醒不会重复安排', async () => {
  readCurrentFastingStateMock.mockResolvedValue(
    restoredState({
      ...VALID_PERSISTED_STATE,
      completionNotificationId: 'notification-1',
    }),
  );

  const renderer = await renderScreen();

  expect(getRenderedText(renderer)).toContain('断食已进行');
  expect(isCycleCompletionNotificationScheduledMock).toHaveBeenCalledWith(
    'notification-1',
  );
  expect(requestCycleNotificationPermissionMock).not.toHaveBeenCalled();
  expect(scheduleCycleCompletionNotificationMock).not.toHaveBeenCalled();
  expect(startCycleCountdownNotificationMock).toHaveBeenCalledWith(
    VALID_SESSION.plannedEndAt,
    'fasting',
  );
  expect(saveCurrentFastingStateMock).not.toHaveBeenCalled();

  ReactTestRenderer.act(() => renderer.unmount());
});

test('恢复核对失败时仍恢复会话，并且不冒险重复安排', async () => {
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
  isCycleCompletionNotificationScheduledMock.mockRejectedValue(
    new Error('query failed'),
  );
  readCurrentFastingStateMock.mockResolvedValue(
    restoredState({
      ...VALID_PERSISTED_STATE,
      completionNotificationId: 'notification-1',
    }),
  );

  const renderer = await renderScreen();

  expect(getRenderedText(renderer)).toContain('断食已进行');
  expect(getRenderedText(renderer)).toContain('提醒未启用');
  expect(scheduleCycleCompletionNotificationMock).not.toHaveBeenCalled();

  ReactTestRenderer.act(() => renderer.unmount());
});

test('恢复时缺少取件号码会补安排一次并写回', async () => {
  requestCycleNotificationPermissionMock.mockResolvedValue(true);
  readCurrentFastingStateMock.mockResolvedValue(restoredState());

  const renderer = await renderScreen();

  expect(getRenderedText(renderer)).toContain('断食已进行');
  expect(isCycleCompletionNotificationScheduledMock).not.toHaveBeenCalled();
  expect(scheduleCycleCompletionNotificationMock).toHaveBeenCalledTimes(1);
  expect(saveCurrentFastingStateMock).toHaveBeenCalledWith(
    VALID_SESSION,
    'notification-1',
  );

  ReactTestRenderer.act(() => renderer.unmount());
});

test('恢复时取件号码对应的系统提醒不存在会补安排一次', async () => {
  requestCycleNotificationPermissionMock.mockResolvedValue(true);
  isCycleCompletionNotificationScheduledMock.mockResolvedValue(false);
  readCurrentFastingStateMock.mockResolvedValue(
    restoredState({
      ...VALID_PERSISTED_STATE,
      completionNotificationId: 'missing-notification',
    }),
  );

  const renderer = await renderScreen();

  expect(scheduleCycleCompletionNotificationMock).toHaveBeenCalledTimes(1);
  expect(saveCurrentFastingStateMock).toHaveBeenCalledWith(
    VALID_SESSION,
    'notification-1',
  );

  ReactTestRenderer.act(() => renderer.unmount());
});

test('恢复已经到期的会话时不为过去时间新增提醒', async () => {
  const expiredSession: FastingSession = {
    id: 'fasting-expired',
    status: 'fasting',
    startAt: FIXED_NOW - 2 * 60 * 60 * 1000,
    plannedEndAt: FIXED_NOW - 60 * 60 * 1000,
  };
  readCurrentFastingStateMock.mockResolvedValue(
    restoredState({storageVersion: 2, session: expiredSession}),
  );

  const renderer = await renderScreen();

  expect(getRenderedText(renderer)).toContain('断食目标已达成');
  expect(isCycleCompletionNotificationScheduledMock).not.toHaveBeenCalled();
  expect(requestCycleNotificationPermissionMock).not.toHaveBeenCalled();
  expect(scheduleCycleCompletionNotificationMock).not.toHaveBeenCalled();

  ReactTestRenderer.act(() => renderer.unmount());
});

test('普通重渲染不会再次核对或安排提醒', async () => {
  requestCycleNotificationPermissionMock.mockResolvedValue(true);
  readCurrentFastingStateMock.mockResolvedValue(restoredState());
  const renderer = await renderScreen();

  ReactTestRenderer.act(() => {
    renderer.update(<FastingScreen />);
  });

  expect(readCurrentFastingStateMock).toHaveBeenCalledTimes(1);
  expect(scheduleCycleCompletionNotificationMock).toHaveBeenCalledTimes(1);
  expect(saveCurrentFastingStateMock).toHaveBeenCalledTimes(1);
  expect(syncCurrentFastingMock).toHaveBeenCalledTimes(1);

  ReactTestRenderer.act(() => renderer.unmount());
});

test('恢复核对完成前不允许用户结束，避免旧结果覆盖新操作', async () => {
  const queryDeferred = createDeferred<boolean>();
  isCycleCompletionNotificationScheduledMock.mockReturnValue(
    queryDeferred.promise,
  );
  readCurrentFastingStateMock.mockResolvedValue(
    restoredState({
      ...VALID_PERSISTED_STATE,
      completionNotificationId: 'notification-1',
    }),
  );
  const renderer = await renderScreen();

  expect(getRenderedText(renderer)).toContain('正在恢复周期状态');
  expect(
    renderer.root.findAllByProps({accessibilityLabel: '结束断食'}),
  ).toHaveLength(0);

  await ReactTestRenderer.act(async () => {
    queryDeferred.resolve(true);
    await queryDeferred.promise;
  });

  expect(
    renderer.root.findByProps({accessibilityLabel: '结束断食'}),
  ).toBeDefined();
  ReactTestRenderer.act(() => renderer.unmount());
});

test('开始时先保存，保存成功后页面才进入 fasting', async () => {
  const setIntervalSpy = jest.spyOn(globalThis, 'setInterval');
  const saveDeferred = createDeferred<void>();
  saveCurrentFastingStateMock.mockReturnValue(saveDeferred.promise);
  const renderer = await renderScreen();

  const idleRing = renderer.root.findByProps({
    accessibilityLabel: '当前周期状态：16:8 轻断食',
  });
  const idleRingStyle = StyleSheet.flatten(idleRing.props.style);
  expect(idleRingStyle.width).toBe(idleRingStyle.height);

  pressButton(renderer, '开始断食');

  expect(saveCurrentFastingStateMock).toHaveBeenCalledTimes(1);
  expect(saveCurrentFastingStateMock).toHaveBeenCalledWith(VALID_SESSION);
  expect(requestCycleNotificationPermissionMock).not.toHaveBeenCalled();
  expect(getRenderedText(renderer)).not.toContain('断食已进行');
  expect(
    renderer.root.findByProps({accessibilityLabel: '正在开始断食…'}).props
      .disabled,
  ).toBe(true);

  await ReactTestRenderer.act(async () => {
    saveDeferred.resolve();
    await saveDeferred.promise;
  });

  expect(getRenderedText(renderer)).toContain('断食已进行');
  expect(getRenderedText(renderer)).toContain('已完成 0%');
  expect(getRenderedText(renderer)).toContain('16:00:00');
  expect(requestCycleNotificationPermissionMock).toHaveBeenCalledTimes(1);
  expect(setIntervalSpy).toHaveBeenCalledTimes(1);
  expect(syncCurrentFastingMock).toHaveBeenCalledWith(
    {
      protocolVersion: 1,
      status: 'fasting',
      sessionId: VALID_SESSION.id,
      startAt: VALID_SESSION.startAt,
      plannedEndAt: VALID_SESSION.plannedEndAt,
      stateChangedAt: FIXED_NOW,
    },
    true,
  );

  const activeArc = renderer.root.findByProps({
    stroke: theme.colors.fastingActive,
  });
  const [activeArcLengthAtStart] = String(
    activeArc.props.strokeDasharray,
  ).split(' ');
  expect(Number(activeArcLengthAtStart)).toBe(0);

  ReactTestRenderer.act(() => renderer.unmount());
});

test('保存失败时保持 idle 并显示明确错误', async () => {
  const setIntervalSpy = jest.spyOn(globalThis, 'setInterval');
  saveCurrentFastingStateMock.mockRejectedValue(new Error('write failed'));
  const renderer = await renderScreen();

  pressButton(renderer, '开始断食');
  await flushPromises();

  expect(getRenderedText(renderer)).toContain('尚未开始');
  expect(getRenderedText(renderer)).toContain(
    '断食状态保存失败，本次断食尚未开始，请重试。',
  );
  expect(setIntervalSpy).not.toHaveBeenCalled();
  expect(syncCurrentFastingMock).not.toHaveBeenCalled();

  ReactTestRenderer.act(() => renderer.unmount());
});

test('权限允许时只安排一条提醒并把取件号码写回外层状态', async () => {
  requestCycleNotificationPermissionMock.mockResolvedValue(true);
  const renderer = await renderScreen();

  pressButton(renderer, '开始断食');
  await flushPromises();

  expect(getRenderedText(renderer)).toContain('断食已进行');
  expect(scheduleCycleCompletionNotificationMock).toHaveBeenCalledTimes(1);
  expect(scheduleCycleCompletionNotificationMock).toHaveBeenCalledWith(
    VALID_SESSION.plannedEndAt,
    'fasting',
  );
  expect(startCycleCountdownNotificationMock).toHaveBeenCalledWith(
    VALID_SESSION.plannedEndAt,
    'fasting',
  );
  expect(startCycleCountdownNotificationMock).toHaveBeenCalledTimes(1);
  expect(saveCurrentFastingStateMock).toHaveBeenNthCalledWith(
    1,
    VALID_SESSION,
  );
  expect(saveCurrentFastingStateMock).toHaveBeenNthCalledWith(
    2,
    VALID_SESSION,
    'notification-1',
  );
  expect(
    saveCurrentFastingStateMock.mock.invocationCallOrder[0],
  ).toBeLessThan(
    scheduleCycleCompletionNotificationMock.mock.invocationCallOrder[0],
  );
  expect(getRenderedText(renderer)).not.toContain('提醒未启用');

  ReactTestRenderer.act(() => renderer.unmount());
});

test('常驻倒计时显示失败时保留到期提醒并给出单独说明', async () => {
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
  requestCycleNotificationPermissionMock.mockResolvedValue(true);
  startCycleCountdownNotificationMock.mockRejectedValue(
    new Error('native countdown failed'),
  );
  const renderer = await renderScreen();

  pressButton(renderer, '开始断食');
  await flushPromises();

  expect(getRenderedText(renderer)).toContain(
    '到期提醒已启用，但通知栏倒计时未显示',
  );
  expect(saveCurrentFastingStateMock).toHaveBeenLastCalledWith(
    VALID_SESSION,
    'notification-1',
  );
  expect(cancelCycleCompletionNotificationMock).not.toHaveBeenCalled();

  ReactTestRenderer.act(() => renderer.unmount());
});

test('权限拒绝时会话仍进入 fasting，并显示提醒不可用', async () => {
  const renderer = await renderScreen();

  pressButton(renderer, '开始断食');
  await flushPromises();

  expect(getRenderedText(renderer)).toContain('断食已进行');
  expect(getRenderedText(renderer)).toContain('提醒未启用');
  expect(saveCurrentFastingStateMock).toHaveBeenCalledTimes(1);
  expect(scheduleCycleCompletionNotificationMock).not.toHaveBeenCalled();
  expect(clearCurrentFastingStateMock).not.toHaveBeenCalled();

  ReactTestRenderer.act(() => renderer.unmount());
});

test('通知安排失败时不回滚已保存的会话', async () => {
  const consoleErrorSpy = jest
    .spyOn(console, 'error')
    .mockImplementation(() => undefined);
  requestCycleNotificationPermissionMock.mockResolvedValue(true);
  scheduleCycleCompletionNotificationMock.mockRejectedValue(
    new Error('schedule failed'),
  );
  const renderer = await renderScreen();

  pressButton(renderer, '开始断食');
  await flushPromises();

  expect(getRenderedText(renderer)).toContain('断食已进行');
  expect(getRenderedText(renderer)).toContain('提醒未启用');
  expect(saveCurrentFastingStateMock).toHaveBeenCalledTimes(1);
  expect(clearCurrentFastingStateMock).not.toHaveBeenCalled();
  expect(syncCurrentFastingMock).toHaveBeenCalledWith(
    expect.objectContaining({status: 'fasting'}),
    true,
  );
  expect(consoleErrorSpy).toHaveBeenCalledWith(
    '[NutriTime] notification-schedule-failed',
    {errorName: 'Error'},
  );

  ReactTestRenderer.act(() => renderer.unmount());
});

test('同步失败时不回滚手机已经保存的 fasting', async () => {
  const consoleErrorSpy = jest
    .spyOn(console, 'error')
    .mockImplementation(() => undefined);
  syncCurrentFastingMock.mockRejectedValue(new Error('data layer failed'));
  const renderer = await renderScreen();

  pressButton(renderer, '开始断食');
  await flushPromises();

  expect(getRenderedText(renderer)).toContain('断食已进行');
  expect(getRenderedText(renderer)).not.toContain('断食状态保存失败');
  expect(saveCurrentFastingStateMock).toHaveBeenCalledWith(VALID_SESSION);
  expect(clearCurrentFastingStateMock).not.toHaveBeenCalled();
  expect(consoleErrorSpy).toHaveBeenCalledWith(
    '[NutriTime] wear-current-fasting-submit-failed',
    {errorName: 'Error'},
  );

  ReactTestRenderer.act(() => renderer.unmount());
});

test('取件号码写回失败时尝试撤销刚安排的提醒', async () => {
  const consoleErrorSpy = jest
    .spyOn(console, 'error')
    .mockImplementation(() => undefined);
  requestCycleNotificationPermissionMock.mockResolvedValue(true);
  saveCurrentFastingStateMock
    .mockResolvedValueOnce()
    .mockRejectedValueOnce(new Error('second write failed'));
  const renderer = await renderScreen();

  pressButton(renderer, '开始断食');
  await flushPromises();

  expect(getRenderedText(renderer)).toContain('断食已进行');
  expect(getRenderedText(renderer)).toContain('提醒未启用');
  expect(saveCurrentFastingStateMock).toHaveBeenCalledTimes(2);
  expect(cancelCycleCompletionNotificationMock).toHaveBeenCalledWith(
    'notification-1',
  );
  expect(clearCurrentFastingStateMock).not.toHaveBeenCalled();
  expect(consoleErrorSpy).toHaveBeenCalledWith(
    '[NutriTime] notification-id-save-failed',
    {errorName: 'Error'},
  );

  ReactTestRenderer.act(() => renderer.unmount());
});

test('结束断食时先保存 eating，再切换提醒并向 Wear v1 urgent 提交 idle', async () => {
  requestCycleNotificationPermissionMock.mockResolvedValue(true);
  readCurrentFastingStateMock.mockResolvedValue(
    restoredState({
      ...VALID_PERSISTED_STATE,
      completionNotificationId: 'notification-fasting',
    }),
  );
  const saveDeferred = createDeferred<void>();
  saveCompletedFastingAndCurrentStateMock.mockReturnValueOnce(
    saveDeferred.promise,
  );
  const renderer = await renderScreen();

  pressButton(renderer, '结束断食');

  expect(saveCompletedFastingAndCurrentStateMock).toHaveBeenCalledWith(
    VALID_SESSION,
    FIXED_NOW,
    VALID_EATING_SESSION,
  );
  expect(getRenderedText(renderer)).toContain('断食已进行');
  expect(
    renderer.root.findByProps({
      accessibilityLabel: '正在进入进食窗口…',
    }).props.disabled,
  ).toBe(true);
  expect(cancelCycleCompletionNotificationMock).not.toHaveBeenCalled();

  await ReactTestRenderer.act(async () => {
    saveDeferred.resolve();
    await saveDeferred.promise;
  });
  await flushPromises();

  expect(getRenderedText(renderer)).toContain('进食窗口');
  expect(getRenderedText(renderer)).toContain('08:00:00');
  expect(cancelCycleCompletionNotificationMock).toHaveBeenCalledWith(
    'notification-fasting',
  );
  expect(scheduleCycleCompletionNotificationMock).toHaveBeenCalledWith(
    VALID_EATING_SESSION.plannedEndAt,
    'eating',
  );
  expect(saveCurrentFastingStateMock).toHaveBeenCalledWith(
    VALID_EATING_SESSION,
    'notification-1',
  );
  expect(
    saveCompletedFastingAndCurrentStateMock.mock.invocationCallOrder[0],
  ).toBeLessThan(
    cancelCycleCompletionNotificationMock.mock.invocationCallOrder[0],
  );
  expect(
    cancelCycleCompletionNotificationMock.mock.invocationCallOrder[0],
  ).toBeLessThan(
    scheduleCycleCompletionNotificationMock.mock.invocationCallOrder[0],
  );
  expect(syncCurrentFastingMock).toHaveBeenLastCalledWith(
    {
      protocolVersion: 1,
      status: 'idle',
      stateChangedAt: FIXED_NOW,
    },
    true,
  );

  ReactTestRenderer.act(() => renderer.unmount());
});

test('eating 保存失败时保持 fasting，不取消提醒或提交 idle', async () => {
  readCurrentFastingStateMock.mockResolvedValue(
    restoredState({
      ...VALID_PERSISTED_STATE,
      completionNotificationId: 'notification-fasting',
    }),
  );
  saveCompletedFastingAndCurrentStateMock.mockRejectedValue(
    new Error('write failed'),
  );
  const renderer = await renderScreen();

  pressButton(renderer, '结束断食');
  await flushPromises();

  expect(getRenderedText(renderer)).toContain('断食已进行');
  expect(getRenderedText(renderer)).toContain(
    '进食窗口保存失败，本次断食仍在继续，请重试。',
  );
  expect(cancelCycleCompletionNotificationMock).not.toHaveBeenCalled();
  expect(scheduleCycleCompletionNotificationMock).not.toHaveBeenCalled();
  expect(syncCurrentFastingMock).not.toHaveBeenCalledWith(
    expect.objectContaining({status: 'idle'}),
    true,
  );

  ReactTestRenderer.act(() => renderer.unmount());
});

test('切换 eating 时取消旧提醒失败不会回滚新状态', async () => {
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
  requestCycleNotificationPermissionMock.mockResolvedValue(true);
  cancelCycleCompletionNotificationMock.mockRejectedValue(
    new Error('cancel failed'),
  );
  readCurrentFastingStateMock.mockResolvedValue(
    restoredState({
      ...VALID_PERSISTED_STATE,
      completionNotificationId: 'notification-fasting',
    }),
  );
  const renderer = await renderScreen();

  pressButton(renderer, '结束断食');
  await flushPromises();

  expect(getRenderedText(renderer)).toContain('进食窗口');
  expect(getRenderedText(renderer)).toContain('上一阶段提醒可能仍会出现');
  expect(scheduleCycleCompletionNotificationMock).toHaveBeenCalledTimes(1);
  expect(syncCurrentFastingMock).toHaveBeenLastCalledWith(
    expect.objectContaining({status: 'idle'}),
    true,
  );

  ReactTestRenderer.act(() => renderer.unmount());
});

test('eating 提醒或 Wear 同步失败都不回滚 eating', async () => {
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
  requestCycleNotificationPermissionMock.mockResolvedValue(true);
  scheduleCycleCompletionNotificationMock.mockRejectedValue(
    new Error('schedule failed'),
  );
  syncCurrentFastingMock.mockRejectedValue(new Error('data layer failed'));
  readCurrentFastingStateMock.mockResolvedValue(restoredState());
  const renderer = await renderScreen();

  pressButton(renderer, '结束断食');
  await flushPromises();

  expect(getRenderedText(renderer)).toContain('进食窗口');
  expect(getRenderedText(renderer)).toContain('提醒未启用');
  expect(saveCompletedFastingAndCurrentStateMock).toHaveBeenCalledWith(
    VALID_SESSION,
    FIXED_NOW,
    VALID_EATING_SESSION,
  );
  expect(clearCurrentFastingStateMock).not.toHaveBeenCalled();

  ReactTestRenderer.act(() => renderer.unmount());
});

test('结束 eating 时先清本地，成功后回 idle 并取消提醒', async () => {
  readCurrentFastingStateMock.mockResolvedValue(
    restoredState({
      storageVersion: 2,
      session: VALID_EATING_SESSION,
      completionNotificationId: 'notification-eating',
    }),
  );
  const clearDeferred = createDeferred<void>();
  clearCurrentFastingStateMock.mockReturnValue(clearDeferred.promise);
  const renderer = await renderScreen();
  const restoreSyncCallCount = syncCurrentFastingMock.mock.calls.length;

  pressButton(renderer, '结束进食窗口');

  expect(clearCurrentFastingStateMock).toHaveBeenCalledTimes(1);
  expect(getRenderedText(renderer)).toContain('进食窗口');
  expect(
    renderer.root.findByProps({
      accessibilityLabel: '正在结束进食窗口…',
    }).props.disabled,
  ).toBe(true);
  expect(cancelCycleCompletionNotificationMock).not.toHaveBeenCalled();

  await ReactTestRenderer.act(async () => {
    clearDeferred.resolve();
    await clearDeferred.promise;
  });
  await flushPromises();

  expect(getRenderedText(renderer)).toContain('尚未开始');
  expect(cancelCycleCompletionNotificationMock).toHaveBeenCalledWith(
    'notification-eating',
  );
  expect(stopCycleCountdownNotificationMock).toHaveBeenCalledTimes(1);
  expect(
    clearCurrentFastingStateMock.mock.invocationCallOrder[0],
  ).toBeLessThan(
    cancelCycleCompletionNotificationMock.mock.invocationCallOrder[0],
  );
  expect(syncCurrentFastingMock).toHaveBeenCalledTimes(restoreSyncCallCount);

  ReactTestRenderer.act(() => renderer.unmount());
});

test('结束 eating 清除失败时保持 eating 且不取消提醒', async () => {
  readCurrentFastingStateMock.mockResolvedValue(
    restoredState({
      storageVersion: 2,
      session: VALID_EATING_SESSION,
      completionNotificationId: 'notification-eating',
    }),
  );
  clearCurrentFastingStateMock.mockRejectedValue(new Error('remove failed'));
  const renderer = await renderScreen();

  pressButton(renderer, '结束进食窗口');
  await flushPromises();

  expect(getRenderedText(renderer)).toContain('进食窗口');
  expect(getRenderedText(renderer)).toContain(
    '本地状态清除失败，进食窗口仍在继续，请重试。',
  );
  expect(cancelCycleCompletionNotificationMock).not.toHaveBeenCalled();

  ReactTestRenderer.act(() => renderer.unmount());
});

test('结束 eating 后取消提醒失败仍保持 idle', async () => {
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
  readCurrentFastingStateMock.mockResolvedValue(
    restoredState({
      storageVersion: 2,
      session: VALID_EATING_SESSION,
      completionNotificationId: 'notification-eating',
    }),
  );
  cancelCycleCompletionNotificationMock.mockRejectedValue(
    new Error('cancel failed'),
  );
  const renderer = await renderScreen();

  pressButton(renderer, '结束进食窗口');
  await flushPromises();

  expect(getRenderedText(renderer)).toContain('尚未开始');
  expect(getRenderedText(renderer)).toContain('上一阶段提醒可能仍会出现');

  ReactTestRenderer.act(() => renderer.unmount());
});

test('快速重复点击在三个状态切换中都只执行一次主存储操作', async () => {
  const firstSaveDeferred = createDeferred<void>();
  saveCurrentFastingStateMock
    .mockReturnValueOnce(firstSaveDeferred.promise)
    .mockResolvedValue();
  const renderer = await renderScreen();
  const startButton = renderer.root.findByProps({
    accessibilityLabel: '开始断食',
  });

  ReactTestRenderer.act(() => {
    startButton.props.onPress();
    startButton.props.onPress();
  });
  expect(saveCurrentFastingStateMock).toHaveBeenCalledTimes(1);

  await ReactTestRenderer.act(async () => {
    firstSaveDeferred.resolve();
    await firstSaveDeferred.promise;
  });
  await flushPromises();

  const eatingSaveDeferred = createDeferred<void>();
  saveCompletedFastingAndCurrentStateMock.mockReturnValueOnce(
    eatingSaveDeferred.promise,
  );
  const endFastingButton = renderer.root.findByProps({
    accessibilityLabel: '结束断食',
  });

  ReactTestRenderer.act(() => {
    endFastingButton.props.onPress();
    endFastingButton.props.onPress();
  });
  expect(saveCompletedFastingAndCurrentStateMock).toHaveBeenCalledTimes(1);

  await ReactTestRenderer.act(async () => {
    eatingSaveDeferred.resolve();
    await eatingSaveDeferred.promise;
  });
  await flushPromises();

  const clearDeferred = createDeferred<void>();
  clearCurrentFastingStateMock.mockReturnValue(clearDeferred.promise);
  const endEatingButton = renderer.root.findByProps({
    accessibilityLabel: '结束进食窗口',
  });

  ReactTestRenderer.act(() => {
    endEatingButton.props.onPress();
    endEatingButton.props.onPress();
  });
  expect(clearCurrentFastingStateMock).toHaveBeenCalledTimes(1);

  await ReactTestRenderer.act(async () => {
    clearDeferred.resolve();
    await clearDeferred.promise;
  });

  ReactTestRenderer.act(() => renderer.unmount());
});

test('损坏数据明确提示且只在用户重置后清除', async () => {
  readCurrentFastingStateMock.mockResolvedValue({status: 'invalid'});
  const renderer = await renderScreen();

  expect(getRenderedText(renderer)).toContain('上次周期状态无法恢复');
  expect(getRenderedText(renderer)).toContain('重置前不会覆盖或删除它');
  expect(resetCurrentCycleDataMock).not.toHaveBeenCalled();
  expect(
    renderer.root.findAllByProps({accessibilityLabel: '开始断食'}),
  ).toHaveLength(0);

  pressButton(renderer, '重置本地状态');
  await flushPromises();

  expect(resetCurrentCycleDataMock).toHaveBeenCalledTimes(1);
  expect(
    renderer.root.findByProps({accessibilityLabel: '开始断食'}),
  ).toBeDefined();

  ReactTestRenderer.act(() => renderer.unmount());
});

test('损坏数据重置失败时继续保留错误状态', async () => {
  readCurrentFastingStateMock.mockResolvedValue({status: 'invalid'});
  resetCurrentCycleDataMock.mockRejectedValue(new Error('remove failed'));
  const renderer = await renderScreen();

  pressButton(renderer, '重置本地状态');
  await flushPromises();

  expect(getRenderedText(renderer)).toContain('上次周期状态无法恢复');
  expect(getRenderedText(renderer)).toContain(
    '本地状态清除失败，原记录仍保留在手机中，请重试。',
  );
  expect(
    renderer.root.findAllByProps({accessibilityLabel: '开始断食'}),
  ).toHaveLength(0);

  ReactTestRenderer.act(() => renderer.unmount());
});

test('底层读取失败时提供重试，不会假装进入 idle', async () => {
  readCurrentFastingStateMock
    .mockRejectedValueOnce(new Error('read failed'))
    .mockResolvedValueOnce({status: 'empty'});
  const renderer = await renderScreen();

  expect(getRenderedText(renderer)).toContain('暂时无法读取周期状态');
  expect(
    renderer.root.findAllByProps({accessibilityLabel: '开始断食'}),
  ).toHaveLength(0);

  pressButton(renderer, '重试恢复');
  await flushPromises();

  expect(readCurrentFastingStateMock).toHaveBeenCalledTimes(2);
  expect(
    renderer.root.findByProps({accessibilityLabel: '开始断食'}),
  ).toBeDefined();

  ReactTestRenderer.act(() => renderer.unmount());
});

test('interval 每秒只刷新时间，不会再次持久化', async () => {
  const renderer = await renderScreen();

  pressButton(renderer, '开始断食');
  await flushPromises();
  expect(saveCurrentFastingStateMock).toHaveBeenCalledTimes(1);
  const permissionCallCount =
    requestCycleNotificationPermissionMock.mock.calls.length;
  const scheduleCallCount =
    scheduleCycleCompletionNotificationMock.mock.calls.length;
  const queryCallCount =
    isCycleCompletionNotificationScheduledMock.mock.calls.length;
  const cancelCallCount =
    cancelCycleCompletionNotificationMock.mock.calls.length;
  const countdownStartCallCount =
    startCycleCountdownNotificationMock.mock.calls.length;
  const countdownStopCallCount =
    stopCycleCountdownNotificationMock.mock.calls.length;
  const syncCallCount = syncCurrentFastingMock.mock.calls.length;

  ReactTestRenderer.act(() => {
    jest.advanceTimersByTime(5000);
  });

  expect(getRenderedText(renderer)).toContain('00:00:05');
  expect(saveCurrentFastingStateMock).toHaveBeenCalledTimes(1);
  expect(clearCurrentFastingStateMock).not.toHaveBeenCalled();
  expect(requestCycleNotificationPermissionMock).toHaveBeenCalledTimes(
    permissionCallCount,
  );
  expect(scheduleCycleCompletionNotificationMock).toHaveBeenCalledTimes(
    scheduleCallCount,
  );
  expect(isCycleCompletionNotificationScheduledMock).toHaveBeenCalledTimes(
    queryCallCount,
  );
  expect(cancelCycleCompletionNotificationMock).toHaveBeenCalledTimes(
    cancelCallCount,
  );
  expect(startCycleCountdownNotificationMock).toHaveBeenCalledTimes(
    countdownStartCallCount,
  );
  expect(stopCycleCountdownNotificationMock).toHaveBeenCalledTimes(
    countdownStopCallCount,
  );
  expect(syncCurrentFastingMock).toHaveBeenCalledTimes(syncCallCount);

  ReactTestRenderer.act(() => renderer.unmount());
});

test('eating 每秒刷新也不会写存储、通知或 DataItem', async () => {
  readCurrentFastingStateMock.mockResolvedValue(
    restoredState({
      storageVersion: 2,
      session: VALID_EATING_SESSION,
      completionNotificationId: 'notification-eating',
    }),
  );
  const renderer = await renderScreen();
  const saveCallCount = saveCurrentFastingStateMock.mock.calls.length;
  const queryCallCount =
    isCycleCompletionNotificationScheduledMock.mock.calls.length;
  const countdownStartCallCount =
    startCycleCountdownNotificationMock.mock.calls.length;
  const countdownStopCallCount =
    stopCycleCountdownNotificationMock.mock.calls.length;
  const syncCallCount = syncCurrentFastingMock.mock.calls.length;

  ReactTestRenderer.act(() => {
    jest.advanceTimersByTime(5000);
  });

  expect(getRenderedText(renderer)).toContain('07:59:55');
  expect(saveCurrentFastingStateMock).toHaveBeenCalledTimes(saveCallCount);
  expect(clearCurrentFastingStateMock).not.toHaveBeenCalled();
  expect(isCycleCompletionNotificationScheduledMock).toHaveBeenCalledTimes(
    queryCallCount,
  );
  expect(scheduleCycleCompletionNotificationMock).not.toHaveBeenCalled();
  expect(cancelCycleCompletionNotificationMock).not.toHaveBeenCalled();
  expect(startCycleCountdownNotificationMock).toHaveBeenCalledTimes(
    countdownStartCallCount,
  );
  expect(stopCycleCountdownNotificationMock).toHaveBeenCalledTimes(
    countdownStopCallCount,
  );
  expect(syncCurrentFastingMock).toHaveBeenCalledTimes(syncCallCount);

  ReactTestRenderer.act(() => renderer.unmount());
});

test('重新打开后按原时间戳和新的当前时间继续计算', async () => {
  const firstRenderer = await renderScreen();

  pressButton(firstRenderer, '开始断食');
  await flushPromises();
  const savedSession = saveCurrentFastingStateMock.mock.calls[0][0];
  ReactTestRenderer.act(() => firstRenderer.unmount());

  jest.setSystemTime(FIXED_NOW + 5 * 60 * 1000);
  readCurrentFastingStateMock.mockResolvedValue(
    restoredState({storageVersion: 2, session: savedSession}),
  );
  const reopenedRenderer = await renderScreen();

  expect(savedSession.startAt).toBe(FIXED_NOW);
  expect(savedSession.plannedEndAt).toBe(FIXED_NOW + DEFAULT_FASTING_MS);
  expect(getRenderedText(reopenedRenderer)).toContain('00:05:00');
  expect(getRenderedText(reopenedRenderer)).toContain('15:55:00');

  ReactTestRenderer.act(() => reopenedRenderer.unmount());
});

test('到达目标后保持会话、剩余不为负数，直到用户结束', async () => {
  const clearIntervalSpy = jest.spyOn(globalThis, 'clearInterval');
  const shortFastingSession: FastingSession = {
    id: 'fasting-short',
    status: 'fasting',
    startAt: FIXED_NOW,
    plannedEndAt: FIXED_NOW + 1000,
  };
  readCurrentFastingStateMock.mockResolvedValue(
    restoredState({storageVersion: 2, session: shortFastingSession}),
  );
  const renderer = await renderScreen();

  ReactTestRenderer.act(() => {
    jest.advanceTimersByTime(1000);
  });

  expect(getRenderedText(renderer)).toContain('断食目标已达成');
  expect(getRenderedText(renderer)).toContain('已完成 100%');
  expect(getRenderedText(renderer)).not.toContain('-00:');
  expect(saveCurrentFastingStateMock).not.toHaveBeenCalled();
  expect(clearCurrentFastingStateMock).not.toHaveBeenCalled();

  pressButton(renderer, '结束断食');
  await flushPromises();
  expect(getRenderedText(renderer)).toContain('进食窗口');
  expect(clearIntervalSpy).toHaveBeenCalledTimes(1);

  ReactTestRenderer.act(() => renderer.unmount());
});

test('进食窗口用短时长到零后不自动回 idle', async () => {
  const shortEatingSession: ActiveCycleSession = {
    id: 'eating-short',
    status: 'eating',
    startAt: FIXED_NOW,
    plannedEndAt: FIXED_NOW + 1000,
  };
  readCurrentFastingStateMock.mockResolvedValue(
    restoredState({storageVersion: 2, session: shortEatingSession}),
  );
  const renderer = await renderScreen();

  ReactTestRenderer.act(() => {
    jest.advanceTimersByTime(1000);
  });

  expect(getRenderedText(renderer)).toContain('进食窗口已结束');
  expect(getRenderedText(renderer)).toContain('00:00:00');
  expect(clearCurrentFastingStateMock).not.toHaveBeenCalled();
  expect(
    renderer.root.findByProps({accessibilityLabel: '结束进食窗口'}),
  ).toBeDefined();

  ReactTestRenderer.act(() => renderer.unmount());
});

test('回到前台时立即按新的系统时间校正显示', async () => {
  let handleAppStateChange: ((state: 'active') => void) | undefined;
  const removeAppStateListener = jest.fn();

  jest
    .spyOn(AppState, 'addEventListener')
    .mockImplementation((_type, listener) => {
      handleAppStateChange = listener;
      return {remove: removeAppStateListener};
    });
  readCurrentFastingStateMock.mockResolvedValue(restoredState());
  const renderer = await renderScreen();

  // 这里故意不推动 interval，只把系统时间移到五分钟后，模拟后台暂停了每秒刷新。
  jest.setSystemTime(FIXED_NOW + 5 * 60 * 1000);
  ReactTestRenderer.act(() => {
    handleAppStateChange?.('active');
  });

  expect(getRenderedText(renderer)).toContain('00:05:00');
  expect(getRenderedText(renderer)).toContain('15:55:00');

  ReactTestRenderer.act(() => renderer.unmount());
  expect(removeAppStateListener).toHaveBeenCalledTimes(1);
});
