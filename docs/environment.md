# 开发环境

## 各工具负责什么

- Node.js 负责运行手机端的 JavaScript/TypeScript 开发工具。
- pnpm 负责按 `package.json` 安装和调用手机端依赖。
- Expo Development Build 是包含 NutriTime 原生依赖的开发版应用；后续不再以 Expo Go 为主。
- Expo Prebuild 根据 `app.json` 和 config plugin（生成时自动调整原生配置的小工具）生成 Android 工程，这套重复生成方式称为 CNG。
- Metro 是 Expo/React Native 的开发服务器，负责把手机端代码送到正在调试的 Development Build。
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

- Expo SDK：57.0.0（`expo` 包当前为 57.0.15）
- expo-dev-client：57.0.14
- expo-splash-screen：57.0.7
- expo-notifications：57.0.13，用于只在 Android 手机安排目标时间附近的本地提醒
- react-native-svg：15.15.4，用于绘制手机禁食页的正圆和圆头状态弧线
- React Native：0.86.2
- React：19.2.3
- Android compileSdk / targetSdk：36
- Android minSdk：24
- Kotlin：2.1.20
- 工程位置：`apps/mobile`

当前手机工程从 MochiLedger 的 React Native CLI 基线迁移而来，现已采用 Expo Development Build。CNG 会用 `app.json`、已安装依赖和 `plugins/` 重建 `apps/mobile/android/`；该生成目录不提交，也不能保存唯一的重要业务代码。

`expo-notifications` 是原生依赖。新增或调整它以后必须重新执行 Prebuild、构建并安装 Development Build，只刷新 Metro 不会把通知接收器和权限带进已安装应用。阶段 4 不加入 `SCHEDULE_EXACT_ALARM` 或 `USE_EXACT_ALARM`；Android 没有精确闹钟能力时使用非精确调度，所以产品只承诺在目标时间附近提醒。

手机端 `pnpm-workspace.yaml` 会把 pnpm 虚拟依赖目录放在 `apps/mobile/.pnpm/`，并缩短内部文件夹名。这是 Windows 原生编译的路径保护；没有它，CMake 可能因依赖路径超过对象文件上限而反复生成 `build.ninja`，最终无法产出 APK。

## 手机端复现命令

首次安装依赖：

```powershell
Set-Location E:\github\NutriTime\apps\mobile
pnpm install
```

生成 Android 工程。`--clean` 会先删除旧生成结果，确认长期配置可以从目录外恢复：

```powershell
Set-Location E:\github\NutriTime\apps\mobile
pnpm prebuild:android
```

构建当前手机模拟器使用的 x86_64 APK（x86_64 是该模拟器的处理器类型）：

```powershell
adb devices -l
Set-Location E:\github\NutriTime\apps\mobile
pnpm prebuild:android
Set-Location android
.\gradlew.bat :app:assembleDebug -PreactNativeArchitectures=x86_64 --no-daemon
```

连接多个设备时，安装命令必须带手机 serial，避免把手机应用装到手表：

```powershell
adb -s <mobile-serial> install -r E:\github\NutriTime\apps\mobile\android\app\build\outputs\apk\debug\app-debug.apk
```

Development Build 已安装且没有变更原生依赖时，日常修改 `.tsx` 只需用 LAN 模式启动 Metro。LAN 是电脑和模拟器所在的本地网络；Windows 的 `localhost` 可能只监听 IPv6，导致模拟器无法加载页面：

```powershell
Set-Location E:\github\NutriTime\apps\mobile
pnpm start -- --host lan
```

Metro 就绪后，在另一个终端通过模拟器访问电脑的固定地址启动项目：

```powershell
adb -s <mobile-serial> shell am start -a android.intent.action.VIEW -d "exp+nutritime://expo-development-client/?url=http%3A%2F%2F10.0.2.2%3A8081" com.zensoku.nutritime
```

## 手机端验证命令

```powershell
Set-Location E:\github\NutriTime\apps\mobile
pnpm lint
pnpm typecheck
pnpm test -- --runInBand
node_modules\.bin\expo.cmd install --check
Set-Location android
.\gradlew.bat :app:assembleDebug -PreactNativeArchitectures=x86_64 --no-daemon
```

当前基线应显示可识别的“禁食 / 统计”文字。保存 `.tsx` 后可观察 Metro 重新打包并刷新页面；修改 `app.json`、config plugin 或原生依赖后必须重新 Prebuild、构建和安装，Metro 刷新不能替代原生重编译。

## Wear OS 复现命令

先构建官方模板，再确认手表 serial 并安装；连接多个设备时不能省略 `-s`，否则 `adb` 不知道应操作哪一台设备：

```powershell
Set-Location E:\github\NutriTime\apps\wear
.\gradlew.bat :app:assembleDebug
adb devices -l
adb -s <wear-serial> install -r app\build\outputs\apk\debug\app-debug.apk
```

当前手表 serial 为 `emulator-5556`。安装后可在 Android Studio 顶部设备下拉框选择该手表，并执行 `Run > Run 'app'`；预期圆形屏幕中央显示 `NutriTime Wear`。Kotlin 修改会进入安装包，保存后需要重新构建和安装，不能像 `.tsx` 那样只依靠 Metro 刷新。

## 阶段 0B 边界

- 手机和手表 applicationId 已统一为 `com.zensoku.nutritime`，签名与版本规则见 `docs/signing.md`。
- `apps/mobile/android/` 仅用于本机构建和检查；未来 Wear Data Layer 业务代码放在 `apps/mobile/modules/wear-data-layer/`。
- 本阶段没有创建 Wear Data Layer 模块、断食业务、通知、Data Layer 或阶段 1/6A 功能。
