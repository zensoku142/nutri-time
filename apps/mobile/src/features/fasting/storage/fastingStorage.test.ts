// ==================== 当前断食本地存储测试 ====================
// AsyncStorage mock（可控制的手机小抽屉替身）让测试能直接准备空、合法、损坏和读写失败的数据。

import AsyncStorage from '@react-native-async-storage/async-storage';

import type {FastingSession} from '../domain/fasting';
import {
  clearCurrentFastingState,
  readCurrentFastingState,
  saveCurrentFastingState,
} from './fastingStorage';

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  },
}));

const asyncStorageMock = AsyncStorage as jest.Mocked<typeof AsyncStorage>;
const STORAGE_KEY = '@nutritime/fasting/current';
const VALID_SESSION: FastingSession = {
  id: 'fasting-1787313600000',
  status: 'fasting',
  startAt: 1_787_313_600_000,
  plannedEndAt: 1_787_371_200_000,
};

beforeEach(() => {
  jest.clearAllMocks();
});

test('没有本地数据时返回 empty', async () => {
  asyncStorageMock.getItem.mockResolvedValue(null);

  await expect(readCurrentFastingState()).resolves.toEqual({status: 'empty'});
  expect(asyncStorageMock.getItem).toHaveBeenCalledWith(STORAGE_KEY);
});

test('合法数据恢复原会话和时间戳', async () => {
  asyncStorageMock.getItem.mockResolvedValue(
    JSON.stringify({storageVersion: 1, session: VALID_SESSION}),
  );

  await expect(readCurrentFastingState()).resolves.toEqual({
    status: 'restored',
    session: VALID_SESSION,
  });
});

test('保存时只写入版本和当前活动会话', async () => {
  asyncStorageMock.setItem.mockResolvedValue();

  await saveCurrentFastingState(VALID_SESSION);

  expect(asyncStorageMock.setItem).toHaveBeenCalledWith(
    STORAGE_KEY,
    JSON.stringify({storageVersion: 1, session: VALID_SESSION}),
  );
});

test('删除时只清理统一的当前会话 key', async () => {
  asyncStorageMock.removeItem.mockResolvedValue();

  await clearCurrentFastingState();

  expect(asyncStorageMock.removeItem).toHaveBeenCalledWith(STORAGE_KEY);
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
    JSON.stringify({storageVersion: 2, session: VALID_SESSION}),
  );

  await expect(readCurrentFastingState()).resolves.toEqual({
    status: 'invalid',
  });
  expect(asyncStorageMock.removeItem).not.toHaveBeenCalled();
});

test.each([
  ['缺少 session', JSON.stringify({storageVersion: 1})],
  [
    '状态不是 fasting',
    JSON.stringify({
      storageVersion: 1,
      session: {...VALID_SESSION, status: 'idle'},
    }),
  ],
  [
    'id 为空',
    JSON.stringify({
      storageVersion: 1,
      session: {...VALID_SESSION, id: '   '},
    }),
  ],
  [
    'session 缺少计划结束时间',
    JSON.stringify({
      storageVersion: 1,
      session: {
        id: VALID_SESSION.id,
        status: VALID_SESSION.status,
        startAt: VALID_SESSION.startAt,
      },
    }),
  ],
  [
    '开始时间不是有限数字',
    `{"storageVersion":1,"session":{"id":"fasting-bad","status":"fasting","startAt":1e400,"plannedEndAt":1787371200000}}`,
  ],
  [
    '计划结束时间不是有限数字',
    `{"storageVersion":1,"session":{"id":"fasting-bad","status":"fasting","startAt":1787313600000,"plannedEndAt":1e400}}`,
  ],
  [
    '结束时间不晚于开始时间',
    JSON.stringify({
      storageVersion: 1,
      session: {...VALID_SESSION, plannedEndAt: VALID_SESSION.startAt},
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
