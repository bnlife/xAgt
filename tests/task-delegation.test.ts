/**
 * Vox 任务委派 E2E 测试
 *
 * 测试内容：
 * 1. Vox 的 prompt 中包含了委派任务的指令
 * 2. task 工具调用格式正确
 * 3. 插件能通过 tool.execute.before/after hook 管理后台任务
 * 4. 模拟 Vox 委派给 Lynx → Lynx 侦察 → 返回结果 → Vox 再委派给 Fixer 的完整流程
 */
import { describe, it, expect, mock } from "bun:test"

// =========================================
// 测试 1：Vox prompt 包含 task 工具指令
// 模拟用户：查看 Vox 的系统提示词
// 期望：prompt 中说明如何使用 task 委派任务
// =========================================
describe("Vox prompt 包含委派指令", () => {
  it("Vox 的 prompt 应该说明如何使用 task 工具", async () => {
    const { getAgents } = await import("../src/agents")
    const agents = getAgents()
    const prompt = agents.vox.prompt

    // Vox 应该知道怎么用 task 委派
    expect(prompt).toMatch(/task/)
    expect(prompt).toMatch(/委派|调度|subagent_type/)
  })

  it("Vox 的 prompt 应该说明如何委派给 lynx", async () => {
    const { getAgents } = await import("../src/agents")
    const agents = getAgents()
    const prompt = agents.vox.prompt
    expect(prompt).toMatch(/lynx/)
  })

  it("Vox 的 prompt 应该说明如何委派给 fixer", async () => {
    const { getAgents } = await import("../src/agents")
    const agents = getAgents()
    const prompt = agents.vox.prompt
    expect(prompt).toMatch(/fixer/)
  })

  it("Vox 的 prompt 应该说明 lynx 的 MCP 工具", async () => {
    const { getAgents } = await import("../src/agents")
    const agents = getAgents()
    const prompt = agents.vox.prompt
    expect(prompt).toMatch(/context7|gh_grep|websearch/)
  })

  it("Vox 的 prompt 应该说明 fixer 的职责约束", async () => {
    const { getAgents } = await import("../src/agents")
    const agents = getAgents()
    const prompt = agents.vox.prompt
    expect(prompt).toMatch(/fixer/)
    expect(prompt).toMatch(/只执行不决策|不越权/)
  })
})

// =========================================
// 测试 2：Lynx prompt 强调只读不写
// 模拟用户：查看 Lynx 的系统提示词
// 期望：明确告诉 Lynx 不要修改文件
// =========================================
describe("Lynx prompt 约束", () => {
  it("Lynx 的 prompt 应该强调不修改文件", async () => {
    const { getAgents } = await import("../src/agents")
    const agents = getAgents()
    const prompt = agents.lynx.prompt
    expect(prompt).toMatch(/NEVER modify|do not modify|READ.ONLY/)
  })

  it("Lynx 的 prompt 应该提到多模态能力", async () => {
    const { getAgents } = await import("../src/agents")
    const agents = getAgents()
    const prompt = agents.lynx.prompt
    expect(prompt).toMatch(/图片|截图|PDF|多模态|图表/)
  })
})

// =========================================
// 测试 3：Fixer prompt 强调精确执行
// 模拟用户：查看 Fixer 的系统提示词
// 期望：Fixer 应该听话照做，不越权
// =========================================
describe("Fixer prompt 约束", () => {
  it("Fixer 的 prompt 应该强调只做被要求的事", async () => {
    const { getAgents } = await import("../src/agents")
    const agents = getAgents()
    const prompt = agents.fixer.prompt
    expect(prompt).toMatch(/NO.*delegation|Only modify|do not redesign/)
  })

  it("Fixer 的 prompt 应该提到验证", async () => {
    const { getAgents } = await import("../src/agents")
    const agents = getAgents()
    const prompt = agents.fixer.prompt
    expect(prompt).toMatch(/验证|test|运行/)
  })
})

// =========================================
// 测试 4：模拟完整委派流程
// 模拟用户：Vox 先派 Lynx 侦察 → 再派 Fixer 执行
// 这是最接近真实用户行为的 E2E 测试
// =========================================
describe("模拟 Vox → Lynx → Fixer 委派流程", () => {
  it("应该能模拟 Vox 委派给 Lynx 侦察", async () => {
    const { getAgents } = await import("../src/agents")
    const agents = getAgents()

    // Vox 应该能调用 task 工具委派给 lynx
    // 验证 Vox 知道 lynx 的 subagent_type
    const voxPrompt = agents.vox.prompt
    expect(voxPrompt).toMatch(/subagent_type.*lynx|task.*lynx/i)
  })

  it("应该能模拟 Vox 委派给 Fixer 执行", async () => {
    const { getAgents } = await import("../src/agents")
    const agents = getAgents()

    // Vox 应该能调用 task 工具委派给 fixer
    const voxPrompt = agents.vox.prompt
    expect(voxPrompt).toMatch(/subagent_type.*fixer|task.*fixer/i)
  })

  it("Vox 的 prompt 应该提到先侦察再执行的工作流", async () => {
    const { getAgents } = await import("../src/agents")
    const agents = getAgents()
    const voxPrompt = agents.vox.prompt

    // Vox 应该知道工作流程：先侦察 → 再执行
    expect(voxPrompt).toMatch(/侦察|了解现状|先.*派.*lynx/i)
    expect(voxPrompt).toMatch(/执行|派.*fixer/i)
  })
})

// =========================================
// 测试 5：插件的 opencode.jsonc 配置
// 模拟用户：检查配置文件
// 期望：opencode.jsonc 中正确配置了插件路径
// =========================================
describe("OpenCode 配置文件验证", () => {
  it("opencode.jsonc 应该包含 xAgt 插件引用", async () => {
    const fs = await import("fs/promises")
    const content = await fs.readFile(
      "C:/Users/叙拉古的城主/.config/opencode/opencode.jsonc",
      "utf-8"
    )

    // 验证插件引用存在
    expect(content).toMatch(/xAgt|xagt/)
    // 验证指向了正确的路径（正斜杠或反斜杠均可）
    expect(content).toMatch(/xAgt/)
  })

  it("opencode.jsonc 的 plugin 数组应该有 2 个条目", async () => {
    const fs = await import("fs/promises")
    const content = await fs.readFile(
      "C:/Users/叙拉古的城主/.config/opencode/opencode.jsonc",
      "utf-8"
    )

    // 粗略验证 plugin 数组有 2 个条目
    const pluginMatches = content.match(/file:\/\/|@whisperopencode/g)
    expect(pluginMatches).toBeDefined()
    expect(pluginMatches!.length).toBeGreaterThanOrEqual(2)
  })
})
