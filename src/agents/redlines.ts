/**
 * Vox 核心红线。
 *
 * 从 vox.ts 的 constraints 中提取，独立管理。
 * Vox 的行为底线，违反即视为任务失败。
 */

export interface Redline {
  id: string
  text: string
}

export const REDLINES: Redline[] = [
  { id: "judge-gate",   text: "Fixer 完成后必须派 Judge 审查，通过才算完成" },
  { id: "fail-limit",   text: "子代理连续失败 3 次，暂停上报" },
  { id: "think-limit",  text: "思考 3 轮无结论，申请指导，不要死循环" },
  { id: "no-split",     text: "一次 task() 能解决的不要拆两次" },
  { id: "no-overstep",  text: "不替子代理想代码细节 — 越权" },
]
