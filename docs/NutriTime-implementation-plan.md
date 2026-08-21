# NutriTime 实施与学习计划

> 面向：只会 Vue 和 JavaScript，尚未接触 React Native、TypeScript、Kotlin、Android 原生开发的学习者  
> 第一阶段技术 MVP：完成 Android 手机 + Wear OS 的“16 小时断食计时闭环”  
> 下一正式里程碑：补齐 8 小时进食窗口，形成完整 16:8 周期  
> 暂不包含：Windows、iOS/watchOS、账号、后端、云同步、食物热量、体重管理、社交功能  
> 文档版本：v1.1 / 2026-08-21

## 1. 最终要做成什么

### 1.1 第一阶段技术 MVP

第一阶段先完成一条可靠、可学习、可验证的 16 小时断食闭环：

1. Android 手机端可以开始和结束一次 16 小时断食。
2. 手机端展示开始时间、计划结束时间、已进行时长和剩余时长。
3. 应用退出、系统回收进程或重新打开后，当前断食状态仍能恢复。
4. 手机在断食目标时间附近发出本地通知，但不承诺秒级准确。
5. Wear OS 手表端能展示当前断食状态，并用时间戳独立计算倒计时。
6. 手机通过 Wear OS Data Layer API 单向同步当前状态快照。
7. 手机或手表暂时离线时不逐秒通信；恢复连接后最终得到最新快照。
8. 手机是唯一真相来源；手表第一版只展示，不发起开始或结束。

```text
手机开始断食
  → 本地保存成功
  → 手机进入 fasting 并独立计时
  → 手机安排结束提醒
  → urgent 同步状态到手表
  → 手表独立计算倒计时
  → 手机结束断食并清除本地状态
  → 手机取消通知
  → urgent 同步 idle
```

在阶段 8 完成前，README 必须明确写明：

> 当前版本先实现 16 小时断食计时闭环，8 小时进食窗口将在下一正式里程碑加入。

### 1.2 完整 16:8 产品里程碑

阶段 8 再增加 `eating` 状态、8 小时进食窗口、进食窗口剩余时间和必要提醒。只有阶段 8 完成后，项目才可以宣称实现了完整 16:8 周期，而不是只有 16 小时断食计时器。

## 2. 技术路线结论

### 2.1 手机端

- React Native + TypeScript + Expo。
- 阶段 0A 使用 Expo `blank-typescript` 模板；Expo Go 只作为第一天的临时学习或纯页面验证工具。
- 阶段 0B 立即安装 `expo-dev-client` 并验证 Expo Development Build；此后它是主开发和验证方式。
- 第一版只使用 React 自带状态和少量项目内函数，不先引入 Redux、Zustand、复杂路由或 UI 框架。
- 本地存储固定使用 `@react-native-async-storage/async-storage`，只保存当前活动状态和必要的平台运行信息。
- 当前阶段不使用 SQLite；等历史、卡路里或体重等数据明显增多后，再评估 `expo-sqlite`。
- 通知使用 Expo 官方通知能力或当时 Expo SDK 推荐的等价官方方式。

Expo Development Build 可以理解为“包含 NutriTime 自己原生能力的开发客户端”。官方资料：[Expo Development Build](https://docs.expo.dev/develop/development-builds/introduction/) 和 [本地 Expo Module](https://docs.expo.dev/modules/get-started/)。

### 2.2 Continuous Native Generation（CNG）边界

手机端采用 Expo Continuous Native Generation：

1. `apps/mobile/android/` 是 Expo Prebuild 生成目录。
2. 不在该目录直接维护任何重要 Kotlin 业务逻辑。
3. Wear Data Layer 原生逻辑放在 `apps/mobile/modules/wear-data-layer/` 本地 Expo Module。
4. AndroidManifest、权限和可由 Expo 配置表达的原生设置，优先使用 Expo config plugin 或官方配置方式。
5. 执行 `prebuild --clean` 后，重要业务代码和必要配置必须仍可恢复。

这些规则必须写入未来的根 `AGENTS.md`，并出现在本文的全局 Codex 工作规则中。生成目录可以用于检查和构建，但不能成为重要逻辑的唯一保存位置。

### 2.3 手表端

- Kotlin + Jetpack Compose for Wear OS。
- 使用 Android Studio 的 Wear OS 模板。
- 第一版声明为 non-standalone，因为核心状态来自手机。
- 只做一个主页面，不先加 Tile、Complication、复杂导航或后台常驻服务。
- 第一版不自行安排与手机相同的断食结束通知，避免手机通知桥接到手表后重复提醒。

官方资料：[创建第一个 Wear OS 应用](https://developer.android.com/training/wearables/get-started/creating) 和 [Compose for Wear OS](https://developer.android.com/training/wearables/compose)。

### 2.4 手机与手表通信

- 使用 Google Play services Wear OS Data Layer API。
- 使用 `DataClient` + `DataItem` 同步当前状态快照。
- 统一 path：`/fasting/current`。
- 不逐秒传输倒计时，只传状态和时间戳。
- 用户主动点击开始或结束时调用 `setUrgent()`。
- App 启动恢复或被动核对时写普通 DataItem。
- `putDataItem()` 成功只表示数据已提交给 Data Layer，不等于手表已经展示；第一版不做回执确认。

官方资料：[Data Layer 概览](https://developer.android.com/training/wearables/data/overview) 和 [同步 DataItem](https://developer.android.com/training/wearables/data/data-items)。

### 2.5 包名、签名和版本基线

- 仓库名统一为 `nutri-time`，显示名统一为 `NutriTime`。
- Android applicationId 使用 `com.<stable-id>.nutritime` 占位；`<stable-id>` 必须换成不会随昵称或组织调整而变化的稳定标识。
- 手机和 Wear OS 的 applicationId 相同。
- 同一构建类型下，手机和手表签名必须匹配：debug 对 debug、release 对 release。
- versionCode 使用不同区间，例如 mobile 从 `1000001` 开始，wear 从 `2000001` 开始，且每次发布递增。
- Release 密钥、密码、凭据文件和本机私有配置不得提交 Git。
- `docs/signing.md` 记录 applicationId、证书指纹核对方式、release 策略和 versionCode 分配规则，但不记录密码。

### 2.6 当前明确不做

- 不做登录、云数据库、跨用户或跨手机同步。
- 不做每秒后台任务、每秒存储或每秒跨设备同步。
- 不做 Repository/UseCase 等当前不需要的多层架构。
- 不让手表直接访问互联网。
- 不在第一阶段申请健康数据权限或 exact alarm 权限。
- 不把手表回执、双向操作、冲突合并塞进技术 MVP。

## 3. 关键设计原则

### 3.1 保存时间点，不保存倒计时

```ts
type FastingSession = {
  id: string;
  status: 'fasting';
  startAt: number;
  plannedEndAt: number;
};

type PersistedFastingState = {
  storageVersion: 1;
  session: FastingSession;
  completionNotificationId?: string;
};
```

`FastingSession` 是纯业务数据；通知 ID 属于平台运行信息，所以放在 `PersistedFastingState`。不要保存 `remainingSeconds`，页面每秒更新 `now` 后重新派生显示值。

### 3.2 时间核心必须可测试

```ts
const DEFAULT_FASTING_MINUTES = 16 * 60;

function createFastingSession(
  now: number,
  durationMinutes = DEFAULT_FASTING_MINUTES,
): FastingSession;

function getRemainingMs(plannedEndAt: number, now: number): number;
function getElapsedMs(startAt: number, now: number): number;
```

纯函数通过参数接收 `now`、`startAt` 或 `plannedEndAt`，不在函数内部读取 `Date.now()`。正式 UI 固定使用 16 小时；测试可以传几秒或几分钟对应的短时长，以快速验证边界。

### 3.3 业务真相和 UI 刷新分开

- 业务真相：session 中的开始与计划结束时间戳。
- UI 刷新信号：每秒更新一次的 `now`。
- `setInterval` 只触发重算，并在生命周期结束时清理。
- 倒计时到零只显示“目标已达成”，不擅自结束会话。

### 3.4 手机是第一阶段唯一真相来源

手机维护本地活动状态，手表保存并展示最近一次合法快照。若收到未知 `protocolVersion` 或非法数据，手表保留 last good state，并显示同步错误或“请更新 NutriTime”；绝不能静默回到 idle。

### 3.5 开始和结束是有顺序的原子流程

开始流程：

```text
检查当前无活动会话
  → 创建 session
  → 本地保存成功
  → UI 进入 fasting
  → 安排手机通知
  → urgent 同步手表
```

- 本地保存失败：阻止开始，UI 不进入 fasting。
- 通知失败：不回滚会话，显示“提醒未启用”或等价非阻塞提示。
- 手表同步失败：不回滚会话，记录可诊断的非阻塞错误。

结束流程：

```text
isMutating 防重复点击
  → 清除本地活动状态
  → UI 进入 idle
  → 取消对应通知
  → urgent 同步 idle
```

清除本地失败时不得假装结束成功。通知取消或同步失败不恢复已经清除的本地会话。开始和结束期间禁用操作按钮，防止双击产生重复 session、通知或乱序同步。

## 4. 建议仓库结构

```text
nutri-time/
├─ AGENTS.md
├─ README.md
├─ docs/
│  ├─ product-scope.md
│  ├─ environment.md
│  ├─ signing.md
│  ├─ sync-contract.md
│  └─ manual-test-checklist.md
├─ apps/
│  ├─ mobile/
│  │  ├─ app.json
│  │  ├─ package.json
│  │  ├─ android/                     # Expo Prebuild 生成目录
│  │  ├─ src/
│  │  │  ├─ components/
│  │  │  ├─ domain/
│  │  │  │  ├─ fasting.ts
│  │  │  │  └─ fasting.test.ts
│  │  │  ├─ storage/fastingStorage.ts
│  │  │  └─ notifications/fastingNotifications.ts
│  │  └─ modules/
│  │     └─ wear-data-layer/          # 重要 Kotlin 逻辑保存在这里
│  └─ wear/
│     ├─ app/
│     ├─ build.gradle.kts
│     └─ settings.gradle.kts
└─ .gitignore
```

不要第一天创建全部业务目录。阶段 0 只建立治理与环境文件，后续每阶段按需要增加最少文件。手机生成工程与长期维护的手表工程分开，二者靠相同 applicationId、匹配签名和协议协作。

根 `AGENTS.md` 至少写明：最小范围修改、先读上下文、不得在 `apps/mobile/android/` 保存重要逻辑、原生业务逻辑放本地 Expo Module、Manifest/权限优先用 config plugin、不得每秒存储或同步、不得提交密钥、每阶段必须执行相称验证。

`docs/environment.md` 记录实际 Node、包管理器、JDK、Android SDK、模拟器/真机和可复现命令。`docs/signing.md` 记录签名与版本规则。

## 5. Vue 知识到 React Native/Kotlin 的对应关系

| Vue | React Native | Kotlin Compose |
|---|---|---|
| `.vue` 单文件组件 | `.tsx` 函数组件 | `@Composable` 函数 |
| `template` | JSX | Compose 函数调用 |
| `ref()` | `useState()` | `remember { mutableStateOf(...) }` |
| `computed()` | 普通派生变量，必要时 `useMemo()` | 普通派生值，必要时 `derivedStateOf` |
| `watch()` / 生命周期 | `useEffect()` | `LaunchedEffect` / `DisposableEffect` |
| `props` / `emit` | Props / 回调 Props | 参数 / 回调参数 |
| CSS | `StyleSheet`，没有 DOM | `Modifier` + Material 组件参数 |
| Pinia | 第一阶段先不用 | 第一阶段先用页面状态 |

最重要的区别：React 状态不可直接修改；React Native 没有 `div` 和浏览器 CSS；`useEffect` 必须理解依赖与清理；Kotlin 不要用大量 `!!` 绕过空安全；Compose 和 React 都由状态重新描述 UI。

## 6. 里程碑总览

| 里程碑 | 可见成果 | 难度 / 主要不确定性 |
|---|---|---|
| M0A 环境与模板 | 手机最小 Expo 页面、Wear 模板分别运行 | Android SDK、模拟器、模板创建 |
| M0B 原生基线 | Development Build 可重建，CNG/包名/签名规则落文档 | JDK、Gradle、Prebuild、证书 |
| M1 手机静态 UI | 能在内存中切换 idle/fasting | React Hook 与 RN 布局 |
| M2 时间逻辑 | 16 小时倒计时可测试 | 时间边界、生命周期 |
| M3 本地恢复 | 关闭后恢复活动会话 | 异步恢复、数据校验、原子顺序 |
| M4 手机提醒 | 目标时间附近提醒且可取消 | 权限、系统限制、失败降级 |
| M5 Wear 原型 | loading/noData/idle/fasting/syncError 页面 | Kotlin、Compose、小屏布局 |
| M6A 原生桥 | RN 调用本地 Kotlin `ping()` | Expo Module 与重建 |
| M6B 固定同步 | 固定 DataItem 出现在手表 | 配对、包名、签名、Data Layer |
| M6C 真实同步 | 真实开始/结束状态同步 | 协议校验、urgent、错误边界 |
| M7 技术 MVP 验收 | 16 小时断食闭环可日常试用 | 生命周期、断连、恢复与通知 |
| M8 完整 16:8 | 增加 8 小时 eating 窗口 | 状态迁移、第二阶段提醒与协议升级 |

每个里程碑保留一个可运行的绿色节点。表中只记录难度与主要不确定性，不给学习时长施加压力。

## 7. 分阶段执行计划

## 阶段 0A：环境与最小模板

### 目标

确认环境，在 `apps/mobile` 用 Expo `blank-typescript` 跑通最小手机项目，并在 `apps/wear` 跑通 Compose for Wear OS 模板。Expo Go 只允许用于第一天学习或纯页面验证。

### 要学的知识

- Node、包管理器、JDK、Android SDK、Gradle、Metro 各自负责什么。
- 手机模拟器与 Wear OS 模拟器是两个设备。
- `adb devices`、Git `status` 和 `diff` 的基本用途。

### Codex 要执行的具体任务

1. 先检查现有仓库和环境，不覆盖用户已有代码，不盲目升级依赖。
2. 创建根 `AGENTS.md`、`README.md` 和 `docs/environment.md` 基础内容。
3. 仓库名和文档称呼统一为 `nutri-time`，产品显示名为 `NutriTime`。
4. 用 `blank-typescript` 创建或校正 `apps/mobile`，不引入 Router。
5. 创建或指导创建 `apps/wear` 最小模板。
6. 记录实际版本、设备 serial、启动命令和需要用户完成的 GUI 步骤。

### 用户观察点

- `.tsx` 保存后 Metro 如何刷新；Kotlin 修改为何通常要重新构建。
- Metro 日志和 Logcat 的区别。
- 多设备连接时命令如何选择正确 serial。

### 验证方法

- 手机与手表分别显示可识别的 NutriTime 文本。
- `adb devices` 能识别目标设备。
- 按 `docs/environment.md` 从新终端复现启动。

### 完成标准

- 两个最小项目独立可运行。
- 环境和命令已记录。
- 尚未增加业务、路由、数据库或复杂架构。

### 常见坑

- JDK 与 Android Gradle Plugin 不兼容。
- 项目装到错误模拟器。
- 为长期使用 Expo Go 而偏离 Development Build 路线。
- 未检查现有仓库就重新初始化并覆盖文件。

### 可复制提示词

```text
请执行 NutriTime v1.1 阶段 0A。先阅读 AGENTS.md（如不存在则按计划创建）、README、现有文件和 git diff。检查环境后，用 Expo blank-typescript 跑通 apps/mobile 最小项目，并跑通 apps/wear Compose for Wear OS 模板。Expo Go 只作第一天临时页面验证，不添加业务、Router、数据库或状态库。把实际环境和可复现命令写入 docs/environment.md，运行最小验证并说明我应观察什么。不要自动进入 0B。
```

## 阶段 0B：Development Build、CNG、包名与签名基线

### 目标

立即建立可重建的 Expo Development Build，并把 CNG、applicationId、签名和 versionCode 规则固定下来，后续不再以 Expo Go 为主开发方式。

### 要学的知识

- Development Build 与 Expo Go 的区别。
- Prebuild/CNG 为什么会重建 `apps/mobile/android/`。
- applicationId、debug/release 签名和 versionCode 的作用。

### Codex 要执行的具体任务

1. 安装与当前 Expo SDK 兼容的 `expo-dev-client`。
2. 使用 `com.<stable-id>.nutritime` 占位规则配置手机和手表相同 applicationId；需要真实 stable-id 时明确让用户确认。
3. 生成并安装最小 Development Build，记录重建命令。
4. 在根 `AGENTS.md` 写入 CNG 和全局工作规则。
5. 创建 `docs/signing.md`，写明 debug/release 匹配要求、指纹检查方法、密钥禁入 Git，以及 mobile `1000001+`、wear `2000001+` 的分区。
6. 将可表达的 Manifest/权限配置保留在 app config/config plugin；不把重要 Kotlin 逻辑写进生成目录。
7. 做一次安全的重建验证，确认治理文件不会被生成过程覆盖。

### 用户观察点

- 为什么新增原生依赖后仅刷新 Metro 不够。
- 哪些文件是长期维护源，哪些是生成结果。
- 相同包名为何还不够，签名也必须匹配。

### 验证方法

- Development Build 安装并加载手机项目。
- 清晰记录生成/构建命令和结果。
- `AGENTS.md`、`docs/signing.md`、本地模块预留位置不在生成目录内。
- Git 不包含 keystore、密码或私有凭据。

### 完成标准

- 后续主要使用 Development Build。
- CNG、包名、签名和 versionCode 规则可被 Codex 与用户重复执行。
- 重要逻辑不会因 `prebuild --clean` 丢失。

### 常见坑

- 修改原生依赖后只做热刷新。
- 把 Kotlin 代码直接维护在 `apps/mobile/android/`。
- 两端 applicationId 看似相同但 build variant 或签名不同。
- 将 release 密钥或密码写入仓库文档。

### 可复制提示词

```text
请执行 NutriTime v1.1 阶段 0B。安装并验证 Expo Development Build，把后续主开发方式固定为 Development Build。采用 CNG：apps/mobile/android 是生成目录，重要 Kotlin 代码不得维护其中；Manifest/权限优先使用 Expo config plugin 或官方配置。补全根 AGENTS.md 和 docs/signing.md，统一 NutriTime 显示名、com.<stable-id>.nutritime applicationId 占位规则、两端匹配签名，以及 mobile 1000001+ / wear 2000001+ versionCode 区间。不得提交任何 release 密钥或密码。实际构建验证后停止。
```

## 阶段 1：手机端静态 UI

### 目标

实现一个单页手机界面：标题、当前状态、16 小时断食说明、时间占位和主按钮；暂时只切换内存状态。

### 要学的知识

- TypeScript 类型与联合类型。
- JSX、Props、`useState`、React Native 基础组件和 `StyleSheet`。

### Codex 要执行的具体任务

1. 移除无关模板示例，不加路由。
2. 表达 `idle | fasting` UI 状态。
3. 添加开始/结束按钮和最少量可用样式。
4. 仅在非直观规则处解释“为什么”。

### 用户观察点

- `useState` 更新如何触发重渲染。
- `Pressable` 回调与 Vue `@click` 的对应关系。
- 为什么不直接修改状态对象。

### 验证方法

- 启动为 idle；点击可在 idle/fasting 间切换。
- TypeScript、lint 和现有测试通过。

### 完成标准

- 单页不依赖路由或全局状态库。
- 关闭 App 后状态丢失是本阶段允许结果。

### 常见坑

- 复制 DOM 标签或网页 CSS。
- render 中调用 setter。
- 过早拆分组件或引入 UI 框架。

### 可复制提示词

```text
请执行 NutriTime v1.1 阶段 1，只修改手机端静态 UI。实现 idle/fasting 内存状态、16 小时断食说明、时间占位和开始/结束按钮。只用 React 自带状态与 RN 基础组件，不加路由、持久化、通知或状态库。运行类型检查、lint 和相关测试，并用 Vue 对照解释本次状态变化。
```

## 阶段 2：可测试的时间逻辑

### 目标

使用真实时间戳实现 16 小时倒计时；核心计算为接收时间参数的纯函数。

### 要学的知识

- Unix 毫秒时间戳、纯函数、派生状态和单元测试。
- `useEffect`、`setInterval` 与清理函数。

### Codex 要执行的具体任务

1. 定义最小 `FastingSession`。
2. 定义 `DEFAULT_FASTING_MINUTES = 16 * 60`。
3. 创建会话和计算函数显式接收 `now`、`startAt`、`plannedEndAt`；纯函数内部不调用 `Date.now()`。
4. UI 层读取当前时间并每秒更新 `now`。
5. 为刚开始、到期、过期、格式化与短测试时长写测试。

### 用户观察点

- interval 只刷新，不是计时真相。
- 后台回来后为何能按时间戳校正。
- 测试为何可以使用短时长，而正式 UI 仍固定 16 小时。

### 验证方法

- 单元测试通过；倒计时不出现负数。
- 后台返回后时间校正。
- 反复开始/结束不产生多个 interval。

### 完成标准

- 时间真相只有时间戳，不存 `remainingSeconds`。
- 纯函数可用固定参数确定性测试。

### 常见坑

- 用 `remaining - 1` 累减。
- 在纯函数内部调用 `Date.now()`。
- 同时保存多份可互相矛盾的时间数据。

### 可复制提示词

```text
请执行 NutriTime v1.1 阶段 2。加入最小 FastingSession、DEFAULT_FASTING_MINUTES=16*60 和可测试时间函数。所有核心纯函数必须显式接收 now/startAt/plannedEndAt，不在内部调用 Date.now；测试可传短时长，正式 UI 固定 16 小时。UI 每秒只更新 now，不保存 remainingSeconds。补边界测试并运行类型检查、lint、测试。
```

## 阶段 3：AsyncStorage、本地恢复与原子操作

### 目标

使用 `@react-native-async-storage/async-storage` 保存当前活动状态，使 App 重开后恢复，并落实开始/结束顺序和失败策略。

### 要学的知识

- 异步读写、启动 loading、JSON 运行时校验。
- 业务 session 与平台运行信息的区别。
- `isMutating` 如何防止重复操作和竞态。

### Codex 要执行的具体任务

1. 安装 AsyncStorage，不引入 SQLite。
2. 创建只负责读取、保存和删除当前状态的存储模块。
3. 使用 `PersistedFastingState`，通知 ID 不放进纯业务 `FastingSession`。
4. 启动先 loading，再根据合法存储显示 idle 或 fasting。
5. 实现开始流程：检查无活动会话→创建→保存成功→UI fasting；保存失败阻止开始。
6. 实现结束流程：防重复→清本地成功→UI idle；清除失败保留原状态。
7. 对损坏/未知存储数据给出明确错误或可恢复策略，不崩溃。

### 用户观察点

- TypeScript 类型不能验证磁盘 JSON。
- 为什么先保存成功再改变业务 UI。
- 为什么通知和同步失败以后不能回滚已保存的 session。

### 验证方法

- 开始后关闭、系统回收进程并重开，状态正确恢复。
- 双击开始/结束不会生成重复操作。
- 模拟存储写入/删除失败时 UI 与错误符合规则。
- 损坏数据不会使 App 崩溃。

### 完成标准

- 当前活动状态跨进程恢复。
- 存储只包含当前状态和必要运行信息。
- 没有 SQLite、每秒写入或分散的直接 AsyncStorage 调用。

### 常见坑

- 启动先闪 idle 再恢复 fasting。
- 恢复与用户点击竞态。
- 保存失败却先更新 UI。
- 为未来历史记录提前建数据库。

### 可复制提示词

```text
请执行 NutriTime v1.1 阶段 3。固定使用 @react-native-async-storage/async-storage，只保存当前 PersistedFastingState，不引入 SQLite。实现 loading、运行时校验、isMutating，以及严格的开始/结束原子顺序；本地保存失败阻止开始，清除失败不得假装结束。通知 ID 只能放平台运行信息，不能放纯 FastingSession。补失败与恢复测试并实际验证重开。
```

## 阶段 4：手机端目标时间提醒

### 目标

仅由手机安排本地通知，在断食目标时间附近提醒；不承诺秒级准确，不主动申请 exact alarm。

### 要学的知识

- 通知权限、通知渠道、调度 ID、取消通知和 Android 后台限制。
- 最近任务划掉、系统回收进程、设备重启和设置中 force stop 的区别。

### Codex 要执行的具体任务

1. 使用兼容的 Expo 官方通知方案配置 Android 通知渠道与权限。
2. 本地开始成功后安排通知，并把 notification ID 写入 `PersistedFastingState`。
3. 通知失败不回滚会话，显示非阻塞提示。
4. 结束后按 ID 取消；取消失败不恢复会话。
5. 启动恢复时核对当前会话与通知，避免重复安排。
6. Wear OS 不安排同类通知，文档说明依赖手机通知及系统桥接行为。
7. 不主动申请 exact alarm；把目标表述为“目标时间附近提醒”。

### 用户观察点

- 计时状态与提醒能力是两个独立结果。
- force stop 后系统行为与普通进程回收不同。
- 为什么两端同时安排通知可能重复提醒。

### 验证方法

- 用短测试时长验证前台、后台和最近任务划掉后的提醒表现。
- 分别记录系统回收、设备重启和 force stop 后的实际结果，不把它们混为一谈。
- 权限拒绝时计时仍可使用；结束时通知被取消。

### 完成标准

- 第一版只有手机安排提醒。
- 文案不承诺秒级准确，也没有不必要的 exact alarm 权限。
- 已记录不同生命周期场景的真实验证结果和限制。

### 常见坑

- 把通知失败当成开始失败。
- 每次恢复都新增一条通知。
- 手机和 Wear 同时安排同一提醒。
- 宣称 force stop 后仍保证提醒。

### 可复制提示词

```text
请执行 NutriTime v1.1 阶段 4。仅由 Android 手机安排本地通知，目标是在断食结束时间附近提醒，不承诺秒级准确，不主动申请 exact alarm。通知失败不得回滚会话；结束后按 PersistedFastingState 中的 ID 取消。区分最近任务划掉、系统回收、设备重启和设置 force stop，并记录实际验证。Wear OS 不安排同类通知，避免与手机通知桥接重复。
```

## 阶段 5：Wear OS 独立 UI

### 目标

先用本地假数据完成 Wear 页面，不连接手机。状态至少覆盖 `loading`、`noData`、`idle`、`fasting`、`syncError`。

### 要学的知识

- Kotlin 类型、空安全、Composable、状态和重组。
- 圆形小屏布局与本地时间戳倒计时。

### Codex 要执行的具体任务

1. 设置 non-standalone Manifest 声明。
2. 建立明确的 Wear UI 状态类型。
3. `noData` 显示“请先在 Android 手机上打开 NutriTime”或等价说明。
4. `fasting` 使用假时间戳独立计算剩余时间。
5. `syncError` 能展示错误，同时允许保留最近合法状态。
6. 不加入 Data Layer、通知、Tile、Complication 或手表操作按钮。

### 用户观察点

- `noData` 与 `idle` 含义不同：前者尚无合法手机快照，后者是手机明确同步的空闲状态。
- Compose 重组与 React 重渲染的相似处。
- 手表为何不需要手机逐秒推送。

### 验证方法

- 五种 UI 状态均可通过预览、假数据或测试入口观察。
- 倒计时到零不负数。
- 常见圆形尺寸核心文本不裁切。
- Manifest 中 non-standalone 配置可检查。

### 完成标准

- Wear UI 与通信解耦。
- 五种状态语义清楚。
- 未收到数据时不会误显示 idle。

### 常见坑

- 只有 idle/fasting 两种状态。
- 把非法协议当 idle。
- 用大屏手机布局思路堆内容。

### 可复制提示词

```text
请执行 NutriTime v1.1 阶段 5，只做 Wear OS 独立 UI。声明 non-standalone，建立 loading/noData/idle/fasting/syncError 五类状态；noData 提示先在 Android 手机打开 NutriTime，syncError 可保留最近合法状态。用假时间戳计算倒计时，不接 Data Layer、不安排通知、不加 Tile、Complication 或操作按钮。验证圆形小屏和状态切换。
```

## 阶段 6A：本地 Expo Module `ping()`

### 目标

直接在 `apps/mobile/modules/wear-data-layer` 创建本地 Expo Module，用 `ping()` 只验证 RN → Kotlin。不得创建临时 Activity。

### 要学的知识

- JS/TS 与 Kotlin 模块边界、Promise 和 Development Build 重建。
- CNG 下本地模块为何比生成目录内临时代码可靠。

### Codex 要执行的具体任务

1. 按 Expo 官方方式创建或接入本地模块。
2. 暴露最小 `ping(): Promise<string>`，返回固定可识别结果。
3. 从 RN 开发入口调用并展示/记录结果。
4. 重建 Development Build，确认自动链接。
5. 不添加 Data Layer 依赖或测试 Activity。

### 用户观察点

- TS 调用如何进入 Kotlin 并返回 Promise。
- 新增原生代码为何必须重建开发客户端。
- 模块源码与生成的 Android 工程分别在哪里。

### 验证方法

- 真机或模拟器显示预期 `ping()` 结果。
- 干净重建后仍能调用。
- `apps/mobile/android/` 中没有唯一的重要业务实现。

### 完成标准

- RN → Kotlin 链路单独成立。
- 未把配对、签名和 Data Layer 问题混入本阶段。

### 常见坑

- 只刷新 Metro。
- 模块未自动链接。
- 为测试创建随后要删除的 Activity。

### 可复制提示词

```text
请执行 NutriTime v1.1 阶段 6A。在 apps/mobile/modules/wear-data-layer 创建最小本地 Expo Module，只实现 ping(): Promise<string> 验证 RN→Kotlin。不得创建临时 Activity，不得把重要 Kotlin 代码写进 apps/mobile/android，也暂不接 Data Layer。重建 Development Build，实际证明干净构建后仍可调用。
```

## 阶段 6B：固定 DataItem 链路

### 目标

在同一个本地模块中实现 `sendTestSnapshot()`，向手表发送固定合法 DataItem，只验证 applicationId、签名、配对和 Data Layer。

### 要学的知识

- `DataClient`、`DataItem`、`DataMap`、path 和节点。
- 手表前台 listener 与启动读取已有 DataItem 的区别。
- 写入成功和手表展示完成不是一回事。

### Codex 要执行的具体任务

1. 核对两端 applicationId 与当前构建签名，记录证据到 `docs/signing.md`。
2. 加入兼容的 wearable 依赖。
3. 在模块中实现固定 `sendTestSnapshot()`，路径为 `/fasting/current`。
4. 固定快照使用当前协议的合法 fasting 数据；测试按钮属于开发入口，不创建 Activity。
5. 手表启动时主动读取现有 DataItem，页面可见时监听变化，离开时注销。
6. 添加必要诊断日志，不显示“手表已收到”；最多显示“已提交同步”。
7. 验证完成后保留方法用于诊断或清楚标记移除条件。

### 用户观察点

- DataItem 是最终状态快照，不是每秒消息。
- 监听未来变化之外，启动还必须读取已有值。
- 配对、Google Play services、包名和签名均可能导致“收不到”。

### 验证方法

- 调用固定快照后手表显示 fasting。
- 先发送再打开手表，仍能读取现有数据。
- 断连更新再重连，最终得到最新快照。
- 两端签名指纹与 applicationId 核对结果有记录。

### 完成标准

- 固定 RN→模块→Data Layer→Wear 链路通过。
- 没有临时 Activity、每秒写入或回执承诺。

### 常见坑

- 两端包名相同但签名不匹配。
- 只注册 listener，不读取当前 DataItem。
- 把 `putDataItem()` 成功误称为手表同步成功。

### 可复制提示词

```text
请执行 NutriTime v1.1 阶段 6B。在已有本地 Expo Module 中实现 sendTestSnapshot()，发送固定合法 DataItem 到 /fasting/current。先用证据核对手机和手表 applicationId、debug 签名与配对；手表启动读取已有 DataItem，前台监听并正确注销。不要创建 Activity，不做真实业务同步，不做每秒发送或手表回执。UI 最多显示“已提交同步”。验证先发送后打开、断连重连，并更新 docs/signing.md。
```

## 阶段 6C：真实 `syncCurrentFasting(payload)`

### 目标

将固定数据替换成真实 discriminated union 协议，并接入开始、结束和启动恢复流程。

### 要学的知识

- 判别联合类型、协议版本、运行时校验和 last good state。
- urgent 与普通 DataItem 的使用边界。

### Codex 要执行的具体任务

1. 实现 `syncCurrentFasting(payload, urgent)` 或等价最小接口。
2. 使用第 10 节协议：idle 不含 session 字段，fasting 才包含它们。
3. 开始保存成功和结束清除成功后使用 `setUrgent()`。
4. App 启动恢复与被动核对使用普通 DataItem。
5. 禁止 render 中调用和每秒同步。
6. 手机同步失败不回滚本地会话。
7. Wear 对未知版本、字段缺失、非法时间或非法状态保留 last good state，并进入 syncError/需更新提示。
8. 更新 `docs/sync-contract.md`，删除旧协议和矛盾注释。

### 用户观察点

- idle 省略字段比传 `null` 更能表达合法状态。
- `stateChangedAt` 描述业务状态变化，不是每秒更新时间。
- 第一版为何不为“手表已展示”增加回执。

### 验证方法

- 开始后手表显示相同时间；结束后回 idle。
- 启动恢复会发送普通核对快照。
- 注入未知版本和非法数据，手表保留 last good state 并显示错误。
- 断连时手机仍可开始/结束，重连后最终收敛。

### 完成标准

- 真实同步不破坏手机本地优先原则。
- urgent 规则、协议校验和错误展示均有测试或实际证据。
- 无每秒同步和回执机制。

### 常见坑

- idle 仍发送空字段。
- 未知版本静默变 idle。
- 恢复时滥用 urgent。
- 同步失败回滚本地 session。

### 可复制提示词

```text
请执行 NutriTime v1.1 阶段 6C。实现真实 syncCurrentFasting：协议必须是 protocolVersion/stateChangedAt 的 discriminated union，idle 只含 protocolVersion/status/stateChangedAt，fasting 才含 sessionId/startAt/plannedEndAt。用户开始/结束用 setUrgent，启动恢复和被动核对用普通 DataItem；禁止每秒同步。未知版本或非法数据必须保留 last good state 并显示 syncError/需更新，绝不能静默回 idle。同步失败不得回滚本地会话，第一版不做回执。更新并验证 docs/sync-contract.md。
```

## 阶段 7：生命周期与技术 MVP 验收

### 目标

完成“16 小时断食计时闭环”的加固、手工验收和内部构建；不把它误称为完整 16:8。

### 要学的知识

- 前后台、进程回收、重启、force stop、断连重连的边界。
- 手工验收、单元测试、Logcat 与最小复现。
- Debug/Release 和签名差异。

### Codex 要执行的具体任务

1. 创建 `docs/manual-test-checklist.md`。
2. 检查 interval、listener、恢复和 mutation 的竞态与清理。
3. 验证通知拒绝、Data Layer 不可用和无手表时的降级。
4. 按风险补高价值测试，不追求数字化覆盖率。
5. 生成内部测试构建并更新 README 的环境、命令、当前范围和限制。
6. README 保留“当前仅完成 16 小时断食闭环”的明确声明。

### 用户观察点

- 每个 Bug 先记录最短复现步骤。
- Debug 正常不代表 Release 签名正确。
- 无手表时手机可用是产品降级策略。

### 验证方法

| 场景 | 预期结果 |
|---|---|
| 手机开始 | 保存后进入 fasting，安排通知，urgent 提交同步 |
| 快速重复点击 | `isMutating` 阻止重复操作 |
| 前后台切换 | 按真实时间校正 |
| 系统回收后重开 | 恢复活动状态 |
| 提前结束 | 清本地、UI idle、取消通知、urgent idle |
| 通知权限拒绝 | 计时可用，提示提醒不可用 |
| 无手表或断连 | 手机正常，重连后最终收敛 |
| 手表首次打开 | noData 提示，收到合法快照后转换状态 |
| 非法/未知协议 | 保留 last good state，显示 syncError/需更新 |
| 倒计时到零 | 不负数，不自动删除 session |
| force stop | 不承诺后台提醒；重开后恢复本地状态 |

### 完成标准

- 必需项通过，未通过项有真实记录。
- 两端可按文档从干净 checkout 构建。
- 没有后端、双向同步或 eating 状态混入技术 MVP。

### 常见坑

- 只测热重载，不测生命周期。
- 同步延迟时改成每秒发送。
- 没有记录设备、系统版本和签名类型。
- README 提前宣称完整 16:8。

### 可复制提示词

```text
请执行 NutriTime v1.1 阶段 7，对 16 小时断食技术 MVP 做生命周期与异常验收。建立手工清单，验证原子开始/结束、前后台、系统回收、设备重启、force stop 限制、通知拒绝、无手表、晚启动、断连重连、非法协议和小屏布局。只修复可复现问题并运行相关测试、类型检查、lint 与两端构建。README 必须注明当前仅完成 16 小时断食闭环，不得声称完整 16:8，也不得声称执行了未实际运行的真机测试。
```

## 阶段 8：完整 16:8 进食窗口

### 目标

在技术 MVP 稳定后增加 8 小时进食窗口，使产品完成真正的 16:8 周期。

### 要学的知识

- 状态机、阶段迁移、协议兼容与存储迁移。
- 第二类提醒与重复通知治理。

### Codex 要执行的具体任务

1. 先写状态迁移规则，再修改代码。
2. 增加 `eating` 状态、进食窗口开始/计划结束时间和剩余时间。
3. 明确断食目标达成后是用户确认进入 eating，还是按已确认产品规则自动迁移；未确认前不得擅自实现。
4. 加入必要的进食窗口提醒，沿用手机单端安排通知原则。
5. 升级本地存储和手机—手表协议，并定义旧版本兼容/需更新行为。
6. 更新 Wear UI 和 README；通过验收后才删除“当前仅完成 16 小时闭环”提示。

### 用户观察点

- 增加 eating 不是改一行时长，而是增加正式状态和迁移。
- 存储版本与通信协议版本是两套概念。
- 第二条提醒为何必须复用既有失败策略和通知治理。

### 验证方法

- 完整走通 idle→fasting→eating→idle。
- fasting 与 eating 都能恢复、倒计时、提醒并同步。
- 旧存储与旧 Wear 版本有明确处理，不静默显示错误状态。

### 完成标准

- 8 小时进食窗口、剩余时间和必要提醒均完成。
- 手机与手表显示同一阶段。
- README 可以准确声明完整 16:8 周期。

### 常见坑

- 只把按钮文案改成 eating，没有定义状态迁移。
- 复用字段却不升级协议。
- 两阶段通知互相覆盖或重复。

### 可复制提示词

```text
请先评审并执行 NutriTime v1.1 阶段 8。先写清 idle→fasting→eating→idle 的迁移规则和用户确认点，再增加 8 小时进食窗口、剩余时间、必要的手机提醒和 Wear 展示。区分 storageVersion 与 protocolVersion，定义旧数据和旧手表版本处理。沿用本地优先、单端通知、无每秒存储/同步原则。完整验收通过后才更新 README，声明已实现完整 16:8。
```

## 8. 推荐学习顺序

按“刚好够完成下一阶段”学习：

1. Git、命令行、Android 环境与两类模拟器。
2. Expo `blank-typescript` 与第一天临时 Expo Go。
3. Development Build、Prebuild/CNG、applicationId 和签名。
4. TypeScript 最小集合：类型、判别联合、函数、Promise。
5. React/RN：组件、Props、`useState`、`useEffect`、基础布局。
6. 时间戳、纯函数和单元测试。
7. AsyncStorage、运行时校验、原子操作和失败策略。
8. Android 通知与生命周期边界。
9. Kotlin/Compose 与 Wear 五种 UI 状态。
10. 本地 Expo Module：先 `ping()`，再固定 DataItem，最后真实同步。
11. 技术 MVP 生命周期验收。
12. 完整 16:8 eating 状态与协议升级。
13. 历史、Tile、卡路里、体重、双向操作和云同步按价值逐项评估。

不要先学完整课程再动手。每个概念都落在一段亲自运行、观察和小改过的代码上。

## 9. 如何与 Codex 配合

### 9.1 一次只执行一个阶段

按 `0A → 0B → 1 → 2 → 3 → 4 → 5 → 6A → 6B → 6C → 7 → 8` 推进。每次只复制当前阶段提示词，完成、验证、理解和查看 diff 后再继续。

### 9.2 每次开始先检查

```text
开始前先阅读根 AGENTS.md、README、docs/environment.md、docs/signing.md、相关代码和当前 git diff。说明当前状态、本次最小改动范围和准备运行的验证。不得修改无关文件，不得在 apps/mobile/android 维护重要逻辑，不得为未来需求提前抽象。
```

### 9.3 每次结束固定汇报

```text
结束时请汇报：
1. 修改了什么；
2. 为什么这样修改；
3. 实际运行了哪些验证及结果；
4. 我应该亲自阅读和修改哪三处代码；
5. 未验证风险和下一步，但不要自动开始下一阶段。
```

### 9.4 让 Codex 教会你

```text
我只会 Vue 和 JavaScript。请用本次实际代码把新概念对应到 Vue；先给最短解释，再指出文件和函数，不要给脱离项目的大段教程，也不要用额外抽象隐藏关键流程。
```

### 9.5 出错时先提供证据

提供完整命令、从第一条 error 开始的日志、设备与系统版本、最后成功步骤和相关 `git diff`。先让 Codex 诊断根因；没有明确要求修复时，不让它顺手改代码。

### 9.6 每阶段 Git 节奏

```text
git status 确认基线
  → 完成一个小改动
  → 运行并亲自观察
  → 查看 git diff
  → 测试通过
  → 用户决定是否提交
```

Codex 不应未经要求提交 Git，也不应连续跨阶段堆积代码。新增原生能力后必须判断是否需要重建 Development Build，不能只建议刷新 Metro。

## 10. 第一阶段数据协议草案

`docs/sync-contract.md` 最终以实际代码为准。第一阶段 path：

```text
/fasting/current
```

TypeScript 草案：

```ts
type WearSyncPayload =
  | {
      protocolVersion: 1;
      status: 'idle';
      stateChangedAt: number;
    }
  | {
      protocolVersion: 1;
      status: 'fasting';
      sessionId: string;
      startAt: number;
      plannedEndAt: number;
      stateChangedAt: number;
    };
```

Fasting 快照：

```json
{
  "protocolVersion": 1,
  "status": "fasting",
  "sessionId": "local-unique-id",
  "startAt": 1787313600000,
  "plannedEndAt": 1787371200000,
  "stateChangedAt": 1787313600000
}
```

Idle 快照：

```json
{
  "protocolVersion": 1,
  "status": "idle",
  "stateChangedAt": 1787371200000
}
```

协议规则：

1. 所有时间均为 Unix 毫秒，不传格式化日期字符串。
2. 第一阶段只有手机写，手表读。
3. idle 不携带 `sessionId`、`startAt` 或 `plannedEndAt`；不得用 `null` 占位。
4. fasting 必须包含三个 session 字段，且 `plannedEndAt > startAt`。
5. `stateChangedAt` 只在业务状态变化时更新，不作为每秒刷新字段。
6. 未知 `protocolVersion`、未知 status、字段缺失或非法时间不得覆盖 last good state；Wear 进入 `syncError` 并提示同步数据不可用或需要更新。
7. 首次没有任何合法快照时显示 `noData`，不显示 idle。
8. 用户主动开始和结束使用 `setUrgent()`；启动恢复与被动核对使用普通 DataItem。
9. 禁止每秒同步。倒计时由各设备用时间戳计算。
10. `putDataItem()` 成功不等于手表已经展示。第一版不做回执，也不显示“手表同步成功”。
11. 倒计时到零不自动删除会话，直到用户明确结束。

## 11. Codex 全局总控提示词

```text
你正在协助一个只会 Vue 和 JavaScript、正在学习 React Native 和 Android 原生开发的用户实现 NutriTime。

仓库名为 nutri-time，显示名为 NutriTime。阶段 7 前的技术 MVP 只实现 Android 手机 + Wear OS 的 16 小时断食计时闭环；完整 16:8 的 8 小时进食窗口属于阶段 8。阶段 8 前 README 必须注明当前仅完成 16 小时断食闭环。

手机使用 React Native + TypeScript + Expo Development Build；手表使用 Kotlin + Jetpack Compose for Wear OS。阶段 0A 的 Expo Go 只用于第一天临时学习/纯页面验证，阶段 0B 后以 Development Build 为主。存储固定使用 @react-native-async-storage/async-storage，不提前使用 SQLite。

工作规则：
1. 每次只执行指定阶段，顺序为 0A、0B、1、2、3、4、5、6A、6B、6C、7、8，不自动跨阶段。
2. 修改前阅读根 AGENTS.md、README、相关 docs、代码和 git diff；只做当前需求的最小改动。
3. 采用 CNG：apps/mobile/android 是 Expo Prebuild 生成目录，不在其中维护重要 Kotlin 逻辑；Wear Data Layer 代码放 apps/mobile/modules/wear-data-layer；Manifest/权限优先通过 Expo config plugin 或官方配置。
4. applicationId 使用 com.<stable-id>.nutritime 规则，手机与手表相同且同构建类型签名匹配；mobile versionCode 使用 1000001+，wear 使用 2000001+。密钥、密码和私有凭据不得提交 Git。
5. 不每秒持久化或同步；不保存 remainingSeconds。核心纯时间函数接收 now/startAt 等参数，DEFAULT_FASTING_MINUTES=16*60。
6. 开始必须先本地保存成功再进入 fasting；结束必须防重复并先清本地。通知或手表同步失败不得回滚已经成功的本地状态。通知 ID 属于 PersistedFastingState，不属于 FastingSession。
7. 第一版仅手机安排目标时间附近的本地提醒，不承诺秒级准确，不主动申请 exact alarm；Wear 不重复安排同类通知。区分最近任务划掉、系统回收、重启和 force stop。
8. 同步协议使用 protocolVersion/stateChangedAt 判别联合：idle 省略 session 字段，fasting 才包含；未知版本或非法数据保留 last good state 并显示 syncError/需更新，绝不静默回 idle。
9. 用户主动开始/结束同步使用 setUrgent；启动恢复/被动核对使用普通 DataItem。putDataItem 成功不代表手表已展示，第一版不做回执。
10. Wear 第一版 non-standalone，UI 至少含 loading/noData/idle/fasting/syncError；noData 提示先在 Android 手机打开 NutriTime。
11. 6A 只做本地 Expo Module ping，6B 在同一模块做固定 DataItem，6C 才接真实 payload；不得创建临时 Activity。
12. 遇到新概念，用本次代码简短对应 Vue/JavaScript。新增依赖前说明必要性，并按风险运行真实测试、类型检查、lint 和构建。
13. 不修改无关文件，不提前设计历史、Tile、卡路里、体重、双向操作或云同步，不替用户提交 Git，除非明确要求。
14. 结束时汇报改动、原因、实际验证、用户应阅读的代码和剩余风险；不得声称运行了未执行的测试。
```

## 12. 技术 MVP 后的下一步

第一优先是阶段 8：补齐 8 小时进食窗口，形成完整 16:8。完成后再一次只选一项：

1. 本地断食历史。
2. Wear OS Tile 或 Complication。
3. 卡路里与食物记录；数据量明确后评估 `expo-sqlite`。
4. 体重记录与趋势。
5. 手表开始/结束及正式双向冲突协议。
6. 导出/备份。
7. 账号与云同步。

建议价值顺序：完整 16:8 → 本地历史 → Tile → 卡路里/体重 → 双向操作 → 云同步。每一步仍需先明确范围、协议和失败策略。

## 13. 最后提醒

- 先建立可重建的 Development Build 与 CNG 边界，再写业务。
- 每次只增加一个难点：UI、时间、存储、通知、Wear UI、原生桥、固定同步、真实同步、验收、eating。
- 遇到同步问题，按 6A、6B、6C 的边界定位，不在 React、Kotlin、签名和配对之间盲猜。
- 第一阶段的成功标准是可靠的 16 小时断食闭环；完整 16:8 必须等 8 小时进食窗口完成后再宣称。
