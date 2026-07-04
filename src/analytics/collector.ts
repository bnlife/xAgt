/**
 * Analytics Collector — 分析事件采集器
 *
 * 采集 Judge 拒绝和 Fixer 失败事件，存到 MemoryStore。
 * Smith 定期读取分析，提出改进建议。
 */

import { MemoryStore } from "../memory/store"
import type { AnalyticsEvent, AnalyticsEventType, AnalyticsStats, RejectionReason } from "./types"

export class AnalyticsCollector {
  constructor(private store: MemoryStore) {}

  /**
   * 记录 Judge 拒绝事件。
   */
  async recordJudgeRejection(summary: string, tags?: Record<string, string>): Promise<void> {
    const event: Omit<AnalyticsEvent, "timestamp"> = {
      type: "judge_rejection",
      agent: "judge",
      summary,
      tags,
    }
    // 编码为 memory record，type 固定为 lesson
    await this.store.append({
      type: "lesson",
      content: JSON.stringify(event),
    })
  }

  /**
   * 记录 Fixer 失败事件。
   */
  async recordFixerFailure(summary: string, tags?: Record<string, string>): Promise<void> {
    const event: Omit<AnalyticsEvent, "timestamp"> = {
      type: "fixer_failure",
      agent: "fixer",
      summary,
      tags,
    }
    await this.store.append({
      type: "lesson",
      content: JSON.stringify(event),
    })
  }

  /**
   * 查询事件。
   * 解析 MemoryStore 中编码为 JSON 的 analytics 事件。
   */
  async query(options?: { type?: AnalyticsEventType; limit?: number }): Promise<AnalyticsEvent[]> {
    const records = await this.store.query({ limit: options?.limit ?? 100 })
    const events: AnalyticsEvent[] = []
    for (const r of records) {
      try {
        const parsed = JSON.parse(r.content)
        if (parsed && parsed.type && (parsed.type === "judge_rejection" || parsed.type === "fixer_failure")) {
          if (options?.type && parsed.type !== options.type) continue
          events.push(parsed as AnalyticsEvent)
        }
      } catch {
        // 非 analytics 记录，跳过
      }
    }
    return events
  }

  /**
   * 获取统计摘要。
   */
  async getStats(): Promise<AnalyticsStats> {
    const events = await this.query()
    const byType: Record<string, number> = {}
    const rejectionReasons: Record<string, number> = {}
    const failureTypes: Record<string, number> = {}

    for (const e of events) {
      byType[e.type] = (byType[e.type] ?? 0) + 1

      if (e.type === "judge_rejection" && e.tags?.rule) {
        rejectionReasons[e.tags.rule] = (rejectionReasons[e.tags.rule] ?? 0) + 1
      }
      if (e.type === "fixer_failure" && e.tags?.errorType) {
        failureTypes[e.tags.errorType] = (failureTypes[e.tags.errorType] ?? 0) + 1
      }
    }

    const topRejectionReasons: RejectionReason[] = Object.entries(rejectionReasons)
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count)

    const topFailureTypes: RejectionReason[] = Object.entries(failureTypes)
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count)

    return { total: events.length, byType, topRejectionReasons, topFailureTypes }
  }

  /**
   * 生成给 Smith 的结构化分析摘要。
   */
  async getReportForSmith(): Promise<string> {
    const stats = await this.getStats()
    const events = await this.query({ limit: 50 })

    if (stats.total === 0) return "暂无分析数据。"

    const lines: string[] = [
      `## 分析数据摘要（共 ${stats.total} 条事件）`,
      ``,
      `### 按类型分布`,
    ]

    for (const [type, count] of Object.entries(stats.byType)) {
      const label = type === "judge_rejection" ? "Judge 拒绝" : "Fixer 失败"
      lines.push(`- ${label}: ${count} 次`)
    }

    if (stats.topRejectionReasons.length > 0) {
      lines.push(``, `### 最常见拒绝原因`)
      for (const r of stats.topRejectionReasons.slice(0, 5)) {
        lines.push(`- ${r.reason}: ${r.count} 次`)
      }
    }

    if (stats.topFailureTypes.length > 0) {
      lines.push(``, `### 最常见失败类型`)
      for (const f of stats.topFailureTypes.slice(0, 5)) {
        lines.push(`- ${f.reason}: ${f.count} 次`)
      }
    }

    lines.push(``, `### 最近事件样例`)
    for (const e of events.slice(0, 10)) {
      lines.push(`- [${e.type}] ${e.summary}`)
    }

    return lines.join("\n")
  }
}
