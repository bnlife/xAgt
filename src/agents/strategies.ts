/**
 * 子代理行为策略。
 *
 * 从 fixer.ts/judge.ts 的 workflow 字段中提取。
 * 包含分级验证策略和审查清单。
 */

// ——————————————————————————————
// 分级验证策略（Fixer 用）
// ——————————————————————————————

export type VerifyLevel = "trivial" | "simple" | "complex"

export interface VerifyStep {
  level: VerifyLevel
  label: string
  steps: string[]
  mustNot: string[]
}

export const VERIFY_STRATEGY: VerifyStep[] = [
  {
    level: "trivial",
    label: "琐碎修改（注释/typo/重命名/格式化）",
    steps: ["tsc --noEmit"],
    mustNot: ["不要跑全量测试"],
  },
  {
    level: "simple",
    label: "简单修改（改默认值/调参数/简单逻辑分支）",
    steps: ["tsc --noEmit", "bun test 直接相关的测试"],
    mustNot: ["不要跑全量测试"],
  },
  {
    level: "complex",
    label: "复杂修改（新功能/新文件/重构/改核心逻辑）",
    steps: ["先写测试", "实现代码", "跑相关测试", "验证日志"],
    mustNot: [],
  },
]

/**
 * 将分级验证策略渲染为文本，供 Fixer prompt 引用。
 */
export function renderVerifyStrategy(): string {
  return VERIFY_STRATEGY.map(s => {
    const steps = s.steps.map((st, i) => `    ${i + 1}. ${st}`).join("\n")
    const mustNot = s.mustNot.map(m => `    - ${m}`).join("\n")
    return `- **${s.label}**：\n${steps}${mustNot ? "\n" + mustNot : ""}`
  }).join("\n")
}

// ——————————————————————————————
// 审查清单（Judge 用）
// ——————————————————————————————

export interface CheckItem {
  id: string
  label: string
  detail: string
}

export const JUDGE_CHECKLIST: CheckItem[] = [
  { id: "A", label: "自动检查", detail: "编译是否通过？测试是否通过？Fixer 是否提供验证凭证？" },
  { id: "B", label: "日志规范", detail: "日志前缀/级别/中文/超长/脱敏是否符合 logrule？" },
  { id: "C", label: "UI 规范", detail: "组件样式是否源码层修改？是否用 @theme 变量？" },
  { id: "D", label: "越权检查", detail: "Fixer 是否改了未指定的文件/配置/依赖？" },
  { id: "E", label: "结构检查", detail: "修改是否在正确模块？有无循环依赖？" },
]

/**
 * 将审查清单渲染为文本，供 Judge prompt 引用。
 */
export function renderJudgeChecklist(): string {
  return JUDGE_CHECKLIST.map(c => `   - ${c.id}. ${c.label}：${c.detail}`).join("\n")
}
