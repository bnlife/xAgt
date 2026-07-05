/**
 * Agent 配置集成 E2E 测试
 *
 * 测试内容：
 * 1. 项目结构完整性
 * 2. 导出模块完整性
 * 3. package.json 配置正确性
 * 4. tsconfig.json 配置正确性
 */
import { describe, it, expect } from "bun:test"


// =========================================
// 测试 2：导出模块完整性
// 模拟用户：import 插件
// 期望：所有模块正确导出
// =========================================
describe("模块导出完整性", () => {
  it("src/index.ts 应该导出 xAgt", async () => {
    const mod = await import("../src/index")
    expect(mod.xAgt).toBeDefined()
  })

  it("src/agents/index.ts 应该导出 getAgents、AGENT_DESCRIPTIONS、AgentName", async () => {
    const mod = await import("../src/agents")
    expect(mod.getAgents).toBeDefined()
    expect(typeof mod.getAgents).toBe("function")
    expect(mod.AGENT_DESCRIPTIONS).toBeDefined()
  })

  it("src/agents/vox.ts 应该导出 createVoxAgent", async () => {
    const mod = await import("../src/agents/vox")
    expect(mod.createVoxAgent).toBeDefined()
    expect(typeof mod.createVoxAgent).toBe("function")
  })

  it("src/agents/lynx.ts 应该导出 createLynxAgent", async () => {
    const mod = await import("../src/agents/lynx")
    expect(mod.createLynxAgent).toBeDefined()
    expect(typeof mod.createLynxAgent).toBe("function")
  })

  it("src/agents/fixer.ts 应该导出 createFixerAgent", async () => {
    const mod = await import("../src/agents/fixer")
    expect(mod.createFixerAgent).toBeDefined()
    expect(typeof mod.createFixerAgent).toBe("function")
  })
})

// =========================================
// 测试 3：package.json 配置
// 模拟用户：查看 package.json
// 期望：各项配置正确
// =========================================
describe("package.json 配置", () => {
  it("name 应该为 xagt", async () => {
    const pkg = await import("../package.json")
    expect(pkg.name).toBe("xagt")
  })

  it("type 应该为 module", async () => {
    const pkg = await import("../package.json")
    expect(pkg.type).toBe("module")
  })

  it("应该包含 opencode-plugin 关键词", async () => {
    const pkg = await import("../package.json")
    expect(pkg.keywords).toContain("opencode-plugin")
  })

  it("应该包含 @opencode-ai/plugin 作为 peerDependencies", async () => {
    const pkg = await import("../package.json")
    expect(pkg.peerDependencies["@opencode-ai/plugin"]).toBeDefined()
  })
})


// =========================================
// 测试 5：思考模式配置验证
// Agent 的推理参数通过 chat.params hook 注入，
// 已在 tests/thinking-mode.test.ts 中覆盖测试。
// =========================================


