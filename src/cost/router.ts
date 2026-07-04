/**
 * Model Router — 模型路由
 *
 * 提供按 Agent 类型建议模型的配置工具。
 * 实际模型选择由用户在 opencode.jsonc 的 xAgt.agents 中配置。
 */

export interface ModelSuggestion {
  role: string
  defaultModel: string
  tier: "performance" | "balanced" | "economy"
  note: string
}

export const MODEL_SUGGESTIONS: Record<string, ModelSuggestion> = {
  vox: {
    role: "总指挥",
    defaultModel: "deepseek/deepseek-chat",
    tier: "performance",
    note: "调度决策质量关键，推荐使用最强模型",
  },
  fixer: {
    role: "执行者",
    defaultModel: "deepseek/deepseek-chat",
    tier: "performance",
    note: "代码生成需要高准确度",
  },
  lynx: {
    role: "侦察兵",
    defaultModel: "deepseek/deepseek-chat",
    tier: "economy",
    note: "只读调研，可选用更便宜的模型",
  },
  judge: {
    role: "审计员",
    defaultModel: "deepseek/deepseek-chat",
    tier: "balanced",
    note: "审查需要一定推理能力",
  },
  smith: {
    role: "锐匠",
    defaultModel: "deepseek/deepseek-chat",
    tier: "economy",
    note: "低频定期审查，对实时性不敏感",
  },
}
