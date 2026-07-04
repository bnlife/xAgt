import { describe, it, expect } from "bun:test"
import { mkdtempSync, rmSync } from "fs"
import { join } from "path"
import { tmpdir } from "os"

// =========================================
// AnalyticsCollector — 分析事件采集
// =========================================
describe("AnalyticsCollector", () => {
  it("recordJudgeRejection 应存储事件并可查询", async () => {
    const { AnalyticsCollector } = await import("../../src/analytics/collector")
    const { MemoryStore } = await import("../../src/memory/store")
    const tempDir = mkdtempSync(join(tmpdir(), "xagt-analytics-"))
    try {
      const store = new MemoryStore(tempDir)
      const collector = new AnalyticsCollector(store)
      await collector.recordJudgeRejection("铁律2违反：Fixer私自扩大了修改范围", "铁律2")
      const events = await collector.query()
      expect(events.length).toBe(1)
      expect(events[0].type).toBe("judge_rejection")
      expect(events[0].summary).toContain("铁律2")
    } finally {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it("recordFixerFailure 应存储事件并可查询", async () => {
    const { AnalyticsCollector } = await import("../../src/analytics/collector")
    const { MemoryStore } = await import("../../src/memory/store")
    const tempDir = mkdtempSync(join(tmpdir(), "xagt-analytics-"))
    try {
      const store = new MemoryStore(tempDir)
      const collector = new AnalyticsCollector(store)
      await collector.recordFixerFailure("编译错误：类型不匹配", "type_error")
      const events = await collector.query({ type: "fixer_failure" })
      expect(events.length).toBe(1)
      expect(events[0].summary).toContain("编译错误")
    } finally {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it("getStats 应返回按类型和标签分类的统计", async () => {
    const { AnalyticsCollector } = await import("../../src/analytics/collector")
    const { MemoryStore } = await import("../../src/memory/store")
    const tempDir = mkdtempSync(join(tmpdir(), "xagt-analytics-"))
    try {
      const store = new MemoryStore(tempDir)
      const collector = new AnalyticsCollector(store)
      await collector.recordJudgeRejection("Judge拒绝：日志格式不规范", "logrule")
      await collector.recordJudgeRejection("Judge拒绝：代码风格不合规", "style")
      await collector.recordJudgeRejection("Judge拒绝：日志格式不规范", "logrule")
      await collector.recordFixerFailure("测试失败：断言错误", "test")

      const stats = await collector.getStats()
      expect(stats.total).toBe(4)
      expect(stats.byType.judge_rejection).toBe(3)
      expect(stats.byType.fixer_failure).toBe(1)
      // logrule 是最多的拒绝原因（统计依据 tags.rule 标识符）
      expect(stats.topRejectionReasons[0].reason).toBe("logrule")
      expect(stats.topRejectionReasons[0].count).toBe(2)
    } finally {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it("无事件时 getStats 应返回空统计", async () => {
    const { AnalyticsCollector } = await import("../../src/analytics/collector")
    const { MemoryStore } = await import("../../src/memory/store")
    const tempDir = mkdtempSync(join(tmpdir(), "xagt-analytics-"))
    try {
      const store = new MemoryStore(tempDir)
      const collector = new AnalyticsCollector(store)
      const stats = await collector.getStats()
      expect(stats.total).toBe(0)
      expect(stats.byType).toEqual({})
      expect(stats.topRejectionReasons).toEqual([])
    } finally {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it("getReportForSmith 应返回格式化的分析摘要", async () => {
    const { AnalyticsCollector } = await import("../../src/analytics/collector")
    const { MemoryStore } = await import("../../src/memory/store")
    const tempDir = mkdtempSync(join(tmpdir(), "xagt-analytics-"))
    try {
      const store = new MemoryStore(tempDir)
      const collector = new AnalyticsCollector(store)
      await collector.recordJudgeRejection("日志前缀缺失", "logrule")
      await collector.recordJudgeRejection("文件路径错误", "path")
      await collector.recordFixerFailure("类型错误", "type")

      const report = await collector.getReportForSmith()
      expect(report).toContain("judge_rejection")
      expect(report).toContain("fixer_failure")
      expect(report).toContain("日志前缀缺失")
      expect(report).toContain("类型错误")
    } finally {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })
})
