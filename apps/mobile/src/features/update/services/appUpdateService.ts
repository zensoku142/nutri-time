// ==================== GitHub 应用更新 ====================
// 正式版启动后从公开的 GitHub Release 读取最新版本，确认附件信息后再交给用户决定是否安装。
// 检查或下载失败只影响本次更新，不会阻断断食计时和本地数据恢复。

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Application from 'expo-application';
import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';

import {
  findAvailableAppUpdate,
  isTrustedReleaseDownloadUrl,
  parseGitHubLatestRelease,
  parseUpdateManifest,
  shouldCheckForUpdate,
  type AvailableAppUpdate,
} from '../domain/appUpdate';

const LATEST_RELEASE_URL =
  'https://api.github.com/repos/zensoku142/nutri-time/releases/latest';
const UPDATE_MANIFEST_ASSET_NAME = 'update.json';
const LAST_CHECKED_AT_STORAGE_KEY = '@nutritime/update/last-checked-at';
const APK_MIME_TYPE = 'application/vnd.android.package-archive';
const FLAG_GRANT_READ_URI_PERMISSION = 1;

async function readLastCheckedAt(): Promise<number | null> {
  try {
    const storedValue = await AsyncStorage.getItem(LAST_CHECKED_AT_STORAGE_KEY);
    if (storedValue === null) {
      return null;
    }

    const parsedValue = Number(storedValue);
    return Number.isFinite(parsedValue) ? parsedValue : null;
  } catch {
    // 更新时间只是减少重复请求的小记事；读不到时仍检查一次，不能让存储故障永久挡住安全更新。
    return null;
  }
}

async function rememberSuccessfulCheck(now: number): Promise<void> {
  try {
    await AsyncStorage.setItem(LAST_CHECKED_AT_STORAGE_KEY, String(now));
  } catch {
    // 版本信息已经检查成功，记不住时间只会让下次启动多查一次，不值得打断用户。
  }
}

function getInstalledVersionCode(): number | null {
  const parsedValue = Number(Application.nativeBuildVersion);
  return Number.isInteger(parsedValue) && parsedValue > 0 ? parsedValue : null;
}

export async function checkForAvailableUpdate(
  now = Date.now(),
): Promise<AvailableAppUpdate | null> {
  const lastCheckedAt = await readLastCheckedAt();
  if (!shouldCheckForUpdate(lastCheckedAt, now)) {
    return null;
  }

  const installedVersionCode = getInstalledVersionCode();
  if (installedVersionCode === null) {
    return null;
  }

  const releaseResponse = await fetch(LATEST_RELEASE_URL, {
    headers: {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2026-03-10',
    },
  });

  // 仓库第一次发布前 latest 会返回 404；这属于“还没有更新”，不是应用启动错误。
  if (releaseResponse.status === 404) {
    await rememberSuccessfulCheck(now);
    return null;
  }

  if (!releaseResponse.ok) {
    throw new Error(`GitHub Release 请求失败：${releaseResponse.status}`);
  }

  const release = parseGitHubLatestRelease(await releaseResponse.json());
  const manifestAsset = release?.assets.find(
    asset => asset.name === UPDATE_MANIFEST_ASSET_NAME,
  );

  if (
    !release ||
    !manifestAsset ||
    !isTrustedReleaseDownloadUrl(manifestAsset.downloadUrl)
  ) {
    return null;
  }

  const manifestResponse = await fetch(manifestAsset.downloadUrl, {
    headers: {Accept: 'application/json'},
  });
  if (!manifestResponse.ok) {
    throw new Error(`更新说明请求失败：${manifestResponse.status}`);
  }

  const manifest = parseUpdateManifest(await manifestResponse.json());
  if (!manifest) {
    return null;
  }

  const availableUpdate = findAvailableAppUpdate(
    installedVersionCode,
    release,
    manifest,
  );
  await rememberSuccessfulCheck(now);
  return availableUpdate;
}

export async function downloadAndOpenAppUpdate(
  update: AvailableAppUpdate,
): Promise<void> {
  if (!FileSystem.cacheDirectory) {
    throw new Error('当前设备没有可用的更新缓存目录。');
  }

  const destination = `${FileSystem.cacheDirectory}nutritime-update-${update.versionCode}.apk`;

  // 先移除上次中断留下的同名文件，避免不完整内容被系统安装器误读。
  await FileSystem.deleteAsync(destination, {idempotent: true});
  const downloadResult = await FileSystem.downloadAsync(
    update.apkDownloadUrl,
    destination,
    {headers: {Accept: APK_MIME_TYPE}},
  );

  if (downloadResult.status < 200 || downloadResult.status >= 300) {
    throw new Error(`APK 下载失败：${downloadResult.status}`);
  }

  const downloadedFile = await FileSystem.getInfoAsync(downloadResult.uri);
  if (
    !downloadedFile.exists ||
    downloadedFile.isDirectory ||
    downloadedFile.size !== update.apkSize
  ) {
    throw new Error('APK 下载大小与 GitHub Release 记录不一致。');
  }

  // content URI（Android 临时分享文件的安全地址）让系统安装器只能读取这一个 APK。
  const contentUri = await FileSystem.getContentUriAsync(downloadResult.uri);
  await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
    data: contentUri,
    type: APK_MIME_TYPE,
    flags: FLAG_GRANT_READ_URI_PERMISSION,
  });
}
