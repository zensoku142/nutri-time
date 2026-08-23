# 手机与 Wear OS 同步协议

## 当前完成范围

- 阶段 6C 的手机正式发送已完成：手机会把真实 idle/fasting 快照提交到 Wear Data Layer。
- Wear 正式解析、未知或非法协议处理、last good state（最近一次合法状态）保护和真实设备联调尚未完成。
- 因此当前只能说明“阶段 6C 已完成手机发送部分”，不能宣称完整阶段 6C 已完成。

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
2. 用户结束断食：本地清除成功并回到 idle 后提交 idle，并使用 `setUrgent()`。
3. App 启动恢复 fasting：提交普通 DataItem，不使用 `setUrgent()`。
4. 本地保存或清除失败时不提交对应状态；通知失败不会阻止提交。
5. 提交失败不会回滚手机本地状态，也不会显示“手表同步成功”。

## Wear 端待完成

1. 正式读取并解析上述协议。
2. 未知版本、未知状态、字段缺失或非法时间出现时保留 last good state，并显示同步错误或需要更新。
3. 完成手机与手表的真实设备联调，包括晚启动与断连重连场景。
