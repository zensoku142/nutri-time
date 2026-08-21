package com.nutritime

// ==================== Android 应用进程入口 ====================
// Application（应用进程启动时最先创建的对象）负责准备 React Native 运行环境。

import android.app.Application
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost

class MainApplication : Application(), ReactApplication {

  // ---------- 原生依赖装配 ----------
  // PackageList 会自动收集已安装的原生功能；只有无法自动连接的库才需要手动加入列表。
  override val reactHost: ReactHost by lazy {
    getDefaultReactHost(
      context = applicationContext,
      packageList =
        PackageList(this).packages.apply {
          // 无法自动连接的原生库才在这里手动 add，普通依赖不要重复添加。
        },
    )
  }

  // Android 创建应用进程时执行一次，loadReactNative 会启动 JavaScript 运行环境。
  override fun onCreate() {
    super.onCreate()
    loadReactNative(this)
  }
}
