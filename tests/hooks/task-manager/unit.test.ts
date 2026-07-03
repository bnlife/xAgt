/**
 * BackgroundJobBoard 单元测试
 *
 * 测试看板数据结构的核心操作：
 * - 启动/更新/查询/取消任务
 */
import { describe, it, expect } from "bun:test"

describe("BackgroundJobBoard 看板数据结构", () => {
  // 测试1：启动任务后看板有记录
  it("启动任务后看板应该有一条记录，状态为 running", async () => {
    const { BackgroundJobBoard } = await import("../../../src/utils/background-job-board")
    const board = new BackgroundJobBoard()

    board.launch("task_1", { agent: "lynx", prompt: "查一下auth目录" })

    const record = board.get("task_1")
    expect(record).toBeDefined()
    expect(record.id).toBe("task_1")
    expect(record.agent).toBe("lynx")
    expect(record.state).toBe("running")
  })

  // 测试2：更新任务状态
  it("完成任务后状态应该变为 completed", async () => {
    const { BackgroundJobBoard } = await import("../../../src/utils/background-job-board")
    const board = new BackgroundJobBoard()
    board.launch("task_1", { agent: "lynx", prompt: "查一下" })

    board.complete("task_1", "找到auth目录，有login.vue")

    const record = board.get("task_1")
    expect(record.state).toBe("completed")
    expect(record.resultSummary).toBe("找到auth目录，有login.vue")
  })

  // 测试3：按 agent 类型查找运行中的任务
  it("应该能按 agent 类型查找运行中任务", async () => {
    const { BackgroundJobBoard } = await import("../../../src/utils/background-job-board")
    const board = new BackgroundJobBoard()
    board.launch("task_1", { agent: "lynx", prompt: "查一下" })
    board.launch("task_2", { agent: "fixer", prompt: "改代码" })
    board.launch("task_3", { agent: "lynx", prompt: "再查一下" })

    const lynxTasks = board.findRunning("lynx")
    expect(lynxTasks.length).toBe(2)
    expect(lynxTasks.map((t) => t.id)).toEqual(["task_1", "task_3"])
  })

  // 测试4：取消任务
  it("取消任务后状态应该为 cancelled", async () => {
    const { BackgroundJobBoard } = await import("../../../src/utils/background-job-board")
    const board = new BackgroundJobBoard()
    board.launch("task_1", { agent: "fixer", prompt: "改代码" })

    board.cancel("task_1")

    const record = board.get("task_1")
    expect(record.state).toBe("cancelled")
  })

  // 测试5：获取所有运行中任务
  it("应该能列出所有运行中任务", async () => {
    const { BackgroundJobBoard } = await import("../../../src/utils/background-job-board")
    const board = new BackgroundJobBoard()
    board.launch("task_1", { agent: "lynx", prompt: "查一下" })
    board.launch("task_2", { agent: "fixer", prompt: "改代码" })
    board.complete("task_1", "完成")

    const running = board.getAllRunning()
    expect(running.length).toBe(1)
    expect(running[0].id).toBe("task_2")
  })
})
