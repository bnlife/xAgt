import { describe, it, expect } from "bun:test"
import { mkdtempSync, rmSync, existsSync, readFileSync } from "fs"
import { join } from "path"
import { tmpdir } from "os"

describe("TaskStatePersistence", () => {
  it("save 后文件存在", async () => {
    const { TaskStatePersistence } = await import("../../src/hooks/task-state-persistence")
    const tempDir = mkdtempSync(join(tmpdir(), "xagt-tsp-"))
    try {
      const tsp = new TaskStatePersistence(tempDir)
      await tsp.save({
        activeTask: null,
        pendingTasks: [],
      })
      expect(existsSync(join(tempDir, "task_state.json"))).toBe(true)
    } finally {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it("save 后 load 应返回相同内容", async () => {
    const { TaskStatePersistence } = await import("../../src/hooks/task-state-persistence")
    const tempDir = mkdtempSync(join(tmpdir(), "xagt-tsp-"))
    try {
      const tsp = new TaskStatePersistence(tempDir)
      const state = {
        version: 1,
        updatedAt: new Date().toISOString(),
        activeTask: {
          taskID: "fixer-001",
          sandboxRef: { branchName: "ai/task-fixer-001", worktreePath: "/tmp/wt", baseCommit: "abc123" },
          instruction: { files: ["src/a.ts:5"], operation: "change type", verification: "tsc --noEmit" },
          completedSteps: [{ stepIndex: 0, action: "read src/a.ts", status: "done" as const }],
          nextStepIndex: 1,
          totalSteps: 2,
          modifiedFiles: [{ path: "src/a.ts" }],
          contextSummary: "changing type",
          lastError: null,
        },
        pendingTasks: [],
      }
      await tsp.save(state)
      const loaded = await tsp.load()
      expect(loaded?.activeTask?.taskID).toBe("fixer-001")
      expect(loaded?.activeTask?.completedSteps.length).toBe(1)
      expect(loaded?.activeTask?.nextStepIndex).toBe(1)
    } finally {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it("文件不存在时 load 返回 null", async () => {
    const { TaskStatePersistence } = await import("../../src/hooks/task-state-persistence")
    const tempDir = mkdtempSync(join(tmpdir(), "xagt-tsp-"))
    try {
      const tsp = new TaskStatePersistence(tempDir)
      const loaded = await tsp.load()
      expect(loaded).toBeNull()
    } finally {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it("clear 后文件被删除", async () => {
    const { TaskStatePersistence } = await import("../../src/hooks/task-state-persistence")
    const tempDir = mkdtempSync(join(tmpdir(), "xagt-tsp-"))
    try {
      const tsp = new TaskStatePersistence(tempDir)
      await tsp.save({ activeTask: null, pendingTasks: [] })
      expect(existsSync(join(tempDir, "task_state.json"))).toBe(true)
      await tsp.clear()
      expect(existsSync(join(tempDir, "task_state.json"))).toBe(false)
    } finally {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it("损坏的 JSON 文件 load 返回 null 不抛异常", async () => {
    const { TaskStatePersistence } = await import("../../src/hooks/task-state-persistence")
    const { writeFileSync } = await import("fs")
    const { join } = await import("path")
    const tempDir = mkdtempSync(join(tmpdir(), "xagt-tsp-"))
    try {
      writeFileSync(join(tempDir, "task_state.json"), "不是 JSON", "utf-8")
      const tsp = new TaskStatePersistence(tempDir)
      const loaded = await tsp.load()
      expect(loaded).toBeNull()
    } finally {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })
})
