/**
 * Memory Hierarchy — 三级记忆注入
 *
 * 组装项目级记忆和长期记忆，供 system prompt 注入。
 */

import { MemoryStore } from "./store"

export interface InjectedMemory {
  /** 项目级记忆：架构图、决策日志摘要等 */
  projectMemory: string
  /** 长期记忆：lessons/patterns/decisions */
  longTermMemory: string
}

/**
 * 构建记忆上下文，供 system prompt 注入。
 *
 * @param store MemoryStore 实例
 * @returns 结构化的记忆上下文
 */
export async function buildMemoryContext(store: MemoryStore): Promise<InjectedMemory> {
  const projectMemory = await buildProjectMemory()
  const longTermMemory = await buildLongTermMemory(store)

  return { projectMemory, longTermMemory }
}

/**
 * 构建项目级记忆。
 * 从 docs/ 目录读取架构图和决策日志。
 * 目前返回空字符串（留待后续扩展）。
 */
async function buildProjectMemory(): Promise<string> {
  // TODO: 从 docs/架构地图.md 和 docs/重要决策/ 读取
  // 当前阶段先返回空，后续 M3/M4 逐步完善
  return ""
}

/**
 * 构建长期记忆。
 * 从 MemoryStore 中最近的 lessons/patterns/decisions 读取。
 */
async function buildLongTermMemory(store: MemoryStore): Promise<string> {
  const records = await store.query({ limit: 30 })

  if (records.length === 0) return ""

  const lines = records.map((r, i) => {
    const typeLabel = { lesson: "[Lesson]", pattern: "[Pattern]", decision: "[Decision]" }[r.type]
    return `${i + 1}. [${typeLabel}] ${r.content}`
  })

  return `## 历史记忆（最近 ${records.length} 条）\n\n${lines.join("\n")}`
}
