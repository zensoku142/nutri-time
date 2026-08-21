// ==================== 页面外壳测试 ====================
// 首页内容要铺到悬浮导航后面，普通页面却必须避开系统手势区，这两种规则不能互相覆盖。
// 测试直接检查安全边缘和底部留白，防止导航下面再次出现一块纯背景空白。

import React from 'react';
import {StyleSheet, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import ReactTestRenderer from 'react-test-renderer';

import {Screen} from './Screen';

// 测试没有真实设备安全区，库自带的 mock（行为可控制的替身）会保留边缘设置。
jest.mock('react-native-safe-area-context', () =>
  jest.requireActual('react-native-safe-area-context/jest/mock').default,
);

test('悬浮底部导航页面允许内容延伸到屏幕最底部', async () => {
  let renderer: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(
      <Screen title="禁食" extendUnderBottomBar />,
    );
  });

  const safeArea = renderer!.root.findByType(SafeAreaView);
  const content = safeArea.findByType(View);
  const contentStyle = StyleSheet.flatten(content.props.style);

  // 不包含 bottom 才能让列表进入系统手势区；paddingBottom=0 防止内部再次生成一块纯底色。
  expect(safeArea.props.edges).toEqual(['right', 'left']);
  expect(contentStyle.paddingBottom).toBe(0);
});

test('普通页面继续保护底部安全区', async () => {
  let renderer: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(<Screen title="普通页面" />);
  });

  const safeArea = renderer!.root.findByType(SafeAreaView);

  // 默认页面继续保护底部，后续普通按钮不会因为悬浮导航效果贴到系统手势条上。
  expect(safeArea.props.edges).toEqual(['right', 'bottom', 'left']);
});
