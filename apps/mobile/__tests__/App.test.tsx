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

// 完整入口测试不碰真实手机存储；空抽屉替身让页面完成启动恢复后再检查首页。
jest.mock('../src/features/fasting/storage/fastingStorage', () => ({
  clearCurrentFastingState: jest.fn(),
  readCyclePlan: jest.fn(() =>
    Promise.resolve({
      status: 'default',
      plan: {fastingMinutes: 16 * 60, eatingMinutes: 8 * 60},
    }),
  ),
  readCurrentFastingState: jest.fn(() => Promise.resolve({status: 'empty'})),
  resetCurrentCycleData: jest.fn(),
  saveCyclePlan: jest.fn(),
  saveCyclePlanAndCurrentState: jest.fn(),
  saveCurrentFastingState: jest.fn(),
}));

// 完整入口只确认页面能启动；系统通知由通知模块和禁食页面测试分别使用可控替身验证。
jest.mock('expo-notifications', () => ({
  AndroidImportance: {DEFAULT: 5},
  SchedulableTriggerInputTypes: {DATE: 'date'},
  setNotificationHandler: jest.fn(),
}));

// 启动测试没有 Android 原生环境，因此只隔离开发诊断模块；真正桥接由模拟器实测确认。
jest.mock('../modules/wear-data-layer', () => ({
  ping: jest.fn(),
}));

// 完整入口测试不访问 GitHub；更新规则和 Android 安装流程由各自的测试使用固定数据验证。
jest.mock('../src/features/update/components/AppUpdateBootstrap', () => ({
  AppUpdateBootstrap: () => null,
}));

test('可以完成本地恢复并渲染禁食首页', async () => {
  let renderer: ReactTestRenderer.ReactTestRenderer;

  // act 会等 React 完成本轮页面更新，避免导航还没准备好，测试就提前检查结果。
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(<App />);
    await Promise.resolve();
  });

  // 品牌和主按钮都来自真实首屏，能证明 App 不只是创建了空 Provider 或导航占位。
  const renderedTree = JSON.stringify(renderer!.toJSON());
  expect(renderedTree).toContain('NutriTime');
  expect(renderedTree).toContain('开始断食');

  // 禁食页读取全局主题背景；检查真实渲染结果可防止页面与悬浮导航使用不同底色。
  expect(renderedTree).toContain('#E7F8F2');

  // 主按钮和重点数字必须跟随参考应用的青绿按钮、Roboto 中等字重，不能退回旧灰按钮和装饰数字字体。
  expect(renderedTree).toContain('#61D1A9');
  expect(renderedTree).toContain('sans-serif-medium');
});
