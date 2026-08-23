// ==================== 禁食页面测试 ====================
// 假时钟（由测试控制的系统时间）可以瞬间走过一秒或 16 小时，不必等待真实时间，也不会改动正式页面时长。
// 存储函数使用 mock（行为可控制的替身），用来证明页面严格等待读写成功，并能显示失败与损坏状态。

import React from 'react';
import {AppState, StyleSheet} from 'react-native';
import ReactTestRenderer from 'react-test-renderer';

import {syncCurrentFasting} from '../../../../modules/wear-data-layer';
import {theme} from '../../../app/theme';
import type {FastingSession} from '../domain/fasting';
import {
  cancelFastingCompletionNotification,
  isFastingCompletionNotificationScheduled,
  requestFastingNotificationPermission,
  scheduleFastingCompletionNotification,
} from '../notifications/fastingNotifications';
import {
  clearCurrentFastingState,
  readCurrentFastingState,
  saveCurrentFastingState,
} from '../storage/fastingStorage';
import type {PersistedFastingState} from '../storage/fastingStorage';
import {FastingScreen} from './FastingScreen';

jest.mock('react-native-safe-area-context', () =>
  jest.requireActual('react-native-safe-area-context/jest/mock').default,
);

jest.mock('../storage/fastingStorage', () => ({
  clearCurrentFastingState: jest.fn(),
  readCurrentFastingState: jest.fn(),
  saveCurrentFastingState: jest.fn(),
}));

jest.mock('../notifications/fastingNotifications', () => ({
  cancelFastingCompletionNotification: jest.fn(),
  isFastingCompletionNotificationScheduled: jest.fn(),
  requestFastingNotificationPermission: jest.fn(),
  scheduleFastingCompletionNotification: jest.fn(),
}));

jest.mock('../../../../modules/wear-data-layer', () => ({
  syncCurrentFasting: jest.fn(),
}));

const clearCurrentFastingStateMock =
  clearCurrentFastingState as jest.MockedFunction<
    typeof clearCurrentFastingState
  >;
const readCurrentFastingStateMock =
  readCurrentFastingState as jest.MockedFunction<
    typeof readCurrentFastingState
  >;
const saveCurrentFastingStateMock =
  saveCurrentFastingState as jest.MockedFunction<
    typeof saveCurrentFastingState
  >;
const cancelFastingCompletionNotificationMock =
  cancelFastingCompletionNotification as jest.MockedFunction<
    typeof cancelFastingCompletionNotification
  >;
const isFastingCompletionNotificationScheduledMock =
  isFastingCompletionNotificationScheduled as jest.MockedFunction<
    typeof isFastingCompletionNotificationScheduled
  >;
const requestFastingNotificationPermissionMock =
  requestFastingNotificationPermission as jest.MockedFunction<
    typeof requestFastingNotificationPermission
  >;
const scheduleFastingCompletionNotificationMock =
  scheduleFastingCompletionNotification as jest.MockedFunction<
    typeof scheduleFastingCompletionNotification
  >;
const syncCurrentFastingMock = jest.mocked(syncCurrentFasting);

const FIXED_NOW = new Date(2026, 7, 23, 20, 0, 0).getTime();
const DEFAULT_FASTING_MS = 16 * 60 * 60 * 1000;
const VALID_SESSION: FastingSession = {
  id: `fasting-${FIXED_NOW}`,
  status: 'fasting',
  startAt: FIXED_NOW,
  plannedEndAt: FIXED_NOW + DEFAULT_FASTING_MS,
};
const VALID_PERSISTED_STATE = {
  storageVersion: 1 as const,
  session: VALID_SESSION,
};

function restoredState(
  state: PersistedFastingState = VALID_PERSISTED_STATE,
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
  saveCurrentFastingStateMock.mockResolvedValue();
  clearCurrentFastingStateMock.mockResolvedValue();
  requestFastingNotificationPermissionMock.mockResolvedValue(false);
  scheduleFastingCompletionNotificationMock.mockResolvedValue(
    'notification-1',
  );
  isFastingCompletionNotificationScheduledMock.mockResolvedValue(true);
  cancelFastingCompletionNotificationMock.mockResolvedValue();
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

  expect(getRenderedText(renderer)).toContain('正在恢复断食状态');
  expect(
    renderer.root.findAllByProps({accessibilityLabel: '开始断食'}),
  ).toHaveLength(0);
  expect(
    renderer.root.findAllByProps({
      accessibilityLabel: '当前断食状态：16 小时断食',
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

test('合法数据恢复为 fasting 并保留原开始和结束时间', async () => {
  const setIntervalSpy = jest.spyOn(globalThis, 'setInterval');
  const clearIntervalSpy = jest.spyOn(globalThis, 'clearInterval');
  readCurrentFastingStateMock.mockResolvedValue(restoredState());

  const renderer = await renderScreen();

  expect(getRenderedText(renderer)).toContain('断食进行中');
  expect(getRenderedText(renderer)).toContain('08/23 20:00');
  expect(getRenderedText(renderer)).toContain('08/24 12:00');
  expect(getRenderedText(renderer)).toContain('还剩 16:00:00');
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

test('恢复时已有有效提醒不会重复安排', async () => {
  readCurrentFastingStateMock.mockResolvedValue(
    restoredState({
      ...VALID_PERSISTED_STATE,
      completionNotificationId: 'notification-1',
    }),
  );

  const renderer = await renderScreen();

  expect(getRenderedText(renderer)).toContain('断食进行中');
  expect(isFastingCompletionNotificationScheduledMock).toHaveBeenCalledWith(
    'notification-1',
  );
  expect(requestFastingNotificationPermissionMock).not.toHaveBeenCalled();
  expect(scheduleFastingCompletionNotificationMock).not.toHaveBeenCalled();
  expect(saveCurrentFastingStateMock).not.toHaveBeenCalled();

  ReactTestRenderer.act(() => renderer.unmount());
});

test('恢复核对失败时仍恢复会话，并且不冒险重复安排', async () => {
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
  isFastingCompletionNotificationScheduledMock.mockRejectedValue(
    new Error('query failed'),
  );
  readCurrentFastingStateMock.mockResolvedValue(
    restoredState({
      ...VALID_PERSISTED_STATE,
      completionNotificationId: 'notification-1',
    }),
  );

  const renderer = await renderScreen();

  expect(getRenderedText(renderer)).toContain('断食进行中');
  expect(getRenderedText(renderer)).toContain('提醒未启用');
  expect(scheduleFastingCompletionNotificationMock).not.toHaveBeenCalled();

  ReactTestRenderer.act(() => renderer.unmount());
});

test('恢复时缺少取件号码会补安排一次并写回', async () => {
  requestFastingNotificationPermissionMock.mockResolvedValue(true);
  readCurrentFastingStateMock.mockResolvedValue(restoredState());

  const renderer = await renderScreen();

  expect(getRenderedText(renderer)).toContain('断食进行中');
  expect(isFastingCompletionNotificationScheduledMock).not.toHaveBeenCalled();
  expect(scheduleFastingCompletionNotificationMock).toHaveBeenCalledTimes(1);
  expect(saveCurrentFastingStateMock).toHaveBeenCalledWith(
    VALID_SESSION,
    'notification-1',
  );

  ReactTestRenderer.act(() => renderer.unmount());
});

test('恢复时取件号码对应的系统提醒不存在会补安排一次', async () => {
  requestFastingNotificationPermissionMock.mockResolvedValue(true);
  isFastingCompletionNotificationScheduledMock.mockResolvedValue(false);
  readCurrentFastingStateMock.mockResolvedValue(
    restoredState({
      ...VALID_PERSISTED_STATE,
      completionNotificationId: 'missing-notification',
    }),
  );

  const renderer = await renderScreen();

  expect(scheduleFastingCompletionNotificationMock).toHaveBeenCalledTimes(1);
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
    restoredState({storageVersion: 1, session: expiredSession}),
  );

  const renderer = await renderScreen();

  expect(getRenderedText(renderer)).toContain('目标已达成');
  expect(isFastingCompletionNotificationScheduledMock).not.toHaveBeenCalled();
  expect(requestFastingNotificationPermissionMock).not.toHaveBeenCalled();
  expect(scheduleFastingCompletionNotificationMock).not.toHaveBeenCalled();

  ReactTestRenderer.act(() => renderer.unmount());
});

test('普通重渲染不会再次核对或安排提醒', async () => {
  requestFastingNotificationPermissionMock.mockResolvedValue(true);
  readCurrentFastingStateMock.mockResolvedValue(restoredState());
  const renderer = await renderScreen();

  ReactTestRenderer.act(() => {
    renderer.update(<FastingScreen />);
  });

  expect(readCurrentFastingStateMock).toHaveBeenCalledTimes(1);
  expect(scheduleFastingCompletionNotificationMock).toHaveBeenCalledTimes(1);
  expect(saveCurrentFastingStateMock).toHaveBeenCalledTimes(1);
  expect(syncCurrentFastingMock).toHaveBeenCalledTimes(1);

  ReactTestRenderer.act(() => renderer.unmount());
});

test('恢复核对完成前不允许用户结束，避免旧结果覆盖新操作', async () => {
  const queryDeferred = createDeferred<boolean>();
  isFastingCompletionNotificationScheduledMock.mockReturnValue(
    queryDeferred.promise,
  );
  readCurrentFastingStateMock.mockResolvedValue(
    restoredState({
      ...VALID_PERSISTED_STATE,
      completionNotificationId: 'notification-1',
    }),
  );
  const renderer = await renderScreen();

  expect(getRenderedText(renderer)).toContain('正在恢复断食状态');
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
    accessibilityLabel: '当前断食状态：16 小时断食',
  });
  const idleRingStyle = StyleSheet.flatten(idleRing.props.style);
  expect(idleRingStyle.width).toBe(idleRingStyle.height);

  pressButton(renderer, '开始断食');

  expect(saveCurrentFastingStateMock).toHaveBeenCalledTimes(1);
  expect(saveCurrentFastingStateMock).toHaveBeenCalledWith(VALID_SESSION);
  expect(requestFastingNotificationPermissionMock).not.toHaveBeenCalled();
  expect(getRenderedText(renderer)).not.toContain('断食进行中');
  expect(
    renderer.root.findByProps({accessibilityLabel: '正在开始…'}).props.disabled,
  ).toBe(true);

  await ReactTestRenderer.act(async () => {
    saveDeferred.resolve();
    await saveDeferred.promise;
  });

  expect(getRenderedText(renderer)).toContain('断食进行中');
  expect(getRenderedText(renderer)).toContain('已完成 0%');
  expect(getRenderedText(renderer)).toContain('还剩 16:00:00');
  expect(requestFastingNotificationPermissionMock).toHaveBeenCalledTimes(1);
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
  requestFastingNotificationPermissionMock.mockResolvedValue(true);
  const renderer = await renderScreen();

  pressButton(renderer, '开始断食');
  await flushPromises();

  expect(getRenderedText(renderer)).toContain('断食进行中');
  expect(scheduleFastingCompletionNotificationMock).toHaveBeenCalledTimes(1);
  expect(scheduleFastingCompletionNotificationMock).toHaveBeenCalledWith(
    VALID_SESSION.plannedEndAt,
  );
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
    scheduleFastingCompletionNotificationMock.mock.invocationCallOrder[0],
  );
  expect(getRenderedText(renderer)).not.toContain('提醒未启用');

  ReactTestRenderer.act(() => renderer.unmount());
});

test('权限拒绝时会话仍进入 fasting，并显示提醒不可用', async () => {
  const renderer = await renderScreen();

  pressButton(renderer, '开始断食');
  await flushPromises();

  expect(getRenderedText(renderer)).toContain('断食进行中');
  expect(getRenderedText(renderer)).toContain('提醒未启用');
  expect(saveCurrentFastingStateMock).toHaveBeenCalledTimes(1);
  expect(scheduleFastingCompletionNotificationMock).not.toHaveBeenCalled();
  expect(clearCurrentFastingStateMock).not.toHaveBeenCalled();

  ReactTestRenderer.act(() => renderer.unmount());
});

test('通知安排失败时不回滚已保存的会话', async () => {
  const consoleErrorSpy = jest
    .spyOn(console, 'error')
    .mockImplementation(() => undefined);
  requestFastingNotificationPermissionMock.mockResolvedValue(true);
  scheduleFastingCompletionNotificationMock.mockRejectedValue(
    new Error('schedule failed'),
  );
  const renderer = await renderScreen();

  pressButton(renderer, '开始断食');
  await flushPromises();

  expect(getRenderedText(renderer)).toContain('断食进行中');
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

  expect(getRenderedText(renderer)).toContain('断食进行中');
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
  requestFastingNotificationPermissionMock.mockResolvedValue(true);
  saveCurrentFastingStateMock
    .mockResolvedValueOnce()
    .mockRejectedValueOnce(new Error('second write failed'));
  const renderer = await renderScreen();

  pressButton(renderer, '开始断食');
  await flushPromises();

  expect(getRenderedText(renderer)).toContain('断食进行中');
  expect(getRenderedText(renderer)).toContain('提醒未启用');
  expect(saveCurrentFastingStateMock).toHaveBeenCalledTimes(2);
  expect(cancelFastingCompletionNotificationMock).toHaveBeenCalledWith(
    'notification-1',
  );
  expect(clearCurrentFastingStateMock).not.toHaveBeenCalled();
  expect(consoleErrorSpy).toHaveBeenCalledWith(
    '[NutriTime] notification-id-save-failed',
    {errorName: 'Error'},
  );

  ReactTestRenderer.act(() => renderer.unmount());
});

test('结束时先删除，删除成功后页面才进入 idle', async () => {
  const clearIntervalSpy = jest.spyOn(globalThis, 'clearInterval');
  readCurrentFastingStateMock.mockResolvedValue(restoredState());
  const clearDeferred = createDeferred<void>();
  clearCurrentFastingStateMock.mockReturnValue(clearDeferred.promise);
  const renderer = await renderScreen();

  pressButton(renderer, '结束断食');

  expect(clearCurrentFastingStateMock).toHaveBeenCalledTimes(1);
  expect(getRenderedText(renderer)).toContain('断食进行中');
  expect(
    renderer.root.findByProps({accessibilityLabel: '正在结束…'}).props.disabled,
  ).toBe(true);

  await ReactTestRenderer.act(async () => {
    clearDeferred.resolve();
    await clearDeferred.promise;
  });

  expect(getRenderedText(renderer)).toContain('尚未开始');
  expect(clearIntervalSpy).toHaveBeenCalledTimes(1);
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

test('结束时先保留取件号码，再清本地，最后取消对应提醒', async () => {
  const stateWithNotification: PersistedFastingState = {
    ...VALID_PERSISTED_STATE,
    completionNotificationId: 'notification-1',
  };
  readCurrentFastingStateMock.mockResolvedValue(
    restoredState(stateWithNotification),
  );
  const cancelDeferred = createDeferred<void>();
  cancelFastingCompletionNotificationMock.mockReturnValue(
    cancelDeferred.promise,
  );
  const renderer = await renderScreen();

  pressButton(renderer, '结束断食');
  await flushPromises();

  expect(getRenderedText(renderer)).toContain('尚未开始');
  expect(clearCurrentFastingStateMock).toHaveBeenCalledTimes(1);
  expect(cancelFastingCompletionNotificationMock).toHaveBeenCalledWith(
    'notification-1',
  );
  expect(
    clearCurrentFastingStateMock.mock.invocationCallOrder[0],
  ).toBeLessThan(
    cancelFastingCompletionNotificationMock.mock.invocationCallOrder[0],
  );

  await ReactTestRenderer.act(async () => {
    cancelDeferred.resolve();
    await cancelDeferred.promise;
  });
  ReactTestRenderer.act(() => renderer.unmount());
});

test('取消提醒失败时仍保持 idle，并显示非阻塞提示', async () => {
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
  readCurrentFastingStateMock.mockResolvedValue(
    restoredState({
      ...VALID_PERSISTED_STATE,
      completionNotificationId: 'notification-1',
    }),
  );
  cancelFastingCompletionNotificationMock.mockRejectedValue(
    new Error('cancel failed'),
  );
  const renderer = await renderScreen();

  pressButton(renderer, '结束断食');
  await flushPromises();

  expect(getRenderedText(renderer)).toContain('尚未开始');
  expect(getRenderedText(renderer)).toContain('旧提醒可能仍会出现');
  expect(clearCurrentFastingStateMock).toHaveBeenCalledTimes(1);
  expect(syncCurrentFastingMock).toHaveBeenLastCalledWith(
    expect.objectContaining({status: 'idle'}),
    true,
  );

  ReactTestRenderer.act(() => renderer.unmount());
});

test('删除失败时保留 fasting 并显示明确错误', async () => {
  const clearIntervalSpy = jest.spyOn(globalThis, 'clearInterval');
  readCurrentFastingStateMock.mockResolvedValue(restoredState());
  clearCurrentFastingStateMock.mockRejectedValue(new Error('remove failed'));
  const renderer = await renderScreen();

  pressButton(renderer, '结束断食');
  await flushPromises();

  expect(getRenderedText(renderer)).toContain('断食进行中');
  expect(getRenderedText(renderer)).toContain(
    '本地状态清除失败，本次断食仍在继续，请重试。',
  );
  expect(clearIntervalSpy).not.toHaveBeenCalled();
  expect(
    syncCurrentFastingMock.mock.calls.some(
      ([payload]) => payload.status === 'idle',
    ),
  ).toBe(false);

  ReactTestRenderer.act(() => renderer.unmount());
});

test('快速重复点击开始和结束都只执行一次存储操作', async () => {
  requestFastingNotificationPermissionMock.mockResolvedValue(true);
  const saveDeferred = createDeferred<void>();
  saveCurrentFastingStateMock
    .mockReturnValueOnce(saveDeferred.promise)
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
    saveDeferred.resolve();
    await saveDeferred.promise;
  });
  await flushPromises();
  expect(scheduleFastingCompletionNotificationMock).toHaveBeenCalledTimes(1);

  const clearDeferred = createDeferred<void>();
  clearCurrentFastingStateMock.mockReturnValue(clearDeferred.promise);
  const endButton = renderer.root.findByProps({
    accessibilityLabel: '结束断食',
  });

  ReactTestRenderer.act(() => {
    endButton.props.onPress();
    endButton.props.onPress();
  });
  expect(clearCurrentFastingStateMock).toHaveBeenCalledTimes(1);
  expect(cancelFastingCompletionNotificationMock).not.toHaveBeenCalled();

  await ReactTestRenderer.act(async () => {
    clearDeferred.resolve();
    await clearDeferred.promise;
  });
  expect(cancelFastingCompletionNotificationMock).toHaveBeenCalledTimes(1);

  ReactTestRenderer.act(() => renderer.unmount());
});

test('损坏数据明确提示且只在用户重置后清除', async () => {
  readCurrentFastingStateMock.mockResolvedValue({status: 'invalid'});
  const renderer = await renderScreen();

  expect(getRenderedText(renderer)).toContain('上次断食状态无法恢复');
  expect(getRenderedText(renderer)).toContain('重置前不会覆盖或删除它');
  expect(clearCurrentFastingStateMock).not.toHaveBeenCalled();
  expect(
    renderer.root.findAllByProps({accessibilityLabel: '开始断食'}),
  ).toHaveLength(0);

  pressButton(renderer, '重置本地状态');
  await flushPromises();

  expect(clearCurrentFastingStateMock).toHaveBeenCalledTimes(1);
  expect(
    renderer.root.findByProps({accessibilityLabel: '开始断食'}),
  ).toBeDefined();

  ReactTestRenderer.act(() => renderer.unmount());
});

test('损坏数据重置失败时继续保留错误状态', async () => {
  readCurrentFastingStateMock.mockResolvedValue({status: 'invalid'});
  clearCurrentFastingStateMock.mockRejectedValue(new Error('remove failed'));
  const renderer = await renderScreen();

  pressButton(renderer, '重置本地状态');
  await flushPromises();

  expect(getRenderedText(renderer)).toContain('上次断食状态无法恢复');
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

  expect(getRenderedText(renderer)).toContain('暂时无法读取断食状态');
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
    requestFastingNotificationPermissionMock.mock.calls.length;
  const scheduleCallCount =
    scheduleFastingCompletionNotificationMock.mock.calls.length;
  const queryCallCount =
    isFastingCompletionNotificationScheduledMock.mock.calls.length;
  const cancelCallCount =
    cancelFastingCompletionNotificationMock.mock.calls.length;
  const syncCallCount = syncCurrentFastingMock.mock.calls.length;

  ReactTestRenderer.act(() => {
    jest.advanceTimersByTime(5000);
  });

  expect(getRenderedText(renderer)).toContain('00:00:05');
  expect(saveCurrentFastingStateMock).toHaveBeenCalledTimes(1);
  expect(clearCurrentFastingStateMock).not.toHaveBeenCalled();
  expect(requestFastingNotificationPermissionMock).toHaveBeenCalledTimes(
    permissionCallCount,
  );
  expect(scheduleFastingCompletionNotificationMock).toHaveBeenCalledTimes(
    scheduleCallCount,
  );
  expect(isFastingCompletionNotificationScheduledMock).toHaveBeenCalledTimes(
    queryCallCount,
  );
  expect(cancelFastingCompletionNotificationMock).toHaveBeenCalledTimes(
    cancelCallCount,
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
    restoredState({storageVersion: 1, session: savedSession}),
  );
  const reopenedRenderer = await renderScreen();

  expect(savedSession.startAt).toBe(FIXED_NOW);
  expect(savedSession.plannedEndAt).toBe(FIXED_NOW + DEFAULT_FASTING_MS);
  expect(getRenderedText(reopenedRenderer)).toContain('00:05:00');
  expect(getRenderedText(reopenedRenderer)).toContain('还剩 15:55:00');

  ReactTestRenderer.act(() => reopenedRenderer.unmount());
});

test('到达目标后保持会话、剩余不为负数，直到用户结束', async () => {
  const clearIntervalSpy = jest.spyOn(globalThis, 'clearInterval');
  readCurrentFastingStateMock.mockResolvedValue(restoredState());
  const renderer = await renderScreen();

  jest.setSystemTime(FIXED_NOW + DEFAULT_FASTING_MS - 1000);
  ReactTestRenderer.act(() => {
    jest.advanceTimersByTime(1000);
  });

  expect(getRenderedText(renderer)).toContain('目标已达成');
  expect(getRenderedText(renderer)).toContain('已完成 100%');
  expect(getRenderedText(renderer)).not.toContain('还剩 -');

  pressButton(renderer, '结束本次断食');
  await flushPromises();
  expect(clearIntervalSpy).toHaveBeenCalledTimes(1);

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
  expect(getRenderedText(renderer)).toContain('还剩 15:55:00');

  ReactTestRenderer.act(() => renderer.unmount());
  expect(removeAppStateListener).toHaveBeenCalledTimes(1);
});
