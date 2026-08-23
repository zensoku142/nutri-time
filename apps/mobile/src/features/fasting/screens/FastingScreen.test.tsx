// ==================== 禁食页面测试 ====================
// 测试直接点击主按钮，证明页面只在当前内存中往返切换 idle 和 fasting。

import React from 'react';
import {StyleSheet} from 'react-native';
import ReactTestRenderer from 'react-test-renderer';

import {FastingScreen} from './FastingScreen';

// 测试没有真实手机窗口，所以用库自带的 mock（行为可控制的替身）提供固定安全区。
jest.mock('react-native-safe-area-context', () =>
  jest.requireActual('react-native-safe-area-context/jest/mock').default,
);

test('初始为 idle，点击后进入 fasting，再点击回到 idle', async () => {
  let renderer: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(<FastingScreen />);
  });

  expect(
    renderer!.root.findByProps({accessibilityLabel: '开始断食'}),
  ).toBeDefined();
  expect(JSON.stringify(renderer!.toJSON())).toContain('尚未开始');

  const idleRing = renderer!.root.findByProps({
    accessibilityLabel: '当前断食状态：16 小时断食',
  });
  const idleRingStyle = StyleSheet.flatten(idleRing.props.style);

  // 圆环宽高必须始终相同；这条检查防止 Android 再把确认稿中的正圆拉成椭圆。
  expect(idleRingStyle.width).toBe(idleRingStyle.height);

  ReactTestRenderer.act(() => {
    renderer!.root.findByProps({accessibilityLabel: '开始断食'}).props.onPress();
  });

  expect(
    renderer!.root.findByProps({accessibilityLabel: '结束断食'}),
  ).toBeDefined();
  expect(JSON.stringify(renderer!.toJSON())).toContain('断食进行中');
  expect(JSON.stringify(renderer!.toJSON())).toContain('已开始');

  ReactTestRenderer.act(() => {
    renderer!.root.findByProps({accessibilityLabel: '结束断食'}).props.onPress();
  });

  expect(
    renderer!.root.findByProps({accessibilityLabel: '开始断食'}),
  ).toBeDefined();
  expect(JSON.stringify(renderer!.toJSON())).toContain('尚未开始');
});

test('重新建立页面后回到 idle', async () => {
  let firstRenderer: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(() => {
    firstRenderer = ReactTestRenderer.create(<FastingScreen />);
  });

  ReactTestRenderer.act(() => {
    firstRenderer!.root
      .findByProps({accessibilityLabel: '开始断食'})
      .props.onPress();
    firstRenderer!.unmount();
  });

  let reopenedRenderer: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(() => {
    reopenedRenderer = ReactTestRenderer.create(<FastingScreen />);
  });

  // 新页面没有读取旧记录，说明当前状态没有被保存到手机，也没有提前实现阶段 3。
  expect(
    reopenedRenderer!.root.findByProps({accessibilityLabel: '开始断食'}),
  ).toBeDefined();
});
