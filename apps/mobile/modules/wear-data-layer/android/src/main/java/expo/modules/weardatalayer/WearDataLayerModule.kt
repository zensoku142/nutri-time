package expo.modules.weardatalayer

import android.util.Log
import com.google.android.gms.wearable.PutDataMapRequest
import com.google.android.gms.wearable.Wearable
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.util.concurrent.atomic.AtomicLong

// ==================== Wear 原生通信桥 ====================
// Expo Module（连接两种代码的小桥）把手机页面的 TypeScript 调用交给这里的 Kotlin。
// 重要源码必须留在 modules 目录；apps/mobile/android 会被 Prebuild 重新生成，写在那里可能在下次生成时丢失。
class WearDataLayerModule : Module() {
  private val lastTestSnapshotTime = AtomicLong(0L)

  override fun definition() = ModuleDefinition {
    Name("WearDataLayer")

    // AsyncFunction（完成后再交回结果的原生方法）会让 TypeScript 收到 Promise，而不是假装立刻拿到结果。
    AsyncFunction("ping") {
      // 固定且不含设备信息的日志用于证明调用真正进入 Kotlin，不会泄露用户数据或本机配置。
      Log.i(LOG_TAG, "ping-entered-kotlin")
      PING_RESULT
    }

    AsyncFunction("sendTestSnapshot") { promise: Promise ->
      val context = appContext.reactContext
      if (context == null) {
        promise.reject(
          SEND_ERROR_CODE,
          "NutriTime 尚未准备好 Android 原生环境，请稍后重试。",
          null,
        )
        return@AsyncFunction
      }

      // 极快的重复测试可能落在同一毫秒；这里至少加 1 毫秒，保证每次快照都能被识别为新内容。
      val snapshotTime = lastTestSnapshotTime.updateAndGet { previous ->
        nextSnapshotTime(System.currentTimeMillis(), previous)
      }
      val snapshot = createStage6BTestSnapshot(snapshotTime)

      // Data Layer（手机和手表之间的共享小信箱）保存双方都能读取的最新状态。
      // DataItem 是信箱里的当前状态快照；手表晚一点打开，也能读取手机此前放进去的内容。
      val request = PutDataMapRequest.create(FASTING_CURRENT_PATH).apply {
        // path（信箱上的固定标签）必须两端完全一致，手表才能找到这一份测试快照。
        dataMap.putInt("protocolVersion", snapshot.protocolVersion)
        dataMap.putString("status", snapshot.status)
        dataMap.putString("sessionId", snapshot.sessionId)
        dataMap.putLong("startAt", snapshot.startAt)
        dataMap.putLong("plannedEndAt", snapshot.plannedEndAt)
        dataMap.putLong("stateChangedAt", snapshot.stateChangedAt)
      }.asPutDataRequest().apply {
        // setUrgent() 只服务用户主动点击后的即时测试，让联调结果尽快出现。
        // 它不能用于每秒刷新，否则会增加手机和手表耗电；阶段 6C 会区分主动操作与被动恢复。
        setUrgent()
      }

      Wearable.getDataClient(context).putDataItem(request)
        .addOnSuccessListener {
          // putDataItem() 成功只表示快照已交给 Data Layer，不代表手表已经打开页面或完成展示。
          Log.i(
            LOG_TAG,
            "test-snapshot-submitted path=$FASTING_CURRENT_PATH stateChangedAt=${snapshot.stateChangedAt}",
          )
          promise.resolve(null)
        }
        .addOnFailureListener { error ->
          Log.e(
            LOG_TAG,
            "test-snapshot-submit-failed path=$FASTING_CURRENT_PATH errorType=${error.javaClass.simpleName}",
          )
          promise.reject(
            SEND_ERROR_CODE,
            "无法把测试快照提交给 Wear Data Layer。",
            error,
          )
        }
    }
  }

  private companion object {
    const val LOG_TAG = "NutriTimeWearModule"
    const val PING_RESULT = "Wear module ready"
    const val SEND_ERROR_CODE = "E_WEAR_TEST_SNAPSHOT_SEND_FAILED"
  }
}
