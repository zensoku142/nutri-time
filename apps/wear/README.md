# Wear OS

这里是 NutriTime 的 Wear OS 手表工程。阶段 0A 使用 Android Studio 的 `Empty Wear App` 官方模板创建，只保留一个显示 `NutriTime Wear` 的 Kotlin + Jetpack Compose for Wear OS 最小页面。

当前没有断食业务、路由、数据库、Data Layer、Tile、Complication 或后台服务。阶段 5 才实现独立 UI，手机同步属于阶段 6。

安装显示名为 `NutriTime`，applicationId 为 `com.zensoku.nutritime`，wear versionCode 从 `2000001` 起。Debug 构建使用 Android 默认的本机调试证书，与同一台电脑生成的手机 Debug 构建匹配；Release 规则见 `../../docs/signing.md`。

## 构建

```powershell
Set-Location E:\github\NutriTime\apps\wear
.\gradlew.bat :app:assembleDebug
```

连接手表模拟器后的安装和设备选择命令见 `../../docs/environment.md`。阶段 0A 的完成画面是圆形手表屏幕中央显示 `NutriTime Wear`。
