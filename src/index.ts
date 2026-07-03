import type { Plugin } from "@opencode-ai/plugin"
import { createVoxAgent } from "./agents/vox"
import { createLynxAgent } from "./agents/lynx"
import { createFixerAgent } from "./agents/fixer"
import { createTaskManagerHook } from "./hooks/task-manager/index"

// Agent 思考模式配置映射
const AGENT_REASONING: Record<string, Record<string, any>> = {
  vox: { thinking: { type: "enabled" }, reasoning_effort: "max" },
  fixer: { thinking: { type: "enabled" }, reasoning_effort: "high" },
  lynx: { thinking: { type: "disabled" } },
}

export const xAgt: Plugin = async (ctx) => {
  console.log("[xAgt] 插件已加载")

  const taskManager = createTaskManagerHook()

  return {
    "tool.execute.before": taskManager["tool.execute.before"],
    "tool.execute.after": taskManager["tool.execute.after"],
    "experimental.chat.messages.transform": taskManager["experimental.chat.messages.transform"],
    event: taskManager.event,

    config: async (config: any) => {
      (config as any).agent = (config as any).agent || {}
      ;(config as any).agent.vox = createVoxAgent()
      ;(config as any).agent.lynx = createLynxAgent()
      ;(config as any).agent.fixer = createFixerAgent()
    },

    // 每次调 API 前注入思考模式参数
    "chat.params": async (input: any, output: any) => {
      const agentName = input.agent as string
      const reasoning = AGENT_REASONING[agentName]
      if (reasoning) {
        output.options = { ...output.options, ...reasoning }
      }
    },
  } as any
}
