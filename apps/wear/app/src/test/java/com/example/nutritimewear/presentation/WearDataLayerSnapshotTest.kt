// ==================== 阶段 6B 固定快照读取测试 ====================
// 这些测试只验证协议边界和新旧判断；真实 Data Layer 仍必须由配对设备联调证明。

package com.example.nutritimewear.presentation

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class WearDataLayerSnapshotTest {
    @Test
    fun fixedFastingSnapshotBecomesTheStage5FastingState() {
        val result = parseStage6BSnapshot(
            path = "/fasting/current",
            raw = validRawSnapshot,
        )

        val snapshot = (result as Stage6BSnapshotResult.Valid).snapshot
        assertEquals("stage-6b-test", snapshot.sessionId)
        assertEquals(1_000_000L, snapshot.startAt)
        assertEquals(1_300_000L, snapshot.plannedEndAt)
        assertEquals(1_000_000L, snapshot.stateChangedAt)
    }

    @Test
    fun unrelatedPathDoesNotChangeTheWearState() {
        assertEquals(
            Stage6BSnapshotResult.IgnoredPath,
            parseStage6BSnapshot(path = "/other/path", raw = validRawSnapshot),
        )
    }

    @Test
    fun missingOrIllegalFixedFieldsBecomeSyncErrors() {
        val missingSession = parseStage6BSnapshot(
            path = FASTING_CURRENT_PATH,
            raw = validRawSnapshot.copy(sessionId = null),
        )
        val invalidTime = parseStage6BSnapshot(
            path = FASTING_CURRENT_PATH,
            raw = validRawSnapshot.copy(plannedEndAt = validRawSnapshot.startAt),
        )
        val realSessionMustNotEnterStage6B = parseStage6BSnapshot(
            path = FASTING_CURRENT_PATH,
            raw = validRawSnapshot.copy(sessionId = "real-session"),
        )

        assertTrue(missingSession is Stage6BSnapshotResult.Invalid)
        assertTrue(invalidTime is Stage6BSnapshotResult.Invalid)
        assertTrue(realSessionMustNotEnterStage6B is Stage6BSnapshotResult.Invalid)
    }

    @Test
    fun olderStartupSnapshotCannotReplaceANewerListenerSnapshot() {
        assertFalse(
            shouldApplySnapshot(
                currentStateChangedAt = 2_000_000L,
                incomingStateChangedAt = 1_000_000L,
            ),
        )
        assertTrue(
            shouldApplySnapshot(
                currentStateChangedAt = 1_000_000L,
                incomingStateChangedAt = 2_000_000L,
            ),
        )
        assertFalse(
            canApplyStartupRead(
                isPageVisible = true,
                readVersion = 1L,
                currentReadVersion = 1L,
                listenerVersionAtStart = 0L,
                currentListenerVersion = 1L,
            ),
        )
    }

    private companion object {
        val validRawSnapshot = Stage6BRawSnapshot(
            protocolVersion = 1,
            status = "fasting",
            sessionId = "stage-6b-test",
            startAt = 1_000_000L,
            plannedEndAt = 1_300_000L,
            stateChangedAt = 1_000_000L,
        )
    }
}
