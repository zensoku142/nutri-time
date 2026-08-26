// ==================== 通知栏倒计时文案 ====================
// 这部分不依赖 Android 页面，单元测试可以直接证明两个周期阶段不会显示错名称。

package expo.modules.fastingnotification

internal data class CycleCountdownContent(
  val title: String,
  val detail: String,
)

internal fun createCycleCountdownContent(stage: String): CycleCountdownContent = when (stage) {
  "fasting" -> CycleCountdownContent(
    title = "断食进行中",
    detail = "距离断食目标结束",
  )

  "eating" -> CycleCountdownContent(
    title = "进食窗口进行中",
    detail = "距离进食窗口结束",
  )

  else -> throw IllegalArgumentException("Unsupported cycle stage")
}
