// ==================== 时间滚轮测试 ====================
// 测试直接模拟滚轮停下的位置，证明松手后的行数差会传回页面，而不是只改变视觉位置。

import React from 'react';
import {ScrollView} from 'react-native';
import ReactTestRenderer from 'react-test-renderer';

import {
  CyclePlanEditorModal,
  EndTimeEditorModal,
  StartTimeEditorModal,
} from './CycleTimeEditorModals';

const FIXED_NOW = new Date(2026, 7, 24, 18, 21, 0).getTime();

function renderStartTimeEditor(overrides: {
  onShiftDay?: jest.Mock;
  onShiftHour?: jest.Mock;
  onShiftMinute?: jest.Mock;
} = {}) {
  let renderer: ReactTestRenderer.ReactTestRenderer;

  ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(
      <StartTimeEditorModal
        draftStartAt={FIXED_NOW}
        error={null}
        isSaving={false}
        onCancel={jest.fn()}
        onConfirm={jest.fn()}
        onShiftDay={overrides.onShiftDay ?? jest.fn()}
        onShiftHour={overrides.onShiftHour ?? jest.fn()}
        onShiftMinute={overrides.onShiftMinute ?? jest.fn()}
        stageLabel="断食"
        visible
      />,
    );
  });

  return renderer!;
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(FIXED_NOW);
});

afterEach(() => {
  jest.useRealTimers();
});

test('日期滚轮显示相对日期并保留点击选择入口', () => {
  const onShiftDay = jest.fn();
  const renderer = renderStartTimeEditor({onShiftDay});
  const renderedTree = JSON.stringify(renderer.toJSON());

  expect(renderedTree).toContain('前天');
  expect(renderedTree).toContain('昨天');
  expect(renderedTree).toContain('今天');
  expect(renderedTree).not.toContain('明天');
  expect(renderedTree).not.toContain('后天');

  ReactTestRenderer.act(() => {
    renderer.root.findByProps({accessibilityLabel: '选择前一天'}).props.onPress();
  });

  expect(onShiftDay).toHaveBeenCalledWith(-1);
  ReactTestRenderer.act(() => renderer.unmount());
});

test('小时滚轮停在后两行时一次移动两小时', () => {
  const onShiftHour = jest.fn();
  const renderer = renderStartTimeEditor({onShiftHour});
  const hourWheel = renderer.root
    .findAllByType(ScrollView)
    .find(wheel => wheel.props.accessibilityLabel === '小时滚轮');

  expect(hourWheel).toBeDefined();

  ReactTestRenderer.act(() => {
    hourWheel!.props.onScrollBeginDrag();
    // 中间项下标为 30，每行 56 dp；停在第 32 项表示向后移动两小时。
    hourWheel!.props.onMomentumScrollEnd({
      nativeEvent: {contentOffset: {x: 0, y: 32 * 56}},
    });
  });

  expect(onShiftHour).toHaveBeenCalledWith(2);
  ReactTestRenderer.act(() => renderer.unmount());
});

test('结束时间日期滚轮能从当前草稿继续选择更早或更晚日期', () => {
  const onShiftDay = jest.fn();
  let renderer: ReactTestRenderer.ReactTestRenderer;

  ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(
      <EndTimeEditorModal
        draftEndAt={FIXED_NOW + 16 * 60 * 60 * 1000}
        error={null}
        isSaving={false}
        onCancel={jest.fn()}
        onConfirm={jest.fn()}
        onShiftDay={onShiftDay}
        onShiftHour={jest.fn()}
        onShiftMinute={jest.fn()}
        stageLabel="断食"
        visible
      />,
    );
  });

  expect(JSON.stringify(renderer!.toJSON())).toContain('修改断食结束时间');
  expect(JSON.stringify(renderer!.toJSON())).toContain(
    '结束时间必须晚于开始时间',
  );

  ReactTestRenderer.act(() => {
    renderer!.root
      .findByProps({accessibilityLabel: '选择后一天'})
      .props.onPress();
  });

  expect(onShiftDay).toHaveBeenCalledWith(1);
  ReactTestRenderer.act(() => renderer!.unmount());
});

test('周期比例滚轮增加断食时同步减少进食', () => {
  const onShiftFastingHours = jest.fn();
  let renderer: ReactTestRenderer.ReactTestRenderer;

  ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(
      <CyclePlanEditorModal
        error={null}
        fastingHours={16}
        isSaving={false}
        onCancel={jest.fn()}
        onConfirm={jest.fn()}
        onShiftFastingHours={onShiftFastingHours}
        visible
      />,
    );
  });

  const renderedTree = JSON.stringify(renderer!.toJSON());
  expect(renderedTree).toContain('断食：进食');
  expect(renderedTree).toContain('16:8');
  expect(renderedTree).toContain('17:7');

  const ratioWheel = renderer!.root
    .findAllByType(ScrollView)
    .find(wheel => wheel.props.accessibilityLabel === '断食进食比例滚轮');

  expect(ratioWheel).toBeDefined();

  ReactTestRenderer.act(() => {
    ratioWheel!.props.onScrollBeginDrag();
    // 16 小时位于下标 15，每行 82 dp；停在下标 17 表示选择 18:6。
    ratioWheel!.props.onMomentumScrollEnd({
      nativeEvent: {contentOffset: {x: 0, y: 17 * 82}},
    });
  });

  expect(onShiftFastingHours).toHaveBeenCalledWith(2);
  ReactTestRenderer.act(() => renderer!.unmount());
});
