// ==================== Wear 模块 TypeScript 桥测试 ====================
// 单元测试只补充检查严格导出和失败边界；真实 TypeScript → Kotlin 链路仍必须由 Development Build 证明。

import {requireNativeModule} from 'expo';

import {ping, syncCurrentFasting} from './index';

jest.mock('expo', () => ({
  requireNativeModule: jest.fn(),
}));

const requireNativeModuleMock = jest.mocked(requireNativeModule);

beforeEach(() => {
  requireNativeModuleMock.mockReset();
});

test('ping 返回 Promise 并交回 Kotlin 的固定结果', async () => {
  const nativePing = jest.fn(() => Promise.resolve('Wear module ready'));
  requireNativeModuleMock.mockReturnValue({ping: nativePing});

  const result = ping();

  expect(result).toBeInstanceOf(Promise);
  await expect(result).resolves.toBe('Wear module ready');
  expect(requireNativeModuleMock).toHaveBeenCalledWith('WearDataLayer');
  expect(nativePing).toHaveBeenCalledTimes(1);
});

test('原生模块没有装进 Development Build 时通过 Promise 明确失败', async () => {
  requireNativeModuleMock.mockImplementation(() => {
    throw new Error('native module missing');
  });

  await expect(ping()).rejects.toThrow('native module missing');
});

test('idle 只把正式公共字段交给 Kotlin，不传 session 空值', async () => {
  const nativeSyncCurrentFasting = jest.fn(() => Promise.resolve());
  requireNativeModuleMock.mockReturnValue({
    ping: jest.fn(),
    syncCurrentFasting: nativeSyncCurrentFasting,
  });
  const payload = {
    protocolVersion: 1,
    status: 'idle',
    stateChangedAt: 1_787_371_200_000,
  } as const;

  const result = syncCurrentFasting(payload, true);

  expect(result).toBeInstanceOf(Promise);
  await expect(result).resolves.toBeUndefined();
  expect(requireNativeModuleMock).toHaveBeenCalledWith('WearDataLayer');
  expect(nativeSyncCurrentFasting).toHaveBeenCalledWith(payload, true);
  expect(Object.keys(payload)).toEqual([
    'protocolVersion',
    'status',
    'stateChangedAt',
  ]);
  expect(payload).not.toHaveProperty('sessionId');
  expect(payload).not.toHaveProperty('startAt');
  expect(payload).not.toHaveProperty('plannedEndAt');
  expect(payload).not.toHaveProperty('remainingSeconds');
});

test('fasting 把完整真实会话和普通发送标记交给 Kotlin', async () => {
  const nativeSyncCurrentFasting = jest.fn(() => Promise.resolve());
  requireNativeModuleMock.mockReturnValue({
    ping: jest.fn(),
    syncCurrentFasting: nativeSyncCurrentFasting,
  });
  const payload = {
    protocolVersion: 1,
    status: 'fasting',
    sessionId: 'fasting-1787313600000',
    startAt: 1_787_313_600_000,
    plannedEndAt: 1_787_371_200_000,
    stateChangedAt: 1_787_313_600_000,
  } as const;

  await syncCurrentFasting(payload, false);

  expect(nativeSyncCurrentFasting).toHaveBeenCalledWith(payload, false);
  expect(Object.keys(payload)).toEqual([
    'protocolVersion',
    'status',
    'sessionId',
    'startAt',
    'plannedEndAt',
    'stateChangedAt',
  ]);
  expect(payload).not.toHaveProperty('remainingSeconds');
});
