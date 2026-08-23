// ==================== Wear 原生模块入口 ====================
// Expo Module（连接两种代码的小桥）让负责手机页面的 TypeScript 可以调用 Android 的 Kotlin 能力。
// 这座桥只在开发者主动测试时加载；若 Development Build 没有重建，断食、存储和通知功能仍可正常启动。

import {requireNativeModule} from 'expo';
import type {NativeModule} from 'expo';

type WearDataLayerNativeModule = NativeModule & {
  ping(): Promise<string>;
  sendTestSnapshot(): Promise<void>;
};

function getNativeModule() {
  // 只在用户点击时寻找原生模块；找不到时错误会落在本次 Promise 中，不会让应用启动失败。
  return requireNativeModule<WearDataLayerNativeModule>('WearDataLayer');
}

// Promise（稍后交回结果的约定）表示 Kotlin 的结果不会假装立即出现。
// TypeScript 会等待原生调用成功或失败，再由调试入口显示对应信息。
export async function ping(): Promise<string> {
  return getNativeModule().ping();
}

// Data Layer（手机和手表之间的共享小信箱）只接收 Kotlin 创建的固定诊断快照。
// TypeScript 不传用户真实会话，避免阶段 6B 提前接入正式断食流程。
export async function sendTestSnapshot(): Promise<void> {
  return getNativeModule().sendTestSnapshot();
}
