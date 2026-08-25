# NutriTime 产品范围

## Android 手机端当前范围

Android 手机端已经实现完整周期：用户明确执行 `idle → fasting → eating → idle`，其中 fasting 默认 16 小时，eating 默认 8 小时，也可改为合计 24 小时的整小时比例。两个倒计时到零后只显示阶段完成，不自动切换状态。

用户可以修改活动阶段的开始时间；手机会保留同一会话 ID，重算计划结束时间并重新安排当前提醒。同一次断食最终只生成一条完成记录。

手机负责当前周期的本地保存、重开恢复和目标时间附近提醒。用户结束断食时，手机会保存实际起止时间并在统计页显示汇总、上次窗口和最近七天图表。当前没有后端、账号、云同步或手表双向操作，断食历史不会离开当前手机。

## Wear OS 当前边界

Wear v1 协议仍只支持 idle/fasting，不支持 eating。手机进入或恢复 eating 时向旧协议提交 idle，目的是避免手表继续显示过期 fasting；这不代表手表已经展示进食窗口。

Wear 正式协议解析、last good state、非法协议保护、eating 同步和手机—手表真实联调仍未完成，因此不能宣称手机和手表都完成了完整 16:8。

## 当前仓库状态

- `apps/mobile`：从 MochiLedger 复用的 React Native 导航基线，保留“禁食 / 统计”悬浮胶囊导航，并实现完整 16:8 手机周期与本地断食统计。
- `apps/wear`：阶段 0A 的 Compose for Wear OS 最小模板，只显示 `NutriTime Wear`，尚未实现断食业务或手机同步。
- `design/fasting`：禁食页三个状态的视觉设计稿。
- `docs/NutriTime-implementation-plan.md`：完整分阶段实施计划。

## 暂不包含

- Windows、iOS 和 watchOS。
- 登录、后端和云同步。
- 食物、卡路里、体重和社交功能。
- 历史详情、导出、Tile、Complication、Wear eating 和手表端操作。
- 双向冲突、回执确认和每秒跨设备同步。
