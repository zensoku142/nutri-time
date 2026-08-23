// ==================== Wear OS 页面测试 ====================
// Compose 测试会把状态放进一块测试画布，再按用户能看到的文字确认页面语义。

package com.example.nutritimewear.presentation

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import com.example.nutritimewear.presentation.theme.NutriTimeWearTheme
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test

class NutriTimeWearScreenTest {
    @get:Rule
    val composeRule = createComposeRule()

    @Test
    fun loadingShowsPreparationMessage() {
        showState(WearUiState.Loading)

        composeRule.onNodeWithText("正在准备…").assertIsDisplayed()
    }

    @Test
    fun noDataAsksUserToOpenThePhoneApp() {
        showState(WearUiState.NoData)

        composeRule
            .onNodeWithText("请先在 Android 手机上打开 NutriTime")
            .assertIsDisplayed()
    }

    @Test
    fun idleIsClearlyDifferentFromNoData() {
        showState(WearUiState.Idle)

        composeRule.onNodeWithText("当前未在断食").assertIsDisplayed()
        composeRule.onNodeWithText("尚未收到状态").assertDoesNotExist()
    }

    @Test
    fun fastingShowsRemainingTime() {
        showState(
            state = runningFasting,
            nowProvider = { 1_000_000L },
        )

        composeRule.onNodeWithText("断食进行中").assertIsDisplayed()
        composeRule.onNodeWithText("01:00:00").assertIsDisplayed()
    }

    @Test
    fun reachedGoalStaysFastingInsteadOfTurningIdle() {
        showState(
            state = runningFasting,
            nowProvider = { 4_600_000L },
        )

        composeRule.onNodeWithText("目标已达成").assertIsDisplayed()
        composeRule.onNodeWithText("00:00:00").assertIsDisplayed()
        composeRule.onNodeWithText("当前未在断食").assertDoesNotExist()
    }

    @Test
    fun syncErrorWithoutLastGoodStateShowsUpdateMessage() {
        showState(WearUiState.SyncError(lastGoodState = null))

        composeRule.onNodeWithText("同步数据暂不可用").assertIsDisplayed()
        composeRule.onNodeWithText("请更新 NutriTime").assertIsDisplayed()
    }

    @Test
    fun syncErrorKeepsLastGoodFastingStateVisible() {
        showState(
            state = WearUiState.SyncError(lastGoodState = runningFasting),
            nowProvider = { 1_000_000L },
        )

        composeRule.onNodeWithText("断食进行中").assertIsDisplayed()
        composeRule.onNodeWithText("01:00:00").assertIsDisplayed()
        composeRule.onNodeWithText("同步异常 · 请更新").assertIsDisplayed()
    }

    @Test
    fun refreshTaskStopsAndRestartsWithoutDuplicates() {
        composeRule.mainClock.autoAdvance = false
        var state by mutableStateOf<WearUiState>(runningFasting)
        var refreshCount = 0

        composeRule.setContent {
            NutriTimeWearTheme {
                NutriTimeWearScreen(
                    state = state,
                    nowProvider = { 1_000_000L },
                    refreshIntervalMillis = 1_000L,
                    onRefreshTick = { refreshCount += 1 },
                )
            }
        }

        composeRule.mainClock.advanceTimeBy(2_100L)
        composeRule.runOnIdle { assertEquals(2, refreshCount) }

        composeRule.runOnIdle { state = WearUiState.Idle }
        composeRule.mainClock.advanceTimeBy(3_000L)
        composeRule.runOnIdle {
            assertEquals(2, refreshCount)
            state = runningFasting.copy(sessionId = "preview-session-reentered")
        }

        composeRule.mainClock.advanceTimeBy(1_100L)
        composeRule.runOnIdle { assertEquals(3, refreshCount) }
    }

    private fun showState(
        state: WearUiState,
        nowProvider: () -> Long = { 1_000_000L },
    ) {
        composeRule.setContent {
            NutriTimeWearTheme {
                NutriTimeWearScreen(
                    state = state,
                    nowProvider = nowProvider,
                )
            }
        }
    }

    private companion object {
        val runningFasting = WearUiState.Fasting(
            sessionId = "preview-session",
            startAt = 1_000_000L,
            plannedEndAt = 4_600_000L,
        )
    }
}
