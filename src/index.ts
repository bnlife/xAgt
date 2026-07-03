import type { Plugin, Config, Hooks } from "@opencode-ai/plugin"
import { createVoxAgent } from "./agents/vox"
import { createLynxAgent } from "./agents/lynx"
import { createFixerAgent } from "./agents/fixer"
import { createTaskManagerHook } from "./hooks/task-manager/index"
import { loadXagtConfig } from "./utils/config-loader"

type AgentCfg = Record<string, unknown>

/** 将用户配置中的 model 和 mcp 合并到 Agent 定义上 */
function applyUserConfig(agent: AgentCfg, model?: string, mcps?: Record<string, boolean>): AgentCfg {
  const merged = { ...agent }
  if (model) merged.model = model
  if (mcps) {
    const perm = (merged.permission as Record<string, unknown>) ?? {}
    const mcpPerms: Record<string, string> = {}
    for (const [name, allowed] of Object.entries(mcps)) {
      if (allowed) mcpPerms[name] = "allow"
    }
    if (Object.keys(mcpPerms).length > 0) {
      perm.mcp = mcpPerms
      merged.permission = perm
    }
  }
  return merged
}

export const xAgt: Plugin = async (ctx) => {
  console.log("[xAgt] 插件已加载")

  const taskManager = createTaskManagerHook()
  const userCfg = loadXagtConfig(ctx.directory)

  const hooks: Hooks = {
    "tool.execute.before": taskManager["tool.execute.before"],
    "tool.execute.after": taskManager["tool.execute.after"],
    "experimental.chat.messages.transform": taskManager["experimental.chat.messages.transform"],
    event: taskManager.event,

    config: async (config: Config) => {
      const agent = (config as Record<string, unknown>).agent as Record<string, unknown> | undefined
      const agents = agent ?? {}

      // 基础 Agent 定义
      const baseAgents: Record<string, AgentCfg> = {
        vox: createVoxAgent(),
        lynx: createLynxAgent(),
        fixer: createFixerAgent(),
      }

      // 合并用户配置
      for (const [name, base] of Object.entries(baseAgents)) {
        agents[name] = applyUserConfig(
          base,
          userCfg.model?.[name],
          userCfg.mcp?.[name],
        )
      }

      ;(config as Record<string, unknown>).agent = agents

      // 注入用户自定义 provider
      if (userCfg.provider) {
        const existing = (config as Record<string, unknown>).provider as Record<string, unknown> | undefined
        ;(config as Record<string, unknown>).provider = { ...existing, ...userCfg.provider }
      }
    },
  }

  return hooks
}
