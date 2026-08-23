// ==================== Wear OS 最小页面 ====================
// Compose（用 Kotlin 函数描述画面的工具）会把下面的文字绘制到手表屏幕中央。
// 阶段 0A 只验证工程能够独立构建和运行，不在这里提前加入断食业务或手机同步。

package com.example.nutritimewear.presentation

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextAlign
import androidx.wear.compose.material3.Text
import androidx.wear.compose.ui.tooling.preview.WearPreviewDevices
import com.example.nutritimewear.R
import com.example.nutritimewear.presentation.theme.NutriTimeWearTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            NutriTimeWearApp()
        }
    }
}

@Composable
fun NutriTimeWearApp() {
    NutriTimeWearTheme {
        Box(
            modifier = Modifier.fillMaxSize(),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = stringResource(R.string.app_name),
                textAlign = TextAlign.Center,
            )
        }
    }
}

// Preview（编辑器里的手表预览图）只帮助观察排版，不会成为安装包中的额外页面。
@WearPreviewDevices
@Composable
fun NutriTimeWearPreview() {
    NutriTimeWearApp()
}
