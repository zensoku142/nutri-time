package expo.modules.weardatalayer

import android.util.Log
import com.google.android.gms.wearable.PutDataMapRequest
import com.google.android.gms.wearable.Wearable
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import expo.modules.kotlin.records.Required
import expo.modules.kotlin.types.OptimizedRecord

// Record（原生桥接收 TypeScript 对象的固定表格）保留可选会话字段，再由 status 检查哪一组字段合法。
@OptimizedRecord
class WearSyncPayloadRecord : Record {
  @Field
  @Required
  val protocolVersion: Int = 0

  @Field
  @Required
  val status: String = ""

  @Field
  val sessionId: String? = null

  @Field
  val startAt: Long? = null

  @Field
  val plannedEndAt: Long? = null

  @Field
  @Required
  val stateChangedAt: Long = 0L
}

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

    AsyncFunction("syncCurrentFasting") { payload: WearSyncPayloadRecord, urgent: Boolean, promise: Promise ->
      val context = appContext.reactContext
      if (context == null) {
        promise.reject(
          SYNC_ERROR_CODE,
          "NutriTime 尚未准备好 Android 原生环境，请稍后重试。",
          null,
        )
        return@AsyncFunction
      }

      val snapshot = try {
        createWearSyncSnapshot(
          protocolVersion = payload.protocolVersion,
          status = payload.status,
          sessionId = payload.sessionId,
          startAt = payload.startAt,
          plannedEndAt = payload.plannedEndAt,
          stateChangedAt = payload.stateChangedAt,
        )
      } catch (error: IllegalArgumentException) {
        promise.reject(
          SYNC_ERROR_CODE,
          "断食同步数据不符合当前协议。",
          error,
        )
        return@AsyncFunction
      }

      // Data Layer（手机和手表之间的共享小信箱）保存双方都能读取的最新状态。
      // DataItem 是信箱里的当前状态快照；手表晚一点打开，也能读取手机此前放进去的内容。
      val request = PutDataMapRequest.create(FASTING_CURRENT_PATH).apply {
        // path（信箱上的固定标签）和字段名必须两端完全一致；idle 的字段表不会生成任何 session 空值。
        snapshot.toDataMapFields().forEach { (key, value) ->
          when (value) {
            is Int -> dataMap.putInt(key, value)
            is Long -> dataMap.putLong(key, value)
            is String -> dataMap.putString(key, value)
          }
        }
      }.asPutDataRequest().apply {
        // setUrgent() 只用于用户刚点击开始或结束；启动恢复使用普通请求，禁止把每秒页面刷新接到这里。
        if (urgent) {
          setUrgent()
        }
      }

      Wearable.getDataClient(context).putDataItem(request)
        .addOnSuccessListener {
          // putDataItem() 成功只表示快照已交给 Data Layer，不代表手表已经打开页面或完成展示。
          Log.i(
            LOG_TAG,
            "current-fasting-submitted path=$FASTING_CURRENT_PATH status=${snapshot.status} urgent=$urgent",
          )
          promise.resolve(null)
        }
        .addOnFailureListener { error ->
          Log.e(
            LOG_TAG,
            "current-fasting-submit-failed path=$FASTING_CURRENT_PATH errorType=${error.javaClass.simpleName}",
          )
          promise.reject(
            SYNC_ERROR_CODE,
            "无法把当前断食状态提交给 Wear Data Layer。",
            error,
          )
        }
    }
  }

  private companion object {
    const val LOG_TAG = "NutriTimeWearModule"
    const val PING_RESULT = "Wear module ready"
    const val SYNC_ERROR_CODE = "E_WEAR_CURRENT_FASTING_SYNC_FAILED"
  }
}
