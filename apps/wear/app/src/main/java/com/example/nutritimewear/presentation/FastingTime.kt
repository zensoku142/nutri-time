// ==================== 手表时间计算 ====================
// 这些纯函数只使用调用方传入的时间，因此测试不需要真的等待几个小时。

package com.example.nutritimewear.presentation

import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

private val WATCH_TIME_FORMATTER = DateTimeFormatter.ofPattern("HH:mm", Locale.ROOT)

fun getRemainingMillis(plannedEndAt: Long, now: Long): Long =
    if (plannedEndAt <= now) 0L else plannedEndAt - now

fun getFastingProgress(startAt: Long, plannedEndAt: Long, now: Long): Float {
    val durationMillis = plannedEndAt - startAt
    if (durationMillis <= 0L) {
        return if (now >= plannedEndAt) 1f else 0f
    }

    return ((now - startAt).toDouble() / durationMillis)
        .coerceIn(0.0, 1.0)
        .toFloat()
}

fun formatRemainingTime(remainingMillis: Long): String {
    val safeMillis = remainingMillis.coerceAtLeast(0L)
    // 不足一秒时向上显示，避免目标时间尚未到达却提前出现 00:00:00。
    val totalSeconds = safeMillis / 1_000L + if (safeMillis % 1_000L == 0L) 0L else 1L
    val hours = totalSeconds / 3_600L
    val minutes = totalSeconds % 3_600L / 60L
    val seconds = totalSeconds % 60L
    return String.format(Locale.ROOT, "%02d:%02d:%02d", hours, minutes, seconds)
}

fun formatWatchTime(timestampMillis: Long, zoneId: ZoneId): String =
    WATCH_TIME_FORMATTER.format(Instant.ofEpochMilli(timestampMillis).atZone(zoneId))
