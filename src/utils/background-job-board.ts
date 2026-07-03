export type TaskState = "running" | "terminal_unreconciled" | "reconciled"

export interface TaskRecord {
  id: string
  agent: string
  prompt: string
  state: TaskState
  startedAt: number
  completedAt?: number
  resultSummary?: string
}

export class BackgroundJobBoard {
  private tasks = new Map<string, TaskRecord>()

  launch(id: string, input: { agent: string; prompt: string }): TaskRecord {
    const record: TaskRecord = {
      id,
      agent: input.agent,
      prompt: input.prompt,
      state: "running",
      startedAt: Date.now(),
    }
    this.tasks.set(id, record)
    return record
  }

  get(id: string): TaskRecord | undefined {
    return this.tasks.get(id)
  }

  complete(id: string, resultSummary: string): TaskRecord | undefined {
    const record = this.tasks.get(id)
    if (!record) return undefined
    record.state = "terminal_unreconciled"
    record.completedAt = Date.now()
    record.resultSummary = resultSummary
    return record
  }

  fail(id: string, error: string): TaskRecord | undefined {
    const record = this.tasks.get(id)
    if (!record) return undefined
    record.state = "terminal_unreconciled"
    record.completedAt = Date.now()
    record.resultSummary = error
    return record
  }

  cancel(id: string): TaskRecord | undefined {
    const record = this.tasks.get(id)
    if (!record) return undefined
    record.state = "terminal_unreconciled"
    record.completedAt = Date.now()
    return record
  }

  /** 标记为已确认，下次不再注入看板 */
  markReconciled(id: string): boolean {
    const record = this.tasks.get(id)
    if (!record || record.state !== "terminal_unreconciled") return false
    record.state = "reconciled"
    return true
  }

  /** 获取活跃任务（running + terminal_unreconciled），用于看板注入 */
  getActive(): TaskRecord[] {
    const active: TaskRecord[] = []
    for (const record of this.tasks.values()) {
      if (record.state === "running" || record.state === "terminal_unreconciled") {
        active.push(record)
      }
    }
    return active
  }

  /** 批量标记所有 terminal_unreconciled 为 reconciled */
  reconcileAll(): number {
    let count = 0
    for (const record of this.tasks.values()) {
      if (record.state === "terminal_unreconciled") {
        record.state = "reconciled"
        count++
      }
    }
    return count
  }

  /** 清理 reconciled 的任务 */
  cleanReconciled(): number {
    let count = 0
    for (const [id, record] of this.tasks.entries()) {
      if (record.state === "reconciled") {
        this.tasks.delete(id)
        count++
      }
    }
    return count
  }

  getAll(): TaskRecord[] {
    return Array.from(this.tasks.values())
  }
}
