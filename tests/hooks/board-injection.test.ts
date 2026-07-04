import { describe, it, expect } from "bun:test"

describe("看板状态注入", () => {
  it("有 running 任务时注入看板", async () => {
    const { createTaskManagerHook } = await import("../../src/hooks")
    const hook = createTaskManagerHook()
    await hook["tool.execute.before"]!(
      { tool: "task", sessionID: "ses_vox", callID: "call_1" } as any,
      { args: { subagent_type: "lynx", prompt: "查一下" } } as any,
    )
    const messages = [{ info: { role: "user" }, parts: [{ type: "text", text: "你好" }] }]
    await hook["experimental.chat.messages.transform"]!({} as any, { messages: messages as any })
    const lastText = messages[messages.length - 1].parts[messages[messages.length - 1].parts.length - 1].text
    expect(lastText).toMatch(/后台任务看板|@lynx/)
  })

  it("没有活动任务时不注入", async () => {
    const { createTaskManagerHook } = await import("../../src/hooks")
    const hook = createTaskManagerHook()
    const messages = [{ info: { role: "user" }, parts: [{ type: "text", text: "你好" }] }]
    const originalLen = messages[0].parts.length
    await hook["experimental.chat.messages.transform"]!({} as any, { messages: messages as any })
    expect(messages[0].parts.length).toBe(originalLen)
  })

  it("已完成（terminal_unreconciled）的任务也会被注入", async () => {
    const { createTaskManagerHook } = await import("../../src/hooks")
    const hook = createTaskManagerHook()
    await hook["tool.execute.before"]!(
      { tool: "task", sessionID: "ses_vox", callID: "call_1" } as any,
      { args: { subagent_type: "lynx", prompt: "查一下" } } as any,
    )
    await hook["tool.execute.after"]!(
      { tool: "task", sessionID: "ses_vox", callID: "call_1", args: {} } as any,
      { title: "Background task completed", output: "找到了", metadata: {} } as any,
    )
    const messages = [{ info: { role: "user" }, parts: [{ type: "text", text: "你好" }] }]
    await hook["experimental.chat.messages.transform"]!({} as any, { messages: messages as any })
    const lastText = messages[messages.length - 1].parts[messages[messages.length - 1].parts.length - 1].text
    expect(lastText).toMatch(/已完成/)
  })

  it("reconciled 后的任务不再注入", async () => {
    const { createTaskManagerHook } = await import("../../src/hooks")
    const hook = createTaskManagerHook()
    await hook["tool.execute.before"]!(
      { tool: "task", sessionID: "ses_vox", callID: "call_1" } as any,
      { args: { subagent_type: "lynx", prompt: "查一下" } } as any,
    )
    await hook["tool.execute.after"]!(
      { tool: "task", sessionID: "ses_vox", callID: "call_1", args: {} } as any,
      { title: "Background task completed", output: "找到了", metadata: {} } as any,
    )
    hook.getBoard().markReconciled("call_1")
    hook.getBoard().cleanReconciled()

    const messages = [{ info: { role: "user" }, parts: [{ type: "text", text: "你好" }] }]
    await hook["experimental.chat.messages.transform"]!({} as any, { messages: messages as any })
    const lastLen = messages[messages.length - 1].parts.length
    expect(lastLen).toBe(1) // 没有新注入
  })

  it("sentinel 防同一轮重复注入", async () => {
    const { createTaskManagerHook } = await import("../../src/hooks")
    const hook = createTaskManagerHook()
    await hook["tool.execute.before"]!(
      { tool: "task", sessionID: "ses_vox", callID: "call_1" } as any,
      { args: { subagent_type: "lynx", prompt: "查一下" } } as any,
    )
    const messages = [{ info: { role: "user" }, parts: [{ type: "text", text: "你好" }] }]

    // 第一次注入
    await hook["experimental.chat.messages.transform"]!({} as any, { messages: messages as any })
    const partsAfterFirst = messages[messages.length - 1].parts.length

    // 第二次注入（应该被 sentinel 拦住）
    await hook["experimental.chat.messages.transform"]!({} as any, { messages: messages as any })
    const partsAfterSecond = messages[messages.length - 1].parts.length

    expect(partsAfterSecond).toBe(partsAfterFirst) // 没有新增
  })
})
