// ==================== 断食统计页面测试 ====================
// 存储 mock（可控制的手机记录替身）让测试覆盖空记录、正常统计和损坏记录，不依赖真实 Android 环境。

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';

import {readFastingHistory} from '../../fasting/storage/fastingStorage';
import {StatisticsScreen} from './StatisticsScreen';

jest.mock('react-native-safe-area-context', () =>
  jest.requireActual('react-native-safe-area-context/jest/mock').default,
);

jest.mock('@react-navigation/native', () => {
  const ReactModule = jest.requireActual<typeof import('react')>('react');

  return {
    // 测试里没有真实底部导航；用 useEffect（页面显示后自动执行一次）代替获得焦点的通知。
    useFocusEffect: (effect: () => void | (() => void)) =>
      ReactModule.useEffect(effect, [effect]),
  };
});

jest.mock('../../fasting/storage/fastingStorage', () => ({
  readFastingHistory: jest.fn(),
}));

const readFastingHistoryMock = readFastingHistory as jest.MockedFunction<
  typeof readFastingHistory
>;
const FIXED_NOW = new Date(2026, 7, 23, 20, 0, 0).getTime();
const HOUR_MS = 60 * 60 * 1000;
const COMPLETED_SESSIONS = [
  {
    id: 'fasting-august-22',
    startAt: new Date(2026, 7, 22, 2, 0, 0).getTime(),
    plannedEndAt: new Date(2026, 7, 22, 18, 0, 0).getTime(),
    completedAt: new Date(2026, 7, 22, 18, 0, 0).getTime(),
  },
  {
    id: 'fasting-august-23',
    startAt: new Date(2026, 7, 23, 4, 0, 0).getTime(),
    plannedEndAt: new Date(2026, 7, 23, 20, 0, 0).getTime(),
    completedAt: new Date(2026, 7, 23, 18, 0, 0).getTime(),
  },
];

async function renderScreen() {
  let renderer: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(<StatisticsScreen />);
    await Promise.resolve();
    await Promise.resolve();
  });

  return renderer!;
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  jest.setSystemTime(FIXED_NOW);
  readFastingHistoryMock.mockResolvedValue({status: 'empty', sessions: []});
});

afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

test('没有历史时仍完整显示三个模块和最近七天日期', async () => {
  const renderer = await renderScreen();
  const renderedText = JSON.stringify(renderer.toJSON());

  expect(renderer.root.findByProps({accessibilityLabel: '断食汇总'})).toBeDefined();
  expect(
    renderer.root.findByProps({accessibilityLabel: '上次断食窗口'}),
  ).toBeDefined();
  expect(
    renderer.root.findByProps({accessibilityLabel: '最近的断食'}),
  ).toBeDefined();
  expect(renderedText).toContain('还没有完成的断食');
  expect(renderedText).toContain('08/17');
  expect(renderedText).toContain('08/23');
  expect(
    renderer.root.findAllByProps({accessibilityLabel: '测试 Wear 原生模块'}),
  ).toHaveLength(0);

  ReactTestRenderer.act(() => renderer.unmount());
});

test('完成记录会计算汇总、上次窗口和目标结果', async () => {
  readFastingHistoryMock.mockResolvedValue({
    status: 'restored',
    sessions: COMPLETED_SESSIONS,
  });
  const renderer = await renderScreen();
  const renderedText = JSON.stringify(renderer.toJSON());

  expect(renderedText).toContain('累计次数');
  expect(renderedText).toContain('最长断食');
  expect(renderedText).toContain('连续断食');
  expect(renderedText).toContain('16');
  expect(renderedText).toContain('14');
  expect(renderedText).toContain('今日 04:00');
  expect(renderedText).toContain('今日 18:00');
  expect(renderedText).toContain('本次断食提前结束');
  expect(
    renderer.root.findByProps({accessibilityLabel: '08/23，断食 14.0h'}).props
      .accessibilityState,
  ).toEqual({selected: true});

  ReactTestRenderer.act(() => renderer.unmount());
});

test('点选某一天后把该日时长显示在图表提示中', async () => {
  readFastingHistoryMock.mockResolvedValue({
    status: 'restored',
    sessions: COMPLETED_SESSIONS,
  });
  const renderer = await renderScreen();
  const previousDay = renderer.root.findByProps({
    accessibilityLabel: '08/22，断食 16.0h',
  });

  ReactTestRenderer.act(() => previousDay.props.onPress());

  expect(
    renderer.root.findByProps({accessibilityLabel: '08/22，断食 16.0h'}).props
      .accessibilityState,
  ).toEqual({selected: true});
  expect(JSON.stringify(renderer.toJSON())).toContain('16.0h');

  ReactTestRenderer.act(() => renderer.unmount());
});

test('损坏历史不会伪装成没有记录', async () => {
  readFastingHistoryMock.mockResolvedValue({status: 'invalid'});
  const renderer = await renderScreen();

  expect(JSON.stringify(renderer.toJSON())).toContain('断食记录暂时无法恢复');

  ReactTestRenderer.act(() => renderer.unmount());
});

test('底层读取失败时提示稍后重开且保留三个模块', async () => {
  readFastingHistoryMock.mockRejectedValue(new Error('storage unavailable'));
  const renderer = await renderScreen();

  expect(JSON.stringify(renderer.toJSON())).toContain('断食记录读取失败');
  expect(
    renderer.root.findByProps({accessibilityLabel: '最近的断食'}),
  ).toBeDefined();

  ReactTestRenderer.act(() => renderer.unmount());
});

test('用于统计的完成时长按实际结束时间计算', () => {
  expect(COMPLETED_SESSIONS[1].completedAt - COMPLETED_SESSIONS[1].startAt).toBe(
    14 * HOUR_MS,
  );
});
