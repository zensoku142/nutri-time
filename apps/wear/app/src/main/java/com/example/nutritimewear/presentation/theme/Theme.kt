package com.example.nutritimewear.presentation.theme

import androidx.compose.runtime.Composable
import androidx.wear.compose.material3.MaterialTheme

@Composable
fun NutriTimeWearTheme(
    content: @Composable () -> Unit,
) {
    // MaterialTheme（手表页面的统一外观设置）先沿用系统默认值，阶段 0A 不提前设计视觉主题。
    MaterialTheme(
        content = content,
    )
}
