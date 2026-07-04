import type { Plugin } from "@opencode-ai/plugin"
import { createVoxAgent } from "./agents/vox"
import { createLynxAgent } from "./agents/lynx"
import { createFixerAgent } from "./agents/fixer"
import { createJudgeAgent } from "./agents/judge"
import { createTaskManagerHook } from "./hooks"
import { createSystemTransformHook } from "./hooks/system-transform"
import { loadXAgtConfig, getReasoningForAgent } from "./config"
import type { AgentConfig } from "./config"

/** Vox 禁止直接调用的工具列表（只能通过 task() 派子代理） */
const VOZ_BLOCKED_TOOLS = new Set([
  "read", "write", "edit", "bash",
  "grep", "glob", "apply_diff",
])

export const xAgt: Plugin = async (ctx) => {
  console.log("[xAgt] 插件已加载")

  const taskManager = createTaskManagerHook()
  const systemTransform = createSystemTransformHook()

  // 初始化为默认配置，config hook 调用后会更新
  let resolvedAgentConfigs: Record<string, AgentConfig> = loadXAgtConfig({}).agentConfigs

  return {
    // ── 工具拦截器 ──────────────────────────────
    // 在 Vox 调用 read/write/edit/bash 时直接拦截
    "tool.execute.before": async (input: any, output: any) => {
      const sessionID = (input.sessionID || "").toLowerCase()
      const isVox = sessionID.startsWith("vox")

      if (isVox && VOZ_BLOCKED_TOOLS.has(input.tool)) {
        console.log(`[xAgt] ⛔ 拦截 Vox 调用 ${input.tool}`)
        output.args = {
          _blocked: true,
          _error: `[xAgt] Vox 禁止直接使用 ${input.tool} 工具。请使用 task() 派子代理（lynx/fixer/judge）执行。`,
        }
        return // 不执行原 hook，工具会因 _error 返回错误
      }

      await taskManager["tool.execute.before"](input, output)
    },

    "tool.execute.after": taskManager["tool.execute.after"],

    // ── 消息注入（看板）──────────────────────────
    "experimental.chat.messages.transform":
      taskManager["experimental.chat.messages.transform"],

    // ── 系统约束注入 ─────────────────────────────
    "experimental.chat.system.transform":
      systemTransform["experimental.chat.system.transform"],

    // ── 输出拦截器 ───────────────────────────────
    // 监听 Vox 回复，若含代码却无 task() 调用，替换为警告
    "chat.message": async (input: any, output: any) => {
      if (input.agent !== "vox") return

      const text = (output.parts || [])
        .filter((p: any) => p.type === "text")
        .map((p: any) => p.text)
        .join("")

      const hasCodeBlock = /```[\s\S]*```/.test(text)
      const hasInlineCode = /`.+`/.test(text)
      const hasTaskCall = /task\s*\(/.test(text)

      // 有代码但没 task() → 判定违规
      if ((hasCodeBlock || hasInlineCode) && !hasTaskCall) {
        console.log(`[xAgt] ⛔ 拦截 Vox 违规回复（含代码无 task()）`)
        output.parts = [
          {
            type: "text",
            text: `⛔ **自动拦截：违规输出**\n\n你的回复包含了代码片段，但没有使用 \`task()\` 调度子代理。\n\n作为调度总指挥，请不要直接输出代码。请重新生成回复，使用以下方式之一：\n\n- 改代码 → \`task("fixer", "精确指令")\`\n- 查代码 → \`task("lynx", "侦察指令")\`\n- 审代码 → \`task("judge", "审查指令")\``,
          },
        ]
      }
    },

    event: taskManager.event,

    config: async (config: any) => {
      const merged = loadXAgtConfig(config)
      resolvedAgentConfigs = merged.agentConfigs

      const voxAgent = createVoxAgent()
      const lynxAgent = createLynxAgent()
      const fixerAgent = createFixerAgent()
      const judgeAgent = createJudgeAgent()

      const applyOverrides = (agent: any, name: string) => {
        const cfg = merged.agentConfigs[name]
        if (cfg?.model) agent.model = cfg.model
        if (cfg?.description) agent.description = cfg.description
        return agent
      }

      ;(config as any).agent = (config as any).agent || {}
      ;(config as any).agent.vox = merged.disabled.includes("vox" as any) ? undefined : applyOverrides(voxAgent, "vox")
      ;(config as any).agent.lynx = merged.disabled.includes("lynx" as any) ? undefined : applyOverrides(lynxAgent, "lynx")
      ;(config as any).agent.fixer = merged.disabled.includes("fixer" as any) ? undefined : applyOverrides(fixerAgent, "fixer")
      ;(config as any).agent.judge = merged.disabled.includes("judge" as any) ? undefined : applyOverrides(judgeAgent, "judge")
    },

    "chat.params": async (input: any, output: any) => {
      if (!input?.agent) return
      const agentName = input.agent as string
      const reasoning = getReasoningForAgent(agentName, resolvedAgentConfigs)
      if (reasoning) {
        output.options = { ...output.options, ...reasoning }
      }
    },
  } as any
}
