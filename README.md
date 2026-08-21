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
│  └─ wear/                   # Wear OS 工程预留位置
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

- `apps/mobile` 已从 MochiLedger 迁移 React Native 0.86 导航基线。
- 只保留“禁食 / 统计”悬浮胶囊导航、最小占位页面、字体和静态资源。
- 记账业务、API、请求缓存、详情、表单和个人中心没有迁移。
- 手机工程当前仍是 React Native CLI 基线，尚未完成 Expo Development Build/CNG 转换。
- Wear OS 工程尚未创建。

## 手机端运行

```powershell
Set-Location apps/mobile
pnpm install
pnpm start
```

另开终端：

```powershell
Set-Location apps/mobile
pnpm android
```

## 文档入口

- 完整实施顺序：[docs/NutriTime-implementation-plan.md](docs/NutriTime-implementation-plan.md)
- 当前产品范围：[docs/product-scope.md](docs/product-scope.md)
- 开发环境和命令：[docs/environment.md](docs/environment.md)
- 包名与签名：[docs/signing.md](docs/signing.md)
- 同步协议草案：[docs/sync-contract.md](docs/sync-contract.md)
- 手工验收：[docs/manual-test-checklist.md](docs/manual-test-checklist.md)
