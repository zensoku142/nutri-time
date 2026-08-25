// ==================== 自动更新入口测试 ====================
// GitHub 和 Android 安装器都使用 mock（测试替身），这里只验证正式版启动、提示和按钮连接是否完整。

import React from 'react';
import {Alert, type AlertButton} from 'react-native';
import ReactTestRenderer from 'react-test-renderer';

import type {AvailableAppUpdate} from '../domain/appUpdate';
import {
  checkForAvailableUpdate,
  downloadAndOpenAppUpdate,
} from '../services/appUpdateService';
import {AppUpdateBootstrap} from './AppUpdateBootstrap';

jest.mock('../services/appUpdateService', () => ({
  checkForAvailableUpdate: jest.fn(),
  downloadAndOpenAppUpdate: jest.fn(),
}));

const checkForAvailableUpdateMock = jest.mocked(checkForAvailableUpdate);
const downloadAndOpenAppUpdateMock = jest.mocked(downloadAndOpenAppUpdate);
const alertMock = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
const originalDevelopmentValue = __DEV__;

const availableUpdate: AvailableAppUpdate = {
  versionName: '0.2.0',
  versionCode: 1000002,
  notes: '新增自动更新。',
  apkAssetName: 'NutriTime-mobile-v0.2.0.apk',
  apkDownloadUrl:
    'https://github.com/zensoku142/nutri-time/releases/download/mobile-v0.2.0/NutriTime-mobile-v0.2.0.apk',
  apkSize: 1024,
  sha256: 'a'.repeat(64),
};

function setDevelopmentValue(value: boolean): void {
  Object.defineProperty(globalThis, '__DEV__', {
    configurable: true,
    value,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  setDevelopmentValue(false);
});

afterAll(() => {
  setDevelopmentValue(originalDevelopmentValue);
  alertMock.mockRestore();
});

test('正式版启动发现新版本后显示说明并连接安装按钮', async () => {
  checkForAvailableUpdateMock.mockResolvedValue(availableUpdate);
  downloadAndOpenAppUpdateMock.mockResolvedValue();

  await ReactTestRenderer.act(async () => {
    ReactTestRenderer.create(<AppUpdateBootstrap />);
    await Promise.resolve();
  });

  expect(alertMock).toHaveBeenCalledWith(
    '发现新版本 0.2.0',
    '新增自动更新。',
    expect.any(Array),
  );

  const buttons = alertMock.mock.calls[0][2] as AlertButton[];
  await ReactTestRenderer.act(async () => {
    buttons[1].onPress?.();
    await Promise.resolve();
  });

  expect(downloadAndOpenAppUpdateMock).toHaveBeenCalledWith(availableUpdate);
});

test('Development Build 不访问 GitHub', async () => {
  setDevelopmentValue(true);

  await ReactTestRenderer.act(async () => {
    ReactTestRenderer.create(<AppUpdateBootstrap />);
    await Promise.resolve();
  });

  expect(checkForAvailableUpdateMock).not.toHaveBeenCalled();
});
