# NutriTime Mobile

这里是 NutriTime 的 Android 手机工程。第一阶段技术 MVP 先完成 16 小时断食计时闭环，8 小时进食窗口属于下一正式里程碑。

当前工程从 MochiLedger 的 React Native 0.86 导航基础迁移而来，只保留：

- “禁食 / 统计”双入口悬浮胶囊导航；
- Android React Native 原生工程；
- 公共页面外壳、主题、导航测试；
- 字体和导航图片等静态资源。

记账页面、API、请求缓存、详情页、表单和个人中心均未迁移。禁食与统计目前都是最小占位页面，禁食计时设计稿保存在 `../../design/fasting/`，将在后续阶段实现。

## 环境

- Node.js 22.11 或更高版本
- pnpm 11
- JDK 与 Android SDK 36
- Android 模拟器或通过 USB 连接的 Android 真机

## 安装与运行

```powershell
pnpm install
pnpm start
```

在另一个终端运行：

```powershell
pnpm android
```

## 验证

```powershell
pnpm lint
pnpm test -- --runInBand
```

## 当前限制

- 目前是 React Native CLI 工程，不是 Expo 托管工程。
- 统计页面只有占位内容。
- 禁食计时、本地保存、通知和 Wear OS 同步尚未实现。
- Android applicationId 暂为 `com.nutritime`；开始 Wear OS Data Layer 联调前必须确认最终包名，并让手机与手表使用相同包名和签名。
- 当前 mobile versionCode 从 `1000001` 起步。
