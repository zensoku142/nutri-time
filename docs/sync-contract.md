# 手机与 Wear OS 同步协议

## 当前完成范围

- Android 手机端已经支持 idle/fasting/eating 完整周期，默认 16:8，也可修改整小时比例和活动开始时间。
- Wear 的 `protocolVersion: 1` 仍只认识 idle/fasting，本阶段没有把 eating 塞进旧协议，也没有提前升级协议版本。
- 手机进入 eating 时向 Wear v1 提交 idle，避免手表继续显示上一段 fasting；该 idle 只是兼容降级，不表示手表已经支持或展示 eating。
- Wear 正式解析、未知或非法协议处理、last good state（最近一次合法状态）保护、eating 同步和真实设备联调尚未完成。

## Path

```text
/fasting/current
```

## TypeScript 正式发送类型

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

## 规则

1. 所有时间使用 Unix 毫秒，不传格式化日期。
2. 第一阶段只有手机写、手表读。
3. idle 不携带 session 字段；fasting 必须包含合法 session，且 `plannedEndAt > startAt`。
4. `stateChangedAt` 只在业务状态变化时更新。
5. 未知版本、未知状态、缺失字段或非法时间不得覆盖 last good state。
6. 首次没有合法快照时显示 noData，不能假装 idle。
7. 用户主动开始和结束使用 urgent；启动恢复和被动核对使用普通 DataItem。
8. 禁止每秒同步；各设备根据时间戳独立计算显示值。
9. `putDataItem()` 成功只表示已经提交，不表示手表已经展示；第一版没有回执。

## 手机端已实现的发送时机

1. 用户开始断食：本地保存成功后提交 fasting，并使用 `setUrgent()`。
2. 用户结束断食并进入 eating：先保存 eating，成功后提交兼容 idle，并使用 `setUrgent()`。
3. App 启动恢复 fasting：提交普通 fasting DataItem，不使用 `setUrgent()`。
4. App 启动恢复 eating：提交普通兼容 idle DataItem，确保旧手表不保留 fasting。
5. 用户结束 eating 回到手机 idle：不重复发送 idle，因为进入 eating 时 Wear v1 已经收到同一业务状态。
6. 用户修改活动 fasting 的比例或开始时间：保存成功后 urgent 重发新的 fasting 时间戳。
7. 用户修改 eating 的比例或开始时间：Wear v1 仍保持 idle，不发送 eating 字段或重复 idle。
8. 本地保存或清除失败时不提交对应状态；通知失败不会阻止提交。
9. 提交失败不会回滚手机本地状态，也不会显示“手表同步成功”。

## eating 兼容映射

| Android 手机状态 | Wear v1 提交 | urgent | 含义 |
|---|---|---:|---|
| 用户开始 fasting | fasting | 是 | 手表可继续显示断食 |
| 启动恢复 fasting | fasting | 否 | 普通状态核对 |
| 用户进入 eating | idle | 是 | 清掉旧 fasting，不代表支持 eating |
| 启动恢复 eating | idle | 否 | 防止旧手表重开后恢复 fasting |
| 修改 fasting 比例或开始时间 | fasting | 是 | 用新时间戳替换旧 fasting 快照 |
| 修改 eating 比例或开始时间 | 不重复提交 | — | Wear v1 继续保持 idle |
| 用户结束 eating | 不重复提交 | — | Wear v1 已是 idle |

## Wear 端待完成

1. 正式读取并解析上述协议。
2. 未知版本、未知状态、字段缺失或非法时间出现时保留 last good state，并显示同步错误或需要更新。
3. 完成手机与手表的真实设备联调，包括晚启动与断连重连场景。
4. 在未来协议版本中正式表达 eating；升级前不得从 v1 idle 推断手机一定处于真正空闲状态。
