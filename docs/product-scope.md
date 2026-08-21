# NutriTime 产品范围

## 当前技术 MVP

当前版本先实现 Android 手机与 Wear OS 的 16 小时断食闭环：开始、计时、恢复、本地提醒和手机到手表的单向状态同步。

阶段 8 完成前，NutriTime 不能宣称已经实现完整 16:8。8 小时进食窗口、`eating` 状态和对应提醒属于下一正式里程碑。

## 当前仓库状态

- `apps/mobile`：从 MochiLedger 复用的 React Native 导航基线，保留“禁食 / 统计”悬浮胶囊导航。
- `apps/wear`：尚未创建 Wear OS 工程。
- `design/fasting`：禁食页三个状态的视觉设计稿。
- `docs/NutriTime-implementation-plan.md`：完整分阶段实施计划。

## 暂不包含

- Windows、iOS 和 watchOS。
- 登录、后端和云同步。
- 食物、卡路里、体重和社交功能。
- 历史统计内容、Tile、Complication 和手表端操作。
- 双向冲突、回执确认和每秒跨设备同步。
