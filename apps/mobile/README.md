# NutriTime Mobile

这里是 NutriTime 的 Android 手机工程。当前已经实现由用户明确控制的完整周期：默认 16 小时断食后进入 8 小时进食窗口，也可修改为 14:10 等整小时比例，再由用户明确结束回到空闲状态。

当前工程从 MochiLedger 的 React Native 0.86 导航基础迁移而来，并已接入 Expo SDK 57 Development Build。目前包含：

- “禁食 / 统计”双入口悬浮胶囊导航；
- 按确认稿最小扩展的周期界面、底部时间编辑层，以及可在 App 重开后恢复的 fasting/eating 当前会话和自定义比例；
- 由 Android 手机为断食和进食窗口分别安排、切换并提前取消的本地提醒；
- 完成断食后的本地历史，以及汇总、上次窗口和最近七天三个统计模块；
- 由 Expo Prebuild 生成的 Android 原生工程；
- 公共页面外壳、主题、导航测试；
- 字体和导航图片等静态资源。

记账页面、API、请求缓存、详情页、表单和个人中心均未迁移。禁食页的视觉来源保存在 `../../design/fasting/`。

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
- 周期页只保存当前活动阶段，重新打开后继续根据原开始时间和计划结束时间计算，不保存每秒变化的倒计时，也不会在倒计时到零时自动切换状态。
- 完成记录使用 `@nutritime/fasting/history` 和独立的 `storageVersion: 1`，只保存在当前手机；未知版本或损坏内容不会被自动覆盖或删除。
- 活动阶段使用 `@nutritime/fasting/current` 和 `storageVersion: 2`；阶段 3～7 的合法 v1 fasting 数据读取后会保留原会话并迁移到 v2。自定义比例使用 `@nutritime/cycle/plan`，正常结束 eating 不会清掉它。
- 顶部比例入口可以调整断食/进食时长；活动阶段的开始时间也可以修改。两种修改都先保存，再更新页面、结束时间和唯一提醒。
- 目标时间提醒不申请精确闹钟权限，因此可能受省电策略影响而延后，不承诺精确到秒。
- 最近任务划掉、系统回收、设备重启和 force stop 的区别与阶段 4 实测状态见 `../../docs/manual-test-checklist.md`。
- Wear OS 不自行安排同类提醒；现有 Wear v1 只支持 idle/fasting，手机进入 eating 时向旧协议提交 idle，避免手表继续显示断食。这是兼容降级，Wear eating、协议错误处理和真实联调仍未完成。
- 手机端没有后端、账号、云同步或手表双向操作。
- Android applicationId 为 `com.zensoku.nutritime`；手机和手表的同类构建还必须使用匹配签名。
- 当前 mobile versionCode 从 `1000001` 起步。
