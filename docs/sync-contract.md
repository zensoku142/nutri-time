# 手机与 Wear OS 同步协议草案

当前文档是阶段 6C 的协议基线，尚未实现。

## Path

```text
/fasting/current
```

## TypeScript 草案

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
