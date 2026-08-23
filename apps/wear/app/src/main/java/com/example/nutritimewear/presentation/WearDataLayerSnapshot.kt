// ==================== 阶段 6B 固定快照读取 ====================
// 这里只识别阶段 6B 的固定 fasting 诊断数据；完整业务协议与 last good state 规则留到阶段 6C。

package com.example.nutritimewear.presentation

import com.google.android.gms.wearable.DataItem
import com.google.android.gms.wearable.DataMap
import com.google.android.gms.wearable.DataMapItem

// path（信箱上的固定标签）必须与手机完全一致，两端才能定位同一份 DataItem。
internal const val FASTING_CURRENT_PATH = "/fasting/current"

internal data class Stage6BRawSnapshot(
    val protocolVersion: Int?,
    val status: String?,
    val sessionId: String?,
    val startAt: Long?,
    val plannedEndAt: Long?,
    val stateChangedAt: Long?,
)

internal data class ReceivedFastingSnapshot(
    val sessionId: String,
    val startAt: Long,
    val plannedEndAt: Long,
    val stateChangedAt: Long,
)

internal sealed interface Stage6BSnapshotResult {
    data object IgnoredPath : Stage6BSnapshotResult

    data class Valid(val snapshot: ReceivedFastingSnapshot) : Stage6BSnapshotResult

    data class Invalid(val stateChangedAt: Long?) : Stage6BSnapshotResult
}

internal fun parseStage6BSnapshot(
    path: String?,
    raw: Stage6BRawSnapshot,
): Stage6BSnapshotResult {
    if (path != FASTING_CURRENT_PATH) {
        return Stage6BSnapshotResult.IgnoredPath
    }

    val sessionId = raw.sessionId
    val startAt = raw.startAt
    val plannedEndAt = raw.plannedEndAt
    val stateChangedAt = raw.stateChangedAt
    if (
        raw.protocolVersion != 1 ||
        raw.status != "fasting" ||
        sessionId != "stage-6b-test" ||
        startAt == null || startAt <= 0L ||
        plannedEndAt == null || plannedEndAt <= startAt ||
        stateChangedAt == null || stateChangedAt <= 0L
    ) {
        return Stage6BSnapshotResult.Invalid(stateChangedAt = stateChangedAt)
    }

    return Stage6BSnapshotResult.Valid(
        snapshot = ReceivedFastingSnapshot(
            sessionId = sessionId,
            startAt = startAt,
            plannedEndAt = plannedEndAt,
            stateChangedAt = stateChangedAt,
        ),
    )
}

internal fun parseStage6BDataItem(dataItem: DataItem): Stage6BSnapshotResult {
    val path = dataItem.uri.path
    if (path != FASTING_CURRENT_PATH) {
        return Stage6BSnapshotResult.IgnoredPath
    }

    return try {
        val dataMap = DataMapItem.fromDataItem(dataItem).dataMap
        parseStage6BSnapshot(path = path, raw = dataMap.toRawSnapshot())
    } catch (_: RuntimeException) {
        // 字段类型错误时 DataMap 会抛出异常；这仍是非法同步数据，不能静默显示 idle。
        Stage6BSnapshotResult.Invalid(stateChangedAt = null)
    }
}

internal fun shouldApplySnapshot(currentStateChangedAt: Long?, incomingStateChangedAt: Long): Boolean =
    currentStateChangedAt == null || incomingStateChangedAt >= currentStateChangedAt

internal fun canApplyStartupRead(
    isPageVisible: Boolean,
    readVersion: Long,
    currentReadVersion: Long,
    listenerVersionAtStart: Long,
    currentListenerVersion: Long,
): Boolean = isPageVisible &&
    readVersion == currentReadVersion &&
    listenerVersionAtStart == currentListenerVersion

private fun DataMap.toRawSnapshot() = Stage6BRawSnapshot(
    protocolVersion = intOrNull("protocolVersion"),
    status = stringOrNull("status"),
    sessionId = stringOrNull("sessionId"),
    startAt = longOrNull("startAt"),
    plannedEndAt = longOrNull("plannedEndAt"),
    stateChangedAt = longOrNull("stateChangedAt"),
)

private fun DataMap.intOrNull(key: String): Int? = if (containsKey(key)) getInt(key) else null

private fun DataMap.stringOrNull(key: String): String? = if (containsKey(key)) getString(key) else null

private fun DataMap.longOrNull(key: String): Long? = if (containsKey(key)) getLong(key) else null
