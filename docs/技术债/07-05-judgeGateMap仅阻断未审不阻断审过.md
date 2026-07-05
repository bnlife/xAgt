# [技术债] judgeGateMap 只阻断"没审"不阻断"审了没过"

- **发现日期**：2026-07-05
- **严重程度**：中
- **影响模块**：gateway/interceptor, hooks/judge-gate

## 问题

当前 `judgeGateMap`（src/index.ts 第 26-28 行 + 第 61-76 行 + 第 120-130 行）在 Judge 返回任何结果（通过或拒绝）后都标记 `judgeDone=true`，解除阻断。

这意味着：Judge 说"拒绝"后，Vox 可以立即派 Fixer 继续改，没有强制"Fixer 必须先修复再送审"或"必须重审通过才能继续"的循环保障。

**当前流程**：
```
Fixer 完成 → judgeGateMap 锁定 → Vox 派 Judge → Judge 拒绝 → 解除锁定 → Vox 可自由行动
```

**期望流程**：
```
Fixer 完成 → judgeGateMap 锁定 → Vox 派 Judge → Judge 拒绝 → Fixer 修改 → 重新派 Judge → 通过 → 解除锁定
```

## 风险

- Vox 可以"假审查"：派 Judge 后不管结果直接继续
- Fixer 的修改可能在未通过审查的情况下进入下一步

## 建议方案

1. Judge 返回"拒绝"时不标记 `judgeDone=true`，而是重置为 `fixerDone=false`
2. Vox 只能派 Fixer（修）或 Judge（重审），不能派其他 agent 或继续下一步
3. 加计数器：拒绝超过 3 次才解除锁定（升级到 Vox 评估）
