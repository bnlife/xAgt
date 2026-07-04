# xAgt — OpenCode 多 Agent 编排插件

xAgt 是一个 [OpenCode](https://opencode.ai) TUI 插件，实现了一套完整的 **多 Agent 编排系统**。通过角色隔离、工具权限管控、记忆持久化、Git 沙盒隔离、数据分析闭环等机制，让一个"快但不那么听话"的模型（如 DeepSeek）被驯服为高效、可靠、自进化的编码助手。

## 系统架构

### 5 大 Agent 角色

| 角色 | 模式 | 职责 | 工具权限 |
|------|------|------|---------|
| **Vox** | primary | 总指挥：7 步工作流调度，不亲自动手 | 只有 `task` |
| **Lynx** | subagent | 侦察兵：搜代码、查文档、联网调研、读图 | `read`, `grep`, `glob`, MCP 工具 |
| **Fixer** | subagent | 双手：精确改代码、建文件、跑命令、闭环验证 | `read`, `write`, `edit`, `bash` |
| **Judge** | subagent | 显微镜：审计代码合规性、测试真实性、日志规范 | `read`, `grep`, `glob` |
| **Smith** | subagent | 锐匠：低频(30轮)分析数据、提出 harness 优化建议 | `read`, `grep`, `glob` |

### 工作流（Vox 的 7 步流程）

```
S1 前期调研 → S2 架构设计 → S3 接口规范 → S4 测试设计 → S5 分步实现 → S6 流水线测试 → S7 人工验收
```

每步完成一审核，三振出局机制保障质量。

### 模块一览

| 模块 | 功能 |
|------|------|
| **M1: Tool Gateway** | 声明式工具权限策略，每个 Agent 拥有精确的白名单。Fixer 的 bash 含 `rm -rf` 危险命令检测 |
| **M2: Memory** | JSONL 文件存储的三级记忆（短期/项目/长期），自动轮转(200条上限) |
| **M3: Git Sandbox** | Git Worktree 物理隔离沙盒，Fixer 在独立分支上工作，审查通过后合并 |
| **M4: Async Orchestration** | Vox Prompt 中的并行/条件分支/等待汇总三种调度模式 |
| **M5: State Restoration** | 断点续传，Fixer 中断后可从 `.xagt/task_state.json` 恢复进度 |
| **M6: Cost Optimization** | 工具调用结果缓存(LRU+TTL)、模型路由配置、缓存写操作自动失效 |
| **M7: Smith Analytics** | 采集 Judge 拒绝 / Fixer 失败事件，每 30 轮分析趋势并提出优化建议 |

## 快速开始

### 安装

```bash
# 克隆到 opencode 插件目录
git clone https://github.com/bnlife/xAgt.git ~/.config/opencode/plugins/xagt

# 或从本地加载
git clone https://github.com/bnlife/xAgt.git
# 在 opencode.jsonc 中添加:
# "plugin": ["file:///path/to/xAgt"]
```

### 配置

在 `opencode.jsonc` 中配置 xAgt：

```jsonc
{
  "plugin": [
    "file:///path/to/xAgt"
  ],
  "xAgt": {
    "agents": {
      "lynx": { "model": "deepseek/deepseek-chat" },
      "judge": { "model": "deepseek/deepseek-chat" }
    },
    "disabled": []
  }
}
```

### 测试

```bash
# 安装依赖
npm install

# 编译
npm run build

# 运行全部测试（207 个）
bun test

# 类型检查
npm run typecheck
```

## Agent 调度规则（Vox 三段式模板）

Vox 使用三段式模板调度子代理，不写背景、不写理由、不写子代理已知的铁律：

```
Fixer:  【文件】路径:行号
        【操作】具体修改内容
        【验收】验证命令

Lynx:   【目标】调研/排错的具体问题
        【线索】关键词/日志片段
        【期望】返回什么格式的信息

Judge:  【审查】文件路径
        【重点】合规/测试/日志/越权
        【标准】通过条件
```

## Fixer 分级 TDD

Fixer 不再一刀切跑全量测试，而是根据修改类型自动选择验证级别：

| 修改类型 | 验证要求 |
|---------|---------|
| 琐碎（注释/typo/重命名） | 编译检查 |
| 简单（参数/默认值调优） | 编译 + 直接相关测试 |
| 复杂（新功能/新逻辑） | 完整 TDD：先写测试再实现 |
| 不确定 | 保守选择小范围测试 |

## 测试覆盖

```
207 tests, 0 failures, 3 skipped
- 19 个测试文件
- 5 个 Agent 测试
- Gateway 策略 + 拦截 64 个测试
- 记忆系统 17 个测试
- Git 沙盒 9 个测试
- 成本缓存 6 个测试
- 断点续传 5 个测试
- 看板 + hooks 15 个测试
```

## 设计原则

1. **质量第一，宁慢勿烂** — 7 步工作流 + 闭环审查 + 三振出局
2. **代码级保障而非 Prompt 约束** — M1 Gateway 用代码锁住工具权限，不依赖 LLM 自觉遵守规则
3. **防御性设计** — Vox 禁止直接操作文件，输出拦截器检测"含代码无 task()"的违规回复
4. **自进化** — Smith 采集运行数据，基于趋势提出优化建议，形成"数据→分析→改进"闭环

## 技术栈

- TypeScript + ESM
- Bun 测试框架（`bun:test`）
- OpenCode Plugin API（`@opencode-ai/plugin`）
- Git Worktree（沙盒隔离）

## License

MIT
