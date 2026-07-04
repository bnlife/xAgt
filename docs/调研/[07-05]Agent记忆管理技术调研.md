# [07-05] Agent 记忆管理（Memory Hierarchy / Context Rollover）技术调研

> 调研日期：2026-07-05
> 调研目标：LLM Agent 记忆管理的最佳实践和现有实现

---

## 一、研究结论总览

### 核心发现

1. **记忆管理的三层架构（LangGraph 标准）**：Checkpointer（短期记忆/线程级）→ Store（长期记忆/跨线程）→ Summarization（上下文压缩）
2. **OpenCode 原生提供 `experimental.session.compacting` 钩子**，这是最直接的上下文轮转机制
3. **没有银弹**——文件存储适合简单场景，向量数据库适合语义检索，SQLite/Postgres 适合结构化持久化
4. **"断点续传"在 Agent 领域 = Checkpointer + State Restoration**

---

## 二、现有 Agent 记忆管理方案对比

### 方案对比表

| 维度 | 文件存储 (JSON/JSONL) | 向量数据库 (Chroma/Pinecone) | SQLite (含 Postgres) |
|------|----------------------|---------------------------|---------------------|
| **代表项目** | Claude Code, Cline, screenpipe | LangChain VectorStoreRetrieverMemory | LangGraph PostgresSaver, MongoDBSaver |
| **持久性** | ✅ 进程重启不丢失 | ✅ 持久化 | ✅ 持久化 |
| **语义检索** | ❌ 不支持 | ✅ 核心能力 | ❌ 原生不支持（需扩展） |
| **结构化查询** | ❌ 弱 | ❌ 弱 | ✅ 强（SQL） |
| **读写性能** | ⚠️ 文件大时变慢 | ✅ 快速近似搜索 | ✅ 索引后快速 |
| **实现复杂度** | 🟢 低 | 🟡 中（需 embedding） | 🟡 中（需 schema） |
| **最适合场景** | 小型项目、本地开发 | 大规模记忆、语义回忆 | 生产级、多会话管理 |
| **第三方依赖** | 无 | 需要向量库 + embedding 模型 | 需要数据库驱动 |

### 1. 文件存储方案

**Claude Code / Cline 模式**：
- 将对话历史保存为 `conversations.json` 文件（`/projects/<project>/conversations/`）
- 使用 `localStorage` 或文件系统作为后备存储
- 优点：简单，零依赖
- 缺点：全文检索能力弱，文件会膨胀

**screenpipe 模式**（`use-chat-conversations.ts`）：
- `saveConversationFile()` / `loadConversationFile()` / `deleteConversationFile()`
- 每个会话独立文件，按项目组织
- 使用 `invalidateConversationListCache()` 管理缓存

**OpenCode 自带**：内置会话持久化到文件系统 `~/.opencode/projects/<project>/sessions/`

### 2. 向量数据库方案

**LangChain `VectorStoreRetrieverMemory`**（`langchainjs/libs/langchain-classic/src/memory/vector_store.ts`）：
```typescript
class VectorStoreRetrieverMemory extends BaseMemory {
  vectorStoreRetriever: VectorStoreRetrieverInterface;
  // 自动将对话历史向量化，通过语义搜索找到相关记忆
  // 支持 top-K 检索
}
```
- 每次对话后自动提取关键信息并向量化存储
- 下次对话时根据当前 query 做语义检索
- 适合"我记得用户上次说过什么"场景

**LangGraph Store + Semantic Search**（`@langchain/langgraph`）：
```typescript
const store = new InMemoryStore({
  index: {
    embeddings: new OpenAIEmbeddings({ model: "text-embedding-3-small" }),
    dims: 1536,
    fields: ["food_preference", "$"],
  },
});
```
- 支持按 namespace 组织记忆（`[userId, "memories"]`）
- `store.search()` 支持自然语言查询
- 生产环境可切换到 PostgresStore / MongoDBStore

### 3. SQLite / 数据库方案

**LangGraph Checkpointer 系列**（生产推荐）：
- `MemorySaver`（开发用，进程丢失）
- `SqliteSaver`（本地开发持久化）
- `PostgresSaver`（生产级）
- `MongoDBSaver`（生产级，支持自动 embedding）

**关键设计**：
```typescript
// LangGraph 的持久化接口
interface BaseCheckpointSaver {
  put(config, checkpoint, metadata): Promise<void>;
  getTuple(config): Promise<StateSnapshot | undefined>;
  list(config, limit?, before?): AsyncIterable<StateSnapshot>;
  putWrites(config, writes, taskId): Promise<void>;
}
```

**n8n 生态的多数据库支持**：
- `MemoryPostgresChat`：PostgresChatMessageHistory
- `MemoryMongoDbChat`：MongoDBChatMessageHistory  
- `MemoryRedisChat`：RedisChatMessageHistory
- `MemoryXata`：XataChatMessageHistory

这些全部基于 LangChain 的 `BaseListChatMessageHistory` 接口，按 `sessionId` 分区。

---

## 三、上下文轮转（Context Rollover）触发策略

### 触发条件

| 策略 | 触发条件 | 代表实现 |
|------|---------|---------|
| **消息数量阈值** | > N 条消息（如 6 条） | LangGraph summarize example |
| **Token 计数** | 接近模型 context window 上限 | LangChain `trimMessages` + `maxTokens` |
| **会话空闲** | session.idle 事件 | OpenCode `event` hook |
| **进程重启** | 恢复时从存储加载 | Claude Code `sessionRestore.ts` |
| **显式请求** | 用户或 Agent 主动触发 | `/compact` 命令 |

### OpenCode 的 compaction 机制（核心）

OpenCode 提供了 **`experimental.session.compacting`** 钩子，这是最原生、最直接的上下文轮转接口：

```typescript
// 方式 1：注入额外上下文
export const CompactionPlugin: Plugin = async (ctx) => {
  return {
    "experimental.session.compacting": async (input, output) => {
      output.context.push(`
## Custom Context
- Current task status
- Important decisions made
- Files being actively worked on
`)
    },
  }
}

// 方式 2：完全替换 compaction prompt（多 Agent 场景）
export const CustomCompactionPlugin: Plugin = async (ctx) => {
  return {
    "experimental.session.compacting": async (input, output) => {
      output.prompt = `
You are generating a continuation prompt for a multi-agent session.
Summarize:
1. Current task and its status
2. Which files are being modified and by whom
3. Any blockers or dependencies between agents
4. Next steps

Format as a structured prompt for a new agent to resume work.
`
    },
  }
}
```

### LangGraph 的三层触发策略

```
┌─────────────────────────────────────────────────┐
│  1. Message Trimming（最基础）                    │
│     trimMessages(state.messages, {               │
│       strategy: "last",                          │
│       maxTokens: 128,                            │
│       startOn: "human",                          │
│       endOn: ["human", "tool"],                  │
│     })                                           │
├─────────────────────────────────────────────────┤
│  2. Message Summarization（中等）                 │
│     if (messages.length > 6) → summarize         │
│     保留最近 2 条，其余压缩成 summary              │
│     state.summary + state.messages 共同喂给 LLM   │
├─────────────────────────────────────────────────┤
│  3. Checkpoint Pruning（维护）                    │
│     定期清理旧 checkpoint                         │
│     checkpointer.deleteThread(threadId)          │
└─────────────────────────────────────────────────┘
```

---

## 四、状态恢复（State Restoration）设计模式

### 模式 1：Checkpoint 恢复（LangGraph 标准）

**LangGraph Checkpointer** 自动在每一步 graph 执行后创建 checkpoint：

```typescript
const graph = workflow.compile({ checkpointer: memory });

// 恢复：只需传入相同的 thread_id
const config = { configurable: { thread_id: "1" } };
await graph.invoke({ messages: [{ role: "user", content: "继续" }] }, config);
```

**恢复的数据**：
- `state.values`：图的所有状态值
- `state.next`：下一个要执行的节点
- `state.config`：包含 thread_id 和 checkpoint_id
- `state.tasks`：待执行的任务

**LangGraph 的 Durability 三级保障**：
- `"exit"`：仅在退出时持久化（性能最好）
- `"async"`：异步持久化（推荐生产）
- `"sync"`：同步持久化（最安全）

### 模式 2：Log-Based 恢复（Claude Code 模式）

Claude Code 使用 **`sessionRestore.ts`** 从日志重建状态：

```typescript
// claude-code/src/utils/sessionRestore.ts
export function restoreSessionStateFromLog(
  result: ResumeResult,
  setAppState: (f: (prev: AppState) => AppState) => void,
): void {
  // 从日志重建：
  // 1. 文件历史 (fileHistory)
  // 2. 归属信息 (attribution)
  // 3. 待办事项 (todos)
  // 4. 工作区状态 (worktreeState)
  // 5. 模式 (mode)
}
```

**关键函数链**：
```
adoptResumedSessionFile()    → 接管恢复的会话文件
recordContentReplacement()   → 重建内容替换记录
resetSessionFilePointer()    → 重置文件指针
restoreSessionMetadata()     → 恢复元数据
saveMode()                   → 保存当前模式
saveWorktreeState()          → 保存工作区状态
```

### 模式 3：MCP Session 管理（ruvnet/ruflo）

```typescript
const restoreSessionSchema = z.object({
  sessionId: z.string(),
  restoreAgents: z.boolean().default(true),  // 恢复 Agent 状态
  restoreTasks: z.boolean().default(true),   // 恢复任务队列
  restoreMemory: z.boolean().default(true),  // 恢复记忆
});
```

### 模式 4：Host-Level 恢复（Cline SDK）

```typescript
interface RestoreSessionInput {
  sessionId: string;
  checkpointRunCount: number;
  cwd?: string;
  restore?: {
    messages?: boolean;
    omitCheckpointMessageFromSession?: boolean;
  };
}
```

### 模式 5：VS Code Codex 的状态恢复

VS Code 的 Agent Service 实现了复杂的恢复机制：
```
_restoreSessionInFlight  → Map<string, Promise<void>> 防止并发恢复
_restoreSubagentInFlight → Map<string, Promise<void>> 子 Agent 恢复
```
- 当订阅 session 的资源出现时触发恢复
- 会话空闲时触发 GC (`_runSessionGc`)

---

## 五、状态恢复的通用设计模式

```
┌─────────────────────────────────────────────┐
│             状态恢复流程                       │
├─────────────────────────────────────────────┤
│  1. 检测需要恢复的信号                         │
│     - 用户重新打开会话                         │
│     - 进程重启后扫描 session 文件              │
│     - session.idle 事件后恢复                  │
├─────────────────────────────────────────────┤
│  2. 加载持久化状态                             │
│     - 从文件/DB/向量库读取最新 checkpoint       │
│     - 反序列化为内存对象                        │
├─────────────────────────────────────────────┤
│  3. 重建上下文                                │
│     - 恢复消息历史（按 token 限制裁剪）          │
│     - 恢复系统提示 + 记忆注入                   │
│     - 恢复任务/文件状态                         │
├─────────────────────────────────────────────┤
│  4. 验证完整性                                │
│     - 确保 reducer 状态正确                     │
│     - 确保文件指针有效                          │
│     - 确保任务队列一致                          │
└─────────────────────────────────────────────┘
```

---

## 六、"Lessons Learned" 模式在 AI Agent 中的应用

### 现有实现

**LangGraph Store 的长期记忆模型**：
- 将 "lessons learned" 作为跨会话记忆存储
- 每个 lesson 作为一个命名空间下的 key-value 对
- 支持语义搜索：`store.search(namespace, { query: "用户喜欢什么", limit: 3 })`

**OpenCode 的 Compaction Hook** 可承载 "lessons learned"：
- 在 compaction 时，Agent 可以提取"这轮学到什么"作为 lessons learned
- 注入到 `output.context` 中保留
- 下一次恢复时这些 lessons 自动成为系统提示的一部分

### 实现模式

```
每次对话结束 → 提取 Lessons Learned → 存入 Store
                                       ↓
每次对话开始 → 检索相关 Lessons → 注入 System Prompt
```

### 关键挑战

| 挑战 | 说明 | 建议方案 |
|------|------|---------|
| **记忆污染** | 错误或不相关的 lessons 累积 | 加入 confidence 评分，低分自动清理 |
| **遗忘曲线** | 太久远的 lessons 可能过时 | 按时间衰减权重，或设 TTL |
| **存储膨胀** | lessons 无限增长 | 设置上限 + LRU 淘汰策略 |
| **冲突解决** | 前后 lessons 矛盾时如何处理 | 新 lessons 覆盖旧的，保留日志 |

---

## 七、关键代码示例 / 项目链接

### LangGraph 记忆管理（最完整的实现）

- **LangGraph Persistence 文档**：https://docs.langchain.com/oss/javascript/langgraph/persistence
- **完整记忆示例**：https://docs.langchain.com/oss/javascript/langgraph/add-memory
- **Store 长期记忆**：https://docs.langchain.com/oss/javascript/langgraph/stores
- **Checkpointer 实现**：https://docs.langchain.com/oss/javascript/langgraph/checkpointers
- **BufferWindowMemory 源码**：`langchainjs/libs/langchain-classic/src/memory/buffer_window_memory.ts`
- **ConversationSummaryMemory 源码**：`langchainjs/libs/langchain-classic/src/memory/summary.ts`
- **VectorStoreRetrieverMemory**：`langchainjs/libs/langchain-classic/src/memory/vector_store.ts`

### Claude Code 状态恢复

- **sessionRestore.ts**：`claude-code/src/utils/sessionRestore.ts`
- **sessionStorage.ts**：`claude-code/src/utils/sessionStorage.ts`

### Cline SDK 恢复

- **restoreSession 接口**：`cline/sdk/packages/core/src/runtime/host/runtime-host.ts`

### VS Code AgentService 恢复

- **agentService.ts**：`microsoft/vscode/src/vs/platform/agentHost/node/agentService.ts`

### Flowise / n8n 多数据库内存节点

- **BufferWindowMemory**：Flowise `packages/components/nodes/memory/BufferWindowMemory/`
- **ConversationSummaryMemory**：Flowise `packages/components/nodes/memory/ConversationSummaryMemory/`
- **PostgresChat**：n8n `packages/@n8n/nodes-langchain/nodes/memory/MemoryPostgresChat/`
- **MongoDBChat**：n8n `packages/@n8n/nodes-langchain/nodes/memory/MemoryMongoDbChat/`

### OpenCode 插件文档

- **Compaction Hooks**：https://opencode.ai/docs/plugins

---

## 八、对 xAgt 项目的建议

### 当前状态分析

xAgt 目前：
- ✅ 有 `BackgroundJobBoard` 做运行中任务追踪（纯内存）
- ✅ 有 `TaskManagerHook` 管理后台任务生命周期
- ✅ `session.idle` 事件触发 reconciled 清理
- ❌ **没有持久化**——所有任务记录在进程重启后丢失
- ❌ **没有 compaction 钩子**——long-running 会话会膨胀
- ❌ **没有 lessons learned** 提取机制

### 分层推荐

| 层 | 推荐方案 | 优先级 | 说明 |
|----|---------|--------|------|
| **短期记忆** | `BackgroundJobBoard` + 复用 OpenCode 原生 compaction | P0 | 利用 `experimental.session.compacting` 注入看板状态 |
| **任务历史持久化** | 简单的 JSON 文件存储 + LRU 淘汰 | P1 | `BackgroundJobBoard` 持久化到 `~/.opencode/plugins/xAgt/tasks.json` |
| **长期记忆** | 暂不需要，后续可接入 LangGraph Store 模式 | P2 | 如果项目需要跨会话的"经验"记忆 |

### 立即可以做的改进

1. **实现 `experimental.session.compacting` 钩子**：在看板信息中提取关键状态
2. **持久化 `BackgroundJobBoard`**：在 `event` hook 的 `session.status` 事件触发时写盘
3. **加入 LRU 淘汰**：`BackgroundJobBoard` 已有 `evictIfNeeded()`，但纯内存，可以扩展为持久化版

---

*调研完成*
