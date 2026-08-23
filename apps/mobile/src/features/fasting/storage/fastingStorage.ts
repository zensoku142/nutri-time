// ==================== 当前断食本地存储 ====================
// AsyncStorage（类似手机里的小抽屉）会在 App 关闭后继续保留数据。
// 这里只保存当前活动会话，不保存历史、格式化文字或每秒变化的剩余时间。

import AsyncStorage from '@react-native-async-storage/async-storage';

import type {FastingSession} from '../domain/fasting';

export type PersistedFastingState = {
  storageVersion: 1;
  session: FastingSession;
};

export type FastingStateReadResult =
  | {status: 'empty'}
  | {status: 'restored'; session: FastingSession}
  | {status: 'invalid'};

const CURRENT_FASTING_STORAGE_KEY = '@nutritime/fasting/current';
const CURRENT_STORAGE_VERSION = 1;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isValidFastingSession(value: unknown): value is FastingSession {
  if (!isRecord(value)) {
    return false;
  }

  return (
    value.status === 'fasting' &&
    typeof value.id === 'string' &&
    value.id.trim().length > 0 &&
    typeof value.startAt === 'number' &&
    Number.isFinite(value.startAt) &&
    typeof value.plannedEndAt === 'number' &&
    Number.isFinite(value.plannedEndAt) &&
    value.plannedEndAt > value.startAt
  );
}

function isValidPersistedState(
  value: unknown,
): value is PersistedFastingState {
  if (!isRecord(value)) {
    return false;
  }

  // TypeScript 只在写代码时检查类型，无法保证手机小抽屉里的旧数据一定正确。
  // 每次恢复都重新检查版本、会话状态和时间，损坏记录才不会让 App 崩溃或冒充正常断食。
  return (
    value.storageVersion === CURRENT_STORAGE_VERSION &&
    isValidFastingSession(value.session)
  );
}

// ---------- 读取当前状态 ----------
export async function readCurrentFastingState(): Promise<FastingStateReadResult> {
  const storedValue = await AsyncStorage.getItem(CURRENT_FASTING_STORAGE_KEY);

  if (storedValue === null) {
    return {status: 'empty'};
  }

  try {
    const parsedValue: unknown = JSON.parse(storedValue);

    if (!isValidPersistedState(parsedValue)) {
      return {status: 'invalid'};
    }

    return {status: 'restored', session: parsedValue.session};
  } catch {
    // 无法解析的原始文字继续留在手机中，只有用户明确重置时才删除，避免静默丢失可排查的信息。
    return {status: 'invalid'};
  }
}

// ---------- 保存当前状态 ----------
export async function saveCurrentFastingState(
  session: FastingSession,
): Promise<void> {
  const persistedState: PersistedFastingState = {
    storageVersion: CURRENT_STORAGE_VERSION,
    session,
  };

  await AsyncStorage.setItem(
    CURRENT_FASTING_STORAGE_KEY,
    JSON.stringify(persistedState),
  );
}

// ---------- 删除当前状态 ----------
export async function clearCurrentFastingState(): Promise<void> {
  await AsyncStorage.removeItem(CURRENT_FASTING_STORAGE_KEY);
}
