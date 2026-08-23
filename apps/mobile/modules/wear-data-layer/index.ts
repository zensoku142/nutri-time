// ==================== Wear 原生模块入口 ====================
// Expo Module（连接两种代码的小桥）让负责手机页面的 TypeScript 可以调用 Android 的 Kotlin 能力。
// 这座桥只在开发者主动测试时加载；若 Development Build 没有重建，断食、存储和通知功能仍可正常启动。

import {requireNativeModule} from 'expo';
import type {NativeModule} from 'expo';

type WearDataLayerNativeModule = NativeModule & {
  ping(): Promise<string>;
};

// Promise（稍后交回结果的约定）表示 Kotlin 的结果不会假装立即出现。
// TypeScript 会等待原生调用成功或失败，再由调试入口显示对应信息。
export async function ping(): Promise<string> {
  // 只在用户点击时寻找原生模块；找不到时错误会落在本次 Promise 中，不会让应用启动失败。
  const nativeModule =
    requireNativeModule<WearDataLayerNativeModule>('WearDataLayer');
  return nativeModule.ping();
}
