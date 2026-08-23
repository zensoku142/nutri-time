// ==================== Wear OS 页面入口 ====================
// Compose（用 Kotlin 函数描述画面的工具）会根据当前状态重新描述手表页面。
// 状态变化后不需要手动寻找控件修改文字，这一点与 React 根据 state 重新渲染页面相似。

package com.example.nutritimewear.presentation

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            // 阶段 5 还没有连接手机，正式入口使用 noData，避免把预览假数据误当成用户记录。
            NutriTimeWearApp()
        }
    }
}
