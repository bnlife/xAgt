/**
 * Task State Persistence — 断点续传
 *
 * 管理和持久化 Fixer 任务的中间状态。
 * 当进程中断或会话超时后，Vox 可恢复未完成的任务。
 *
 * 存储位置：.xagt/task_state.json
 * 关联 M3：sandboxRef.branchName 精确到 Git 分支
 */

import { readFile, writeFile, unlink } from "fs/promises"
import { existsSync } from "fs"
import { join } from "path"
import { XAGT_DIR, TASK_STATE_FILE } from "../constants"

export interface SandboxRef {
  branchName: string
  worktreePath: string
  baseCommit: string
}

export interface StepRecord {
  stepIndex: number
  action: string
  status: "done" | "failed" | "skipped"
}

export interface FileRecord {
  path: string
}

export interface ActiveTask {
  taskID: string
  sandboxRef: SandboxRef
  instruction: {
    files: string[]
    operation: string
    verification: string
  }
  completedSteps: StepRecord[]
  nextStepIndex: number
  totalSteps: number
  modifiedFiles: FileRecord[]
  contextSummary: string
  lastError: string | null
}

export interface TaskState {
  version: number
  updatedAt: string
  activeTask: ActiveTask | null
  pendingTasks: Array<{
    taskID: string
    instruction: any
    priority: string
  }>
}

export class TaskStatePersistence {
  private filePath: string

  constructor(storageDir?: string) {
    const dir = storageDir ?? join(process.cwd(), XAGT_DIR)
    this.filePath = join(dir, TASK_STATE_FILE)
  }

  async save(state: TaskState): Promise<void> {
    state.updatedAt = new Date().toISOString()
    state.version = 1

    const dir = join(this.filePath, "..")
    if (!existsSync(dir)) {
      const { mkdir } = await import("fs/promises")
      await mkdir(dir, { recursive: true })
    }

    await writeFile(this.filePath, JSON.stringify(state, null, 2), "utf-8")
  }

  async load(): Promise<TaskState | null> {
    if (!existsSync(this.filePath)) return null

    try {
      const content = await readFile(this.filePath, "utf-8")
      return JSON.parse(content) as TaskState
    } catch {
      return null
    }
  }

  async clear(): Promise<void> {
    if (existsSync(this.filePath)) {
      await unlink(this.filePath)
    }
  }
}
