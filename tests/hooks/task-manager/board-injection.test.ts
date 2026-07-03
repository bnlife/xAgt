/**
 * 看板注入测试
 *
 * 验证 experimental.chat.messages.transform 能把
 * 当前任务看板状态注入到 Vox 的消息流中。
 */
import { describe, it, expect } from "bun:test"

describe("看板状态注入", () => {
  // 测试1：有运行中任务时注入看板
  it("有运行中任务时，应该在消息中注入看板状态", async () => {
    const { createTaskManagerHook } = await import("../../../src/hooks/task-manager/index")
    const hook = createTaskManagerHook()

    await hook["tool.execute.before"]!(
      { tool: "task", sessionID: "ses_vox", callID: "call_1" } as any,
      { args: { subagent_type: "lynx", prompt: "查一下" } } as any,
    )

    const messages = [
      { info: { role: "user" as const }, parts: [{ type: "text" as const, text: "当前任务状态？" }] },
    ]

    await hook["experimental.chat.messages.transform"]!({} as any, { messages: messages as any })

    const parts = messages[messages.length - 1].parts
    const lastText = parts[parts.length - 1].text
    expect(lastText).toMatch(/lynx|运行中|后台任务|running/i)
  })

  // 测试2：空看板时不注入
  it("没有任务时，不应该注入看板信息", async () => {
    const { createTaskManagerHook } = await import("../../../src/hooks/task-manager/index")
    const hook = createTaskManagerHook()

    const messages = [
      { info: { role: "user" as const }, parts: [{ type: "text" as const, text: "你好" }] },
    ]

    const originalText = messages[0].parts[0].text
    await hook["experimental.chat.messages.transform"]!({} as any, { messages: messages as any })

    // 没任务时消息不应该被修改
    expect(messages[0].parts[0].text).toBe(originalText)
  })

  // 测试3：多个任务时全部列出
  it("多个任务时，看板应该列出所有任务状态", async () => {
    const { createTaskManagerHook } = await import("../../../src/hooks/task-manager/index")
    const hook = createTaskManagerHook()

    await hook["tool.execute.before"]!(
      { tool: "task", sessionID: "ses_vox", callID: "call_lynx" } as any,
      { args: { subagent_type: "lynx", prompt: "查一下" } } as any,
    )
    await hook["tool.execute.before"]!(
      { tool: "task", sessionID: "ses_vox", callID: "call_fixer" } as any,
      { args: { subagent_type: "fixer", prompt: "改代码" } } as any,
    )

    const messages = [
      { info: { role: "user" as const }, parts: [{ type: "text" as const, text: "任务列表" }] },
    ]

    await hook["experimental.chat.messages.transform"]!({} as any, { messages: messages as any })

    const parts = messages[messages.length - 1].parts
    const lastText = parts[parts.length - 1].text
    expect(lastText).toMatch(/call_lynx/)
    expect(lastText).toMatch(/call_fixer/)
    expect(lastText).toMatch(/lynx/)
    expect(lastText).toMatch(/fixer/)
  })
})
