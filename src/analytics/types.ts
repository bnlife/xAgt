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
  /** Judge 拒绝的具体规则（如 logrule、铁律2、越权等） */
  rule?: string
  /** Fixer 失败的错误类型（如 type_error、test_failure、compile_error 等） */
  errorType?: string
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
