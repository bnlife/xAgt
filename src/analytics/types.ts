/**
 * Analytics — 类型定义
 */

export type AnalyticsEventType = "judge_rejection" | "fixer_failure"

export interface AnalyticsEvent {
  type: AnalyticsEventType
  timestamp: string
  agent: string
  sessionID?: string
  summary: string
  tags?: Record<string, string>
}

export interface RejectionReason {
  reason: string
  count: number
}

export interface AnalyticsStats {
  total: number
  byType: Record<string, number>
  topRejectionReasons: RejectionReason[]
  topFailureTypes: RejectionReason[]
}
