import { describe, it, expect } from "bun:test"

describe("TaskManager Hook 集成测试", () => {
  it("拦截 task → 看板新增 running", async () => {
    const { createTaskManagerHook } = await import("../../../src/hooks/task-manager/index")
    const hook = createTaskManagerHook()
    await hook["tool.execute.before"]!(
      { tool: "task", sessionID: "ses_vox", callID: "call_1" } as any,
      { args: { subagent_type: "lynx", prompt: "查一下" } } as any,
    )
    const active = hook.getBoard().getActive()
    expect(active.length).toBe(1)
    expect(active[0].state).toBe("running")
  })

  it("after 完成后 → 状态变为 terminal_unreconciled", async () => {
    const { createTaskManagerHook } = await import("../../../src/hooks/task-manager/index")
    const hook = createTaskManagerHook()
    await hook["tool.execute.before"]!(
      { tool: "task", sessionID: "ses_vox", callID: "call_1" } as any,
      { args: { subagent_type: "lynx", prompt: "查一下" } } as any,
    )
    await hook["tool.execute.after"]!(
      { tool: "task", sessionID: "ses_vox", callID: "call_1", args: {} } as any,
      { title: "Background task completed", output: "找到了", metadata: {} } as any,
    )
    expect(hook.getBoard().get("call_1")?.state).toBe("terminal_unreconciled")
  })

  it("event session.idle 触发后 → reconciled", async () => {
    const { createTaskManagerHook } = await import("../../../src/hooks/task-manager/index")
    const hook = createTaskManagerHook()
    await hook["tool.execute.before"]!(
      { tool: "task", sessionID: "ses_vox", callID: "call_1" } as any,
      { args: { subagent_type: "lynx", prompt: "查一下" } } as any,
    )
    await hook["tool.execute.after"]!(
      { tool: "task", sessionID: "ses_vox", callID: "call_1", args: {} } as any,
      { title: "Background task completed", output: "找到了", metadata: {} } as any,
    )
    await hook.event!({ event: { type: "session.idle" } } as any)
    expect(hook.getBoard().get("call_1")).toBeUndefined() // 已清理
  })

  it("Vox → Lynx 完整闭环", async () => {
    const { createTaskManagerHook } = await import("../../../src/hooks/task-manager/index")
    const hook = createTaskManagerHook()
    await hook["tool.execute.before"]!(
      { tool: "task", sessionID: "ses_vox", callID: "call_lynx" } as any,
      { args: { subagent_type: "lynx", prompt: "查一下src" } } as any,
    )
    await hook["tool.execute.after"]!(
      { tool: "task", sessionID: "ses_vox", callID: "call_lynx", args: {} } as any,
      { title: "Background task completed", output: "src下有agents目录", metadata: {} } as any,
    )
    const record = hook.getBoard().get("call_lynx")
    expect(record?.agent).toBe("lynx")
    expect(record?.state).toBe("terminal_unreconciled")
    expect(record?.resultSummary).toContain("src")
  })
})
