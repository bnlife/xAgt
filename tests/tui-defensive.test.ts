/**
 * xAgt TUI 防御性工具函数单元测试
 *
 * 测试 safeText、themeColor、safeAgentConfig、safeMcpList、splitModel 五个工具函数。
 * 这些是纯函数/纯逻辑，不依赖 JSX/TUI 环境，可单元测试。
 */
import { describe, it, expect } from "bun:test"

// =========================================
// 直接从源码复制工具函数（避免 import .tsx 的 JSX 编译问题）
// =========================================

function safeText(s: unknown, max = 28): string {
  if (s == null || typeof s !== "string") return ""
  return s.length <= max ? s : s.slice(0, max - 1) + "…"
}

function themeColor(t: Record<string, string> | undefined, key: string): string {
  if (!t) return ""
  return (t as Record<string, string>)[key] ?? t.textMuted ?? ""
}

interface MockState {
  config: Record<string, unknown>
  mcp: () => unknown
}

function safeAgentConfig(state: MockState): Record<string, Record<string, unknown>> {
  try {
    const c = (state.config as Record<string, unknown>)?.agent
    if (!c || typeof c !== "object") return {}
    return c as Record<string, Record<string, unknown>>
  } catch {
    return {}
  }
}

interface McpItem {
  name: string
  status: string
  error?: string
}

function safeMcpList(state: MockState): McpItem[] {
  try {
    const list = state.mcp()
    if (!Array.isArray(list)) return []
    return list as McpItem[]
  } catch {
    return []
  }
}

function splitModel(id: string): { p: string; m: string } {
  const i = id.indexOf("/")
  return i === -1 ? { p: "", m: id } : { p: id.slice(0, i), m: id.slice(i + 1) }
}

// =========================================
// 测试套件
// =========================================

describe("safeText()", () => {
  it("返回正常文本（未超长）", () => {
    expect(safeText("hello")).toBe("hello")
  })

  it("截断超长文本", () => {
    const long = "a".repeat(50)
    const result = safeText(long, 10)
    expect(result.length).toBe(10) // 9 字符 + 省略号
    expect(result.endsWith("…")).toBe(true)
  })

  it("处理 null", () => {
    expect(safeText(null)).toBe("")
  })

  it("处理 undefined", () => {
    expect(safeText(undefined)).toBe("")
  })

  it("处理非字符串类型（数字）", () => {
    expect(safeText(42)).toBe("")
  })

  it("处理非字符串类型（对象）", () => {
    expect(safeText({ foo: "bar" })).toBe("")
  })

  it("处理空字符串", () => {
    expect(safeText("")).toBe("")
  })

  it("使用默认 max=28", () => {
    const result = safeText("a".repeat(30))
    expect(result.length).toBe(28)
    expect(result.endsWith("…")).toBe(true)
  })
})

describe("themeColor()", () => {
  const theme = {
    accent: "#ff6600",
    text: "#ffffff",
    textMuted: "#888888",
    success: "#00ff00",
    error: "#ff0000",
  }

  it("返回存在的 key", () => {
    expect(themeColor(theme, "accent")).toBe("#ff6600")
  })

  it("不存在的 key 回退到 textMuted", () => {
    expect(themeColor(theme, "nonexistent")).toBe("#888888")
  })

  it("theme 为 undefined 返回空字符串", () => {
    expect(themeColor(undefined, "accent")).toBe("")
  })

  it("theme 为空对象，不存在的 key 返回空字符串", () => {
    expect(themeColor({}, "accent")).toBe("")
  })

  it("theme 有 textMuted 但不存在的 key 回退", () => {
    expect(themeColor({ textMuted: "#999" }, "accent")).toBe("#999")
  })
})

describe("splitModel()", () => {
  it("拆分标准 provider/model", () => {
    expect(splitModel("openai/gpt-4")).toEqual({ p: "openai", m: "gpt-4" })
  })

  it("没有斜杠时整个作为 model", () => {
    expect(splitModel("gpt-4")).toEqual({ p: "", m: "gpt-4" })
  })

  it("多斜杠只拆分第一个", () => {
    expect(splitModel("a/b/c")).toEqual({ p: "a", m: "b/c" })
  })

  it("空字符串", () => {
    expect(splitModel("")).toEqual({ p: "", m: "" })
  })

  it("只有斜杠", () => {
    expect(splitModel("/")).toEqual({ p: "", m: "" })
  })
})

describe("safeAgentConfig()", () => {
  it("返回正常的 agent 配置", () => {
    const state: MockState = {
      config: {
        agent: {
          vox: { model: "deepseek/deepseek-chat" },
          lynx: { model: "anthropic/claude-3" },
        },
      },
      mcp: () => [],
    }
    const result = safeAgentConfig(state)
    expect(result.vox).toBeDefined()
    expect((result.vox as Record<string, unknown>).model).toBe("deepseek/deepseek-chat")
    expect(result.lynx).toBeDefined()
  })

  it("config 中没有 agent 字段返回空对象", () => {
    const state: MockState = { config: {}, mcp: () => [] }
    expect(safeAgentConfig(state)).toEqual({})
  })

  it("agent 为 null 返回空对象", () => {
    const state: MockState = { config: { agent: null }, mcp: () => [] }
    expect(safeAgentConfig(state)).toEqual({})
  })

  it("agent 为非对象（字符串）返回空对象", () => {
    const state: MockState = { config: { agent: "oops" }, mcp: () => [] }
    expect(safeAgentConfig(state)).toEqual({})
  })
})

describe("safeMcpList()", () => {
  it("返回正常的 MCP 列表", () => {
    const state: MockState = {
      config: {},
      mcp: () => [
        { name: "context7", status: "connected" },
        { name: "gh_grep", status: "connected" },
      ],
    }
    const result = safeMcpList(state)
    expect(result.length).toBe(2)
    expect(result[0].name).toBe("context7")
    expect(result[1].status).toBe("connected")
  })

  it("mcp 返回非数组时返回空数组", () => {
    const state: MockState = { config: {}, mcp: () => null as unknown as McpItem[] }
    expect(safeMcpList(state)).toEqual([])
  })

  it("mcp 返回字符串时返回空数组", () => {
    const state: MockState = { config: {}, mcp: () => "oops" as unknown as McpItem[] }
    expect(safeMcpList(state)).toEqual([])
  })

  it("mcp() 抛出异常时返回空数组", () => {
    const state: MockState = {
      config: {},
      mcp: () => { throw new Error("mcp fail") },
    }
    expect(safeMcpList(state)).toEqual([])
  })

  it("空数组正常返回", () => {
    const state: MockState = { config: {}, mcp: () => [] }
    expect(safeMcpList(state)).toEqual([])
  })
})
