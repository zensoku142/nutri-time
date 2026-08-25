// ==================== 应用更新规则测试 ====================
// 测试只使用固定 JSON（网络接口常用的文字数据格式），避免真正访问 GitHub 或下载 APK。

import {
  findAvailableAppUpdate,
  parseGitHubLatestRelease,
  parseUpdateManifest,
  shouldCheckForUpdate,
  UPDATE_CHECK_INTERVAL_MS,
} from './appUpdate';

const SHA256 = 'a'.repeat(64);
const APK_NAME = 'NutriTime-mobile-v0.2.0.apk';
const APK_URL =
  'https://github.com/zensoku142/nutri-time/releases/download/mobile-v0.2.0/NutriTime-mobile-v0.2.0.apk';

function createRelease() {
  return {
    tagName: 'mobile-v0.2.0',
    notes: '新增更新检查。',
    draft: false,
    prerelease: false,
    assets: [
      {
        name: APK_NAME,
        downloadUrl: APK_URL,
        size: 80 * 1024 * 1024,
        digest: `sha256:${SHA256}`,
      },
    ],
  };
}

test('距离上次成功检查不足一天时不重复访问 GitHub', () => {
  const now = 2 * UPDATE_CHECK_INTERVAL_MS;

  expect(shouldCheckForUpdate(now - UPDATE_CHECK_INTERVAL_MS + 1, now)).toBe(
    false,
  );
  expect(shouldCheckForUpdate(now - UPDATE_CHECK_INTERVAL_MS, now)).toBe(true);
  expect(shouldCheckForUpdate(now + 1, now)).toBe(true);
});

test('只接受手机版本区间内且包含 SHA-256 的更新说明', () => {
  expect(
    parseUpdateManifest({
      versionName: '0.2.0',
      versionCode: 1000002,
      apkAssetName: APK_NAME,
      sha256: SHA256,
    }),
  ).toEqual({
    versionName: '0.2.0',
    versionCode: 1000002,
    apkAssetName: APK_NAME,
    sha256: SHA256,
  });

  expect(
    parseUpdateManifest({
      versionName: '0.2',
      versionCode: 2000001,
      apkAssetName: '../wrong.apk',
      sha256: 'not-a-digest',
    }),
  ).toBeNull();
});

test('GitHub 返回缺字段的附件时拒绝整份 Release', () => {
  expect(
    parseGitHubLatestRelease({
      tag_name: 'mobile-v0.2.0',
      body: '说明',
      draft: false,
      prerelease: false,
      assets: [{name: APK_NAME}],
    }),
  ).toBeNull();
});

test('版本号、附件摘要和下载地址都匹配时返回可安装更新', () => {
  const update = findAvailableAppUpdate(1000001, createRelease(), {
    versionName: '0.2.0',
    versionCode: 1000002,
    apkAssetName: APK_NAME,
    sha256: SHA256,
  });

  expect(update).toEqual({
    versionName: '0.2.0',
    versionCode: 1000002,
    notes: '新增更新检查。',
    apkAssetName: APK_NAME,
    apkDownloadUrl: APK_URL,
    apkSize: 80 * 1024 * 1024,
    sha256: SHA256,
  });
});

test('相同版本、预发布版本或摘要不匹配时不提示安装', () => {
  const manifest = {
    versionName: '0.2.0',
    versionCode: 1000002,
    apkAssetName: APK_NAME,
    sha256: SHA256,
  };

  expect(findAvailableAppUpdate(1000002, createRelease(), manifest)).toBeNull();
  expect(
    findAvailableAppUpdate(
      1000001,
      {...createRelease(), prerelease: true},
      manifest,
    ),
  ).toBeNull();
  expect(
    findAvailableAppUpdate(
      1000001,
      {
        ...createRelease(),
        assets: [{...createRelease().assets[0], digest: `sha256:${'b'.repeat(64)}`}],
      },
      manifest,
    ),
  ).toBeNull();
});
