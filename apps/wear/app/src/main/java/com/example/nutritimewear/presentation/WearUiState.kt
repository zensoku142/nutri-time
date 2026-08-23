// ==================== 手表页面状态 ====================
// 这组 sealed interface（限定成员的类型）类似 TypeScript 联合类型。
// 页面只能收到这里列出的状态，when 因而可以检查是否漏掉某一种画面。

package com.example.nutritimewear.presentation

sealed interface WearUiState {
    data object Loading : WearUiState

    // noData 表示手表从未得到合法手机状态；idle 表示手机明确说当前没有断食。
    // 两者不能合并，否则用户无法判断是“还没开始”还是“根本没有同步到”。
    data object NoData : WearUiState

    sealed interface LastGoodState : WearUiState

    data object Idle : LastGoodState

    data class Fasting(
        val sessionId: String,
        // Unix 毫秒时间戳表示从统一时间起点累计的毫秒数。
        // 手机和手表以后统一使用毫秒，避免同一时间被放大或缩小一千倍。
        val startAt: Long,
        val plannedEndAt: Long,
    ) : LastGoodState

    data class SyncError(
        // 新数据无法理解时继续显示上一份合法状态，不能直接变成 idle。
        // 否则正在断食的用户会误以为自己的会话已经结束。
        val lastGoodState: LastGoodState?,
    ) : WearUiState
}
