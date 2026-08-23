// ==================== 阶段 6B 固定测试快照 ====================
// 这里的数据只用于确认手机与手表能互相找到，不读取或修改用户真正的断食记录。

package expo.modules.weardatalayer

internal const val FASTING_CURRENT_PATH = "/fasting/current"
internal const val STAGE_6B_PROTOCOL_VERSION = 1
internal const val STAGE_6B_STATUS = "fasting"
internal const val STAGE_6B_SESSION_ID = "stage-6b-test"
internal const val STAGE_6B_TEST_DURATION_MILLIS = 5 * 60 * 1_000L

internal data class Stage6BTestSnapshot(
  val protocolVersion: Int,
  val status: String,
  val sessionId: String,
  val startAt: Long,
  val plannedEndAt: Long,
  val stateChangedAt: Long,
)

internal fun createStage6BTestSnapshot(snapshotTime: Long) = Stage6BTestSnapshot(
  protocolVersion = STAGE_6B_PROTOCOL_VERSION,
  status = STAGE_6B_STATUS,
  sessionId = STAGE_6B_SESSION_ID,
  startAt = snapshotTime,
  plannedEndAt = snapshotTime + STAGE_6B_TEST_DURATION_MILLIS,
  stateChangedAt = snapshotTime,
)

internal fun nextSnapshotTime(now: Long, previousSnapshotTime: Long): Long =
  if (now > previousSnapshotTime) now else previousSnapshotTime + 1L
