// ==================== 应用启动测试 ====================
// 测试从真实 App 入口建立完整页面树，尽早发现公共能力顺序或导航配置导致的启动崩溃。
// 导航栏行为由 AppTabBar.test.tsx 单独验证，这里只确认应用能启动并显示禁食首页。

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import App from '../App';

// ---------- 手机安全区替身 ----------
// 测试没有真实手机窗口，所以用库自带的 mock（行为可控制的替身）提供固定边距。
jest.mock('react-native-safe-area-context', () =>
  jest.requireActual('react-native-safe-area-context/jest/mock').default,
);

test('可以渲染基础应用和首页', async () => {
  let renderer: ReactTestRenderer.ReactTestRenderer;

  // act 会等 React 完成本轮页面更新，避免导航还没准备好，测试就提前检查结果。
  await ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(<App />);
  });

  // 标题来自真实首屏，能证明 App 不只是创建了空 Provider。
  const renderedTree = JSON.stringify(renderer!.toJSON());
  expect(renderedTree).toContain('禁食');

  // 首页通过共享 Screen 组件读取全局背景色；检查真实渲染结果可防止主题变量被误改。
  expect(renderedTree).toContain('#FFFFFF');
});
