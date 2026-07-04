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

  it("smith 的 prompt 应强调只读不写", async () => {
    const { getAgents } = await import("../../src/agents")
    const prompt = getAgents().smith.prompt
    expect(prompt).toMatch(/只读|不修改|不改文件|dont.*modify|no.*write/i)
  })

  it("smith 的 prompt 应提到审查 xAgt 源码", async () => {
    const { getAgents } = await import("../../src/agents")
    const prompt = getAgents().smith.prompt
    expect(prompt).toMatch(/xagt|harness|plugin|agent/i)
  })

  it("smith 的 prompt 长度应在 300-2000 字符之间", async () => {
    const { getAgents } = await import("../../src/agents")
    const len = getAgents().smith.prompt.length
    expect(len).toBeGreaterThan(300)
    expect(len).toBeLessThan(2000)
  })
})
