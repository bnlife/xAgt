/**
 * 思考模式 E2E 测试
 *
 * 测试内容：
 * 1. chat.params hook 是否正确注入 reasoning_effort
 * 2. API 实际请求验证
 */
import { describe, it, expect, beforeAll } from "bun:test"
import type { Plugin } from "@opencode-ai/plugin"

let xAgt: Plugin

beforeAll(async () => {
  const mod = await import("../src/index")
  xAgt = mod.xAgt
})

// =========================================
// 测试 1：chat.params hook 注入验证
// =========================================
describe("chat.params hook 注入验证", () => {
  it("Vox 的 reasoning_effort 应注入为 max", async () => {
    const hooks = await xAgt({} as any)! as any
    const output = { options: {} }
    await hooks["chat.params"]?.(
      { agent: "vox", sessionID: "", model: {} as any, provider: {} as any, message: {} as any },
      output,
    )
    expect(output.options.reasoning_effort).toBe("max")
    expect(output.options.thinking?.type).toBe("enabled")
  })

  it("Fixer 的 reasoning_effort 应注入为 high", async () => {
    const hooks = await xAgt({} as any)! as any
    const output = { options: {} }
    await hooks["chat.params"]?.(
      { agent: "fixer", sessionID: "", model: {} as any, provider: {} as any, message: {} as any },
      output,
    )
    expect(output.options.reasoning_effort).toBe("high")
    expect(output.options.thinking?.type).toBe("enabled")
  })

  it("Lynx 的 thinking 应注入为 disabled", async () => {
    const hooks = await xAgt({} as any)! as any
    const output = { options: {} }
    await hooks["chat.params"]?.(
      { agent: "lynx", sessionID: "", model: {} as any, provider: {} as any, message: {} as any },
      output,
    )
    expect(output.options.thinking?.type).toBe("disabled")
    expect(output.options.reasoning_effort).toBeUndefined()
  })

  it("未知 agent 不应注入任何参数", async () => {
    const hooks = await xAgt({} as any)! as any
    const output = { options: {} }
    await hooks["chat.params"]?.(
      { agent: "unknown", sessionID: "", model: {} as any, provider: {} as any, message: {} as any },
      output,
    )
    expect(output.options).toEqual({})
  })
})

// =========================================
// 测试 2：API 实际请求验证（集成测试）
// =========================================
describe("DeepSeek API 思考模式集成测试", () => {
  const apiKey = "sk-8e031985634945cfbb71bb516b9a6e9e"

  // 跳过条件：没有 API key
  const itIf = (condition: boolean) => condition ? it : it.skip

  itIf(!!apiKey)("Vox: reasoning_effort=max 应返回 reasoning_content", async () => {
    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "user", content: "9.11 和 9.8 哪个大？直接回答" },
        ],
        reasoning_effort: "max",
        extra_body: { thinking: { type: "enabled" } },
      }),
    })

    const data = await response.json() as any
    const message = data.choices?.[0]?.message

    console.log("Vox (max) 响应:", JSON.stringify({
      reasoning_content: message?.reasoning_content?.slice(0, 100),
      content: message?.content,
    }, null, 2))

    expect(response.status).toBe(200)
    expect(message?.reasoning_content).toBeDefined()
    expect(message?.reasoning_content?.length).toBeGreaterThan(0)
  })

  itIf(!!apiKey)("Fixer: reasoning_effort=high 应返回 reasoning_content", async () => {
    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "user", content: "实现一个快速排序，用 TypeScript" },
        ],
        reasoning_effort: "high",
        extra_body: { thinking: { type: "enabled" } },
      }),
    })

    const data = await response.json() as any
    const message = data.choices?.[0]?.message

    console.log("Fixer (high) 响应:", JSON.stringify({
      reasoning_content: message?.reasoning_content?.slice(0, 100),
      content: message?.content?.slice(0, 200),
    }, null, 2))

    expect(response.status).toBe(200)
    expect(message?.reasoning_content).toBeDefined()
    expect(message?.reasoning_content?.length).toBeGreaterThan(0)
  })

  itIf(!!apiKey)("Lynx: thinking=disabled 不应返回 reasoning_content", async () => {
    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "user", content: "搜索项目中所有 Vue 文件" },
        ],
        extra_body: { thinking: { type: "disabled" } },
      }),
    })

    const data = await response.json() as any
    const message = data.choices?.[0]?.message

    console.log("Lynx (disabled) 响应:", JSON.stringify({
      reasoning_content: message?.reasoning_content,
      content: message?.content?.slice(0, 200),
    }, null, 2))

    expect(response.status).toBe(200)
    // thinking 关闭时 reasoning_content 应为空或 undefined
    expect(message?.reasoning_content === undefined || message?.reasoning_content === null || message?.reasoning_content === "").toBe(true)
  })
})
