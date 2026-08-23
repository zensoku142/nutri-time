// ==================== Wear OS 页面入口 ====================
// Compose（用 Kotlin 函数描述画面的工具）会根据当前状态重新描述手表页面。
// 状态变化后不需要手动寻找控件修改文字，这一点与 React 根据 state 重新渲染页面相似。

package com.example.nutritimewear.presentation

import android.os.Bundle
import android.util.Log
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.google.android.gms.wearable.DataClient
import com.google.android.gms.wearable.DataEvent
import com.google.android.gms.wearable.DataEventBuffer
import com.google.android.gms.wearable.DataItemBuffer
import com.google.android.gms.wearable.Wearable

class MainActivity : ComponentActivity(), DataClient.OnDataChangedListener {
    private lateinit var dataClient: DataClient
    private var uiState by mutableStateOf<WearUiState>(WearUiState.Loading)
    private var lastGoodState: WearUiState.LastGoodState? = null
    private var latestStateChangedAt: Long? = null
    private var listenerEventVersion = 0L
    private var startupReadVersion = 0L
    private var isListenerRegistered = false
    private var isPageVisible = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // Data Layer（手机和手表之间的共享小信箱）让手机放入最新状态，手表连接后再读取。
        // 它传递的是状态快照，不是每秒直播倒计时；倒计时仍由手表自己的当前时间计算。
        dataClient = Wearable.getDataClient(this)
        setContent {
            NutriTimeWearApp(state = uiState)
        }
    }

    override fun onStart() {
        super.onStart()
        isPageVisible = true
        if (latestStateChangedAt == null) {
            uiState = WearUiState.Loading
        }

        registerDataListener()
        readExistingSnapshot()
    }

    override fun onStop() {
        isPageVisible = false
        startupReadVersion += 1L
        if (isListenerRegistered) {
            // 页面离开后必须停止监听，否则重复进入页面可能注册多个监听器并重复处理同一事件。
            dataClient.removeListener(this)
                .addOnFailureListener { error ->
                    logFailure("listener-remove-failed", error)
                }
            isListenerRegistered = false
        }
        super.onStop()
    }

    override fun onDataChanged(dataEvents: DataEventBuffer) {
        if (!isPageVisible) {
            return
        }

        dataEvents.forEach { event ->
            val path = event.dataItem.uri.path
            if (path != FASTING_CURRENT_PATH) {
                Log.d(LOG_TAG, "ignored-data-item path=${path ?: "missing"}")
                return@forEach
            }

            listenerEventVersion += 1L
            if (event.type != DataEvent.TYPE_CHANGED) {
                Log.d(LOG_TAG, "ignored-data-event path=$path type=${event.type}")
                return@forEach
            }

            applySnapshotResult(parseStage6BDataItem(event.dataItem), source = "listener")
        }
    }

    private fun registerDataListener() {
        if (isListenerRegistered) {
            return
        }

        // listener（之后变化的提醒器）只负责页面可见期间新发生的变化，不能代替启动读取。
        isListenerRegistered = true
        dataClient.addListener(this)
            .addOnFailureListener { error ->
                isListenerRegistered = false
                if (isPageVisible) {
                    showSyncError()
                }
                logFailure("listener-register-failed", error)
            }
    }

    private fun readExistingSnapshot() {
        val readVersion = ++startupReadVersion
        val listenerVersionAtStart = listenerEventVersion

        // DataItem（信箱里的当前状态快照）会被保留，所以手表晚一点打开也能主动读取手机此前发送的内容。
        dataClient.getDataItems().addOnCompleteListener { task ->
            if (!task.isSuccessful) {
                if (isCurrentStartupRead(readVersion, listenerVersionAtStart)) {
                    showSyncError()
                    logFailure("startup-read-failed", task.exception)
                }
                return@addOnCompleteListener
            }

            val dataItems = task.result
            try {
                if (!isCurrentStartupRead(readVersion, listenerVersionAtStart)) {
                    return@addOnCompleteListener
                }
                applyStartupItems(dataItems)
            } finally {
                // DataItemBuffer 像借来的结果清单；读完立即归还，避免原生资源一直占用。
                dataItems.release()
            }
        }
    }

    private fun isCurrentStartupRead(readVersion: Long, listenerVersionAtStart: Long): Boolean {
        // 启动查询和新事件完成顺序不固定；listener 已收到更新时，旧查询结果不能再覆盖新快照。
        // event 版本先挡住并发完成顺序，stateChangedAt 再负责比较两份合法快照的新旧。
        return canApplyStartupRead(
            isPageVisible = isPageVisible,
            readVersion = readVersion,
            currentReadVersion = startupReadVersion,
            listenerVersionAtStart = listenerVersionAtStart,
            currentListenerVersion = listenerEventVersion,
        )
    }

    private fun applyStartupItems(dataItems: DataItemBuffer) {
        var foundTargetPath = false
        dataItems.forEach { dataItem ->
            when (val result = parseStage6BDataItem(dataItem)) {
                Stage6BSnapshotResult.IgnoredPath -> {
                    Log.d(LOG_TAG, "ignored-data-item path=${dataItem.uri.path ?: "missing"}")
                }
                else -> {
                    foundTargetPath = true
                    applySnapshotResult(result, source = "startup")
                }
            }
        }

        if (!foundTargetPath && latestStateChangedAt == null) {
            uiState = WearUiState.NoData
        }
    }

    private fun applySnapshotResult(result: Stage6BSnapshotResult, source: String) {
        when (result) {
            Stage6BSnapshotResult.IgnoredPath -> return
            is Stage6BSnapshotResult.Invalid -> {
                val invalidStateChangedAt = result.stateChangedAt
                if (
                    invalidStateChangedAt != null &&
                    !shouldApplySnapshot(latestStateChangedAt, invalidStateChangedAt)
                ) {
                    Log.d(LOG_TAG, "ignored-older-invalid-snapshot source=$source")
                    return
                }
                if (invalidStateChangedAt != null) {
                    latestStateChangedAt = invalidStateChangedAt
                }
                showSyncError()
                Log.w(LOG_TAG, "invalid-test-snapshot path=$FASTING_CURRENT_PATH source=$source")
            }
            is Stage6BSnapshotResult.Valid -> {
                val snapshot = result.snapshot
                if (!shouldApplySnapshot(latestStateChangedAt, snapshot.stateChangedAt)) {
                    Log.d(LOG_TAG, "ignored-older-snapshot source=$source")
                    return
                }

                val fastingState = WearUiState.Fasting(
                    sessionId = snapshot.sessionId,
                    startAt = snapshot.startAt,
                    plannedEndAt = snapshot.plannedEndAt,
                )
                latestStateChangedAt = snapshot.stateChangedAt
                lastGoodState = fastingState
                uiState = fastingState
                Log.i(
                    LOG_TAG,
                    "fasting-snapshot-applied path=$FASTING_CURRENT_PATH stateChangedAt=${snapshot.stateChangedAt} source=$source",
                )
            }
        }
    }

    private fun showSyncError() {
        uiState = WearUiState.SyncError(lastGoodState = lastGoodState)
    }

    private fun logFailure(action: String, error: Throwable?) {
        Log.e(
            LOG_TAG,
            "$action errorType=${error?.javaClass?.simpleName ?: "UnknownError"}",
        )
    }

    private companion object {
        const val LOG_TAG = "NutriTimeWearData"
    }
}
