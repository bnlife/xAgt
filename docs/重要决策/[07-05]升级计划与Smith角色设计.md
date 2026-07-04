# [07-05]升级计划与Smith角色设计

## 升级背景

xAgt v0.1.0（4-Agent 编排系统：Vox/Lynx/Fixer/Judge）已完成基线。为进一步提升系统的鲁棒性、持久化能力和自优化能力，基于 `docs/升级思考/` 的 4 份设计文档和社区技术调研结果，制定本升级计划。

## 升级蓝图

### Phase 1：基础设施加固（安全 + 持久化）

| 模块 | 描述 | 预估代码量 | 优先级 |
|------|------|-----------|--------|
| **M1: Tool Gateway** | 工具调用拦截网关，按 Agent 细粒度控制工具权限 + 危险操作检测 | ~150 行 | P0 |
| **M2: 持久化记忆系统** | File-based 三级记忆（短期/项目/长期）+ Context Rollover | ~200 行 | P0 |
| **M3: Git 分支沙盒** | 自动分支隔离：Fixer 工作前创建 ai/task-xxx 分支，审查通过后合并 | ~100 行 | P0 |

### Phase 2：编排能力提升（可靠 + 并行）

| 模块 | 描述 | 预估代码量 | 优先级 |
|------|------|-----------|--------|
| **M4: Async Orchestration** | 并行/条件编排模式支持，Vox 可同时调度多个子 Agent | ~50 行 | P1 |
| **M5: State Restoration** | 断点续传：Fixer 中断后从 .task_state.json 恢复进度 | ~120 行 | P1 |

### Phase 3：成本与质量优化

| 模块 | 描述 | 预估代码量 | 优先级 |
|------|------|-----------|--------|
| **M6: 成本优化** | LLM 响应缓存 + 模型分级 + 结果复用 | ~100 行 | P1 |
| **M7: Smith Agent** | 低频元Agent，每 30 轮激活一次，优化 xAgt harness 本身 | ~80 行 + hook | P1 |

### 依赖关系

```
M1 Tool Gateway ── 独立
M2 记忆系统 ── 独立
M3 Git沙盒  ── 依赖 M1（网关中需添加 Git 操作规则）
M6 成本优化  ── 独立，可穿插在任何阶段
M4 异步编排 ── 独立，建议 M1 后实施（网关保障安全）
M5 断点续传 ── 依赖 M2 + M3（需要持久化 + 分支）
M7 Smith    ── 独立，依赖 M1 保障只读安全
```

**推荐实施顺序**：M1 → M2 → M3 → M6 → M7 → M4 → M5

**总预估代码量**：约 800 行，12+ 个新文件。

---

## Smith（锐匠）角色详细设计

### 命名

Smith — 铁匠磨刀。Smith 的工作是"打磨工具本身"，让 Vox/Lynx/Fixer/Judge 这套 harness 越来越好用。

### 角色定位

| 属性 | 值 |
|------|-----|
| 模式 | subagent |
| 频率 | 每 30 轮激活一次 |
| 模型 | deepseek/deepseek-chat |
| 定位 | 只读优化师 — 只审查 xAgt 源代码，提出改进建议，绝不做修改 |
| 关键词 | "Sharpen the saw" — 打磨工具而非使用工具 |

### 职责

1. **审查 Agent Prompt** — 检查 Vox/Lynx/Fixer/Judge 的 system prompt 是否过时、有矛盾、缺技能引用
2. **审查日志规范** — 检查 logrule 是否被正确遵循，日志前缀是否一致
3. **审查防御性设计** — 检查工具拦截器、输出拦截器、违规检测是否有遗漏
4. **提出优化建议** — 以结构化报告输出：问题 → 建议方案 → 风险评级

### 铁律

| 铁律 | 内容 |
|------|------|
| **只读不写** | Smith 绝不修改任何文件，只输出结构化审查报告 |
| **只提建议** | 所有改进必须经 Vox 调度 Fixer 执行，Smith 不直接干预 |
| **关注矛盾** | 优先发现 prompt 之间的矛盾、过时引用、缺失技能 |
| **不评价代码** | 只报告事实和一致性问题，不评价代码好坏 |

### 激活机制

```
chat.message（每轮计数）
  → 计数 % 30 === 0 ?
      → 是：通过 system.transform 注入 Smith 激活指令给 Vox
      → 否：跳过
```

实现方式：新增 `src/hooks/smith-trigger.ts`，维护 `Map<sessionID, number>` 计数器。

### 汇报格式

```markdown
### Smith 第 N 次定期审查报告

**审查范围：**
- [文件列表]

**发现的问题：**
1. [问题描述] | 风险：[高/中/低] | 建议：[具体修改建议]

**健康评分：** [良好/需关注/需修复]
**建议下一步：** [建议 Vox 采取的行动]
```

### 新增/修改文件清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/agents/smith.ts` | 新增 | Smith Agent 定义 + Prompt |
| `src/agents/index.ts` | 修改 | 注册 Smith 到 getAgents() |
| `src/hooks/smith-trigger.ts` | 新增 | 频率计数器 + 激活逻辑 |
| `src/index.ts` | 修改 | 挂载 smith-trigger hook |
| `tests/agent-config.test.ts` | 修改 | 适配 Smith 注册 |
| `tests/plugin-loading.test.ts` | 修改 | 适配 Smith 注册 |

---

## 升级后目录结构预期

```
src/
├── index.ts                   # 插件主入口（挂载所有 hook）
├── config.ts                  # 配置系统
├── agents/
│   ├── index.ts               # Agent 注册工厂
│   ├── vox.ts                 # Vox 总指挥
│   ├── lynx.ts                # Lynx 侦察兵
│   ├── fixer.ts               # Fixer 执行者
│   ├── judge.ts               # Judge 审计员
│   └── smith.ts               # [新增] Smith 锐匠
├── hooks/
│   ├── index.ts               # TaskManagerHook（看板）
│   ├── system-transform.ts    # 系统约束注入
│   └── smith-trigger.ts       # [新增] Smith 频率触发器
├── utils/
│   └── background-job-board.ts # 后台任务看板
├── gateway/
│   ├── policy.ts              # [新增] 工具权限策略定义
│   ├── interceptor.ts         # [新增] 拦截核心
│   └── rules.ts               # [新增] 预置规则
├── memory/
│   ├── store.ts               # [新增] 文件存储引擎
│   ├── hierarchy.ts           # [新增] 三级记忆注入
│   └── context-rollover.ts    # [新增] 上下文轮转
└── cost/
    ├── cache.ts               # [新增] LLM 响应缓存
    └── model-router.ts        # [新增] 模型路由
```

---

## 状态

- [待讨论] — 等待用户确认后进入 S2 架构设计阶段
