// ==================== 手机正式同步快照测试 ====================
// 测试只检查手机写出的字段，不假装已经完成 Wear 接收、解析或设备联调。

package expo.modules.weardatalayer

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class WearSyncSnapshotTest {
  @Test
  fun idleOmitsEverySessionField() {
    val snapshot = createWearSyncSnapshot(
      protocolVersion = 1,
      status = "idle",
      sessionId = null,
      startAt = null,
      plannedEndAt = null,
      stateChangedAt = 1_000_000L,
    )
    val fields = snapshot.toDataMapFields()

    assertEquals("/fasting/current", FASTING_CURRENT_PATH)
    assertEquals(setOf("protocolVersion", "status", "stateChangedAt"), fields.keys)
    assertFalse(fields.containsKey("sessionId"))
    assertFalse(fields.containsKey("startAt"))
    assertFalse(fields.containsKey("plannedEndAt"))
    assertFalse(fields.containsKey("remainingSeconds"))
  }

  @Test
  fun fastingContainsTheCompleteSessionInUnixMilliseconds() {
    val snapshot = createWearSyncSnapshot(
      protocolVersion = 1,
      status = "fasting",
      sessionId = "fasting-1000000",
      startAt = 1_000_000L,
      plannedEndAt = 58_600_000L,
      stateChangedAt = 1_000_000L,
    )
    val fields = snapshot.toDataMapFields()

    assertEquals(1, fields["protocolVersion"])
    assertEquals("fasting", fields["status"])
    assertEquals("fasting-1000000", fields["sessionId"])
    assertEquals(1_000_000L, fields["startAt"])
    assertEquals(58_600_000L, fields["plannedEndAt"])
    assertEquals(1_000_000L, fields["stateChangedAt"])
    assertFalse(fields.containsKey("remainingSeconds"))
    assertTrue((fields["plannedEndAt"] as Long) > (fields["startAt"] as Long))
  }
}
