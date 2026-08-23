// ==================== Wear 原生模块入口 ====================
// Expo Module（连接两种代码的小桥）让负责手机页面的 TypeScript 可以调用 Android 的 Kotlin 能力。
// 正式断食流程只在本地状态保存或恢复成功后调用这座桥；原生同步失败不会改变手机里的断食结果。

import {requireNativeModule} from 'expo';
import type {NativeModule} from 'expo';

type WearDataLayerNativeModule = NativeModule & {
  ping(): Promise<string>;
  syncCurrentFasting(payload: WearSyncPayload, urgent: boolean): Promise<void>;
};

// 判别联合会根据 status 限定合法字段：idle 不能夹带空会话，fasting 则必须带齐真实会话。
export type WearSyncPayload =
  | {
      protocolVersion: 1;
      status: 'idle';
      stateChangedAt: number;
    }
  | {
      protocolVersion: 1;
      status: 'fasting';
      sessionId: string;
      startAt: number;
      plannedEndAt: number;
      stateChangedAt: number;
    };

function getNativeModule() {
  // 只在实际诊断或同步时寻找原生模块；找不到时错误会落在本次 Promise 中，不会在 render 阶段让应用崩溃。
  return requireNativeModule<WearDataLayerNativeModule>('WearDataLayer');
}

// Promise（稍后交回结果的约定）表示 Kotlin 的结果不会假装立即出现。
// TypeScript 会等待原生调用成功或失败，再由调试入口显示对应信息。
export async function ping(): Promise<string> {
  return getNativeModule().ping();
}

// Data Layer（手机和手表之间的共享小信箱）保存最新状态快照，不传每秒变化的剩余时间。
// urgent 只有用户主动开始或结束时为 true；启动恢复传 false，避免普通核对增加设备耗电。
export async function syncCurrentFasting(
  payload: WearSyncPayload,
  urgent: boolean,
): Promise<void> {
  return getNativeModule().syncCurrentFasting(payload, urgent);
}
