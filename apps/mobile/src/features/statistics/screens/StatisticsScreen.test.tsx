// ==================== 统计页开发入口测试 ====================
// Release（交给正式用户的安装包）必须隐藏阶段 6A 按钮，避免把内部诊断误当成产品功能。

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';

import {StatisticsScreen} from './StatisticsScreen';

jest.mock('react-native-safe-area-context', () =>
  jest.requireActual('react-native-safe-area-context/jest/mock').default,
);

// Jest 没有 Android 原生环境，这里只隔离模块加载；真实 ping 仍由 Development Build 和 Logcat 验证。
jest.mock('../../../../modules/wear-data-layer', () => ({
  ping: jest.fn(),
  sendTestSnapshot: jest.fn(),
}));

const ORIGINAL_DEV_VALUE = __DEV__;

function setDevelopmentMode(value: boolean) {
  Object.defineProperty(globalThis, '__DEV__', {
    configurable: true,
    value,
  });
}

afterEach(() => {
  setDevelopmentMode(ORIGINAL_DEV_VALUE);
});

function renderScreen() {
  let renderer: ReactTestRenderer.ReactTestRenderer;

  ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(<StatisticsScreen />);
  });

  return renderer!;
}

test('开发包显示主动测试原生模块的入口', () => {
  setDevelopmentMode(true);
  const renderer = renderScreen();

  expect(
    renderer.root.findByProps({accessibilityLabel: '测试 Wear 原生模块'}),
  ).toBeDefined();
  expect(
    renderer.root.findByProps({accessibilityLabel: '发送测试快照'}),
  ).toBeDefined();
});

test('Release 条件下不显示原生模块调试入口', () => {
  setDevelopmentMode(false);
  const renderer = renderScreen();

  expect(
    renderer.root.findAllByProps({accessibilityLabel: '测试 Wear 原生模块'}),
  ).toHaveLength(0);
  expect(
    renderer.root.findAllByProps({accessibilityLabel: '发送测试快照'}),
  ).toHaveLength(0);
  expect(JSON.stringify(renderer.toJSON())).not.toContain('阶段 6B');
});
