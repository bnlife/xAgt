# [技术债] MemoryStore 无 agent 级别隔离

- **发现日期**：2026-07-05
- **严重程度**：低
- **影响模块**：memory/store, memory/hierarchy

## 问题

MemoryStore（src/memory/store.ts）是全局单例，所有 agent 共享同一份 `.xagt/memory.jsonl`。`MemoryQuery` 支持按 `type` 和 `since` 过滤，但不支持按 agent 来源过滤。

任意 agent 写入的教训/模式/决策会被所有 agent（包括 Vox 和子代理）通过 `buildMemoryContext()` 读取并注入到 system prompt 中。

## 风险

- 如果一个 agent（如 Fixer）写入了一条有偏见的教训（如"可以跳过 Judge 审查"），所有 agent 都会看到
- 不同 agent 的"经验"混合在一起，可能产生矛盾的指导
- 无法区分"是 Lynx 发现的模式"还是"Fixer 发现的模式"

## 建议方案

1. MemoryRecord 增加可选的 `source` 字段，标记写入者（如 "fixer", "lynx", "vox"）
2. MemoryQuery 支持 `source` 过滤参数
3. `buildMemoryContext()` 按 `source` 过滤：子代理只看到自己来源的记忆，Vox 可以看到全部
