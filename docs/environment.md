# 开发环境

## 各工具负责什么

- Node.js 负责运行手机端的 JavaScript/TypeScript 开发工具。
- pnpm 负责按 `package.json` 安装和调用手机端依赖。
- Metro 是 React Native 的开发服务器，负责把手机端代码送到正在调试的应用。
- JDK 负责运行 Gradle；Gradle 再把 Android 和 Kotlin 代码编译成安装包。
- Android SDK 提供 Android 编译工具、`adb` 和模拟器。`adb` 是电脑向指定设备安装应用、查看连接状态的命令。
- Logcat 是 Android 系统日志；它包含原生应用和系统信息，不等同于 Metro 输出的 JavaScript 日志。

## 2026-08-23 实际环境

- 操作系统：Windows 10.0.26200
- Node.js：24.18.0
- pnpm：11.19.0
- JDK：`JAVA_HOME` 指向 Temurin 17.0.19，路径为 `D:\path\Java\.jabba\jdk\temurin@17.0.19`；Wear 官方模板的 Gradle Wrapper 会按工程配置自动使用 JDK 25 工具链。
- JDK 注意事项：当前终端直接运行 `java` 会误用旧 JDK 8；不要把 JDK 8 当作项目环境。首次构建 Wear 工程时需要联网下载 JDK 25，后续从 Gradle 缓存读取。
- Android SDK：`D:\Android\Sdk`
- 手机 Android SDK Platform / Build Tools：36 / 36.0.0；Wear 官方模板使用声明式 compile SDK 37。
- `adb`：1.0.41，程序版本 37.0.1
- 手机设备：`emulator-5554`，Android 16 / API 36，1080 × 2400 手机模拟器
- Wear OS 设备：`emulator-5556`，Android 17 / API 37，384 × 384 手表模拟器
- Android Studio：已经用 `Wear OS > Empty Wear App` 向导生成 `apps/wear` 模板。

每次设备重新启动后 serial 都可能改变。不要把 `emulator-5554` 永久写进脚本，应先运行 `adb devices -l` 查看本次实际值。

## 手机端当前基线

- React Native：0.86.0
- React：19.2.3
- Android compileSdk / targetSdk：36
- Android minSdk：24
- Kotlin：2.1.20
- 工程位置：`apps/mobile`

当前手机工程是从 MochiLedger 迁移的 React Native CLI 基线，并非 Expo `blank-typescript` 或 Expo Go 工程。阶段 0A 保留并验证该基线，不重新初始化；Expo Development Build 与 CNG 转换留到阶段 0B 评估和执行。

## 手机端复现命令

首次安装依赖：

```powershell
Set-Location E:\github\NutriTime\apps\mobile
pnpm install
```

启动 Metro：

```powershell
Set-Location E:\github\NutriTime\apps\mobile
pnpm start
```

另开终端，将应用安装到指定手机模拟器：

```powershell
adb devices -l
Set-Location E:\github\NutriTime\apps\mobile
pnpm android -- --deviceId emulator-5554
```

连接多个设备时，必须把最后一行的 serial 换成 `adb devices -l` 中目标手机的实际 serial，避免把手机应用装到手表。

## 手机端验证命令

```powershell
Set-Location E:\github\NutriTime\apps\mobile
pnpm lint
node_modules\.bin\tsc.cmd --noEmit
node_modules\.bin\jest.cmd --runInBand
Set-Location android
.\gradlew.bat app:assembleDebug
```

当前基线应显示可识别的“禁食 / 统计”文字。保存 `.tsx` 后可观察 Metro 重新打包并刷新页面；修改 Android 原生代码后通常需要重新执行 Gradle 构建，Metro 刷新不能替代原生重编译。

## Wear OS 复现命令

先构建官方模板，再确认手表 serial 并安装；连接多个设备时不能省略 `-s`，否则 `adb` 不知道应操作哪一台设备：

```powershell
Set-Location E:\github\NutriTime\apps\wear
.\gradlew.bat :app:assembleDebug
adb devices -l
adb -s <wear-serial> install -r app\build\outputs\apk\debug\app-debug.apk
```

当前手表 serial 为 `emulator-5556`。安装后可在 Android Studio 顶部设备下拉框选择该手表，并执行 `Run > Run 'app'`；预期圆形屏幕中央显示 `NutriTime Wear`。Kotlin 修改会进入安装包，保存后需要重新构建和安装，不能像 `.tsx` 那样只依靠 Metro 刷新。

## 阶段边界

阶段 0A 不安装 Expo、`expo-dev-client`，不执行 Prebuild，不确定最终稳定 applicationId 和正式签名。以上内容属于阶段 0B，本阶段只记录手机 CLI 基线并补齐两个最小工程的运行条件。
