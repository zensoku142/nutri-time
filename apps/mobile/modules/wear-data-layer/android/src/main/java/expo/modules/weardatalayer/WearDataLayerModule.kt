package expo.modules.weardatalayer

import android.util.Log
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

// ==================== Wear 原生通信桥 ====================
// Expo Module（连接两种代码的小桥）把手机页面的 TypeScript 调用交给这里的 Kotlin。
// 重要源码必须留在 modules 目录；apps/mobile/android 会被 Prebuild 重新生成，写在那里可能在下次生成时丢失。
class WearDataLayerModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("WearDataLayer")

    // AsyncFunction（完成后再交回结果的原生方法）会让 TypeScript 收到 Promise，而不是假装立刻拿到结果。
    AsyncFunction("ping") {
      // 固定且不含设备信息的日志用于证明调用真正进入 Kotlin，不会泄露用户数据或本机配置。
      Log.i(LOG_TAG, "ping-entered-kotlin")
      PING_RESULT
    }
  }

  private companion object {
    const val LOG_TAG = "NutriTimeWearModule"
    const val PING_RESULT = "Wear module ready"
  }
}
