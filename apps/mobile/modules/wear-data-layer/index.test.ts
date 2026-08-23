// ==================== Wear 模块 TypeScript 桥测试 ====================
// 单元测试只补充检查严格导出和失败边界；真实 TypeScript → Kotlin 链路仍必须由 Development Build 证明。

import {requireNativeModule} from 'expo';

import {ping} from './index';

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
