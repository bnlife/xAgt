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
// 测试 1：项目结构完整性
// 模拟用户：克隆仓库 → 查看项目结构
// 期望：所有关键文件都存在
// =========================================
describe("项目结构完整性", () => {
  it("src/index.ts 应该存在", async () => {
    const fs = await import("fs/promises")
    const stat = await fs.stat("src/index.ts")
    expect(stat.isFile()).toBe(true)
  })

  it("src/agents/vox.ts 应该存在", async () => {
    const fs = await import("fs/promises")
    const stat = await fs.stat("src/agents/vox.ts")
    expect(stat.isFile()).toBe(true)
  })

  it("src/agents/lynx.ts 应该存在", async () => {
    const fs = await import("fs/promises")
    const stat = await fs.stat("src/agents/lynx.ts")
    expect(stat.isFile()).toBe(true)
  })

  it("src/agents/fixer.ts 应该存在", async () => {
    const fs = await import("fs/promises")
    const stat = await fs.stat("src/agents/fixer.ts")
    expect(stat.isFile()).toBe(true)
  })

  it("src/agents/index.ts 应该存在", async () => {
    const fs = await import("fs/promises")
    const stat = await fs.stat("src/agents/index.ts")
    expect(stat.isFile()).toBe(true)
  })

  it("dist/xagt.js 应该存在（编译产物）", async () => {
    const fs = await import("fs/promises")
    const stat = await fs.stat("dist/xagt.js")
    expect(stat.isFile()).toBe(true)
  })
})

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
// 测试 4：所有 Agent 的 prompt 完整性
// 模拟用户：查看 Agent 的思考方式
// 期望：每个 Agent 的 prompt 都覆盖了关键点
// =========================================
describe("Agent prompt 完整性", () => {
  it("Vox 的 prompt 应该覆盖所有关键点", async () => {
    const { getAgents } = await import("../src/agents")
    const prompt = getAgents().vox.prompt

    const checks = [
      "Role",
      "Workflow",
      "Delegation",
      "Communication",
      "@lynx",
      "@fixer",
      "三振出局",
      "后台任务看板",
    ]
    for (const check of checks) {
      expect(prompt).toMatch(new RegExp(check, "i"))
    }
  })

  it("Lynx 的 prompt 应该覆盖所有关键点", async () => {
    const { getAgents } = await import("../src/agents")
    const prompt = getAgents().lynx.prompt

    const checks = [
      "reconnaissance",
      "context7",
      "gh_grep",
      "NEVER modify",
    ]
    for (const check of checks) {
      expect(prompt).toMatch(new RegExp(check, "i"))
    }
  })

  it("Fixer 的 prompt 应该覆盖所有关键点", async () => {
    const { getAgents } = await import("../src/agents")
    const prompt = getAgents().fixer.prompt

    const checks = [
      "implementation specialist",
      "read",
      "edit",
      "write",
      "bash",
      "NO research",
    ]
    for (const check of checks) {
      expect(prompt).toMatch(new RegExp(check, "i"))
    }
  })

  it("每个 Agent 的 prompt 长度应该合理", async () => {
    const { getAgents } = await import("../src/agents")
    const agents = getAgents()
    for (const [name, agent] of Object.entries(agents)) {
      // prompt 应该在 200-10000 字之间
      expect(
        agent.prompt.length,
        `${name} 的 prompt 长度 ${agent.prompt.length} 不合理`
      ).toBeGreaterThan(200)
      expect(
        agent.prompt.length,
        `${name} 的 prompt 长度 ${agent.prompt.length} 不合理`
      ).toBeLessThan(10000)
    }
  })
})

// =========================================
// 测试 5：dist 产物验证
// 模拟用户：发布插件
// 期望：构建产物完整可加载
// =========================================
describe("构建产物验证", () => {
  it("dist/xagt.js 应该能被动态 import", async () => {
    const mod = await import("../dist/xagt.js")
    expect(mod.xAgt).toBeDefined()
    expect(typeof mod.xAgt).toBe("function")
  })

  it("dist/agents/index.js 应该能被动态 import", async () => {
    const mod = await import("../dist/agents/index.js")
    expect(mod.getAgents).toBeDefined()
    expect(mod.AGENT_DESCRIPTIONS).toBeDefined()
  })
})
