# 手机端手工验收清单

## 当前验收边界

- [x] 本文只记录 Android 手机端 16 小时断食技术 MVP 的已完成验收。
- [x] 当前不是完整 16:8；8 小时 `eating` 状态属于阶段 8，本次没有实现或验收。
- [x] Wear 正式接收、last good state、非法协议处理和手机—手表真实联调尚未完成。
- [x] 因此本次只能说明“阶段 7 手机端技术 MVP 验收完成”，不能说明原计划中的完整阶段 7 已完成。

## 验收环境

- 日期：2026-08-24。
- 手机：`emulator-5554`，Android 16 / API 36，1080 × 2400。
- 构建：Android x86_64 Development Build，applicationId 为 `com.zensoku.nutritime`。
- Wear：本次没有连接 Wear 设备；这用于验证没有手表时手机仍能独立工作，但不构成真实联调。
- 模拟器冷启动期间曾出现 NutriTime 和 Android 权限控制器的 ANR（系统提示“没有响应”）；选择等待后业务页面正常加载，后续开始、恢复和结束均完成。该现象记录为当前模拟器性能干扰，不解释成 Wear 或业务联调成功。

## 16 小时手机闭环

- [x] 开始断食前先写入本地状态，成功后 UI 才进入 fasting。
- [x] 正式会话的 `plannedEndAt - startAt` 为 `57,600,000` 毫秒，即 16 小时。
- [x] 通知权限允许时，开始后保存一个通知 ID，并由 Android 安排一条目标提醒。
- [x] 开始后调用手机本地 Expo Module 发起 fasting DataItem 提交；没有 Wear 设备时原生调用失败，但手机会话不回滚。
- [x] 结束时先清除本地状态，成功后 UI 回到 idle。
- [x] 提前结束会取消对应通知；系统中不再保留本次提醒的目标时间戳。
- [x] 结束后调用手机本地 Expo Module 发起 idle DataItem 提交；没有 Wear 设备时原生调用失败，但 idle 不回滚。

手机实测时，AsyncStorage（App 关闭后仍保留数据的手机小抽屉）中只有一个活动记录：

```json
{
  "storageVersion": 1,
  "session": {
    "id": "fasting-1787502595349",
    "status": "fasting",
    "startAt": 1787502595349,
    "plannedEndAt": 1787560195349
  },
  "completionNotificationId": "01f256ae-f529-4371-b482-c53b0bec9a8d"
}
```

结束后重新读取 `RKStorage`，上述 `@nutritime/fasting/current` key 已不存在。

## 原子流程与重复操作

以下故障通过 Jest mock（测试里可控制成功或失败的替身）注入，实际执行的 78 个手机端测试全部通过：

- [x] 本地保存失败时保持 idle，不安排通知，也不提交 fasting。
- [x] 本地清除失败时保持 fasting，不提交 idle。
- [x] 通知权限检查或安排失败时保留 fasting，并继续尝试提交 fasting。
- [x] Data Layer 发送失败时保留手机已确认的 fasting 或 idle。
- [x] 通知取消失败时保留 idle，并继续尝试提交 idle。
- [x] `isMutating` 同时用 ref（立即生效的小锁）和禁用按钮阻止开始、结束期间的第二次操作。
- [x] 模拟器上快速连续触发结束时，本地只清除一次，且只出现一次新的 idle 提交失败日志；没有生成第二个会话或第二条提醒。

## 生命周期

- [x] App 从后台回到前台时立即读取新的系统时间；自动测试证明不依赖暂停期间的 interval 次数。
- [x] 退到后台后执行受控进程回收，再打开 App，原 `startAt` 和 `plannedEndAt` 不变，页面按新时间继续计算。
- [x] 重新打开时先显示恢复页；恢复完成前不允许用户操作，不会先闪现 idle。
- [x] 恢复时核对保存的通知 ID；有效提醒不会重复安排，缺失提醒只补一条。
- [x] 启动恢复提交普通 DataItem，自动测试断言 `urgent=false`。
- [x] 用户点击开始和结束传入 `urgent=true`；TypeScript 测试断言调用参数，Kotlin 源码构建确认该参数进入 `setUrgent()` 分支。
- [x] force stop 后 `stopped=true`，系统中本次通知闹钟消失，因此不承诺后台提醒。
- [x] force stop 不删除 AsyncStorage；用户重新打开后恢复同一会话，并重新出现一条非精确提醒。

受控进程回收使用 `adb shell am kill com.zensoku.nutritime`，用于模拟系统结束后台进程；没有伪称制造了真实内存压力。force stop 使用 `adb shell am force-stop com.zensoku.nutritime`，与普通进程回收分开记录。

## 时间规则

- [x] 存储类型、手机实测数据和 DataItem 字段都没有 `remainingSeconds`。
- [x] AsyncStorage 只在开始、通知 ID 写回、结束或用户明确重置时读写。
- [x] 每秒 interval 只更新页面的 `now`；自动测试推进 5 秒后，存储、通知和 DataItem 调用次数均未增加。
- [x] 倒计时到零和超过目标时间时都显示零，不出现负数。
- [x] 倒计时到零后仍保留会话，只有用户明确结束才清除。
- [x] 正式 UI 调用 `createFastingSession(startNow)`，没有传测试短时长；默认值仍为 `16 * 60` 分钟。

到零边界使用假时钟自动测试完成，没有等待真实 16 小时，也没有伪称做了 16 小时真机等待。

## 手机通知

- [x] 权限允许：模拟器实测只保存一个通知 ID；`dumpsys alarm` 出现一条当前 NutriTime `RTC_WAKEUP` 提醒。
- [x] 该提醒的系统窗口为 1 小时，属于目标时间附近提醒，不承诺精确到秒。
- [x] 权限拒绝：模拟器实测 fasting 正常，页面显示“提醒未启用”，系统没有当前 NutriTime 提醒。
- [x] 提前结束：模拟器实测通知 ID 对应的目标时间戳从当前闹钟列表消失。
- [x] 最终 APK 权限包含 `POST_NOTIFICATIONS` 和 `RECEIVE_BOOT_COMPLETED`。
- [x] 最终 APK 权限不包含 `SCHEDULE_EXACT_ALARM` 或 `USE_EXACT_ALARM`。
- [x] `apps/wear` 静态搜索没有通知、AlarmManager 或 exact alarm 实现；Wear OS 不重复安排同类提醒。

## 阶段 6B 遗留清理

- [x] 手机维护源码中没有 `stage-6b-test`、`sendTestSnapshot` 或“手表同步成功”。
- [x] 正式流程不显示同步成功；`putDataItem()` 成功也只代表提交给 Data Layer，不代表手表已经展示。
- [x] debug-only ping 保留在统计页，用于确认 TypeScript 能进入 Kotlin，不发送业务快照。
- [x] `__DEV__=false` 的组件测试确认 Release UI 不显示 ping 或固定快照测试按钮。

## 实际执行的验证

```powershell
Set-Location E:\github\NutriTime\apps\mobile
pnpm test -- --runInBand
pnpm typecheck
pnpm lint
node_modules\.bin\expo.cmd install --check
node_modules\.bin\expo.cmd config --type public
pnpm prebuild:android

Set-Location android
.\gradlew.bat :app:assembleDebug -PreactNativeArchitectures=x86_64 --no-daemon
.\gradlew.bat :wear-data-layer:testDebugUnitTest --no-daemon

Set-Location ..
& 'D:\Android\Sdk\build-tools\36.0.0\aapt2.exe' dump permissions android\app\build\outputs\apk\debug\app-debug.apk
```

结果：

- Jest：10 个测试套件、78 个测试全部通过。
- TypeScript：通过。
- lint：0 个错误；2 个警告来自 Kotlin 测试生成的 `modules/wear-data-layer/android/build/reports`，不是维护源码。
- Expo 依赖检查与公共配置解析：通过。
- 干净 Prebuild：成功删除并重建 `apps/mobile/android`，本地 `wear-data-layer` 模块重新自动链接。
- Android x86_64 Development Build：`BUILD SUCCESSFUL`，生成约 76.8 MB 的 Debug APK。
- 手机本地 Expo Module Kotlin 测试：`BUILD SUCCESSFUL`。
- APK 权限检查：没有 exact alarm 权限。

## 未完成且本次不得宣称完成

- Wear 正式读取与解析 `/fasting/current`。
- Wear last good state、未知版本和非法字段保护。
- 手机—手表真实开始、结束、晚启动和断连重连联调。
- 完整阶段 7；它仍需上述 Wear 部分完成。
- 8 小时进食窗口和完整 16:8；它属于阶段 8。
