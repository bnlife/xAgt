import { describe, it, expect } from "bun:test"

// =========================================
// 测试 1：resolveAgentFromSession
// 验证从 sessionID 解析 agent 名称
// =========================================
describe("resolveAgentFromSession", () => {
  it("\"vox-abc123\" 应解析为 \"vox\"", async () => {
    const { resolveAgentFromSession } = await import("../../src/gateway/interceptor")
    expect(resolveAgentFromSession("vox-abc123")).toBe("vox")
  })

  it("\"lynx/session/xyz\" 应解析为 \"lynx\"", async () => {
    const { resolveAgentFromSession } = await import("../../src/gateway/interceptor")
    expect(resolveAgentFromSession("lynx/session/xyz")).toBe("lynx")
  })

  it("\"fixer_001\" 应解析为 \"fixer\"", async () => {
    const { resolveAgentFromSession } = await import("../../src/gateway/interceptor")
    expect(resolveAgentFromSession("fixer_001")).toBe("fixer")
  })

  it("\"unknown\" 应原样返回 \"unknown\"", async () => {
    const { resolveAgentFromSession } = await import("../../src/gateway/interceptor")
    expect(resolveAgentFromSession("unknown")).toBe("unknown")
  })

  it("空字符串应返回空字符串", async () => {
    const { resolveAgentFromSession } = await import("../../src/gateway/interceptor")
    expect(resolveAgentFromSession("")).toBe("")
  })

  it("大小写不敏感：\"Vox-main\" 应解析为 \"vox\"", async () => {
    const { resolveAgentFromSession } = await import("../../src/gateway/interceptor")
    expect(resolveAgentFromSession("Vox-main")).toBe("vox")
  })

  it("纯 agent 名：\"fixer\" 应返回 \"fixer\"", async () => {
    const { resolveAgentFromSession } = await import("../../src/gateway/interceptor")
    expect(resolveAgentFromSession("fixer")).toBe("fixer")
  })

  it("纯数字 sessionID \"12345\" 应返回 \"\"（无法解析为 agent）", async () => {
    const { resolveAgentFromSession } = await import("../../src/gateway/interceptor")
    expect(resolveAgentFromSession("12345")).toBe("")
  })

  it("特殊字符 sessionID 应返回 \"\"（无法解析为 agent）", async () => {
    const { resolveAgentFromSession } = await import("../../src/gateway/interceptor")
    expect(resolveAgentFromSession("!@#$%")).toBe("")
  })
})

// =========================================
// 测试 2：ToolGateway.check — 放行场景
// =========================================
describe("ToolGateway.check — 放行", () => {
  it("Vox 调 task 应放行", async () => {
    const { ToolGateway } = await import("../../src/gateway/interceptor")
    const gateway = new ToolGateway()
    const result = gateway.check("vox", "task")
    expect(result.allow).toBe(true)
    expect(result.reason).toBeUndefined()
  })

  it("Fixer 调 read 应放行", async () => {
    const { ToolGateway } = await import("../../src/gateway/interceptor")
    const gateway = new ToolGateway()
    expect(gateway.check("fixer", "read").allow).toBe(true)
  })

  it("Fixer 调 write 应放行", async () => {
    const { ToolGateway } = await import("../../src/gateway/interceptor")
    const gateway = new ToolGateway()
    expect(gateway.check("fixer", "write").allow).toBe(true)
  })

  it("Fixer 调 edit 应放行", async () => {
    const { ToolGateway } = await import("../../src/gateway/interceptor")
    const gateway = new ToolGateway()
    expect(gateway.check("fixer", "edit").allow).toBe(true)
  })

  it("Fixer 调 bash（安全命令）应放行", async () => {
    const { ToolGateway } = await import("../../src/gateway/interceptor")
    const gateway = new ToolGateway()
    const result = gateway.check("fixer", "bash", "echo hello")
    expect(result.allow).toBe(true)
  })

  it("Fixer 调 bash（npm test）应放行", async () => {
    const { ToolGateway } = await import("../../src/gateway/interceptor")
    const gateway = new ToolGateway()
    const result = gateway.check("fixer", "bash", "npm run test")
    expect(result.allow).toBe(true)
  })

  it("Lynx 调 read 应放行", async () => {
    const { ToolGateway } = await import("../../src/gateway/interceptor")
    const gateway = new ToolGateway()
    expect(gateway.check("lynx", "read").allow).toBe(true)
  })

  it("Lynx 调 grep 应放行", async () => {
    const { ToolGateway } = await import("../../src/gateway/interceptor")
    const gateway = new ToolGateway()
    expect(gateway.check("lynx", "grep").allow).toBe(true)
  })

  it("Lynx 调 glob 应放行", async () => {
    const { ToolGateway } = await import("../../src/gateway/interceptor")
    const gateway = new ToolGateway()
    expect(gateway.check("lynx", "glob").allow).toBe(true)
  })

  it("Lynx 调 context7_query-docs 应放行", async () => {
    const { ToolGateway } = await import("../../src/gateway/interceptor")
    const gateway = new ToolGateway()
    expect(gateway.check("lynx", "context7_query-docs").allow).toBe(true)
  })

  it("Lynx 调 gh_grep_searchGitHub 应放行", async () => {
    const { ToolGateway } = await import("../../src/gateway/interceptor")
    const gateway = new ToolGateway()
    expect(gateway.check("lynx", "gh_grep_searchGitHub").allow).toBe(true)
  })

  it("Lynx 调 webfetch 应放行", async () => {
    const { ToolGateway } = await import("../../src/gateway/interceptor")
    const gateway = new ToolGateway()
    expect(gateway.check("lynx", "webfetch").allow).toBe(true)
  })

  it("Judge 调 read 应放行", async () => {
    const { ToolGateway } = await import("../../src/gateway/interceptor")
    const gateway = new ToolGateway()
    expect(gateway.check("judge", "read").allow).toBe(true)
  })

  it("Judge 调 grep 应放行", async () => {
    const { ToolGateway } = await import("../../src/gateway/interceptor")
    const gateway = new ToolGateway()
    expect(gateway.check("judge", "grep").allow).toBe(true)
  })

  it("Judge 调 glob 应放行", async () => {
    const { ToolGateway } = await import("../../src/gateway/interceptor")
    const gateway = new ToolGateway()
    expect(gateway.check("judge", "glob").allow).toBe(true)
  })

  it("Smith 调 read 应放行", async () => {
    const { ToolGateway } = await import("../../src/gateway/interceptor")
    const gateway = new ToolGateway()
    expect(gateway.check("smith", "read").allow).toBe(true)
  })

  it("Smith 调 grep 应放行", async () => {
    const { ToolGateway } = await import("../../src/gateway/interceptor")
    const gateway = new ToolGateway()
    expect(gateway.check("smith", "grep").allow).toBe(true)
  })

  it("Smith 调 glob 应放行", async () => {
    const { ToolGateway } = await import("../../src/gateway/interceptor")
    const gateway = new ToolGateway()
    expect(gateway.check("smith", "glob").allow).toBe(true)
  })
})

// =========================================
// 测试 3：ToolGateway.check — 拦截场景
// =========================================
describe("ToolGateway.check — 拦截", () => {
  it("Vox 调 read 应放行（policy 已改为 allow）", async () => {
    const { ToolGateway } = await import("../../src/gateway/interceptor")
    const gateway = new ToolGateway()
    const result = gateway.check("vox", "read")
    expect(result.allow).toBe(true)
  })

  it("Vox 调 write 应拦截", async () => {
    const { ToolGateway } = await import("../../src/gateway/interceptor")
    const gateway = new ToolGateway()
    expect(gateway.check("vox", "write").allow).toBe(false)
  })

  it("Vox 调 bash 应拦截", async () => {
    const { ToolGateway } = await import("../../src/gateway/interceptor")
    const gateway = new ToolGateway()
    expect(gateway.check("vox", "bash").allow).toBe(false)
  })

  it("Vox 调 grep 应拦截", async () => {
    const { ToolGateway } = await import("../../src/gateway/interceptor")
    const gateway = new ToolGateway()
    expect(gateway.check("vox", "grep").allow).toBe(false)
  })

  it("Vox 调 apply_diff 应拦截", async () => {
    const { ToolGateway } = await import("../../src/gateway/interceptor")
    const gateway = new ToolGateway()
    expect(gateway.check("vox", "apply_diff").allow).toBe(false)
  })

  it("Lynx 调 write 应拦截", async () => {
    const { ToolGateway } = await import("../../src/gateway/interceptor")
    const gateway = new ToolGateway()
    expect(gateway.check("lynx", "write").allow).toBe(false)
  })

  it("Lynx 调 bash 应放行（只读命令）", async () => {
    const { ToolGateway } = await import("../../src/gateway/interceptor")
    const gateway = new ToolGateway()
    expect(gateway.check("lynx", "bash").allow).toBe(true)
  })

  it("Lynx 调 edit 应拦截", async () => {
    const { ToolGateway } = await import("../../src/gateway/interceptor")
    const gateway = new ToolGateway()
    expect(gateway.check("lynx", "edit").allow).toBe(false)
  })

  it("Judge 调 write 应拦截", async () => {
    const { ToolGateway } = await import("../../src/gateway/interceptor")
    const gateway = new ToolGateway()
    expect(gateway.check("judge", "write").allow).toBe(false)
  })

  it("Judge 调 bash 应拦截", async () => {
    const { ToolGateway } = await import("../../src/gateway/interceptor")
    const gateway = new ToolGateway()
    expect(gateway.check("judge", "bash").allow).toBe(false)
  })

  it("Judge 调 edit 应拦截", async () => {
    const { ToolGateway } = await import("../../src/gateway/interceptor")
    const gateway = new ToolGateway()
    expect(gateway.check("judge", "edit").allow).toBe(false)
  })

  it("Smith 调 write 应拦截", async () => {
    const { ToolGateway } = await import("../../src/gateway/interceptor")
    const gateway = new ToolGateway()
    expect(gateway.check("smith", "write").allow).toBe(false)
  })

  it("Smith 调 bash 应拦截", async () => {
    const { ToolGateway } = await import("../../src/gateway/interceptor")
    const gateway = new ToolGateway()
    expect(gateway.check("smith", "bash").allow).toBe(false)
  })

  it("Smith 调 edit 应拦截", async () => {
    const { ToolGateway } = await import("../../src/gateway/interceptor")
    const gateway = new ToolGateway()
    expect(gateway.check("smith", "edit").allow).toBe(false)
  })
})

// =========================================
// 测试 4：ToolGateway.check — 危险命令拦截
// =========================================
describe("ToolGateway — 危险命令检测", () => {
  it("Fixer 调 bash 含 \"rm -rf /\" 应拦截", async () => {
    const { ToolGateway } = await import("../../src/gateway/interceptor")
    const gateway = new ToolGateway()
    const result = gateway.check("fixer", "bash", "rm -rf /")
    expect(result.allow).toBe(false)
    expect(result.reason).toMatch(/递归删除|禁止/i)
  })

  it("Fixer 调 bash 含 \"rm -rf ./node_modules\" 应拦截", async () => {
    const { ToolGateway } = await import("../../src/gateway/interceptor")
    const gateway = new ToolGateway()
    const result = gateway.check("fixer", "bash", "rm -rf ./node_modules")
    expect(result.allow).toBe(false)
  })

  it("Fixer 调 bash 不含 args（undefined）不应拦截", async () => {
    const { ToolGateway } = await import("../../src/gateway/interceptor")
    const gateway = new ToolGateway()
    const result = gateway.check("fixer", "bash", undefined)
    expect(result.allow).toBe(true)
  })

  it("Fixer 调 bash args 为 null 不应拦截", async () => {
    const { ToolGateway } = await import("../../src/gateway/interceptor")
    const gateway = new ToolGateway()
    const result = gateway.check("fixer", "bash", null)
    expect(result.allow).toBe(true)
  })

  it("bash args 为 { command: \"rm -rf /\" } 应拦截", async () => {
    const { ToolGateway } = await import("../../src/gateway/interceptor")
    const gateway = new ToolGateway()
    const result = gateway.check("fixer", "bash", { command: "rm -rf /" })
    expect(result.allow).toBe(false)
  })

  it("bash args 为 { command: \"npm test\" } 应放行", async () => {
    const { ToolGateway } = await import("../../src/gateway/interceptor")
    const gateway = new ToolGateway()
    const result = gateway.check("fixer", "bash", { command: "npm test" })
    expect(result.allow).toBe(true)
  })
})

// =========================================
// 测试 5：ToolGateway.check — 未知 Agent
// 未知 Agent 的所有工具应被拦截（安全默认）
// =========================================
describe("ToolGateway.check — 未知 Agent", () => {
  it("未知 Agent 调 read 应拦截", async () => {
    const { ToolGateway } = await import("../../src/gateway/interceptor")
    const gateway = new ToolGateway()
    expect(gateway.check("unknown_agent", "read").allow).toBe(false)
  })

  it("未知 Agent 调 task 应拦截", async () => {
    const { ToolGateway } = await import("../../src/gateway/interceptor")
    const gateway = new ToolGateway()
    expect(gateway.check("unknown_agent", "task").allow).toBe(false)
  })
})

// =========================================
// 测试 6：ToolGateway — 自定义配置
// 允许传入自定义 GatewayConfig 覆盖默认策略
// =========================================
describe("ToolGateway — 自定义配置", () => {
  it("可传入自定义策略覆盖默认行为", async () => {
    const { ToolGateway } = await import("../../src/gateway/interceptor")
    const customConfig = {
      agents: {
        customAgent: {
          tools: { read: "allow", write: "deny" },
        },
      },
    }
    const gateway = new ToolGateway(customConfig)
    expect(gateway.check("customAgent", "read").allow).toBe(true)
    expect(gateway.check("customAgent", "write").allow).toBe(false)
  })

  it("自定义策略中的未知 Agent 仍应拦截", async () => {
    const { ToolGateway } = await import("../../src/gateway/interceptor")
    const gateway = new ToolGateway({ agents: {} })
    expect(gateway.check("anyone", "read").allow).toBe(false)
  })
})
