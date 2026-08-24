// ==================== 当前断食本地存储测试 ====================
// AsyncStorage mock（可控制的手机小抽屉替身）让测试能直接准备空、合法、损坏和读写失败的数据。

import AsyncStorage from '@react-native-async-storage/async-storage';

import type {ActiveCycleSession, FastingSession} from '../domain/fasting';
import {
  clearCurrentFastingState,
  readCyclePlan,
  readCurrentFastingState,
  resetCurrentCycleData,
  saveCyclePlan,
  saveCyclePlanAndCurrentState,
  saveCurrentFastingState,
} from './fastingStorage';

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(),
    multiRemove: jest.fn(),
    multiSet: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  },
}));

const asyncStorageMock = AsyncStorage as jest.Mocked<typeof AsyncStorage>;
const STORAGE_KEY = '@nutritime/fasting/current';
const PLAN_STORAGE_KEY = '@nutritime/cycle/plan';
const CUSTOM_PLAN = {fastingMinutes: 14 * 60, eatingMinutes: 10 * 60};
const VALID_SESSION: FastingSession = {
  id: 'fasting-1787313600000',
  status: 'fasting',
  startAt: 1_787_313_600_000,
  plannedEndAt: 1_787_371_200_000,
};
const VALID_EATING_SESSION: ActiveCycleSession = {
  id: 'eating-1787371200000',
  status: 'eating',
  startAt: 1_787_371_200_000,
  plannedEndAt: 1_787_400_000_000,
};

beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(() => {
  jest.restoreAllMocks();
});

test('没有本地数据时返回 empty', async () => {
  asyncStorageMock.getItem.mockResolvedValue(null);

  await expect(readCurrentFastingState()).resolves.toEqual({status: 'empty'});
  expect(asyncStorageMock.getItem).toHaveBeenCalledWith(STORAGE_KEY);
});

test('没有自定义计划时返回默认 16:8', async () => {
  asyncStorageMock.getItem.mockResolvedValue(null);

  await expect(readCyclePlan()).resolves.toEqual({
    status: 'default',
    plan: {fastingMinutes: 16 * 60, eatingMinutes: 8 * 60},
  });
  expect(asyncStorageMock.getItem).toHaveBeenCalledWith(PLAN_STORAGE_KEY);
});

test('合法自定义计划会按原比例恢复', async () => {
  asyncStorageMock.getItem.mockResolvedValue(
    JSON.stringify({storageVersion: 1, plan: CUSTOM_PLAN}),
  );

  await expect(readCyclePlan()).resolves.toEqual({
    status: 'restored',
    plan: CUSTOM_PLAN,
  });
});

test.each([
  ['损坏 JSON', '{bad-json'],
  [
    '未知计划版本',
    JSON.stringify({storageVersion: 2, plan: CUSTOM_PLAN}),
  ],
  [
    '两段不满 24 小时',
    JSON.stringify({
      storageVersion: 1,
      plan: {fastingMinutes: 14 * 60, eatingMinutes: 8 * 60},
    }),
  ],
  [
    '分钟不是整小时',
    JSON.stringify({
      storageVersion: 1,
      plan: {fastingMinutes: 14 * 60 + 30, eatingMinutes: 9 * 60 + 30},
    }),
  ],
])('%s 的自定义计划返回 invalid 且不删除', async (_name, value) => {
  asyncStorageMock.getItem.mockResolvedValue(value);

  await expect(readCyclePlan()).resolves.toEqual({status: 'invalid'});
  expect(asyncStorageMock.removeItem).not.toHaveBeenCalled();
  expect(asyncStorageMock.multiRemove).not.toHaveBeenCalled();
});

test('空闲时单独保存自定义计划', async () => {
  asyncStorageMock.setItem.mockResolvedValue();

  await saveCyclePlan(CUSTOM_PLAN);

  expect(asyncStorageMock.setItem).toHaveBeenCalledWith(
    PLAN_STORAGE_KEY,
    JSON.stringify({storageVersion: 1, plan: CUSTOM_PLAN}),
  );
});

test('活动中把新比例和重算后的阶段一起批量保存', async () => {
  asyncStorageMock.multiSet.mockResolvedValue();
  const state = {
    storageVersion: 2 as const,
    session: VALID_SESSION,
  };

  await saveCyclePlanAndCurrentState(CUSTOM_PLAN, state);

  expect(asyncStorageMock.multiSet).toHaveBeenCalledWith([
    [
      PLAN_STORAGE_KEY,
      JSON.stringify({storageVersion: 1, plan: CUSTOM_PLAN}),
    ],
    [STORAGE_KEY, JSON.stringify(state)],
  ]);
});

test('storageVersion 1 旧数据会保留原断食并迁移为版本 2', async () => {
  asyncStorageMock.getItem.mockResolvedValue(
    JSON.stringify({storageVersion: 1, session: VALID_SESSION}),
  );
  asyncStorageMock.setItem.mockResolvedValue();

  await expect(readCurrentFastingState()).resolves.toEqual({
    status: 'restored',
    session: VALID_SESSION,
    state: {storageVersion: 2, session: VALID_SESSION},
  });
  expect(asyncStorageMock.setItem).toHaveBeenCalledWith(
    STORAGE_KEY,
    JSON.stringify({storageVersion: 2, session: VALID_SESSION}),
  );
});

test('版本 2 fasting 数据会一并恢复通知取件号码', async () => {
  const storedState = {
    storageVersion: 2 as const,
    session: VALID_SESSION,
    completionNotificationId: 'notification-1',
  };
  asyncStorageMock.getItem.mockResolvedValue(JSON.stringify(storedState));

  await expect(readCurrentFastingState()).resolves.toEqual({
    status: 'restored',
    session: VALID_SESSION,
    state: storedState,
  });
});

test('版本 2 eating 数据会按原时间恢复', async () => {
  const storedState = {
    storageVersion: 2 as const,
    session: VALID_EATING_SESSION,
    completionNotificationId: 'notification-eating',
  };
  asyncStorageMock.getItem.mockResolvedValue(JSON.stringify(storedState));

  await expect(readCurrentFastingState()).resolves.toEqual({
    status: 'restored',
    session: VALID_EATING_SESSION,
    state: storedState,
  });
  expect(asyncStorageMock.setItem).not.toHaveBeenCalled();
});

test('旧数据迁移写回失败时仍恢复合法断食且不删除', async () => {
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
  asyncStorageMock.getItem.mockResolvedValue(
    JSON.stringify({
      storageVersion: 1,
      session: VALID_SESSION,
      completionNotificationId: 'notification-1',
    }),
  );
  asyncStorageMock.setItem.mockRejectedValue(new Error('write failed'));

  await expect(readCurrentFastingState()).resolves.toEqual({
    status: 'restored',
    session: VALID_SESSION,
    state: {
      storageVersion: 2,
      session: VALID_SESSION,
      completionNotificationId: 'notification-1',
    },
  });
  expect(asyncStorageMock.removeItem).not.toHaveBeenCalled();
});

test('保存时只写入版本和当前活动会话', async () => {
  asyncStorageMock.setItem.mockResolvedValue();

  await saveCurrentFastingState(VALID_SESSION);

  expect(asyncStorageMock.setItem).toHaveBeenCalledWith(
    STORAGE_KEY,
    JSON.stringify({storageVersion: 2, session: VALID_SESSION}),
  );
});

test('通知安排成功后把系统取件号码写在业务会话外层', async () => {
  asyncStorageMock.setItem.mockResolvedValue();

  await saveCurrentFastingState(VALID_SESSION, 'notification-1');

  expect(asyncStorageMock.setItem).toHaveBeenCalledWith(
    STORAGE_KEY,
    JSON.stringify({
      storageVersion: 2,
      session: VALID_SESSION,
      completionNotificationId: 'notification-1',
    }),
  );
  expect(VALID_SESSION).not.toHaveProperty('completionNotificationId');
});

test('删除时只清理统一的当前会话 key', async () => {
  asyncStorageMock.removeItem.mockResolvedValue();

  await clearCurrentFastingState();

  expect(asyncStorageMock.removeItem).toHaveBeenCalledWith(STORAGE_KEY);
});

test('用户确认重置错误数据时同时清理会话和自定义计划', async () => {
  asyncStorageMock.multiRemove.mockResolvedValue();

  await resetCurrentCycleData();

  expect(asyncStorageMock.multiRemove).toHaveBeenCalledWith([
    STORAGE_KEY,
    PLAN_STORAGE_KEY,
  ]);
});

test('非法 JSON 返回 invalid 且保留原始数据', async () => {
  asyncStorageMock.getItem.mockResolvedValue('{not-json');

  await expect(readCurrentFastingState()).resolves.toEqual({
    status: 'invalid',
  });
  expect(asyncStorageMock.removeItem).not.toHaveBeenCalled();
});

test('未知 storageVersion 返回 invalid 且不静默删除', async () => {
  asyncStorageMock.getItem.mockResolvedValue(
    JSON.stringify({storageVersion: 3, session: VALID_SESSION}),
  );

  await expect(readCurrentFastingState()).resolves.toEqual({
    status: 'invalid',
  });
  expect(asyncStorageMock.removeItem).not.toHaveBeenCalled();
});

test.each([
  ['缺少 session', JSON.stringify({storageVersion: 2})],
  [
    '版本 1 不能伪装成当时不存在的 eating',
    JSON.stringify({storageVersion: 1, session: VALID_EATING_SESSION}),
  ],
  [
    '状态不是 fasting 或 eating',
    JSON.stringify({
      storageVersion: 2,
      session: {...VALID_SESSION, status: 'idle'},
    }),
  ],
  [
    'id 为空',
    JSON.stringify({
      storageVersion: 2,
      session: {...VALID_SESSION, id: '   '},
    }),
  ],
  [
    'session 缺少计划结束时间',
    JSON.stringify({
      storageVersion: 2,
      session: {
        id: VALID_SESSION.id,
        status: VALID_SESSION.status,
        startAt: VALID_SESSION.startAt,
      },
    }),
  ],
  [
    '开始时间不是有限数字',
    `{"storageVersion":2,"session":{"id":"fasting-bad","status":"fasting","startAt":1e400,"plannedEndAt":1787371200000}}`,
  ],
  [
    '计划结束时间不是有限数字',
    `{"storageVersion":2,"session":{"id":"fasting-bad","status":"fasting","startAt":1787313600000,"plannedEndAt":1e400}}`,
  ],
  [
    '结束时间不晚于开始时间',
    JSON.stringify({
      storageVersion: 2,
      session: {...VALID_SESSION, plannedEndAt: VALID_SESSION.startAt},
    }),
  ],
  [
    '通知取件号码是空文字',
    JSON.stringify({
      storageVersion: 2,
      session: VALID_SESSION,
      completionNotificationId: '   ',
    }),
  ],
  [
    '通知取件号码不是文字',
    JSON.stringify({
      storageVersion: 2,
      session: VALID_SESSION,
      completionNotificationId: 123,
    }),
  ],
])('%s 时返回 invalid', async (_name, storedValue) => {
  asyncStorageMock.getItem.mockResolvedValue(storedValue);

  await expect(readCurrentFastingState()).resolves.toEqual({
    status: 'invalid',
  });
});

test('底层读取失败时把错误交给页面显示和重试', async () => {
  const readError = new Error('storage unavailable');
  asyncStorageMock.getItem.mockRejectedValue(readError);

  await expect(readCurrentFastingState()).rejects.toBe(readError);
  expect(asyncStorageMock.removeItem).not.toHaveBeenCalled();
});
