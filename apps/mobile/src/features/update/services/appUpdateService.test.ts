// ==================== GitHub 更新流程测试 ====================
// 原生模块和网络都换成可控制的 mock（测试替身），验证失败时不会误开 Android 安装器。

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';

import type {AvailableAppUpdate} from '../domain/appUpdate';
import {
  checkForAvailableUpdate,
  downloadAndOpenAppUpdate,
} from './appUpdateService';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

jest.mock('expo-application', () => ({
  nativeBuildVersion: '1000001',
}));

jest.mock('expo-file-system/legacy', () => ({
  cacheDirectory: 'file:///cache/',
  deleteAsync: jest.fn(),
  downloadAsync: jest.fn(),
  getInfoAsync: jest.fn(),
  getContentUriAsync: jest.fn(),
}));

jest.mock('expo-intent-launcher', () => ({
  startActivityAsync: jest.fn(),
}));

const asyncStorageMock = AsyncStorage as jest.Mocked<typeof AsyncStorage>;
const fileSystemMock = FileSystem as jest.Mocked<typeof FileSystem>;
const startActivityAsyncMock = jest.mocked(
  IntentLauncher.startActivityAsync,
);
const fetchMock = jest.fn();
const SHA256 = 'a'.repeat(64);
const APK_NAME = 'NutriTime-mobile-v0.2.0.apk';
const APK_URL =
  'https://github.com/zensoku142/nutri-time/releases/download/mobile-v0.2.0/NutriTime-mobile-v0.2.0.apk';
const MANIFEST_URL =
  'https://github.com/zensoku142/nutri-time/releases/download/mobile-v0.2.0/update.json';

function createResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn(() => Promise.resolve(body)),
  } as unknown as Response;
}

function createAvailableUpdate(): AvailableAppUpdate {
  return {
    versionName: '0.2.0',
    versionCode: 1000002,
    notes: '新增更新检查。',
    apkAssetName: APK_NAME,
    apkDownloadUrl: APK_URL,
    apkSize: 1024,
    sha256: SHA256,
  };
}

beforeAll(() => {
  globalThis.fetch = fetchMock as typeof fetch;
});

beforeEach(() => {
  jest.clearAllMocks();
  asyncStorageMock.getItem.mockResolvedValue(null);
  asyncStorageMock.setItem.mockResolvedValue();
});

test('一天内已经成功检查时不再请求 GitHub', async () => {
  asyncStorageMock.getItem.mockResolvedValue('1000');

  await expect(checkForAvailableUpdate(2000)).resolves.toBeNull();

  expect(fetchMock).not.toHaveBeenCalled();
});

test('正式版本较新且两个附件匹配时返回更新', async () => {
  fetchMock
    .mockResolvedValueOnce(
      createResponse(200, {
        tag_name: 'mobile-v0.2.0',
        body: '新增更新检查。',
        draft: false,
        prerelease: false,
        assets: [
          {
            name: 'update.json',
            browser_download_url: MANIFEST_URL,
            size: 150,
            digest: `sha256:${'b'.repeat(64)}`,
          },
          {
            name: APK_NAME,
            browser_download_url: APK_URL,
            size: 1024,
            digest: `sha256:${SHA256}`,
          },
        ],
      }),
    )
    .mockResolvedValueOnce(
      createResponse(200, {
        versionName: '0.2.0',
        versionCode: 1000002,
        apkAssetName: APK_NAME,
        sha256: SHA256,
      }),
    );

  await expect(checkForAvailableUpdate(2000)).resolves.toEqual(
    createAvailableUpdate(),
  );
  expect(asyncStorageMock.setItem).toHaveBeenCalledWith(
    '@nutritime/update/last-checked-at',
    '2000',
  );
});

test('仓库还没有 Release 时记住检查时间并保持安静', async () => {
  fetchMock.mockResolvedValue(createResponse(404, {}));

  await expect(checkForAvailableUpdate(3000)).resolves.toBeNull();
  expect(asyncStorageMock.setItem).toHaveBeenCalledWith(
    '@nutritime/update/last-checked-at',
    '3000',
  );
});

test('APK 下载完整后使用只读 content URI 打开系统安装器', async () => {
  const update = createAvailableUpdate();
  fileSystemMock.deleteAsync.mockResolvedValue();
  fileSystemMock.downloadAsync.mockResolvedValue({
    uri: 'file:///cache/nutritime-update-1000002.apk',
    status: 200,
    headers: {},
    mimeType: 'application/vnd.android.package-archive',
  });
  fileSystemMock.getInfoAsync.mockResolvedValue({
    exists: true,
    uri: 'file:///cache/nutritime-update-1000002.apk',
    size: 1024,
    isDirectory: false,
    modificationTime: 1,
  });
  fileSystemMock.getContentUriAsync.mockResolvedValue(
    'content://nutritime/update.apk',
  );
  startActivityAsyncMock.mockResolvedValue({resultCode: 0});

  await downloadAndOpenAppUpdate(update);

  expect(startActivityAsyncMock).toHaveBeenCalledWith(
    'android.intent.action.VIEW',
    {
      data: 'content://nutritime/update.apk',
      type: 'application/vnd.android.package-archive',
      flags: 1,
    },
  );
});

test('APK 大小不一致时停止安装', async () => {
  fileSystemMock.deleteAsync.mockResolvedValue();
  fileSystemMock.downloadAsync.mockResolvedValue({
    uri: 'file:///cache/incomplete.apk',
    status: 200,
    headers: {},
    mimeType: 'application/vnd.android.package-archive',
  });
  fileSystemMock.getInfoAsync.mockResolvedValue({
    exists: true,
    uri: 'file:///cache/incomplete.apk',
    size: 512,
    isDirectory: false,
    modificationTime: 1,
  });

  await expect(downloadAndOpenAppUpdate(createAvailableUpdate())).rejects.toThrow(
    'APK 下载大小与 GitHub Release 记录不一致。',
  );
  expect(startActivityAsyncMock).not.toHaveBeenCalled();
});
