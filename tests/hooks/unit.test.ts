import { describe, it, expect } from "bun:test"

describe("BackgroundJobBoard 看板数据结构", () => {
  it("启动任务后看板有一条记录，状态为 running", async () => {
    const { BackgroundJobBoard } = await import("../../src/utils/background-job-board")
    const board = new BackgroundJobBoard()
    board.launch("task_1", { agent: "lynx", prompt: "查一下" })
    const record = board.get("task_1")
    expect(record?.state).toBe("running")
  })

  it("完成任务后状态变为 terminal_unreconciled", async () => {
    const { BackgroundJobBoard } = await import("../../src/utils/background-job-board")
    const board = new BackgroundJobBoard()
    board.launch("task_1", { agent: "lynx", prompt: "查一下" })
    board.complete("task_1", "完成")
    expect(board.get("task_1")?.state).toBe("terminal_unreconciled")
    expect(board.get("task_1")?.resultSummary).toBe("完成")
  })

  it("markReconciled 后状态变为 reconciled", async () => {
    const { BackgroundJobBoard } = await import("../../src/utils/background-job-board")
    const board = new BackgroundJobBoard()
    board.launch("task_1", { agent: "lynx", prompt: "查一下" })
    board.complete("task_1", "完成")
    board.markReconciled("task_1")
    expect(board.get("task_1")?.state).toBe("reconciled")
  })

  it("getActive 只返回 running 和 terminal_unreconciled", async () => {
    const { BackgroundJobBoard } = await import("../../src/utils/background-job-board")
    const board = new BackgroundJobBoard()
    board.launch("t1", { agent: "lynx", prompt: "a" })
    board.launch("t2", { agent: "fixer", prompt: "b" })
    board.complete("t1", "ok")
    board.markReconciled("t1")

    const active = board.getActive()
    expect(active.length).toBe(1) // 只有 t2 (terminal_unreconciled)
    expect(active[0].id).toBe("t2")
  })

  it("getAllRunning 只返回 running（不包含 terminal_unreconciled）", async () => {
    const { BackgroundJobBoard } = await import("../../src/utils/background-job-board")
    const board = new BackgroundJobBoard()
    board.launch("t1", { agent: "lynx", prompt: "查一下" })
    board.complete("t1", "ok")
    const running = board.getAllRunning()
    expect(running.length).toBe(0)
  })

  it("cleanReconciled 删除所有 reconciled 记录", async () => {
    const { BackgroundJobBoard } = await import("../../src/utils/background-job-board")
    const board = new BackgroundJobBoard()
    board.launch("t1", { agent: "lynx", prompt: "a" })
    board.complete("t1", "ok")
    board.markReconciled("t1")
    const count = board.cleanReconciled()
    expect(count).toBe(1)
    expect(board.get("t1")).toBeUndefined()
  })
})
