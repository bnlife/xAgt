/**
 * TaskManager Hook 集成测试
 *
 * 模拟完整流程：
 * Vox 派 Lynx 侦察 → Lynx 完成任务 → Vox 看到结果
 * Vox 派 Fixer 执行 → Fixer 完成任务 → Vox 看到结果
 */
import { describe, it, expect } from "bun:test"

describe("TaskManager Hook 集成测试", () => {
  // 测试1：tool.execute.before 拦截 task 调用
  it("拦截 task 工具调用后，看板应该新增 running 记录", async () => {
    const { createTaskManagerHook } = await import("../../../src/hooks/task-manager/index")
    const hook = createTaskManagerHook()

    const input = { tool: "task", sessionID: "ses_vox", callID: "call_1" }
    const output = { args: { subagent_type: "lynx", prompt: "查一下auth目录" } }
    await hook["tool.execute.before"]!(input as any, output as any)

    const tasks = hook.getBoard().getAllRunning()
    expect(tasks.length).toBe(1)
    expect(tasks[0].id).toBe("call_1")
    expect(tasks[0].agent).toBe("lynx")
    expect(tasks[0].state).toBe("running")
  })

  // 测试2：tool.execute.after 捕获完成
  it("工具执行完成后，看板状态应该更新为 completed", async () => {
    const { createTaskManagerHook } = await import("../../../src/hooks/task-manager/index")
    const hook = createTaskManagerHook()

    await hook["tool.execute.before"]!(
      { tool: "task", sessionID: "ses_vox", callID: "call_1" } as any,
      { args: { subagent_type: "lynx", prompt: "查一下" } } as any,
    )

    await hook["tool.execute.after"]!(
      { tool: "task", sessionID: "ses_vox", callID: "call_1", args: {} } as any,
      { title: "Background task completed", output: "找到auth目录，有login.vue", metadata: {} } as any,
    )

    const record = hook.getBoard().get("call_1")
    expect(record.state).toBe("completed")
    expect(record.resultSummary).toContain("auth")
  })

  // 测试3：Vox → Lynx 完整闭环
  it("模拟 Vox 派 Lynx 侦察的完整闭环", async () => {
    const { createTaskManagerHook } = await import("../../../src/hooks/task-manager/index")
    const hook = createTaskManagerHook()

    // Vox 派 Lynx 侦察
    await hook["tool.execute.before"]!(
      { tool: "task", sessionID: "ses_vox", callID: "call_lynx" } as any,
      { args: { subagent_type: "lynx", prompt: "查一下src目录结构" } } as any,
    )

    // Lynx 完成侦察
    await hook["tool.execute.after"]!(
      { tool: "task", sessionID: "ses_vox", callID: "call_lynx", args: {} } as any,
      { title: "Background task completed", output: "src下有agents、hooks、tests目录", metadata: {} } as any,
    )

    // 验证看板
    const record = hook.getBoard().get("call_lynx")
    expect(record.agent).toBe("lynx")
    expect(record.state).toBe("completed")
    expect(record.resultSummary).toContain("src")
  })

  // 测试4：Vox → Fixer 完整闭环
  it("模拟 Vox 派 Fixer 执行的完整闭环", async () => {
    const { createTaskManagerHook } = await import("../../../src/hooks/task-manager/index")
    const hook = createTaskManagerHook()

    // Vox 派 Fixer 执行
    await hook["tool.execute.before"]!(
      { tool: "task", sessionID: "ses_vox", callID: "call_fixer" } as any,
      { args: { subagent_type: "fixer", prompt: "创建login.vue文件" } } as any,
    )

    // Fixer 完成执行
    await hook["tool.execute.after"]!(
      { tool: "task", sessionID: "ses_vox", callID: "call_fixer", args: {} } as any,
      { title: "Background task completed", output: "已创建login.vue，测试通过", metadata: {} } as any,
    )

    const record = hook.getBoard().get("call_fixer")
    expect(record.agent).toBe("fixer")
    expect(record.state).toBe("completed")
    expect(record.resultSummary).toContain("login.vue")
  })
})
