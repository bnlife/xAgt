import { MemoryStore } from "./store"
import { join } from "path"
import { existsSync } from "fs"
import { readFile, writeFile, mkdir } from "fs/promises"
import { XAGT_DIR } from "../constants"
import { logger } from "../utils/logger"

export type DecisionType = "alignment" | "decision" | "finding" | "task" | "review"

export const DECISION_LABELS: Record<DecisionType, string> = {
  alignment: "需求对齐",
  decision: "方案决策",
  finding: "调研发现",
  task: "任务记录",
  review: "审查记录",
}

export interface DecisionEntry {
  type: DecisionType
  timestamp: string
  content: string
  tags: string[]
  source: string
  sessionID: string
}

export class DecisionMemory {
  private store: MemoryStore
  private storageDir: string

  constructor(store: MemoryStore, storageDir?: string) {
    this.store = store
    this.storageDir = storageDir ?? join(process.cwd(), XAGT_DIR)
  }

  async record(entry: {
    type: DecisionType
    content: string
    tags?: string[]
    source?: string
    sessionID?: string
  }): Promise<void> {
    const tags = entry.tags ?? []
    const source = entry.source ?? "system"
    const sessionID = entry.sessionID ?? ""

    const payload = {
      _type: entry.type,
      content: entry.content,
      tags,
      source,
      sessionID,
    }

    await this.store.append({
      type: "decision",
      content: JSON.stringify(payload),
    })

    await this.updateSummary()
  }

  async query(options?: {
    type?: DecisionType
    limit?: number
  }): Promise<DecisionEntry[]> {
    const records = await this.store.query({
      type: "decision",
      limit: options?.limit,
    })

    const results: DecisionEntry[] = []

    for (const record of records) {
      try {
        const parsed = JSON.parse(record.content)
        if (parsed && parsed._type) {
          // 如果指定了 type 过滤，跳过不匹配的
          if (options?.type && parsed._type !== options.type) {
            continue
          }

          results.push({
            type: parsed._type as DecisionType,
            timestamp: record.timestamp,
            content: parsed.content ?? "",
            tags: parsed.tags ?? [],
            source: parsed.source ?? "",
            sessionID: parsed.sessionID ?? "",
          })
        }
      } catch {
        // 解析失败的记录静默跳过
      }
    }

    // 按时间倒序（最新在前）
    results.sort((a, b) => b.timestamp.localeCompare(a.timestamp))

    return results
  }

  async renderSummary(): Promise<string> {
    const entries = await this.query({ limit: 50 })

    if (entries.length === 0) {
      return "# 决策记忆\n\n暂无记录。"
    }

    // 按类型分组
    const grouped: Record<DecisionType, DecisionEntry[]> = {
      alignment: [],
      decision: [],
      finding: [],
      task: [],
      review: [],
    }

    for (const entry of entries) {
      if (grouped[entry.type]) {
        grouped[entry.type].push(entry)
      }
    }

    const lines: string[] = []
    lines.push("# 决策记忆")
    lines.push("")
    lines.push("> 自动记录的关键决策、调研发现和审查结果。")
    lines.push("> 子代理可按需读取了解任务背景。")
    lines.push("")

    for (const type of ["alignment", "decision", "finding", "task", "review"] as DecisionType[]) {
      const group = grouped[type]
      if (group.length === 0) continue

      lines.push(`## ${DECISION_LABELS[type]}`)
      for (const entry of group) {
        lines.push(`- ${entry.content}`)
      }
      lines.push("")
    }

    return lines.join("\n")
  }

  private async updateSummary(): Promise<void> {
    try {
      const memoryDir = join(this.storageDir, "memory")
      if (!existsSync(memoryDir)) {
        await mkdir(memoryDir, { recursive: true })
      }

      const summary = await this.renderSummary()
      await writeFile(join(memoryDir, "README.md"), summary, "utf-8")
    } catch (err) {
      logger.error("decision-memory::updateSummary", "failed", {
        error: String(err),
      }, "E1014")
    }
  }
}
