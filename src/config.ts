/**
 * xAgt 配置系统
 *
 * 提供默认配置 + 用户配置的深度合并。
 * 用户通过 opencode.jsonc 在 xAgt 插件段中覆盖默认参数：
 *
 * ```jsonc
 * {
 *   "plugin": ["file:///path/to/xAgt"],
 *   "xAgt": {
 *     "agents": {
 *       "vox": {
 *         "model": "opencode-go/deepseek-v4-flash",
 *         "reasoning": {
 *           "thinking": { "type": "enabled" },
 *           "reasoning_effort": "max"
 *         }
 *       }
 *     },
 *     "disabled": ["lynx"]
 *   }
 * }
 * ```
 *
 * 所有可调参数均集中在此单一配置源，不需要额外的配置文件。
 */

import type { AgentName } from "./agents"

// ============================================
// 类型定义 —— 用户在 opencode.jsonc 中可配置的字段
// ============================================

/** 推理参数（对应 OpenCode 的 thinking/reasoning_effort） */
export interface ReasoningConfig {
  thinking?: { type: "enabled" | "disabled" }
  reasoning_effort?: "low" | "medium" | "high" | "max"
}

/** 单个 Agent 的可配置参数 */
export interface AgentConfig {
  model?: string
  description?: string
  reasoning?: ReasoningConfig
}

/** xAgt 插件在 opencode.jsonc 中的配置节 */
export interface XAgtPluginConfig {
  agents?: Partial<Record<AgentName | string, AgentConfig>>
  disabled?: AgentName[]
}

// ============================================
// 默认值
// ============================================

export const DEFAULT_AGENT_REASONING: Record<string, ReasoningConfig> = {
  vox: {
    thinking: { type: "enabled" },
    reasoning_effort: "max",
  },
  fixer: {
    thinking: { type: "enabled" },
    reasoning_effort: "high",
  },
  lynx: {
    thinking: { type: "disabled" },
  },
  judge: {
    thinking: { type: "disabled" },
  },
  smith: {
    thinking: { type: "disabled" },
  },
}

export const DEFAULT_AGENT_CONFIGS: Record<string, AgentConfig> = {
  vox: {
    model: "opencode-go/deepseek-v4-flash",
    description: undefined,
    reasoning: DEFAULT_AGENT_REASONING.vox,
  },
  lynx: {
    model: "opencode-go/deepseek-v4-flash",
    description: undefined,
    reasoning: DEFAULT_AGENT_REASONING.lynx,
  },
  fixer: {
    model: "opencode-go/deepseek-v4-flash",
    description: undefined,
    reasoning: DEFAULT_AGENT_REASONING.fixer,
  },
  judge: {
    model: "opencode-go/deepseek-v4-flash",
    description: undefined,
    reasoning: DEFAULT_AGENT_REASONING.judge,
  },
  smith: {
    model: "opencode-go/deepseek-v4-flash",
  },
}

// ============================================
// 配置合并
// ============================================

function mergeReasoning(
  base: ReasoningConfig | undefined,
  override: ReasoningConfig | undefined,
): ReasoningConfig | undefined {
  if (!override) return base
  if (!base) return override
  return {
    ...base,
    ...override,
    thinking: override.thinking ?? base.thinking,
  }
}

function mergeAgentConfig(
  base: AgentConfig,
  override: AgentConfig | undefined,
): AgentConfig {
  if (!override) return base
  return {
    ...base,
    ...override,
    reasoning: mergeReasoning(base.reasoning, override.reasoning),
  }
}

/**
 * 从 OpenCode 全局配置中提取 xAgt 配置并合并默认值。
 * 在插件的 config hook 中调用，用户未配置的项保持默认行为。
 *
 * @param config 插件的 config hook 收到的完整配置对象
 * @returns 合并后的 agent 配置和禁用列表
 */
export function loadXAgtConfig(config: any): {
  agentConfigs: Record<string, AgentConfig>
  disabled: AgentName[]
} {
  const userConfig: XAgtPluginConfig = config?.xAgt ?? {}

  const agentConfigs: Record<string, AgentConfig> = {}
  const allAgentNames = Object.keys(DEFAULT_AGENT_CONFIGS) as AgentName[]

  // 对每个内置 agent：默认值 + 用户覆盖
  for (const name of allAgentNames) {
    const defaultCfg = DEFAULT_AGENT_CONFIGS[name]
    const userAgentCfg = userConfig.agents?.[name]
    agentConfigs[name] = mergeAgentConfig(defaultCfg, userAgentCfg)
  }

  // 支持用户在配置中新增自定义 agent
  if (userConfig.agents) {
    for (const [name, cfg] of Object.entries(userConfig.agents)) {
      if (!agentConfigs[name]) {
        agentConfigs[name] = cfg as AgentConfig
      }
    }
  }

  return {
    agentConfigs,
    disabled: userConfig.disabled ?? [],
  }
}

/**
 * 获取某个 agent 的 reasoning 配置（用于 chat.params hook）
 */
export function getReasoningForAgent(
  agentName: string,
  agentConfigs: Record<string, AgentConfig>,
): ReasoningConfig | undefined {
  return agentConfigs[agentName]?.reasoning
}
