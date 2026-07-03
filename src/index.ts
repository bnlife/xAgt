import type { Plugin } from "@opencode-ai/plugin"
import { createVoxAgent } from "./agents/vox"
import { createLynxAgent } from "./agents/lynx"
import { createFixerAgent } from "./agents/fixer"
import { createTaskManagerHook } from "./hooks/task-manager/index"

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
  } as any
}
