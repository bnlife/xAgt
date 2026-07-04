export type TaskState = "running" | "terminal_unreconciled" | "reconciled"

export interface TaskRecord {
  id: string
  agent: string
  prompt: string
  state: TaskState
  sessionID: string
  startedAt: number
  completedAt?: number
  resultSummary?: string
}

export class BackgroundJobBoard {
  /** 最大任务数，超过上限时自动淘汰最旧的已完成任务 */
  static readonly MAX_TASKS = 200

  private tasks = new Map<string, TaskRecord>()

  /** 超过上限时淘汰最旧的 reconciled/terminal_unreconciled 任务 */
  private evictIfNeeded(): void {
    if (this.tasks.size < BackgroundJobBoard.MAX_TASKS) return

    // 先清理已 reconciled 的
    this.cleanReconciled()

    // 如果还超限，淘汰最旧的 terminal_unreconciled
    if (this.tasks.size >= BackgroundJobBoard.MAX_TASKS) {
      const entries = Array.from(this.tasks.entries())
        .filter(([, t]) => t.state === "terminal_unreconciled")
        .sort(([, a], [, b]) => a.startedAt - b.startedAt)

      const toRemove = entries.slice(0, entries.length - BackgroundJobBoard.MAX_TASKS + 20)
      for (const [id] of toRemove) {
        this.tasks.delete(id)
      }
    }
  }

  launch(id: string, input: { agent: string; prompt: string }, sessionID?: string): TaskRecord {
    this.evictIfNeeded()
    const record: TaskRecord = {
      id,
      agent: input.agent,
      prompt: input.prompt,
      state: "running",
      sessionID: sessionID ?? "",
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

  /**
   * 批量标记指定会话的所有 unreconciled 任务为 reconciled。
   * @param parentSessionID 要清理的会话 ID，空字符串仅匹配无归属任务
   */
  reconcileAll(parentSessionID: string): number {
    let count = 0
    for (const record of this.tasks.values()) {
      if (record.state === "terminal_unreconciled" && record.sessionID === parentSessionID) {
        record.state = "reconciled"
        count++
      }
    }
    return count
  }

  /** 获取活跃任务（running + terminal_unreconciled），可选按 session 过滤 */
  getActive(sessionID?: string): TaskRecord[] {
    const active: TaskRecord[] = []
    for (const record of this.tasks.values()) {
      if (record.state === "running" || record.state === "terminal_unreconciled") {
        if (sessionID !== undefined && record.sessionID !== sessionID) continue
        active.push(record)
      }
    }
    return active
  }

  /** 获取所有运行中任务（旧接口兼容） */
  getAllRunning(): TaskRecord[] {
    return this.getActive().filter((t) => t.state === "running")
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
