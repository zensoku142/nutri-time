# Android 包名、签名与版本

## 阶段 0B 基线

- 手机和手表 applicationId 均为 `com.zensoku.nutritime`。
- 手机 versionCode 从 `1000001` 起，手表 versionCode 从 `2000001` 起；各自发布新版本时只在所属区间内递增。
- 手机 CNG 配置位于 `apps/mobile/app.json`，手表配置位于 `apps/wear/app/build.gradle.kts`。
- applicationId 是系统识别应用的唯一名字；相同名字仍不够，同一构建类型的证书也必须匹配，Wear Data Layer 才会把两端视为同一应用。

## Debug 签名

手机的 `apps/mobile/plugins/with-shared-debug-keystore.js` 会在 Prebuild 时把生成工程指向本机 `~/.android/debug.keystore`。Wear 的 Android Debug 构建默认也使用这张证书，因此同一台电脑构建的 debug 对 debug 可以匹配，keystore 文件本身不进入仓库。

不同电脑通常会生成不同的 Debug 证书。更换构建电脑后，如果设备上已有另一张证书签名的同包名应用，需要先卸载旧应用再安装；不要把某台电脑的 Debug keystore 提交到 Git 来规避这个限制。

## Release 签名

release 对 release 必须使用同一张正式证书和同一个 key alias（证书中的密钥名称）。手机端已经通过 `apps/mobile/plugins/with-release-signing.js` 接好环境变量入口；正式密钥仍需在仓库外生成，并作为 GitHub Actions Secrets 注入。完整准备和发布步骤见 `docs/mobile-release.md`。

手机 Release 任务缺少任意正式签名环境变量时会主动停止，不再退回 Debug 证书。Release keystore、密码、令牌、凭据 JSON、私有地址和生产数据不得提交 Git；只允许通过本机环境变量、被忽略的本地配置或受控构建平台注入。

2026-08-25 已建立手机正式签名基线：

- key alias：`nutritime`；
- 算法：RSA 4096；
- SHA-256：`BF:CD:62:55:C5:15:C9:B6:28:DA:62:95:8B:4C:9B:4C:EF:A4:C2:2B:BD:2F:63:6C:06:15:BF:56:B7:E1:F8:51`；
- 私钥只保存在仓库外的加密备份和 GitHub Actions Secrets 中。

Android 开发者登记、GitHub Release 和用户手机上的正式 APK 都必须保持这条指纹一致。以后新增 Wear Release 签名时也要使用同一证书，否则正式版手机和手表无法作为同一应用通信。

## 检查两端 APK 证书指纹

先分别构建手机和手表 Debug APK：

```powershell
Set-Location E:\github\NutriTime\apps\mobile
pnpm prebuild:android
Set-Location android
.\gradlew.bat :app:assembleDebug

Set-Location E:\github\NutriTime\apps\wear
.\gradlew.bat :app:assembleDebug
```

再选择本机最新的 `apksigner`（Android 官方 APK 签名检查工具），分别打印证书 SHA-256：

```powershell
$apksigner = Get-ChildItem "$env:ANDROID_HOME\build-tools\*\apksigner.bat" |
  Sort-Object { [version]$_.Directory.Name } -Descending |
  Select-Object -First 1

& $apksigner.FullName verify --print-certs E:\github\NutriTime\apps\mobile\android\app\build\outputs\apk\debug\app-debug.apk
& $apksigner.FullName verify --print-certs E:\github\NutriTime\apps\wear\app\build\outputs\apk\debug\app-debug.apk
```

两段输出中的 `Signer #1 certificate SHA-256 digest` 必须完全相同。还应检查两个构建配置都写着 `com.zensoku.nutritime`；只要包名或指纹有一项不同，就停止 Data Layer 联调并先修正签名基线。

阶段 0B 在 2026-08-23 的实际核对结果：

- mobile：`com.zensoku.nutritime` / versionCode `1000001`。
- wear：`com.zensoku.nutritime` / versionCode `2000001`。
- 两端 Debug APK 的 SHA-256：`7ba7ca2be2a1af27d1f66522559c17220fb598ee957eea416065725f94d5216f`。

如需直接检查本机 Debug keystore：

```powershell
keytool -list -v -keystore "$env:USERPROFILE\.android\debug.keystore" -alias androiddebugkey -storepass android
```

这里的 `android` 是 Android 工具为本机 Debug 证书约定的公开默认口令，不是 Release 密码。Release 密码不得写入本文、命令历史或仓库文件。
