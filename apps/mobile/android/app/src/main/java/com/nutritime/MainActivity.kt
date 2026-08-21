package com.nutritime

import android.os.Bundle
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import com.swmansion.rnscreens.fragment.restoration.RNScreensFragmentFactory

// ==================== Android 界面窗口 ====================
// Activity（承载手机界面的原生窗口）把 NutriTime 根组件交给 React Native 显示。
// 页面恢复前必须先安装 Screens 的 Fragment 工厂，否则系统恢复原生导航页面时可能崩溃。
class MainActivity : ReactActivity() {

  // ---------- 根组件连接 ----------
  // 这个名称必须与 app.json 和 index.js 的登记结果一致，否则原生窗口找不到应用界面。
  override fun getMainComponentName(): String = "NutriTime"

  // ---------- 页面恢复保护 ----------
  // Android 可能在应用退到后台后回收窗口，回来时再用 savedInstanceState 恢复旧状态。
  // 工厂必须在 super.onCreate 前设置，确保恢复的页面仍由导航库按兼容方式创建。
  override fun onCreate(savedInstanceState: Bundle?) {
    supportFragmentManager.fragmentFactory = RNScreensFragmentFactory()
    super.onCreate(savedInstanceState)
  }

  // Fabric（React Native 的新界面绘制方式）是否启用由项目开关决定，这里不自行改写。
  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)
}
