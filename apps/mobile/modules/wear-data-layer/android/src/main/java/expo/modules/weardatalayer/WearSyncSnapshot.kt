// ==================== 手机正式同步快照 ====================
// 这里把 TypeScript 传来的数据整理成两种合法快照，Kotlin 只会把对应状态真正拥有的字段写进 DataItem。

package expo.modules.weardatalayer

internal const val FASTING_CURRENT_PATH = "/fasting/current"
internal const val WEAR_PROTOCOL_VERSION = 1

internal sealed interface WearSyncSnapshot {
  val protocolVersion: Int
  val status: String
  val stateChangedAt: Long
}

internal data class IdleWearSyncSnapshot(
  override val stateChangedAt: Long,
) : WearSyncSnapshot {
  override val protocolVersion = WEAR_PROTOCOL_VERSION
  override val status = "idle"
}

internal data class FastingWearSyncSnapshot(
  val sessionId: String,
  val startAt: Long,
  val plannedEndAt: Long,
  override val stateChangedAt: Long,
) : WearSyncSnapshot {
  override val protocolVersion = WEAR_PROTOCOL_VERSION
  override val status = "fasting"
}

// Map（按字段名装值的小表）是原生模块写入 DataMap 的唯一来源，测试可以直接确认 idle 没有任何会话字段。
internal fun WearSyncSnapshot.toDataMapFields(): Map<String, Any> = when (this) {
  is IdleWearSyncSnapshot -> mapOf(
    "protocolVersion" to protocolVersion,
    "status" to status,
    "stateChangedAt" to stateChangedAt,
  )

  is FastingWearSyncSnapshot -> mapOf(
    "protocolVersion" to protocolVersion,
    "status" to status,
    "sessionId" to sessionId,
    "startAt" to startAt,
    "plannedEndAt" to plannedEndAt,
    "stateChangedAt" to stateChangedAt,
  )
}

internal fun createWearSyncSnapshot(
  protocolVersion: Int,
  status: String,
  sessionId: String?,
  startAt: Long?,
  plannedEndAt: Long?,
  stateChangedAt: Long,
): WearSyncSnapshot {
  require(protocolVersion == WEAR_PROTOCOL_VERSION) {
    "Unsupported Wear protocol version"
  }
  require(stateChangedAt >= 0L) {
    "stateChangedAt must be a Unix millisecond timestamp"
  }

  return when (status) {
    "idle" -> {
      // idle 表示手机已明确没有活动会话；夹带空值或旧会话字段都会让协议含义变得含糊。
      require(sessionId == null && startAt == null && plannedEndAt == null) {
        "Idle payload must omit session fields"
      }
      IdleWearSyncSnapshot(stateChangedAt)
    }

    "fasting" -> {
      require(!sessionId.isNullOrBlank()) {
        "Fasting payload requires sessionId"
      }
      require(startAt != null && startAt >= 0L) {
        "Fasting payload requires a Unix millisecond startAt"
      }
      require(plannedEndAt != null && plannedEndAt > startAt) {
        "Fasting payload requires plannedEndAt after startAt"
      }
      FastingWearSyncSnapshot(
        sessionId = sessionId,
        startAt = startAt,
        plannedEndAt = plannedEndAt,
        stateChangedAt = stateChangedAt,
      )
    }

    else -> throw IllegalArgumentException("Unsupported fasting status")
  }
}
