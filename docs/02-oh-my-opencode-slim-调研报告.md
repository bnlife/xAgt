# oh-my-opencode-slim 项目调研报告

> 对 oh-my-opencode-slim v2.0.6 的完整分析
> 调研日期：2026-07-03

---

## 一、项目概述

**oh-my-opencode-slim** 是一个 **OpenCode TUI 插件**（v2.0.6），实现了 **多 Agent 编排系统**。核心理念是：不让一个模型做所有事情，而是将任务路由到最适合的专家 Agent，平衡质量、速度和成本。

- **技术栈**: TypeScript + Bun + Biome（linter/formatter）
- **运行时**: Node.js ESM 模块
- **核心依赖**: `@opencode-ai/plugin`, `@opencode-ai/sdk`, `@modelcontextprotocol/sdk`, `zod`, `jsdom`
- **测试框架**: `bun:test`（468 个测试，35 个文件）
- **构建工具**: Bun build + TypeScript 声明生成

---

## 二、目录结构

```
oh-my-opencode-slim/
├── src/
│   ├── index.ts              # 插件主入口（Plugin 导出）
│   ├── tui.ts                # TUI 侧边栏
│   ├── agents/               # Agent 工厂定义
│   │   ├── orchestrator.ts   # 主调度 Agent prompt 构建
│   │   ├── explorer.ts       # 代码侦察 Agent
│   │   ├── oracle.ts         # 架构顾问 Agent
│   │   ├── librarian.ts      # 知识检索 Agent
│   │   ├── designer.ts       # UI/UX 设计 Agent
│   │   ├── fixer.ts          # 快速实现 Agent
│   │   ├── observer.ts       # 视觉分析 Agent（可选，默认禁用）
│   │   ├── council.ts        # 多模型共识 Agent
│   │   ├── councillor.ts     # Council 内部成员 Agent
│   │   └── index.ts          # Agent 注册、override、权限工厂
│   ├── config/               # 配置系统
│   │   ├── schema.ts         # Zod 配置 schema
│   │   ├── constants.ts      # Agent 名称、默认值
│   │   ├── loader.ts         # 配置加载、合并、preset
│   │   └── utils.ts          # Agent override 查询工具
│   ├── hooks/                # OpenCode 生命周期钩子
│   │   ├── task-session-manager/  # 后台任务会话管理
│   │   ├── foreground-fallback/   # 模型 rate-limit fallback
│   │   ├── delegate-task-retry/   # 任务委派重试指导
│   │   ├── apply-patch/           # apply_patch 输入修复
│   │   ├── deepwork/              # /deepwork 命令
│   │   ├── reflect/               # /reflect 命令
│   │   ├── loop-command/          # /loop 命令
│   │   ├── phase-reminder/        # 工作流阶段提醒
│   │   ├── filter-available-skills/ # 技能过滤
│   │   ├── post-file-tool-nudge/  # 文件工具后处理提示
│   │   ├── json-error-recovery/   # JSON 解析错误恢复
│   │   └── auto-update-checker/   # 自动更新检查
│   ├── tools/                # 自定义工具定义
│   │   ├── council.ts        # Council 多模型共识工具
│   │   ├── cancel-task.ts    # 后台任务取消工具
│   │   ├── acp-run.ts        # ACP 外部 Agent 调用工具
│   │   ├── preset-manager.ts # /preset 运行时切换命令
│   │   └── smartfetch/       # Web 内容抓取
│   ├── council/              # Council 多 LLM 编排
│   ├── mcp/                  # MCP 服务器定义（websearch, context7, gh_grep）
│   ├── multiplexer/          # Tmux/Zellij/Herdr 面板集成
│   ├── skills/               # 内置技能（deepwork, reflect, worktrees 等）
│   ├── companion/            # 桌面浮动窗口状态显示
│   ├── interview/            # 浏览器访谈式规格生成
│   ├── loop/                 # 循环执行会话
│   ├── cli/                  # CLI 入口（安装、配置、诊断）
│   └── utils/                # 共享工具函数
├── docs/                     # 用户文档
├── companion/                # Companion 二进制相关
├── scripts/                  # 构建/验证脚本
└── package.json
```

---

## 三、多 Agent 工作实现方式

### 3.1 Agent 系统

**7 个核心 Agent + 1 个内部 Agent**：

| Agent | 角色 | 文件 |
|-------|------|------|
| **Orchestrator** | 主调度器：规划→调度→监控→调和→验证 | `orchestrator.ts` |
| **Explorer** | 代码侦察：glob/grep/AST 快速定位 | `explorer.ts` |
| **Oracle** | 架构顾问：高级推理、调试、代码审查 | `oracle.ts` |
| **Librarian** | 知识检索：文档、API 参考、Web 搜索 | `librarian.ts` |
| **Designer** | UI/UX 实现：视觉设计、交互、响应式 | `designer.ts` |
| **Fixer** | 快速实现：范围化执行任务 | `fixer.ts` |
| **Observer** | 视觉分析：图片/PDF/图表解读（默认禁用） | `observer.ts` |
| **Council** | 多模型共识：并行多模型→综合 | `council.ts` |
| **Councillor** | Council 内部成员（隐藏） | `councillor.ts` |

### 3.2 调度模型（Background Orchestration）

V2 采用 **调度优先** 模型，Orchestrator 不再是默认的实现工作者：

```
旧模型：orchestrator 直接工作 → 委派 → 等待结果
新模型：orchestrator 规划 → 调度后台专家 → 监控 → 调和 → 验证
```

**执行循环**：

1. **理解**：解析请求，识别显式需求 + 隐式需求
2. **路径选择**：评估方法（质量、速度、成本）
3. **委派检查**：根据 lane 规则选择 Agent
4. **并行化**：构建工作图（独立 lane 并行执行，依赖 lane 有序）
5. **调度后台任务**：使用 `task(..., background: true)` 启动
6. **跟踪**：记录 task ID、状态、文件所有权
7. **调和**：整合结果、解决冲突
8. **验证**：运行检查/诊断

### 3.3 后台任务管理

**核心组件**：

- **`BackgroundJobBoard`**：内存中的任务看板，跟踪每个后台任务的 taskID、alias、agent、状态、文件上下文
- **`TaskSessionManagerHook`**：
  - 拦截 `task` 工具调用（`tool.execute.before`），注入 session 管理
  - 拦截工具输出（`tool.execute.after`），解析启动/状态输出，注册到看板
  - 在 `experimental.chat.messages.transform` 中注入后台任务看板状态到 orchestrator 的最新消息
  - 处理 session 创建/删除/idle 事件
- **`CancelTaskTool`**：允许 orchestrator 取消追踪的后台任务
- **`MultiplexerSessionManager`**：在 Tmux/Zellij 中为后台任务创建独立面板

### 3.4 会话复用

Orchestrator 可以复用已有 specialist 会话，节省时间和 token：
- 使用 `task_id` 参数传递已有 session ID
- `BackgroundJobBoard.resolveReusable()` 根据 agent 类型和父 session 查找可复用的会话

### 3.5 文件所有权避免写冲突

- 后台写入 Agent（fixer, designer）的写入范围不能重叠
- Orchestrator 在调度前比较运行中任务的范围
- 通过 `ContextFile` 追踪每个任务读取的文件

---

## 四、Hook 机制

### 4.1 插件入口挂载点

插件通过返回对象的特定键名挂载到 OpenCode 生命周期：

| 挂载点 | 用途 |
|--------|------|
| `agent` | 注册所有 Agent（orchestrator + 7 个 subagent + 自定义 + ACP） |
| `tool` | 注册自定义工具（council, cancel_task, webfetch, ast_grep 等） |
| `mcp` | 注册 MCP 服务器（websearch, context7, gh_grep） |
| `config` | 配置钩子：设置 default_agent、合并 agent/mcp 配置、注册命令 |
| `event` | 事件钩子：session 创建/删除/状态、模型 fallback、multiplexer 管理 |
| `chat.message` | 跟踪 session→agent 映射 |
| `chat.headers` | TUI 头部信息 |
| `experimental.chat.system.transform` | 注入 orchestrator 系统 prompt |
| `experimental.chat.messages.transform` | 注入阶段提醒、过滤技能、重写 displayName |
| `tool.execute.before` | 修复 apply_patch 输入、任务会话管理 |
| `tool.execute.after` | 委派重试指导、JSON 错误恢复、文件工具后处理 |
| `command.execute.before` | 处理 /interview、/preset、/deepwork、/reflect、/loop 命令 |

### 4.2 内置 Hook 列表

| Hook | 功能 |
|------|------|
| **TaskSessionManager** | 后台任务会话跟踪、看板状态注入、上下文管理 |
| **ForegroundFallback** | API rate-limit 时自动切换到 fallback 模型 |
| **DelegateTaskRetry** | 任务委派失败后提供重试指导 |
| **ApplyPatch** | 修复过时的 apply_patch 输入 |
| **DeepworkCommand** | `/deepwork` 命令处理 |
| **ReflectCommand** | `/reflect` 命令处理 |
| **LoopCommand** | `/loop` 命令处理 |
| **PhaseReminder** | 注入工作流阶段提醒（plan→dispatch→track→verify） |
| **FilterAvailableSkills** | 过滤可用技能 |
| **PostFileToolNudge** | 文件工具后处理提示 |
| **JsonErrorRecovery** | JSON 解析错误恢复 |
| **AutoUpdateChecker** | 自动更新检查 |
| **ChatHeaders** | TUI 头部信息 |
| **ImageHook** | 图片附件处理（orchestrator 不支持图片时委派给 observer） |

---

## 五、配置系统

### 5.1 配置文件位置

- **主配置**: `~/.config/opencode/oh-my-opencode-slim.json`（支持 JSONC）
- **Schema**: `oh-my-opencode-slim.schema.json`
- **项目级定制**: `.slim/` 目录下可覆盖 agent prompt

### 5.2 配置结构（Zod Schema）

```jsonc
{
  "$schema": "...",
  "preset": "openai",           // 活跃 preset 名称
  "presets": {                  // 多 preset 定义
    "openai": {
      "orchestrator": { "model": "openai/gpt-5.5", "variant": "medium", "skills": ["*"], "mcps": ["*", "!context7"] },
      "explorer": { "model": "openai/gpt-5.4-mini", "variant": "low" },
      // ...
    }
  },
  "agents": {                   // Agent 级配置覆盖
    "orchestrator": { "model": "...", "variant": "...", "temperature": 0.1, "prompt": "...", "displayName": "..." },
    // 支持 model 为字符串或优先级数组 [{id: "...", variant: "..."}]
  },
  "disabled_agents": ["observer"],  // 禁用的 Agent
  "disabled_mcps": [],              // 禁用的 MCP
  "disabled_tools": [],             // 禁用的工具
  "disabled_skills": [],            // 禁用的技能
  "multiplexer": {                  // 面板集成
    "type": "tmux|zellij|herdr|auto|none",
    "layout": "main-vertical",
    "main_pane_size": 60
  },
  "council": { ... },               // Council 配置
  "fallback": {                     // 模型 fallback 配置
    "enabled": true,
    "timeoutMs": 15000,
    "retry_on_empty": true
  },
  "backgroundJobs": {               // 后台任务配置
    "maxSessionsPerAgent": 2,
    "readContextMinLines": 10,
    "readContextMaxFiles": 8
  },
  "companion": { ... },             // 桌面伴侣窗口
  "acpAgents": { ... },             // ACP 外部 Agent
  "websearch": { "provider": "exa|tavily" },
  "interview": { ... },
  "autoUpdate": true,
  "setDefaultAgent": true,
  "compactSidebar": false
}
```

### 5.3 Agent Override 配置

每个 Agent 支持以下 override 字段：

| 字段 | 类型 | 说明 |
|------|------|------|
| `model` | `string \| Array<string \| {id, variant?}>` | 模型 ID（支持 fallback 数组） |
| `temperature` | `number` | 温度（0-2） |
| `variant` | `string` | 模型变体（low/medium/high/max） |
| `skills` | `string[]` | 可用技能（`"*"` = 全部, `"!item"` = 排除） |
| `mcps` | `string[]` | 可用 MCP（`"*"` = 全部, `"!item"` = 排除） |
| `prompt` | `string` | 自定义 prompt（替换默认） |
| `orchestratorPrompt` | `string` | 追加到 orchestrator 的路由提示 |
| `options` | `Record<string, unknown>` | Provider 特定选项 |
| `displayName` | `string` | 显示名称（`@name` 语法） |

### 5.4 Preset 系统

- 配置文件中可定义多个 preset
- 运行时通过 `/preset` 命令切换
- 切换时覆盖 agent 的 model/variant/temperature
- 运行时 preset 存储在 `config/runtime-preset.ts`

### 5.5 自定义 Agent

在 `config.agents` 中添加未知 key 即可创建自定义 Agent：

```jsonc
{
  "agents": {
    "my-specialist": {
      "model": "openai/gpt-5.5",
      "prompt": "You are my custom specialist."
    }
  }
}
```

### 5.6 ACP Agent

连接外部 ACP 兼容 Agent（如 Claude Code ACP）：

```jsonc
{
  "acpAgents": {
    "claude-code": {
      "command": "claude-code-acp",
      "args": ["--stdio"],
      "wrapperModel": "openai/gpt-5.5",
      "orchestratorPrompt": "@claude-code\n- Lane: ..."
    }
  }
}
```

---

## 六、关键设计模式

1. **工厂模式**: 每个 Agent 有独立的 `create*Agent()` 工厂函数
2. **Hook 模式**: 通过 OpenCode 生命周期钩子扩展行为
3. **看板模式**: `BackgroundJobBoard` 管理所有后台任务状态
4. **动态 Prompt**: Orchestrator prompt 根据活跃 Agent 动态构建
5. **Override 层叠**: config preset → agent override → custom prompt → append prompt
6. **运行时 Fallback**: `ForegroundFallbackManager` 在 API 错误时自动切换模型
7. **面板集成**: 通过 Tmux/Zellij/Herdr 为每个后台 Agent 创建独立面板

---

## 七、重要依赖

| 依赖 | 用途 |
|------|------|
| `@opencode-ai/plugin` | OpenCode 插件接口定义 |
| `@opencode-ai/sdk` | OpenCode SDK（Agent、Tool、Session 类型） |
| `@modelcontextprotocol/sdk` | MCP 协议实现（websearch, context7, gh_grep） |
| `@ast-grep/cli` | AST 搜索和替换工具 |
| `zod` | 运行时配置 schema 验证 |
| `jsdom` | HTML 解析（webfetch 工具） |
| `@mozilla/readability` | Web 内容可读性提取 |
| `turndown` | HTML→Markdown 转换 |
| `lru-cache` | 缓存 |
| `@opentui/solid` | TUI 侧边栏（可选依赖） |
