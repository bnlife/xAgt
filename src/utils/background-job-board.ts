export type TaskState = "running" | "completed" | "failed" | "cancelled"

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
    record.state = "completed"
    record.completedAt = Date.now()
    record.resultSummary = resultSummary
    return record
  }

  fail(id: string, error: string): TaskRecord | undefined {
    const record = this.tasks.get(id)
    if (!record) return undefined
    record.state = "failed"
    record.completedAt = Date.now()
    record.resultSummary = error
    return record
  }

  cancel(id: string): TaskRecord | undefined {
    const record = this.tasks.get(id)
    if (!record) return undefined
    record.state = "cancelled"
    record.completedAt = Date.now()
    return record
  }

  findRunning(agent?: string): TaskRecord[] {
    const running: TaskRecord[] = []
    for (const record of this.tasks.values()) {
      if (record.state !== "running") continue
      if (agent && record.agent !== agent) continue
      running.push(record)
    }
    return running
  }

  getAllRunning(): TaskRecord[] {
    return this.findRunning()
  }

  getAll(): TaskRecord[] {
    return Array.from(this.tasks.values())
  }
}
