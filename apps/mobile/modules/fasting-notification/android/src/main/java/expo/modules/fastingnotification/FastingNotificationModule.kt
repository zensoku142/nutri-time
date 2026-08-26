// ==================== 通知栏常驻倒计时 ====================
// Expo Module（连接 TypeScript 和 Android 的小桥）只接收阶段与计划结束时间。
// Android 自己刷新通知里的秒数，所以应用退到后台后仍能继续，也不需要每秒保存或跨设备同步。

package expo.modules.fastingnotification

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.os.Build
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class FastingNotificationModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("FastingNotification")

    AsyncFunction("startCountdown") { plannedEndAt: Long, stage: String, promise: Promise ->
      val context = appContext.reactContext
      if (context == null) {
        promise.reject(
          NOTIFICATION_ERROR_CODE,
          "NutriTime 尚未准备好 Android 通知环境，请稍后重试。",
          null,
        )
        return@AsyncFunction
      }

      try {
        showCountdown(context, plannedEndAt, stage)
        promise.resolve(null)
      } catch (error: Exception) {
        promise.reject(
          NOTIFICATION_ERROR_CODE,
          "无法显示通知栏倒计时。",
          error,
        )
      }
    }

    AsyncFunction("stopCountdown") { promise: Promise ->
      val context = appContext.reactContext
      if (context == null) {
        promise.reject(
          NOTIFICATION_ERROR_CODE,
          "NutriTime 尚未准备好 Android 通知环境，请稍后重试。",
          null,
        )
        return@AsyncFunction
      }

      cancelCountdown(context)
      promise.resolve(null)
    }
  }

  private fun showCountdown(
    context: Context,
    plannedEndAt: Long,
    stage: String,
  ) {
    val now = System.currentTimeMillis()
    require(plannedEndAt > now) {
      "plannedEndAt must be later than the current time"
    }

    val content = createCycleCountdownContent(stage)
    val notificationManager =
      context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

    require(notificationManager.areNotificationsEnabled()) {
      "Notifications are disabled for NutriTime"
    }

    createCountdownChannel(notificationManager)

    val launchIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)
    val contentIntent = launchIntent?.let {
      PendingIntent.getActivity(
        context,
        OPEN_APP_REQUEST_CODE,
        it,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
      )
    }

    @Suppress("DEPRECATION")
    val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      Notification.Builder(context, COUNTDOWN_CHANNEL_ID)
    } else {
      Notification.Builder(context)
    }

    builder
      .setSmallIcon(R.drawable.nutritime_notification_icon)
      .setContentTitle(content.title)
      .setContentText(content.detail)
      .setWhen(plannedEndAt)
      .setShowWhen(true)
      .setUsesChronometer(true)
      .setChronometerCountDown(true)
      .setOngoing(true)
      .setAutoCancel(false)
      .setOnlyAlertOnce(true)
      .setCategory(Notification.CATEGORY_STATUS)
      .setVisibility(Notification.VISIBILITY_PRIVATE)

    if (contentIntent != null) {
      // 用户点通知时回到 NutriTime；系统找不到启动页时仍保留倒计时，不让辅助入口影响主要展示。
      builder.setContentIntent(contentIntent)
    }

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      // 到达目标时间后由系统移除常驻倒计时，随后继续展示原有的“目标已达成”到期提醒。
      builder.setTimeoutAfter(plannedEndAt - now)
    }

    notificationManager.notify(COUNTDOWN_NOTIFICATION_TAG, COUNTDOWN_NOTIFICATION_ID, builder.build())
  }

  private fun cancelCountdown(context: Context) {
    val notificationManager =
      context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    notificationManager.cancel(COUNTDOWN_NOTIFICATION_TAG, COUNTDOWN_NOTIFICATION_ID)
  }

  private fun createCountdownChannel(notificationManager: NotificationManager) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
      return
    }

    // 常驻倒计时只安静显示进度；结束时是否响铃仍由原来的“目标时间提醒”渠道单独负责。
    val channel = NotificationChannel(
      COUNTDOWN_CHANNEL_ID,
      "周期倒计时",
      NotificationManager.IMPORTANCE_LOW,
    ).apply {
      description = "在活动周期内持续显示距离目标结束的时间"
      setSound(null, null)
      enableVibration(false)
      setShowBadge(false)
    }
    notificationManager.createNotificationChannel(channel)
  }

  private companion object {
    const val NOTIFICATION_ERROR_CODE = "E_FASTING_COUNTDOWN_NOTIFICATION_FAILED"
    const val COUNTDOWN_CHANNEL_ID = "fasting-countdown"
    const val COUNTDOWN_NOTIFICATION_TAG = "nutritime-cycle-countdown"
    const val COUNTDOWN_NOTIFICATION_ID = 1
    const val OPEN_APP_REQUEST_CODE = 1
  }
}
