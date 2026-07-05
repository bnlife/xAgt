import { describe, it, expect } from "bun:test"

describe("SessionAgentRegistry", () => {
  it("register + resolve 应正确建立映射", async () => {
    const { SessionAgentRegistry } = await import("../../src/gateway/session-registry")
    const reg = new SessionAgentRegistry()
    reg.register("ses_abc123", "vox")
    expect(reg.resolve("ses_abc123")).toBe("vox")
  })

  it("未注册的 ses_xxx 应被前缀兜底，返回 \"ses\"", async () => {
    const { SessionAgentRegistry } = await import("../../src/gateway/session-registry")
    const reg = new SessionAgentRegistry()
    // 兜底走 resolveAgentFromSession，ses_xxx 会抓出 "ses"
    expect(reg.resolve("ses_unknown")).toBe("ses")
  })

  it("已注册的映射应优先于前缀解析", async () => {
    const { SessionAgentRegistry } = await import("../../src/gateway/session-registry")
    const reg = new SessionAgentRegistry()
    // "fixer-001" 前缀解析得 "fixer"，但若注册成别的应以注册为准
    reg.register("fixer-001", "vox")
    expect(reg.resolve("fixer-001")).toBe("vox")
  })

  it("register 时 agent 名应小写化", async () => {
    const { SessionAgentRegistry } = await import("../../src/gateway/session-registry")
    const reg = new SessionAgentRegistry()
    reg.register("ses_xyz", "VOX")
    expect(reg.resolve("ses_xyz")).toBe("vox")
  })

  it("空 sessionID 或空 agent 名应忽略", async () => {
    const { SessionAgentRegistry } = await import("../../src/gateway/session-registry")
    const reg = new SessionAgentRegistry()
    reg.register("", "vox")
    reg.register("ses_x", "")
    expect(reg.resolve("")).toBe("")
  })

  it("Vox 用 ses_xxx sessionID 应能被正确识别（根因验证）", async () => {
    const { SessionAgentRegistry } = await import("../../src/gateway/session-registry")
    const reg = new SessionAgentRegistry()
    // 模拟 chat.params hook 触发
    reg.register("ses_0ceaffb53ffeP8F65UgvvOzswi", "vox")
    // 模拟 tool.execute.before hook 触发
    expect(reg.resolve("ses_0ceaffb53ffeP8F65UgvvOzswi")).toBe("vox")
  })

  it("clear 应清除所有映射", async () => {
    const { SessionAgentRegistry } = await import("../../src/gateway/session-registry")
    const reg = new SessionAgentRegistry()
    reg.register("ses_a", "vox")
    reg.clear()
    expect(reg.resolve("ses_a")).toBe("ses")
  })
})
