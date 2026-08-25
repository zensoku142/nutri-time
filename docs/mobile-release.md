# Android 手机 APK 发布与自动更新

## 用户实际会看到什么

NutriTime 正式版打开后每天最多检查一次公开的 GitHub Release。发现更大的 `versionCode` 后会显示版本说明；用户点击“立即更新”后，应用下载 APK 并打开 Android 系统安装页。

普通 Android 应用不能静默替换自己。用户第一次使用此功能时，需要允许 NutriTime“安装未知应用”，每次安装仍由 Android 显示最终确认页。

Development Build 使用 Debug 证书，不运行自动更新检查。这样可以避免开发包提示一个签名不同、无法覆盖安装的正式 APK。

## 首次准备正式签名

Release keystore（正式安装包的长期身份证文件）只能生成一次并长期备份。丢失后，已经安装的用户无法继续覆盖升级。

在仓库外选择安全目录，然后运行 `keytool -genkeypair`。不要把密码写进命令参数；让 `keytool` 在终端中逐项询问，避免密码进入命令历史：

```powershell
keytool -genkeypair -v -keystore <仓库外安全路径>\nutritime-release.jks -alias nutritime -keyalg RSA -keysize 4096 -validity 10000
```

至少准备两份加密备份，并把密码保存在密码管理器中。不要提交 `.jks`、Base64 内容或密码。

把 keystore 转成 GitHub Secret 可保存的 Base64 文字：

```powershell
$keystoreBytes = [System.IO.File]::ReadAllBytes('<仓库外安全路径>\nutritime-release.jks')
[Convert]::ToBase64String($keystoreBytes) | Set-Clipboard
```

在 GitHub 仓库的 `Settings > Secrets and variables > Actions` 添加：

| Secret 名称 | 内容 |
| --- | --- |
| `NUTRITIME_KEYSTORE_BASE64` | 上一步复制的整段 Base64 文字 |
| `NUTRITIME_RELEASE_STORE_PASSWORD` | keystore 密码 |
| `NUTRITIME_RELEASE_KEY_ALIAS` | `nutritime` |
| `NUTRITIME_RELEASE_KEY_PASSWORD` | key 密码 |

GitHub Actions 只在临时构建机恢复 keystore。任务结束后临时文件随构建机一起销毁，仓库不会保存凭据。

## 发布新版本

每次发布都要同时修改：

- `apps/mobile/app.json` 的 `expo.version`，例如从 `0.1.0` 改成 `0.1.1`；
- `apps/mobile/app.json` 的 `expo.android.versionCode`，例如从 `1000001` 加到 `1000002`；
- `apps/mobile/package.json` 的 `version`，与显示版本保持一致。

提交并推送源码后，创建与显示版本完全相同的手机标签：

```powershell
git tag mobile-v0.1.0
git push origin mobile-v0.1.0
```

`.github/workflows/mobile-release.yml` 会依次执行测试、Expo Prebuild、正式签名构建、签名检查和 GitHub Release 创建。成功后 Release 中包含：

- `NutriTime-mobile-v0.1.0.apk`：用户安装的正式 APK；
- `update.json`：手机用来读取 `versionName`、`versionCode`、文件名和 SHA-256 摘要的更新说明。

标签、两个配置文件中的显示版本或 `versionCode` 区间不一致时，工作流会停止发布。

## 首个正式版的安装提醒

当前本地 Development Build 使用 Debug 证书，不能被新建的 Release 证书直接覆盖。第一次切换到 `0.1.0` 正式版时，需要先卸载 Debug 版本；卸载会清除当前手机中的断食会话、比例和历史记录。

从 `0.1.0` 正式版开始，只要后续 APK 始终使用同一张 Release keystore 且递增 `versionCode`，就能保留本地数据并覆盖升级。

## 自动更新的安全边界

手机只接受同时满足以下条件的更新：

- 来源是 `zensoku142/nutri-time` 的最新正式 GitHub Release；
- 标签格式是 `mobile-v0.1.0`，并与 `update.json` 的版本一致；
- `versionCode` 位于手机约定的 `1000001～1999999` 区间且大于已安装版本；
- APK 文件名、大小和 GitHub 提供的 SHA-256 摘要互相匹配；
- 下载地址属于本仓库的 GitHub Release。

下载后的 APK 仍会经过 Android 的应用签名检查。签名不同、包名不同或版本号更低时，Android 会拒绝覆盖安装。
