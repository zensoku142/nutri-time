# NutriTime Mobile

这里是 NutriTime 的 Android 手机工程。当前已完成 Android 手机端 16 小时断食技术 MVP 验收；8 小时进食窗口属于下一正式里程碑，因此当前不是完整 16:8。

当前工程从 MochiLedger 的 React Native 0.86 导航基础迁移而来，并已接入 Expo SDK 57 Development Build。目前包含：

- “禁食 / 统计”双入口悬浮胶囊导航；
- 按确认稿实现的禁食界面，以及可在 App 重开后恢复的真实 16 小时断食会话；
- 由 Android 手机在目标时间附近安排并可提前取消的本地提醒；
- 由 Expo Prebuild 生成的 Android 原生工程；
- 公共页面外壳、主题、导航测试；
- 字体和导航图片等静态资源。

记账页面、API、请求缓存、详情页、表单和个人中心均未迁移。统计目前仍是最小占位页面，禁食页的视觉来源保存在 `../../design/fasting/`。

## 环境

- Node.js 22.11 或更高版本
- pnpm 11
- JDK 与 Android SDK 36
- Android 模拟器或通过 USB 连接的 Android 真机

## 安装与运行

```powershell
pnpm install
pnpm prebuild:android
pnpm android -- --device <mobile-serial>
```

Development Build 已安装且没有新增原生依赖时，后续日常开发只需：

```powershell
pnpm start
```

`prebuild:android` 会删除并重建 `android/`。长期配置必须放在 `app.json` 或 `plugins/`，未来 Wear Data Layer Kotlin 业务代码必须放在 `modules/wear-data-layer/`，不能直接维护在生成目录中。

## 验证

```powershell
pnpm lint
pnpm typecheck
pnpm test -- --runInBand
```

## 当前限制

- 目前以 Expo Development Build 为主，不使用 Expo Go 承载后续原生能力。
- 统计页面只有占位内容。
- 禁食页只保存当前活动会话，重新打开后继续根据原开始时间和计划结束时间计算，不保存每秒变化的倒计时。
- 目标时间提醒不申请精确闹钟权限，因此可能受省电策略影响而延后，不承诺精确到秒。
- 最近任务划掉、系统回收、设备重启和 force stop 的区别与阶段 4 实测状态见 `../../docs/manual-test-checklist.md`。
- Wear OS 不自行安排同类提醒；手机正式发送已接入，Wear 接收、协议错误处理和真实联调仍未完成。
- 本次只完成阶段 7 的手机端技术 MVP 验收；原计划中的完整阶段 7 仍待 Wear 正式接收、last good state、非法协议处理和真实联调完成。
- Android applicationId 为 `com.zensoku.nutritime`；手机和手表的同类构建还必须使用匹配签名。
- 当前 mobile versionCode 从 `1000001` 起步。
