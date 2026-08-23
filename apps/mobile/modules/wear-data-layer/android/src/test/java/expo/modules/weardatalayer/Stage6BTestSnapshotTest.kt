// ==================== 阶段 6B 固定测试快照测试 ====================
// 测试传入固定时间，既能检查协议字段，也不需要真的等待五分钟。

package expo.modules.weardatalayer

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class Stage6BTestSnapshotTest {
  @Test
  fun snapshotUsesOnlyTheFixedFastingFields() {
    val snapshot = createStage6BTestSnapshot(1_000_000L)

    assertEquals("/fasting/current", FASTING_CURRENT_PATH)
    assertEquals(1, snapshot.protocolVersion)
    assertEquals("fasting", snapshot.status)
    assertEquals("stage-6b-test", snapshot.sessionId)
    assertEquals(1_000_000L, snapshot.startAt)
    assertEquals(1_300_000L, snapshot.plannedEndAt)
    assertEquals(snapshot.startAt, snapshot.stateChangedAt)
    assertTrue(snapshot.plannedEndAt > snapshot.startAt)

    val fieldNames = Stage6BTestSnapshot::class.java.declaredFields.map { it.name }
    assertFalse(fieldNames.contains("remainingSeconds"))
    assertFalse(fieldNames.any { it.startsWith("idle") })
  }

  @Test
  fun repeatedClickInTheSameMillisecondStillGetsANewerTimestamp() {
    assertEquals(1_000_001L, nextSnapshotTime(now = 1_000_000L, previousSnapshotTime = 1_000_000L))
    assertEquals(2_000_000L, nextSnapshotTime(now = 2_000_000L, previousSnapshotTime = 1_000_000L))
  }
}
