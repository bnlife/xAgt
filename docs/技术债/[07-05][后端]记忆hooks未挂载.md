# [07-05][后端]记忆 hooks 未挂载

## 状态

- 待解决

## 优先级

- 中

## 类别

- [后端：功能缺失]

## 问题描述

- MemoryStore（src/memory/store.ts）已实现并通过测试，但从未在 src/index.ts 中挂载到 opencode 的生命周期 hooks
- 缺少的 hooks：
  - experimental.session.compacting — 触发记忆写入
  - experimental.chat.system.transform — 注入历史记忆上下文给 LLM
- 因此虽然记忆引擎就绪，但实际上从未被调用，.xagt/memory.jsonl 文件不会生成

## 影响范围

- M2 持久化记忆系统处于"造好引擎没装车"状态，记忆功能无效

## 方案建议

1. 在 src/index.ts 中实例化 MemoryStore
2. 挂载 experimental.session.compacting hook 调用 createRolloverHandler
3. 在 experimental.chat.system.transform 中注入 buildMemoryContext 结果
