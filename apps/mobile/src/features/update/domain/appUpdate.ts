// ==================== 应用更新规则 ====================
// 这里先把 GitHub 返回的陌生数据缩成应用真正需要的字段，再决定是否提示更新。
// 网络内容即使缺字段或被改坏也只会被拒绝，不会直接交给 Android 安装。

export const UPDATE_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

const MOBILE_VERSION_CODE_MIN = 1000001;
const MOBILE_VERSION_CODE_MAX = 1999999;
const MAX_APK_SIZE_BYTES = 250 * 1024 * 1024;
const TRUSTED_RELEASE_DOWNLOAD_PREFIX =
  'https://github.com/zensoku142/nutri-time/releases/download/';

export type UpdateManifest = {
  versionName: string;
  versionCode: number;
  apkAssetName: string;
  sha256: string;
};

export type GitHubReleaseAsset = {
  name: string;
  downloadUrl: string;
  size: number;
  digest: string | null;
};

export type GitHubLatestRelease = {
  tagName: string;
  notes: string;
  draft: boolean;
  prerelease: boolean;
  assets: GitHubReleaseAsset[];
};

export type AvailableAppUpdate = {
  versionName: string;
  versionCode: number;
  notes: string;
  apkAssetName: string;
  apkDownloadUrl: string;
  apkSize: number;
  sha256: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isTrustedReleaseDownloadUrl(value: string): boolean {
  return value.startsWith(TRUSTED_RELEASE_DOWNLOAD_PREFIX);
}

export function shouldCheckForUpdate(
  lastCheckedAt: number | null,
  now: number,
): boolean {
  if (!Number.isFinite(lastCheckedAt) || lastCheckedAt === null) {
    return true;
  }

  // 手机时间被手动调回时重新检查一次，避免错误的未来时间让更新永久停住。
  if (lastCheckedAt > now) {
    return true;
  }

  return now - lastCheckedAt >= UPDATE_CHECK_INTERVAL_MS;
}

export function parseUpdateManifest(value: unknown): UpdateManifest | null {
  if (!isRecord(value)) {
    return null;
  }

  const {versionName, versionCode, apkAssetName, sha256} = value;

  if (
    typeof versionName !== 'string' ||
    !/^\d+\.\d+\.\d+$/.test(versionName) ||
    !Number.isInteger(versionCode) ||
    (versionCode as number) < MOBILE_VERSION_CODE_MIN ||
    (versionCode as number) > MOBILE_VERSION_CODE_MAX ||
    typeof apkAssetName !== 'string' ||
    !/^[A-Za-z0-9._-]+\.apk$/.test(apkAssetName) ||
    typeof sha256 !== 'string' ||
    !/^[a-f0-9]{64}$/.test(sha256)
  ) {
    return null;
  }

  return {
    versionName,
    versionCode: versionCode as number,
    apkAssetName,
    sha256,
  };
}

export function parseGitHubLatestRelease(
  value: unknown,
): GitHubLatestRelease | null {
  if (!isRecord(value) || !Array.isArray(value.assets)) {
    return null;
  }

  const assets: GitHubReleaseAsset[] = [];

  for (const assetValue of value.assets) {
    if (!isRecord(assetValue)) {
      return null;
    }

    const {name, browser_download_url: downloadUrl, size, digest} = assetValue;
    if (
      typeof name !== 'string' ||
      typeof downloadUrl !== 'string' ||
      typeof size !== 'number' ||
      !Number.isInteger(size) ||
      size < 0 ||
      (digest !== null && typeof digest !== 'string')
    ) {
      return null;
    }

    assets.push({name, downloadUrl, size, digest});
  }

  const {
    tag_name: tagName,
    body: notes,
    draft,
    prerelease,
  } = value;
  if (
    typeof tagName !== 'string' ||
    (notes !== null && typeof notes !== 'string') ||
    typeof draft !== 'boolean' ||
    typeof prerelease !== 'boolean'
  ) {
    return null;
  }

  return {
    tagName,
    notes: notes ?? '',
    draft,
    prerelease,
    assets,
  };
}

export function findAvailableAppUpdate(
  installedVersionCode: number,
  release: GitHubLatestRelease,
  manifest: UpdateManifest,
): AvailableAppUpdate | null {
  if (
    release.draft ||
    release.prerelease ||
    release.tagName !== `mobile-v${manifest.versionName}` ||
    manifest.versionCode <= installedVersionCode
  ) {
    return null;
  }

  const apkAsset = release.assets.find(
    asset => asset.name === manifest.apkAssetName,
  );

  // 文件名、大小、GitHub 摘要和下载域名必须同时匹配，避免把误传的附件当成安装包。
  if (
    !apkAsset ||
    apkAsset.size <= 0 ||
    apkAsset.size > MAX_APK_SIZE_BYTES ||
    apkAsset.digest !== `sha256:${manifest.sha256}` ||
    !isTrustedReleaseDownloadUrl(apkAsset.downloadUrl)
  ) {
    return null;
  }

  return {
    versionName: manifest.versionName,
    versionCode: manifest.versionCode,
    notes: release.notes.trim(),
    apkAssetName: manifest.apkAssetName,
    apkDownloadUrl: apkAsset.downloadUrl,
    apkSize: apkAsset.size,
    sha256: manifest.sha256,
  };
}
