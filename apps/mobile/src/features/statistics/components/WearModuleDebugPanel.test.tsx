// ==================== Wear 模块诊断入口测试 ====================
// 这里使用可控替身检查按钮状态和提示；它不能代替模拟器中真正进入 Kotlin 的验证。

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';

import {ping, sendTestSnapshot} from '../../../../modules/wear-data-layer';
import {WearModuleDebugPanel} from './WearModuleDebugPanel';

jest.mock('../../../../modules/wear-data-layer', () => ({
  ping: jest.fn(),
  sendTestSnapshot: jest.fn(),
}));

const pingMock = jest.mocked(ping);
const sendTestSnapshotMock = jest.mocked(sendTestSnapshot);

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return {promise, resolve, reject};
}

function getRenderedText(renderer: ReactTestRenderer.ReactTestRenderer) {
  return JSON.stringify(renderer.toJSON());
}

function renderPanel() {
  let renderer: ReactTestRenderer.ReactTestRenderer;

  ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(<WearModuleDebugPanel />);
  });

  return renderer!;
}

beforeEach(() => {
  pingMock.mockReset();
  sendTestSnapshotMock.mockReset();
});

test('成功时显示 Kotlin 返回的固定结果', async () => {
  pingMock.mockResolvedValue('Wear module ready');
  const renderer = renderPanel();

  await ReactTestRenderer.act(async () => {
    renderer.root.findByProps({accessibilityLabel: '测试 Wear 原生模块'}).props.onPress();
    await Promise.resolve();
  });

  expect(getRenderedText(renderer)).toContain('Wear module ready');
  expect(pingMock).toHaveBeenCalledTimes(1);
});

test('调用未完成时阻止快速重复点击', async () => {
  const deferred = createDeferred<string>();
  pingMock.mockReturnValue(deferred.promise);
  const renderer = renderPanel();
  const button = renderer.root.findByProps({
    accessibilityLabel: '测试 Wear 原生模块',
  });

  ReactTestRenderer.act(() => {
    button.props.onPress();
    button.props.onPress();
  });

  expect(pingMock).toHaveBeenCalledTimes(1);
  expect(
    renderer.root.findByProps({
      accessibilityLabel: '正在测试 Wear 原生模块',
    }).props.disabled,
  ).toBe(true);

  await ReactTestRenderer.act(async () => {
    deferred.resolve('Wear module ready');
    await deferred.promise;
  });
});

test('调用失败时显示可操作提示，不把原始错误放进页面', async () => {
  const consoleErrorSpy = jest
    .spyOn(console, 'error')
    .mockImplementation(() => undefined);
  pingMock.mockRejectedValue(new Error('private native stack'));
  const renderer = renderPanel();

  await ReactTestRenderer.act(async () => {
    renderer.root.findByProps({accessibilityLabel: '测试 Wear 原生模块'}).props.onPress();
    await Promise.resolve();
  });

  const renderedText = getRenderedText(renderer);
  expect(renderedText).toContain('请重新构建并安装 Development Build');
  expect(renderedText).not.toContain('private native stack');
  expect(consoleErrorSpy).toHaveBeenCalledWith(
    '[NutriTime] wear-module-ping-failed',
    {errorName: 'Error'},
  );
});

test('固定快照提交成功时只显示已提交同步', async () => {
  sendTestSnapshotMock.mockResolvedValue();
  const renderer = renderPanel();

  await ReactTestRenderer.act(async () => {
    renderer.root.findByProps({accessibilityLabel: '发送测试快照'}).props.onPress();
    await Promise.resolve();
  });

  const renderedText = getRenderedText(renderer);
  expect(renderedText).toContain('已提交同步');
  expect(renderedText).not.toContain('手表同步成功');
  expect(sendTestSnapshotMock).toHaveBeenCalledWith();
  expect(sendTestSnapshotMock).toHaveBeenCalledTimes(1);
});

test('测试快照提交期间阻止快速重复点击', async () => {
  const deferred = createDeferred<void>();
  sendTestSnapshotMock.mockReturnValue(deferred.promise);
  const renderer = renderPanel();
  const button = renderer.root.findByProps({accessibilityLabel: '发送测试快照'});

  ReactTestRenderer.act(() => {
    button.props.onPress();
    button.props.onPress();
  });

  expect(sendTestSnapshotMock).toHaveBeenCalledTimes(1);
  expect(
    renderer.root.findByProps({accessibilityLabel: '正在发送测试快照'}).props.disabled,
  ).toBe(true);

  await ReactTestRenderer.act(async () => {
    deferred.resolve();
    await deferred.promise;
  });
});

test('测试快照提交失败时显示可诊断提示且不泄露原始错误', async () => {
  const consoleErrorSpy = jest
    .spyOn(console, 'error')
    .mockImplementation(() => undefined);
  sendTestSnapshotMock.mockRejectedValue(new Error('private data layer stack'));
  const renderer = renderPanel();

  await ReactTestRenderer.act(async () => {
    renderer.root.findByProps({accessibilityLabel: '发送测试快照'}).props.onPress();
    await Promise.resolve();
  });

  const renderedText = getRenderedText(renderer);
  expect(renderedText).toContain('请查看 Metro 与 Logcat 后重试');
  expect(renderedText).not.toContain('private data layer stack');
  expect(consoleErrorSpy).toHaveBeenCalledWith(
    '[NutriTime] wear-module-test-snapshot-failed',
    {errorName: 'Error'},
  );
});
