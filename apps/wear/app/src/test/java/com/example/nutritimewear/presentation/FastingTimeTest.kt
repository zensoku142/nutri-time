// ==================== 手表时间计算测试 ====================
// 测试传入固定时间，不读取真实时钟，因此不会因为机器快慢或等待时长而偶尔失败。

package com.example.nutritimewear.presentation

import java.time.ZoneOffset
import org.junit.Assert.assertEquals
import org.junit.Test

class FastingTimeTest {
    @Test
    fun futureTargetReturnsExactRemainingMilliseconds() {
        assertEquals(3_600_000L, getRemainingMillis(plannedEndAt = 4_600_000L, now = 1_000_000L))
    }

    @Test
    fun targetAtCurrentTimeReturnsZero() {
        assertEquals(0L, getRemainingMillis(plannedEndAt = 1_000_000L, now = 1_000_000L))
    }

    @Test
    fun expiredTargetDoesNotReturnNegativeTime() {
        assertEquals(0L, getRemainingMillis(plannedEndAt = 500_000L, now = 1_000_000L))
    }

    @Test
    fun remainingTimeFormatsCommonBoundaries() {
        assertEquals("00:00:00", formatRemainingTime(0L))
        assertEquals("00:00:01", formatRemainingTime(1L))
        assertEquals("00:01:00", formatRemainingTime(60_000L))
        assertEquals("16:00:00", formatRemainingTime(57_600_000L))
        assertEquals("25:01:01", formatRemainingTime(90_061_000L))
    }

    @Test
    fun watchTimeUsesTheRequestedTimeZone() {
        assertEquals("05:07", formatWatchTime(18_420_000L, ZoneOffset.UTC))
    }

    @Test
    fun progressStaysInsideTheDialRange() {
        assertEquals(0f, getFastingProgress(startAt = 1_000L, plannedEndAt = 2_000L, now = 500L))
        assertEquals(0.5f, getFastingProgress(startAt = 1_000L, plannedEndAt = 2_000L, now = 1_500L))
        assertEquals(1f, getFastingProgress(startAt = 1_000L, plannedEndAt = 2_000L, now = 3_000L))
    }
}
