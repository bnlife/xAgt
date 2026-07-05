/**
 * Agent prompt 渲染引擎。
 *
 * 将 AgentDefinition 渲染为 Markdown 格式的 prompt 字符串。
 * 统一所有 agent 的 prompt 结构，使用中文 Markdown 标题。
 */

import type { AgentDefinition } from "./types"

/**
 * 将 AgentDefinition 渲染为 Markdown prompt。
 *
 * @param def Agent 定义
 * @param extraSections 额外段落（键=标题，值=内容），用于 Vox 等需要特殊维度的 agent
 */
export function renderPrompt(def: AgentDefinition, extraSections?: Record<string, string>): string {
  const sections: string[] = []

  // —— 定位 ——
  sections.push(`## 定位\n${def.role}`)

  // —— 职责 ——
  sections.push(`## 职责\n${def.goal}`)

  // —— 能力 ——
  sections.push(`## 能力\n${def.capabilities.map(c => `- ${c}`).join("\n")}`)

  // —— 约束 ——
  sections.push(`## 约束\n${def.constraints.map((c, i) => `${i + 1}. ${c}`).join("\n")}`)

  // —— 流程 ——
  if (def.workflow) {
    sections.push(`## 流程\n${def.workflow}`)
  }

  // —— 输出 ——
  if (def.outputFormat) {
    sections.push(`## 输出\n${def.outputFormat}`)
  }

  // —— 额外段落（如 Vox 的协作协议、沟通规范） ——
  if (extraSections) {
    for (const [title, content] of Object.entries(extraSections)) {
      if (content) {
        sections.push(`## ${title}\n${content}`)
      }
    }
  }

  return sections.join("\n\n")
}

/**
 * 从 AgentDefinition 生成 OpenCode 兼容的 agent 对象。
 * @param extraSections 额外段落（透传给 renderPrompt）
 */
export function toAgentConfig(def: AgentDefinition, extraSections?: Record<string, string>): {
  description: string
  prompt: string
} {
  return {
    description: def.description,
    prompt: renderPrompt(def, extraSections),
  }
}
