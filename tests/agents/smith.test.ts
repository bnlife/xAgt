import { describe, it, expect } from "bun:test"

// =========================================
// Smith Agent 定义测试
// =========================================
describe("Smith Agent", () => {
  it("getAgents() 应包含 smith", async () => {
    const { getAgents } = await import("../../src/agents")
    const agents = getAgents()
    expect(agents.smith).toBeDefined()
  })

  it("smith 的 mode 应为 subagent", async () => {
    const { getAgents } = await import("../../src/agents")
    expect(getAgents().smith.mode).toBe("subagent")
  })

  it("smith 的 description 应包含相关关键词", async () => {
    const { getAgents } = await import("../../src/agents")
    const desc = getAgents().smith.description
    const keywords = ["锐匠", "优化", "审查", "harness"]
    const hasAny = keywords.some(k => desc.includes(k))
    expect(hasAny).toBe(true)
  })

  it("smith 的 prompt 长度应在 300-2000 字符之间", async () => {
    const { getAgents } = await import("../../src/agents")
    const len = getAgents().smith.prompt.length
    expect(len).toBeGreaterThan(300)
    expect(len).toBeLessThan(2000)
  })

  it("Smith 的工具权限应禁止写操作", async () => {
    const { DEFAULT_POLICY } = await import("../../src/gateway/policy")
    const smithPolicy = DEFAULT_POLICY.agents.smith
    expect(smithPolicy).toBeDefined()
    expect(smithPolicy.tools.write).toBe("deny")
    expect(smithPolicy.tools.edit).toBe("deny")
    expect(smithPolicy.tools.bash).toBe("deny")
    // 应有 read 权限
    expect(smithPolicy.tools.read).toBe("allow")
  })

  it("AnalyticsCollector getReportForSmith 应返回非空摘要", async () => {
    const { MemoryStore } = await import("../../src/memory/store")
    const { AnalyticsCollector } = await import("../../src/analytics/collector")
    const { mkdtempSync, rmSync } = await import("fs")
    const { join } = await import("path")
    const { tmpdir } = await import("os")

    const tempDir = mkdtempSync(join(tmpdir(), "xagt-smith-test-"))
    try {
      const store = new MemoryStore(tempDir)
      const collector = new AnalyticsCollector(store)

      // 插入模拟事件
      await store.append({
        type: "lesson",
        content: JSON.stringify({ type: "judge_rejection", agent: "judge", summary: "test rejection", rule: "test" })
      })

      const report = await collector.getReportForSmith()
      expect(report).toBeTruthy()
      expect(typeof report).toBe("string")
      expect(report.length).toBeGreaterThan(10)
    } finally {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })
})
