/**
 * Smith Trigger — 频率计数器
 *
 * 管理 Smith Agent 的激活频率。
 * 每 N 轮用户消息激活一次，按 session 隔离计数。
 */

export interface SmithTriggerOptions {
  /** 每多少轮激活一次，默认 30 */
  everyNTurns?: number
}

export interface SmithTrigger {
  /** 增加计数（每次用户消息时调用） */
  activate(sessionID: string): void
  /** 检查是否达到阈值，达到则返回 true 并重置计数 */
  shouldActivate(sessionID: string): boolean
  /** 查看当前计数值 */
  getCounter(sessionID: string): number
  /** 重置所有 session 的计数 */
  reset(): void
}

export function createSmithTrigger(options?: SmithTriggerOptions): SmithTrigger {
  const everyNTurns = options?.everyNTurns ?? 30
  const counters = new Map<string, number>()

  return {
    activate(sessionID: string): void {
      const current = counters.get(sessionID) ?? 0
      counters.set(sessionID, current + 1)
    },

    shouldActivate(sessionID: string): boolean {
      const current = counters.get(sessionID)
      if (current === undefined) return false
      if (current >= everyNTurns) {
        counters.set(sessionID, 0)
        return true
      }
      return false
    },

    getCounter(sessionID: string): number {
      return counters.get(sessionID) ?? 0
    },

    reset(): void {
      counters.clear()
    },
  }
}
