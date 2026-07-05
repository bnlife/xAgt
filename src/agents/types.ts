/**
 * Agent 6 维度定义。
 *
 * 每个 agent 必须覆盖这 6 个维度。
 * 渲染引擎根据此定义生成最终 prompt。
 *
 * 设计参考：
 * - CrewAI: role/goal/backstory 三要素
 * - Anthropic: XML 标签分离 prompt 各部分
 * - OpenAI: Markdown 标题分章
 */

export interface AgentDefinition {
  /** 角色名（小写英文，如 "lynx", "fixer"） */
  name: string

  /** 一句话描述（用于 OpenCode agent 列表） */
  description: string

  /** 定位 — 你是谁，在整个系统中的位置 */
  role: string

  /** 职责 — 你负责做什么 */
  goal: string

  /** 能力 — 你能用什么工具、有什么技能 */
  capabilities: string[]

  /** 绝对基线 — 绝对不能做的事 */
  constraints: string[]

  /** 流程 — 收到任务后做什么，步骤 */
  workflow: string

  /** 输出 — 任务完成后怎么汇报，什么格式 */
  outputFormat: string
}
