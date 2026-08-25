// ==================== 当前周期本地存储 ====================
// AsyncStorage（类似手机里的小抽屉）会在 App 关闭后继续保留数据。
// 当前阶段与完成历史使用不同的 key（手机小抽屉标签），都不保存格式化文字或每秒变化的剩余时间。

import AsyncStorage from '@react-native-async-storage/async-storage';

import {DEFAULT_CYCLE_PLAN} from '../domain/fasting';
import type {
  ActiveCycleSession,
  CompletedFastingSession,
  CyclePlan,
  FastingSession,
} from '../domain/fasting';

export type PersistedCycleState = {
  storageVersion: 2;
  session: ActiveCycleSession;
  // notification ID（系统给这条提醒的“取件号码”）只属于手机运行信息，切换阶段时靠它找到并取消上一条提醒。
  completionNotificationId?: string;
};

// 旧名称继续导出，已有调用方不需要和 storageVersion 一起被迫改名。
export type PersistedFastingState = PersistedCycleState;

export type CycleStateReadResult =
  | {status: 'empty'}
  | {
      status: 'restored';
      session: ActiveCycleSession;
      state: PersistedCycleState;
    }
  | {status: 'invalid'};

export type FastingStateReadResult = CycleStateReadResult;

export type CyclePlanReadResult =
  | {status: 'default'; plan: CyclePlan}
  | {status: 'restored'; plan: CyclePlan}
  | {status: 'invalid'};

export type FastingHistoryReadResult =
  | {status: 'empty'; sessions: []}
  | {status: 'restored'; sessions: CompletedFastingSession[]}
  | {status: 'invalid'};

type LegacyPersistedFastingState = {
  storageVersion: 1;
  session: FastingSession;
  completionNotificationId?: string;
};

const CURRENT_FASTING_STORAGE_KEY = '@nutritime/fasting/current';
const CYCLE_PLAN_STORAGE_KEY = '@nutritime/cycle/plan';
const FASTING_HISTORY_STORAGE_KEY = '@nutritime/fasting/history';
const CURRENT_STORAGE_VERSION = 2;
const CURRENT_PLAN_STORAGE_VERSION = 1;
const CURRENT_HISTORY_STORAGE_VERSION = 1;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isValidCycleSession(value: unknown): value is ActiveCycleSession {
  if (!isRecord(value)) {
    return false;
  }

  return (
    (value.status === 'fasting' || value.status === 'eating') &&
    typeof value.id === 'string' &&
    value.id.trim().length > 0 &&
    typeof value.startAt === 'number' &&
    Number.isFinite(value.startAt) &&
    typeof value.plannedEndAt === 'number' &&
    Number.isFinite(value.plannedEndAt) &&
    value.plannedEndAt > value.startAt
  );
}

function hasValidNotificationId(value: Record<string, unknown>): boolean {
  return (
    value.completionNotificationId === undefined ||
    (typeof value.completionNotificationId === 'string' &&
      value.completionNotificationId.trim().length > 0)
  );
}

function isValidCyclePlan(value: unknown): value is CyclePlan {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.fastingMinutes === 'number' &&
    Number.isInteger(value.fastingMinutes) &&
    value.fastingMinutes >= 60 &&
    value.fastingMinutes <= 23 * 60 &&
    value.fastingMinutes % 60 === 0 &&
    typeof value.eatingMinutes === 'number' &&
    Number.isInteger(value.eatingMinutes) &&
    value.eatingMinutes >= 60 &&
    value.eatingMinutes <= 23 * 60 &&
    value.eatingMinutes % 60 === 0 &&
    value.fastingMinutes + value.eatingMinutes === 24 * 60
  );
}

function isValidCompletedFastingSession(
  value: unknown,
): value is CompletedFastingSession {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === 'string' &&
    value.id.trim().length > 0 &&
    typeof value.startAt === 'number' &&
    Number.isFinite(value.startAt) &&
    typeof value.plannedEndAt === 'number' &&
    Number.isFinite(value.plannedEndAt) &&
    value.plannedEndAt > value.startAt &&
    typeof value.completedAt === 'number' &&
    Number.isFinite(value.completedAt) &&
    value.completedAt >= value.startAt
  );
}

function parseFastingHistory(
  storedValue: string | null,
): FastingHistoryReadResult {
  if (storedValue === null) {
    return {status: 'empty', sessions: []};
  }

  try {
    const parsedValue: unknown = JSON.parse(storedValue);

    if (
      !isRecord(parsedValue) ||
      parsedValue.storageVersion !== CURRENT_HISTORY_STORAGE_VERSION ||
      !Array.isArray(parsedValue.sessions) ||
      !parsedValue.sessions.every(isValidCompletedFastingSession)
    ) {
      return {status: 'invalid'};
    }

    return {status: 'restored', sessions: parsedValue.sessions};
  } catch {
    return {status: 'invalid'};
  }
}

function isValidPersistedCycleState(
  value: unknown,
): value is PersistedCycleState {
  if (!isRecord(value)) {
    return false;
  }

  // TypeScript 只在写代码时检查类型，无法保证手机小抽屉里的旧数据一定正确。
  // 每次恢复都重新检查版本、会话状态和时间，损坏记录才不会让 App 崩溃或冒充正常断食。
  return (
    value.storageVersion === CURRENT_STORAGE_VERSION &&
    isValidCycleSession(value.session) &&
    hasValidNotificationId(value)
  );
}

function isValidLegacyPersistedFastingState(
  value: unknown,
): value is LegacyPersistedFastingState {
  return (
    isRecord(value) &&
    value.storageVersion === 1 &&
    isValidCycleSession(value.session) &&
    value.session.status === 'fasting' &&
    hasValidNotificationId(value)
  );
}

// ---------- 读取当前状态 ----------
export async function readCurrentFastingState(): Promise<CycleStateReadResult> {
  const storedValue = await AsyncStorage.getItem(CURRENT_FASTING_STORAGE_KEY);

  if (storedValue === null) {
    return {status: 'empty'};
  }

  try {
    const parsedValue: unknown = JSON.parse(storedValue);

    if (isValidPersistedCycleState(parsedValue)) {
      return {
        status: 'restored',
        session: parsedValue.session,
        state: parsedValue,
      };
    }

    if (isValidLegacyPersistedFastingState(parsedValue)) {
      const migratedState: PersistedCycleState = {
        storageVersion: CURRENT_STORAGE_VERSION,
        session: parsedValue.session,
        ...(parsedValue.completionNotificationId === undefined
          ? {}
          : {completionNotificationId: parsedValue.completionNotificationId}),
      };

      try {
        // v1 只有 fasting；原样保留合法会话并写回 v2，升级后才能与新的 eating 记录使用同一套结构。
        await AsyncStorage.setItem(
          CURRENT_FASTING_STORAGE_KEY,
          JSON.stringify(migratedState),
        );
      } catch (error) {
        // 写回失败时仍先恢复合法旧会话，下次启动会再次迁移，不能因升级失败把用户正在进行的断食丢掉。
        const errorName = error instanceof Error ? error.name : 'UnknownError';
        console.error('[NutriTime] cycle-storage-migration-write-failed', {
          errorName,
        });
      }

      return {
        status: 'restored',
        session: migratedState.session,
        state: migratedState,
      };
    }

    return {status: 'invalid'};
  } catch {
    // 无法解析的原始文字继续留在手机中，只有用户明确重置时才删除，避免静默丢失可排查的信息。
    return {status: 'invalid'};
  }
}

// ---------- 读取与保存自定义周期 ----------
export async function readCyclePlan(): Promise<CyclePlanReadResult> {
  const storedValue = await AsyncStorage.getItem(CYCLE_PLAN_STORAGE_KEY);

  if (storedValue === null) {
    return {status: 'default', plan: DEFAULT_CYCLE_PLAN};
  }

  try {
    const parsedValue: unknown = JSON.parse(storedValue);

    if (
      !isRecord(parsedValue) ||
      parsedValue.storageVersion !== CURRENT_PLAN_STORAGE_VERSION ||
      !isValidCyclePlan(parsedValue.plan)
    ) {
      return {status: 'invalid'};
    }

    return {status: 'restored', plan: parsedValue.plan};
  } catch {
    // 自定义计划同样不静默删除；用户确认重置后才回到默认 16:8。
    return {status: 'invalid'};
  }
}

export async function saveCyclePlan(plan: CyclePlan): Promise<void> {
  await AsyncStorage.setItem(
    CYCLE_PLAN_STORAGE_KEY,
    JSON.stringify({
      storageVersion: CURRENT_PLAN_STORAGE_VERSION,
      plan,
    }),
  );
}

export async function saveCyclePlanAndCurrentState(
  plan: CyclePlan,
  state: PersistedCycleState,
): Promise<void> {
  // multiSet（一次交给手机小抽屉的批量写入）把新比例和当前阶段一起提交，避免页面重开后两处只更新一半。
  await AsyncStorage.multiSet([
    [
      CYCLE_PLAN_STORAGE_KEY,
      JSON.stringify({
        storageVersion: CURRENT_PLAN_STORAGE_VERSION,
        plan,
      }),
    ],
    [CURRENT_FASTING_STORAGE_KEY, JSON.stringify(state)],
  ]);
}

// ---------- 断食历史 ----------
export async function readFastingHistory(): Promise<FastingHistoryReadResult> {
  const storedValue = await AsyncStorage.getItem(FASTING_HISTORY_STORAGE_KEY);

  return parseFastingHistory(storedValue);
}

export async function saveCompletedFastingAndCurrentState(
  completedSession: FastingSession,
  completedAt: number,
  nextSession: ActiveCycleSession,
): Promise<void> {
  const storedValue = await AsyncStorage.getItem(FASTING_HISTORY_STORAGE_KEY);
  const historyResult = parseFastingHistory(storedValue);

  if (historyResult.status === 'invalid') {
    // 损坏历史不能被新的记录悄悄覆盖，否则用户连原始数据也无法再排查或恢复。
    throw new Error('本地断食历史无法读取');
  }

  const completedRecord: CompletedFastingSession = {
    id: completedSession.id,
    startAt: completedSession.startAt,
    plannedEndAt: completedSession.plannedEndAt,
    completedAt,
  };
  // 同一个会话若在上次写入后遇到系统中断，重试时替换原记录，避免统计次数被重复增加。
  const nextHistory = [
    ...historyResult.sessions.filter(session => session.id !== completedRecord.id),
    completedRecord,
  ];
  const nextState: PersistedCycleState = {
    storageVersion: CURRENT_STORAGE_VERSION,
    session: nextSession,
  };

  // 当前阶段和刚完成的断食一起交给 AsyncStorage，页面不会先进入 eating 却漏掉对应统计记录。
  await AsyncStorage.multiSet([
    [CURRENT_FASTING_STORAGE_KEY, JSON.stringify(nextState)],
    [
      FASTING_HISTORY_STORAGE_KEY,
      JSON.stringify({
        storageVersion: CURRENT_HISTORY_STORAGE_VERSION,
        sessions: nextHistory,
      }),
    ],
  ]);
}

// ---------- 保存当前状态 ----------
export async function saveCurrentFastingState(
  session: ActiveCycleSession,
  completionNotificationId?: string,
): Promise<void> {
  const persistedState: PersistedCycleState = {
    storageVersion: CURRENT_STORAGE_VERSION,
    session,
    ...(completionNotificationId === undefined
      ? {}
      : {completionNotificationId}),
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

export async function resetCurrentCycleData(): Promise<void> {
  // 用户在错误页明确重置时才同时删除损坏的活动阶段和自定义比例；正常结束 eating 只清活动阶段。
  await AsyncStorage.multiRemove([
    CURRENT_FASTING_STORAGE_KEY,
    CYCLE_PLAN_STORAGE_KEY,
  ]);
}
