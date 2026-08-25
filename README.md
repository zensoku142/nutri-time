# NutriTime

NutriTime 是面向 Android 手机和 Wear OS 的轻断食计时与提醒应用。

> Android 手机端现已实现完整 16:8 周期。Wear OS 当前仍只支持 idle/fasting，不支持 eating。

## 仓库结构

```text
NutriTime/
├─ AGENTS.md
├─ README.md
├─ apps/
│  ├─ mobile/                 # React Native 手机工程
│  └─ wear/                   # Kotlin + Compose for Wear OS 手表工程
├─ design/
│  └─ fasting/                # 禁食页视觉设计稿
└─ docs/
   ├─ NutriTime-implementation-plan.md
   ├─ environment.md
   ├─ manual-test-checklist.md
   ├─ product-scope.md
   ├─ signing.md
   └─ sync-contract.md
```

## 当前状态

- `apps/mobile` 已从 React Native CLI 基线迁移到 Expo SDK 57 Development Build。
- Android 手机端支持 `idle → fasting → eating → idle` 完整周期：默认是 16 小时断食和 8 小时进食，用户可改为 14:10 等整小时比例；所有状态仍由用户明确点击切换，倒计时到零不会自动跳到下一状态。
- 活动中的“断食开始 / 进食开始”可以修改；确认后会保存新的开始时间、重算计划结束时间并切换手机提醒。
- 两个阶段都支持重开恢复和目标时间附近提醒；手机只保存开始与计划结束时间戳，不保存每秒变化的剩余时间。通知权限拒绝、通知失败或 Data Layer 失败不会回滚手机状态。
- 活动状态继续使用 `@nutritime/fasting/current`：新数据为 `storageVersion: 2`，阶段 3～7 的合法 v1 fasting 会话会原样迁移，不会被删除或改成 idle。自定义比例单独保存在 `@nutritime/cycle/plan`，不会因为结束一次周期而丢失。
- 用户结束断食时会在本地保存完成记录；统计页显示累计次数、最长断食、连续天数、上次窗口和最近七天图表。
- 记账业务、API、请求缓存、详情、表单和个人中心没有迁移。
- 手机端采用 CNG（根据 `app.json` 持续生成原生工程）；`apps/mobile/android/` 不作为长期维护源码提交。
- 手机与手表 applicationId 已统一为 `com.zensoku.nutritime`，版本号分别从 `1000001` 和 `2000001` 起。
- Wear v1 协议仍只支持 idle/fasting。手机进入 eating 时会向旧协议提交 idle，避免手表继续显示 fasting；这只是兼容降级，不代表 Wear 已支持 eating。
- Wear 正式接收、last good state（最近一次合法状态）、非法协议处理、eating 同步和手机—手表真实联调尚未完成。
- 手机端没有后端、账号、云同步或手表双向操作；断食历史只保存在当前手机。
- 手机通知不申请精确闹钟权限，只承诺在目标时间附近提醒，不承诺精确到秒。
- 手机正式版从 `0.1.0` 开始，可由 GitHub Actions 发布签名 APK；应用每天最多自动检查一次 GitHub Release，并由用户确认安装更新。

## 手机端运行

```powershell
Set-Location apps/mobile
pnpm install
pnpm prebuild:android
pnpm android -- --device <mobile-serial>
```

Development Build 已安装且原生依赖没有变化时，只需启动 Expo 的 Metro 开发服务器：

```powershell
Set-Location apps/mobile
pnpm start
```

完整环境、构建和指定设备启动命令见 [docs/environment.md](docs/environment.md)。

## 文档入口

- 完整实施顺序：[docs/NutriTime-implementation-plan.md](docs/NutriTime-implementation-plan.md)
- 当前产品范围：[docs/product-scope.md](docs/product-scope.md)
- 开发环境和命令：[docs/environment.md](docs/environment.md)
- 包名与签名：[docs/signing.md](docs/signing.md)
- 手机 APK 发布与自动更新：[docs/mobile-release.md](docs/mobile-release.md)
- 同步协议草案：[docs/sync-contract.md](docs/sync-contract.md)
- 手工验收：[docs/manual-test-checklist.md](docs/manual-test-checklist.md)
