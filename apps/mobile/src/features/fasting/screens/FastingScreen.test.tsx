// ==================== 禁食页面测试 ====================
// 假时钟（由测试控制的系统时间）可以瞬间走过一秒或 16 小时，不必等待真实时间，也不会改动正式页面时长。
// interval（每秒触发页面刷新的系统闹钟）数量由假时钟统计，可以证明反复操作没有留下旧闹钟。

import React from 'react';
import {AppState, StyleSheet} from 'react-native';
import ReactTestRenderer from 'react-test-renderer';

import {theme} from '../../../app/theme';
import {FastingScreen} from './FastingScreen';

// 测试没有真实手机窗口，所以用库自带的 mock（行为可控制的替身）提供固定安全区。
jest.mock('react-native-safe-area-context', () =>
  jest.requireActual('react-native-safe-area-context/jest/mock').default,
);

const FIXED_NOW = new Date(2026, 7, 23, 20, 0, 0).getTime();
const DEFAULT_FASTING_MS = 16 * 60 * 60 * 1000;

async function renderScreen() {
  let renderer: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(<FastingScreen />);
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

function getRenderedText(renderer: ReactTestRenderer.ReactTestRenderer) {
  return JSON.stringify(renderer.toJSON());
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(FIXED_NOW);
});

afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

test('开始后显示真实会话时间并每秒刷新，结束后回到 idle', async () => {
  const renderer = await renderScreen();

  expect(
    renderer.root.findByProps({accessibilityLabel: '开始断食'}),
  ).toBeDefined();
  expect(getRenderedText(renderer)).toContain('尚未开始');

  const idleRing = renderer.root.findByProps({
    accessibilityLabel: '当前断食状态：16 小时断食',
  });
  const idleRingStyle = StyleSheet.flatten(idleRing.props.style);

  // 圆环宽高必须始终相同；这条检查防止 Android 再把确认稿中的正圆拉成椭圆。
  expect(idleRingStyle.width).toBe(idleRingStyle.height);

  pressButton(renderer, '开始断食');

  expect(jest.getTimerCount()).toBe(1);
  expect(getRenderedText(renderer)).toContain('断食进行中');
  expect(getRenderedText(renderer)).toContain('已完成 0%');
  expect(getRenderedText(renderer)).toContain('00:00:00');
  expect(getRenderedText(renderer)).toContain('还剩 16:00:00');
  expect(getRenderedText(renderer)).toContain('08/23 20:00');
  expect(getRenderedText(renderer)).toContain('08/24 12:00');

  const activeArc = renderer.root.findByProps({
    stroke: theme.colors.fastingActive,
  });
  const [activeArcLengthAtStart] = String(
    activeArc.props.strokeDasharray,
  ).split(' ');

  // 0% 时弧长必须真的是零；圆头会保留绿色起点，但不能伪造一截已经完成的进度。
  expect(Number(activeArcLengthAtStart)).toBe(0);

  ReactTestRenderer.act(() => {
    jest.advanceTimersByTime(1000);
  });

  expect(getRenderedText(renderer)).toContain('00:00:01');
  expect(getRenderedText(renderer)).toContain('还剩 15:59:59');

  pressButton(renderer, '结束断食');

  expect(jest.getTimerCount()).toBe(0);
  expect(getRenderedText(renderer)).toContain('尚未开始');

  ReactTestRenderer.act(() => {
    jest.advanceTimersByTime(5000);
    renderer.unmount();
  });
});

test('到达目标后保持会话、剩余不为负数，直到用户结束', async () => {
  const renderer = await renderScreen();

  pressButton(renderer, '开始断食');

  jest.setSystemTime(FIXED_NOW + DEFAULT_FASTING_MS - 1000);
  ReactTestRenderer.act(() => {
    jest.advanceTimersByTime(1000);
  });

  expect(getRenderedText(renderer)).toContain('目标已达成');
  expect(getRenderedText(renderer)).toContain('已完成 100%');
  expect(getRenderedText(renderer)).toContain('16:00:00');
  expect(
    renderer.root.findByProps({accessibilityLabel: '结束本次断食'}),
  ).toBeDefined();

  jest.setSystemTime(FIXED_NOW + DEFAULT_FASTING_MS + 60 * 60 * 1000 - 1000);
  ReactTestRenderer.act(() => {
    jest.advanceTimersByTime(1000);
  });

  expect(getRenderedText(renderer)).toContain('目标已达成');
  expect(getRenderedText(renderer)).not.toContain('还剩 -');

  pressButton(renderer, '结束本次断食');
  expect(jest.getTimerCount()).toBe(0);

  ReactTestRenderer.act(() => {
    renderer.unmount();
  });
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

  const renderer = await renderScreen();
  pressButton(renderer, '开始断食');

  // 这里故意不推动 interval，只把系统时间移到五分钟后，模拟后台暂停了每秒刷新。
  jest.setSystemTime(FIXED_NOW + 5 * 60 * 1000);
  ReactTestRenderer.act(() => {
    handleAppStateChange?.('active');
  });

  expect(getRenderedText(renderer)).toContain('00:05:00');
  expect(getRenderedText(renderer)).toContain('还剩 15:55:00');

  pressButton(renderer, '结束断食');
  expect(removeAppStateListener).toHaveBeenCalledTimes(1);

  ReactTestRenderer.act(() => {
    renderer.unmount();
  });
});

test('反复开始和结束时始终最多只有一个 interval', async () => {
  const renderer = await renderScreen();

  for (let cycle = 0; cycle < 3; cycle += 1) {
    pressButton(renderer, '开始断食');
    expect(jest.getTimerCount()).toBe(1);

    pressButton(renderer, '结束断食');
    expect(jest.getTimerCount()).toBe(0);
  }

  ReactTestRenderer.act(() => {
    renderer.unmount();
  });
});

test('重新建立页面后回到 idle', async () => {
  const firstRenderer = await renderScreen();

  pressButton(firstRenderer, '开始断食');
  ReactTestRenderer.act(() => {
    firstRenderer.unmount();
  });

  expect(jest.getTimerCount()).toBe(0);

  const reopenedRenderer = await renderScreen();

  // 新页面没有读取旧记录，说明当前状态没有保存到手机，也没有提前实现阶段 3。
  expect(
    reopenedRenderer.root.findByProps({accessibilityLabel: '开始断食'}),
  ).toBeDefined();

  ReactTestRenderer.act(() => {
    reopenedRenderer.unmount();
  });
});
