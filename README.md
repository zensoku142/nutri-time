# NutriTime

NutriTime 是面向 Android 手机和 Wear OS 的轻断食计时与提醒应用。

> 当前版本先实现 16 小时断食计时闭环，8 小时进食窗口将在下一正式里程碑加入。

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
- 已按确认稿完成手机禁食页的阶段 1 静态界面，可在内存中切换未开始和进行中；统计页仍是占位页面。
- 记账业务、API、请求缓存、详情、表单和个人中心没有迁移。
- 手机端采用 CNG（根据 `app.json` 持续生成原生工程）；`apps/mobile/android/` 不作为长期维护源码提交。
- 手机与手表 applicationId 已统一为 `com.zensoku.nutritime`，版本号分别从 `1000001` 和 `2000001` 起。
- `apps/wear` 已建立只显示 `NutriTime Wear` 的 Compose for Wear OS 最小模板，尚未加入断食业务或手机同步。

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
- 同步协议草案：[docs/sync-contract.md](docs/sync-contract.md)
- 手工验收：[docs/manual-test-checklist.md](docs/manual-test-checklist.md)
