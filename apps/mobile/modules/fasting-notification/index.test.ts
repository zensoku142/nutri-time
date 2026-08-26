// ==================== 通知栏倒计时原生桥测试 ====================
// 测试确认页面只传结束时间和阶段，不会为了刷新通知而生成每秒变化的剩余时间字段。

import {requireNativeModule} from 'expo';

import {startCountdown, stopCountdown} from './index';

jest.mock('expo', () => ({
  requireNativeModule: jest.fn(),
}));

const requireNativeModuleMock = jest.mocked(requireNativeModule);

beforeEach(() => {
  requireNativeModuleMock.mockReset();
});

test('开始倒计时只把计划结束时间和阶段交给 Android', async () => {
  const nativeStartCountdown = jest.fn(() => Promise.resolve());
  requireNativeModuleMock.mockReturnValue({
    startCountdown: nativeStartCountdown,
    stopCountdown: jest.fn(),
  });

  await startCountdown(1_787_371_200_000, 'fasting');

  expect(requireNativeModuleMock).toHaveBeenCalledWith('FastingNotification');
  expect(nativeStartCountdown).toHaveBeenCalledWith(
    1_787_371_200_000,
    'fasting',
  );
  expect(nativeStartCountdown).toHaveBeenCalledTimes(1);
});

test('结束阶段时让 Android 取消同一条常驻通知', async () => {
  const nativeStopCountdown = jest.fn(() => Promise.resolve());
  requireNativeModuleMock.mockReturnValue({
    startCountdown: jest.fn(),
    stopCountdown: nativeStopCountdown,
  });

  await stopCountdown();

  expect(requireNativeModuleMock).toHaveBeenCalledWith('FastingNotification');
  expect(nativeStopCountdown).toHaveBeenCalledTimes(1);
});

test('原生模块未装入 Development Build 时通过 Promise 明确失败', async () => {
  requireNativeModuleMock.mockImplementation(() => {
    throw new Error('native module missing');
  });

  await expect(startCountdown(1_787_371_200_000, 'eating')).rejects.toThrow(
    'native module missing',
  );
});
