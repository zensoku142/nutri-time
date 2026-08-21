# Android 包名、签名与版本

## 当前迁移基线

- 当前临时 applicationId：`com.nutritime`
- 当前手机 versionCode：`1`
- 当前构建只配置公开的本地 Debug keystore。

这些值仅用于复制基线的编译验证，不是最终发布配置。

## 计划要求

1. 开始 Wear OS Data Layer 联调前，用户必须确认稳定标识，将两端统一为 `com.<stable-id>.nutritime`。
2. 手机和手表同一构建类型必须使用相同 applicationId 和匹配签名。
3. mobile versionCode 使用 `1000001+` 区间，wear 使用 `2000001+` 区间，并在每次发布时递增。
4. Release 密钥、密码、凭据文件和本机私有配置不得提交 Git。
5. `putDataItem()` 前应记录两端 applicationId 与证书指纹核对结果，但文档不得保存密码。

## 指纹核对

最终建立 Wear 工程后，分别对手机和手表实际安装包使用 Android 官方签名工具核对证书 SHA-256。只有包名和签名都匹配，Data Layer 才允许两端互通。
