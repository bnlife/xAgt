import { describe, it, expect } from "bun:test"

// =========================================
// 测试 1：策略完整性
// 验证 DEFAULT_POLICY 包含所有预期的 Agent 和工具权限
// =========================================
describe("DEFAULT_POLICY 完整性", () => {
  it("应包含全部 5 个 Agent（vox/lynx/fixer/judge/smith）", async () => {
    const { DEFAULT_POLICY } = await import("../../src/gateway/policy")
    const agents = Object.keys(DEFAULT_POLICY.agents)
    expect(agents.sort()).toEqual(["fixer", "judge", "lynx", "smith", "vox"])
  })

  it("每个 Agent 的策略都应包含 tools 字段", async () => {
    const { DEFAULT_POLICY } = await import("../../src/gateway/policy")
    for (const [name, policy] of Object.entries(DEFAULT_POLICY.agents)) {
      expect(policy.tools, `${name} 缺少 tools 字段`).toBeDefined()
      expect(typeof policy.tools, `${name} 的 tools 应为对象`).toBe("object")
    }
  })
})

// =========================================
// 测试 2：Vox 权限
// Vox 只允许 task，其他工具全部 deny
// =========================================
describe("Vox 工具权限", () => {
  it("task 应标记为 allow", async () => {
    const { DEFAULT_POLICY } = await import("../../src/gateway/policy")
    expect(DEFAULT_POLICY.agents.vox.tools.task).toBe("allow")
  })

  it("read 应标记为 allow，write/edit/bash/grep/glob/apply_diff 应标记为 deny", async () => {
    const { DEFAULT_POLICY } = await import("../../src/gateway/policy")
    expect(DEFAULT_POLICY.agents.vox.tools.read, "Vox 的 read 应为 allow").toBe("allow")
    const blocked = ["write", "edit", "bash", "grep", "glob", "apply_diff"]
    for (const tool of blocked) {
      expect(DEFAULT_POLICY.agents.vox.tools[tool], `Vox 的 ${tool} 应为 deny`).toBe("deny")
    }
  })

  it("未显式列出的工具应默认不存在于 tools 中（默认 deny）", async () => {
    const { DEFAULT_POLICY } = await import("../../src/gateway/policy")
    // Vox 的 tools 应含 task/read/skill/todowrite/write/edit/bash/grep/glob/apply_diff 共 10 个
    const toolCount = Object.keys(DEFAULT_POLICY.agents.vox.tools).length
    expect(toolCount).toBe(10)
  })

  it("不应包含 dangerRules", async () => {
    const { DEFAULT_POLICY } = await import("../../src/gateway/policy")
    expect(DEFAULT_POLICY.agents.vox.dangerRules).toBeUndefined()
  })
})

// =========================================
// 测试 3：Lynx 权限
// Lynx 允许只读工具，禁止写和执行工具
// =========================================
describe("Lynx 工具权限", () => {
  it("read/grep/glob/context7/gh_grep/webfetch 应标记为 allow", async () => {
    const { DEFAULT_POLICY } = await import("../../src/gateway/policy")
    const allowed = ["read", "grep", "glob", "context7_query-docs", "context7_resolve-library-id", "gh_grep_searchGitHub", "webfetch"]
    for (const tool of allowed) {
      expect(DEFAULT_POLICY.agents.lynx.tools[tool], `Lynx 的 ${tool} 应为 allow`).toBe("allow")
    }
  })

  it("write/edit 应标记为 deny，bash 已改为 allow", async () => {
    const { DEFAULT_POLICY } = await import("../../src/gateway/policy")
    const blocked = ["write", "edit"]
    for (const tool of blocked) {
      expect(DEFAULT_POLICY.agents.lynx.tools[tool], `Lynx 的 ${tool} 应为 deny`).toBe("deny")
    }
    expect(DEFAULT_POLICY.agents.lynx.tools.bash, "Lynx 的 bash 应为 allow（读命令）").toBe("allow")
  })

  it("不应包含 dangerRules", async () => {
    const { DEFAULT_POLICY } = await import("../../src/gateway/policy")
    expect(DEFAULT_POLICY.agents.lynx.dangerRules).toBeUndefined()
  })
})

// =========================================
// 测试 4：Fixer 权限
// Fixer 允许读/写/编辑/bash，并有 dangerRules
// =========================================
describe("Fixer 工具权限", () => {
  it("read/write/edit/bash 应标记为 allow", async () => {
    const { DEFAULT_POLICY } = await import("../../src/gateway/policy")
    const allowed = ["read", "write", "edit", "bash"]
    for (const tool of allowed) {
      expect(DEFAULT_POLICY.agents.fixer.tools[tool], `Fixer 的 ${tool} 应为 allow`).toBe("allow")
    }
  })

  it("应包含 dangerRules 且至少含 rm -rf 规则", async () => {
    const { DEFAULT_POLICY } = await import("../../src/gateway/policy")
    const rules = DEFAULT_POLICY.agents.fixer.dangerRules
    expect(rules).toBeDefined()
    expect(rules!.length).toBeGreaterThan(0)

    const hasRmRf = rules!.some(r => r.pattern instanceof RegExp && r.reason.includes("递归删除"))
    expect(hasRmRf, "dangerRules 应包含 rm -rf 检测规则").toBe(true)
  })

  it("每条 dangerRule 都应包含 pattern 和 reason 字段", async () => {
    const { DEFAULT_POLICY } = await import("../../src/gateway/policy")
    for (const rule of DEFAULT_POLICY.agents.fixer.dangerRules!) {
      expect(rule.pattern).toBeInstanceOf(RegExp)
      expect(typeof rule.reason).toBe("string")
      expect(rule.reason.length).toBeGreaterThan(0)
    }
  })
})

// =========================================
// 测试 5：Judge 权限
// Judge 允许只读工具，禁止写和执行
// =========================================
describe("Judge 工具权限", () => {
  it("read/grep/glob 应标记为 allow", async () => {
    const { DEFAULT_POLICY } = await import("../../src/gateway/policy")
    const allowed = ["read", "grep", "glob"]
    for (const tool of allowed) {
      expect(DEFAULT_POLICY.agents.judge.tools[tool], `Judge 的 ${tool} 应为 allow`).toBe("allow")
    }
  })

  it("write/edit/bash 应标记为 deny", async () => {
    const { DEFAULT_POLICY } = await import("../../src/gateway/policy")
    const blocked = ["write", "edit", "bash"]
    for (const tool of blocked) {
      expect(DEFAULT_POLICY.agents.judge.tools[tool], `Judge 的 ${tool} 应为 deny`).toBe("deny")
    }
  })

  it("不应包含 dangerRules", async () => {
    const { DEFAULT_POLICY } = await import("../../src/gateway/policy")
    expect(DEFAULT_POLICY.agents.judge.dangerRules).toBeUndefined()
  })
})

// =========================================
// 测试 6：Smith 权限
// Smith 允许只读工具，禁止写和执行
// =========================================
describe("Smith 工具权限", () => {
  it("read/grep/glob 应标记为 allow", async () => {
    const { DEFAULT_POLICY } = await import("../../src/gateway/policy")
    const allowed = ["read", "grep", "glob"]
    for (const tool of allowed) {
      expect(DEFAULT_POLICY.agents.smith.tools[tool], `Smith 的 ${tool} 应为 allow`).toBe("allow")
    }
  })

  it("write/edit/bash 应标记为 deny", async () => {
    const { DEFAULT_POLICY } = await import("../../src/gateway/policy")
    const blocked = ["write", "edit", "bash"]
    for (const tool of blocked) {
      expect(DEFAULT_POLICY.agents.smith.tools[tool], `Smith 的 ${tool} 应为 deny`).toBe("deny")
    }
  })

  it("不应包含 dangerRules", async () => {
    const { DEFAULT_POLICY } = await import("../../src/gateway/policy")
    expect(DEFAULT_POLICY.agents.smith.dangerRules).toBeUndefined()
  })
})

// =========================================
// 测试 7：类型验证
// 验证类型定义是否正确
// =========================================
describe("类型定义", () => {
  it("ToolPermission 类型应接受 allow 和 deny", async () => {
    const { DEFAULT_POLICY } = await import("../../src/gateway/policy")
    const allTools = [
      ...Object.values(DEFAULT_POLICY.agents.vox.tools),
      ...Object.values(DEFAULT_POLICY.agents.lynx.tools),
      ...Object.values(DEFAULT_POLICY.agents.fixer.tools),
    ]
    for (const perm of allTools) {
      expect(["allow", "deny"]).toContain(perm)
    }
  })
})
