import type { Plugin } from "@opencode-ai/plugin"
import { createVoxAgent } from "./agents/vox"
import { createLynxAgent } from "./agents/lynx"
import { createFixerAgent } from "./agents/fixer"

export const xAgt: Plugin = async (ctx) => {
  console.log("[xAgt] 插件已加载")

  return {
    config: async (config) => {
      (config as any).agent = (config as any).agent || {}
      ;(config as any).agent.vox = createVoxAgent()
      ;(config as any).agent.lynx = createLynxAgent()
      ;(config as any).agent.fixer = createFixerAgent()
    },
  }
}
