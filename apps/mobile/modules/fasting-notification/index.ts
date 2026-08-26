// ==================== 通知栏倒计时原生入口 ====================
// Android 系统根据计划结束时间自己刷新通知；TypeScript 只在阶段开始、修改或结束时调用一次。

import {requireNativeModule} from 'expo';
import type {NativeModule} from 'expo';

type CycleStage = 'fasting' | 'eating';

type FastingNotificationNativeModule = NativeModule & {
  startCountdown(plannedEndAt: number, stage: CycleStage): Promise<void>;
  stopCountdown(): Promise<void>;
};

function getNativeModule() {
  // 延迟寻找原生模块，让缺少新 Development Build 时通过本次 Promise 报错，而不是在页面加载时直接崩溃。
  return requireNativeModule<FastingNotificationNativeModule>(
    'FastingNotification',
  );
}

export async function startCountdown(
  plannedEndAt: number,
  stage: CycleStage,
): Promise<void> {
  return getNativeModule().startCountdown(plannedEndAt, stage);
}

export async function stopCountdown(): Promise<void> {
  return getNativeModule().stopCountdown();
}
