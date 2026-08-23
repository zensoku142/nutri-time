// ==================== Wear OS 断食状态页面 ====================
// 页面只展示本地状态和假时间戳，不连接手机，也不包含开始、结束或设置入口。

package com.example.nutritimewear.presentation

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.wear.compose.material3.CircularProgressIndicator
import androidx.wear.compose.material3.Text
import androidx.wear.compose.ui.tooling.preview.WearPreviewDevices
import com.example.nutritimewear.R
import com.example.nutritimewear.presentation.theme.NutriTimeWearTheme
import java.time.ZoneId
import kotlinx.coroutines.delay

private val ScreenBackground = Color(0xFFFFFCFB)
private val PrimaryText = Color(0xFF171515)
private val SecondaryText = Color(0xFF8D8988)
private val FastingCoral = Color(0xFFFF6253)
private val ProgressGreen = Color(0xFF59D38B)
private val ProgressTrack = Color(0xFFEDEBEA)
private val ErrorBackground = Color(0xFFFFE9E6)

private const val COUNTDOWN_REFRESH_MILLIS = 1_000L
private const val PREVIEW_NOW = 1_787_313_600_000L

@Composable
fun NutriTimeWearApp(state: WearUiState = WearUiState.NoData) {
    NutriTimeWearTheme {
        NutriTimeWearScreen(state = state)
    }
}

@Composable
internal fun NutriTimeWearScreen(
    state: WearUiState,
    nowProvider: () -> Long = System::currentTimeMillis,
    refreshIntervalMillis: Long = COUNTDOWN_REFRESH_MILLIS,
    onRefreshTick: () -> Unit = {},
) {
    val now = rememberRefreshingNow(
        state = state,
        nowProvider = nowProvider,
        refreshIntervalMillis = refreshIntervalMillis,
        onRefreshTick = onRefreshTick,
    )

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(ScreenBackground),
        contentAlignment = Alignment.Center,
    ) {
        when (state) {
            WearUiState.Loading -> LoadingContent()
            WearUiState.NoData -> NoDataContent()
            WearUiState.Idle -> IdleContent(showSyncError = false)
            is WearUiState.Fasting -> FastingContent(
                state = state,
                now = now,
                showSyncError = false,
            )
            is WearUiState.SyncError -> when (val lastGoodState = state.lastGoodState) {
                null -> SyncErrorContent()
                WearUiState.Idle -> IdleContent(showSyncError = true)
                is WearUiState.Fasting -> FastingContent(
                    state = lastGoodState,
                    now = now,
                    showSyncError = true,
                )
            }
        }
    }
}

@Composable
private fun rememberRefreshingNow(
    state: WearUiState,
    nowProvider: () -> Long,
    refreshIntervalMillis: Long,
    onRefreshTick: () -> Unit,
): Long {
    val displayedFasting = state.displayedFasting()
    var now by remember(displayedFasting) { mutableLongStateOf(nowProvider()) }

    // LaunchedEffect（跟随当前页面运行的小任务）只在 fasting 画面显示时定时刷新当前时间。
    // 页面离开或状态改变后 Compose 会取消旧任务，避免多个倒计时同时运行。
    LaunchedEffect(displayedFasting) {
        if (displayedFasting == null) return@LaunchedEffect

        now = nowProvider()
        while (true) {
            delay(refreshIntervalMillis.coerceAtLeast(1L))
            now = nowProvider()
            onRefreshTick()
        }
    }

    return now
}

private fun WearUiState.displayedFasting(): WearUiState.Fasting? = when (this) {
    is WearUiState.Fasting -> this
    is WearUiState.SyncError -> lastGoodState as? WearUiState.Fasting
    else -> null
}

@Composable
private fun LoadingContent() {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        CircularProgressIndicator(modifier = Modifier.size(28.dp))
        Text(
            text = stringResource(R.string.wear_loading),
            color = SecondaryText,
            fontSize = 12.sp,
            textAlign = TextAlign.Center,
        )
    }
}

@Composable
private fun NoDataContent() {
    StatusContent(
        title = stringResource(R.string.wear_no_data_title),
        supportingText = stringResource(R.string.wear_no_data_message),
        accentColor = FastingCoral,
    )
}

@Composable
private fun IdleContent(showSyncError: Boolean) {
    Box(modifier = Modifier.fillMaxSize()) {
        ProgressDial(progress = 0f)
        StatusContent(
            title = stringResource(R.string.wear_idle_title),
            supportingText = stringResource(R.string.wear_idle_message),
            accentColor = FastingCoral,
        )
        if (showSyncError) {
            SyncErrorBadge(modifier = Modifier.align(Alignment.BottomCenter))
        }
    }
}

@Composable
private fun FastingContent(
    state: WearUiState.Fasting,
    now: Long,
    showSyncError: Boolean,
) {
    val remainingMillis = getRemainingMillis(state.plannedEndAt, now)
    val hasReachedGoal = remainingMillis == 0L
    val progress = getFastingProgress(state.startAt, state.plannedEndAt, now)
    val zoneId = ZoneId.systemDefault()

    Box(modifier = Modifier.fillMaxSize()) {
        ProgressDial(progress = progress)
        Column(
            modifier = Modifier.align(Alignment.Center),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(2.dp),
        ) {
            Text(
                text = stringResource(
                    if (hasReachedGoal) R.string.wear_goal_reached else R.string.wear_fasting,
                ),
                color = FastingCoral,
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold,
                textAlign = TextAlign.Center,
            )
            Text(
                text = formatRemainingTime(remainingMillis),
                color = PrimaryText,
                fontSize = 24.sp,
                fontWeight = FontWeight.Medium,
                textAlign = TextAlign.Center,
            )
            Text(
                // 到达目标时间不等于用户已经结束断食，页面仍等待手机以后明确更新状态。
                text = stringResource(
                    if (hasReachedGoal) R.string.wear_waiting_for_phone else R.string.wear_remaining,
                ),
                color = SecondaryText,
                fontSize = 10.sp,
                textAlign = TextAlign.Center,
            )
        }

        if (showSyncError) {
            SyncErrorBadge(modifier = Modifier.align(Alignment.BottomCenter))
        } else {
            TimeSummary(
                startTime = formatWatchTime(state.startAt, zoneId),
                endTime = formatWatchTime(state.plannedEndAt, zoneId),
                modifier = Modifier.align(Alignment.BottomCenter),
            )
        }
    }
}

@Composable
private fun SyncErrorContent() {
    StatusContent(
        title = stringResource(R.string.wear_sync_error_title),
        supportingText = stringResource(R.string.wear_sync_error_action),
        accentColor = FastingCoral,
    )
}

@Composable
private fun StatusContent(
    title: String,
    supportingText: String,
    accentColor: Color,
) {
    Column(
        modifier = Modifier.padding(horizontal = 34.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(7.dp),
    ) {
        Text(
            text = title,
            color = accentColor,
            fontSize = 15.sp,
            fontWeight = FontWeight.SemiBold,
            textAlign = TextAlign.Center,
        )
        Text(
            text = supportingText,
            color = SecondaryText,
            fontSize = 11.sp,
            lineHeight = 15.sp,
            textAlign = TextAlign.Center,
        )
    }
}

@Composable
private fun ProgressDial(progress: Float) {
    BoxWithConstraints(
        modifier = Modifier.fillMaxSize(),
        contentAlignment = Alignment.Center,
    ) {
        val dialSize = minOf(maxWidth, maxHeight) - 18.dp
        Canvas(modifier = Modifier.size(dialSize)) {
            val strokeWidth = 8.dp.toPx()
            val inset = strokeWidth / 2f
            val arcSize = Size(size.width - strokeWidth, size.height - strokeWidth)
            val topLeft = Offset(inset, inset)
            val stroke = Stroke(width = strokeWidth, cap = StrokeCap.Round)
            val startAngle = -220f
            val totalSweep = 260f

            drawArc(
                color = ProgressTrack,
                startAngle = startAngle,
                sweepAngle = totalSweep,
                useCenter = false,
                topLeft = topLeft,
                size = arcSize,
                style = stroke,
            )
            if (progress > 0f) {
                drawArc(
                    color = ProgressGreen,
                    startAngle = startAngle,
                    sweepAngle = totalSweep * progress.coerceIn(0f, 1f),
                    useCenter = false,
                    topLeft = topLeft,
                    size = arcSize,
                    style = stroke,
                )
            }
        }
    }
}

@Composable
private fun TimeSummary(
    startTime: String,
    endTime: String,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier = modifier.padding(bottom = 12.dp),
        horizontalArrangement = Arrangement.Center,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        TimeSummaryItem(label = stringResource(R.string.wear_started), value = startTime)
        Spacer(modifier = Modifier.width(22.dp))
        TimeSummaryItem(label = stringResource(R.string.wear_target), value = endTime)
    }
}

@Composable
private fun TimeSummaryItem(label: String, value: String) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(text = label, color = SecondaryText, fontSize = 8.sp)
        Text(text = value, color = PrimaryText, fontSize = 10.sp, fontWeight = FontWeight.Medium)
    }
}

@Composable
private fun SyncErrorBadge(modifier: Modifier = Modifier) {
    Text(
        text = stringResource(R.string.wear_sync_error_badge),
        modifier = modifier
            .padding(bottom = 12.dp)
            .clip(RoundedCornerShape(50))
            .background(ErrorBackground)
            .padding(horizontal = 9.dp, vertical = 4.dp),
        color = FastingCoral,
        fontSize = 8.sp,
        fontWeight = FontWeight.Medium,
        textAlign = TextAlign.Center,
    )
}

// Preview（编辑器里的手表预览图）使用固定假数据，只帮助观察排版，不会进入正式页面。
@WearPreviewDevices
@Composable
fun LoadingPreview() = PreviewState(WearUiState.Loading)

@WearPreviewDevices
@Composable
fun NoDataPreview() = PreviewState(WearUiState.NoData)

@WearPreviewDevices
@Composable
fun IdlePreview() = PreviewState(WearUiState.Idle)

@WearPreviewDevices
@Composable
fun FastingPreview() = PreviewState(
    WearUiState.Fasting(
        sessionId = "preview-running",
        startAt = PREVIEW_NOW - 3_600_000L,
        plannedEndAt = PREVIEW_NOW + 12_600_000L,
    ),
)

@WearPreviewDevices
@Composable
fun FastingGoalReachedPreview() = PreviewState(
    WearUiState.Fasting(
        sessionId = "preview-completed",
        startAt = PREVIEW_NOW - 57_600_000L,
        plannedEndAt = PREVIEW_NOW,
    ),
)

@WearPreviewDevices
@Composable
fun SyncErrorPreview() = PreviewState(WearUiState.SyncError(lastGoodState = null))

@WearPreviewDevices
@Composable
fun SyncErrorWithFastingPreview() = PreviewState(
    WearUiState.SyncError(
        lastGoodState = WearUiState.Fasting(
            sessionId = "preview-last-good",
            startAt = PREVIEW_NOW - 3_600_000L,
            plannedEndAt = PREVIEW_NOW + 12_600_000L,
        ),
    ),
)

@Composable
private fun PreviewState(state: WearUiState) {
    NutriTimeWearTheme {
        NutriTimeWearScreen(
            state = state,
            nowProvider = { PREVIEW_NOW },
        )
    }
}
