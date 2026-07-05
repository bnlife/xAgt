/**
 * xAgt 插件加载 E2E 测试
 *
 * 测试内容：
 * 1. 插件入口能正常导出
 * 2. 插件注册了 3 个 Agent：vox、lynx、fixer
 * 3. 每个 Agent 有正确的 description、model、prompt
 * 4. 禁用 Agent 后不会出现在注册列表
 * 5. 插件上下文传入后能正常初始化
 */
import { describe, it, expect, mock } from "bun:test"

// =========================================
// 测试 1：插件入口导出
// 模拟用户：npm install xAgt → import 插件
// 期望：能拿到 xAgt 函数，类型正确
// =========================================
describe("插件入口导出", () => {
  it("应该导出 xAgt 插件函数", async () => {
    const mod = await import("../src/index")
    expect(mod.xAgt).toBeDefined()
    expect(typeof mod.xAgt).toBe("function")
  })
})

// =========================================
// 测试 2：Agent 注册
// 模拟用户：启动 OpenCode → 插件注册 Agent
// 期望：vox、lynx、fixer 三个 Agent 都存在
// =========================================
describe("Agent 注册 - getAgents()", () => {
  it("默认注册 5 个 Agent：vox、lynx、fixer、judge、smith", async () => {
    const { getAgents } = await import("../src/agents")
    const agents = getAgents()

    // 验证有 5 个 Agent
    const agentNames = Object.keys(agents)
    expect(agentNames.length).toBe(5)
    expect(agentNames).toContain("vox")
    expect(agentNames).toContain("lynx")
    expect(agentNames).toContain("fixer")
    expect(agentNames).toContain("judge")
    expect(agentNames).toContain("smith")
    expect(agents.smith).toBeDefined()
  })

  it("每个 Agent 都有 description 和 prompt", async () => {
    const { getAgents } = await import("../src/agents")
    const agents = getAgents()

    for (const [name, agent] of Object.entries(agents)) {
      expect(agent.description).toBeDefined()
      expect(typeof agent.description).toBe("string")
      expect(agent.description.length).toBeGreaterThan(0)

      

      expect(agent.prompt).toBeDefined()
      expect(typeof agent.prompt).toBe("string")
      expect(agent.prompt.length).toBeGreaterThan(100)
    }
  })

})

// =========================================
// 测试 3：禁用 Agent
// 模拟用户：在配置中禁用某个 Agent
// 期望：被禁用的 Agent 不出现在注册列表
// =========================================
describe("Agent 禁用 - getAgents(disabled)", () => {
  it("禁用 lynx 后，agent 列表只有 3 个", async () => {
    const { getAgents } = await import("../src/agents")
    const agents = getAgents(["lynx"])
    const agentNames = Object.keys(agents)
    expect(agentNames.length).toBe(4)
    expect(agentNames).not.toContain("lynx")
    expect(agentNames).toContain("vox")
    expect(agentNames).toContain("fixer")
    expect(agentNames).toContain("judge")
    expect(agentNames).toContain("smith")
  })

  it("禁用所有 Agent 后，列表为空", async () => {
    const { getAgents } = await import("../src/agents")
    const agents = getAgents(["vox", "lynx", "fixer", "judge", "smith"])
    expect(Object.keys(agents).length).toBe(0)
  })
})

// =========================================
// 测试 4：AGENT_DESCRIPTIONS 常量
// 模拟用户：查看 Agent 列表
// 期望：每个 Agent 都有对应的中文描述
// =========================================
describe("AGENT_DESCRIPTIONS 常量", () => {
  it("应该包含 5 个 Agent 的描述", async () => {
    const { AGENT_DESCRIPTIONS } = await import("../src/agents")
    expect(AGENT_DESCRIPTIONS.vox).toBeDefined()
    expect(AGENT_DESCRIPTIONS.lynx).toBeDefined()
    expect(AGENT_DESCRIPTIONS.fixer).toBeDefined()
    expect(AGENT_DESCRIPTIONS.judge).toBeDefined()
    expect(AGENT_DESCRIPTIONS.smith).toBeDefined()
    expect(Object.keys(AGENT_DESCRIPTIONS).length).toBe(5)
  })

  it("每个描述都是非空字符串", async () => {
    const { AGENT_DESCRIPTIONS } = await import("../src/agents")
    for (const desc of Object.values(AGENT_DESCRIPTIONS)) {
      expect(desc.length).toBeGreaterThan(0)
    }
  })
})

// =========================================
// 测试 5：插件初始化（模拟 OpenCode 上下文）
// 模拟用户：OpenCode 启动 → 加载插件
// 期望：插件能正常初始化，不报错
// =========================================
describe("插件初始化", () => {
  it("传入 mock 上下文后，插件应该返回 config hook", async () => {
    const { xAgt } = await import("../src/index")

    const mockCtx = {
      project: { name: "test-project" },
      directory: "/test/dir",
      worktree: "",
      client: {},
      $: {},
    }

    const hooks = await xAgt(mockCtx as any)
    expect(hooks).toBeDefined()
    expect(typeof hooks.config).toBe("function")

    // 调用 config hook 后，config.agent 应该包含 3 个 Agent
    const config: any = { agent: {} }
    await hooks.config(config)
    expect(config.agent.vox).toBeDefined()
    expect(config.agent.lynx).toBeDefined()
    expect(config.agent.fixer).toBeDefined()
    expect(config.agent.vox.mode).toBe("primary")
    expect(config.agent.lynx.mode).toBe("subagent")
    expect(config.agent.fixer.mode).toBe("subagent")
    expect(config.agent.judge).toBeDefined()
  })
})
