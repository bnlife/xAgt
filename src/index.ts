import type { Plugin } from "@opencode-ai/plugin"
import { createVoxAgent } from "./agents/vox"
import { createLynxAgent } from "./agents/lynx"
import { createFixerAgent } from "./agents/fixer"
import { createJudgeAgent } from "./agents/judge"
import { createTaskManagerHook } from "./hooks"
import { createSystemTransformHook } from "./hooks/system-transform"
import { loadXAgtConfig, getReasoningForAgent } from "./config"
import type { AgentConfig } from "./config"
import { resolveAgentFromSession } from "./gateway/interceptor"
import { ToolGateway } from "./gateway/interceptor"
import { createSmithTrigger } from "./hooks/smith-trigger"
import { AnalyticsCollector } from "./analytics/collector"
import { MemoryStore } from "./memory/store"

export const xAgt: Plugin = async (ctx) => {
  console.log("[xAgt] plugin loaded")

  const gateway = new ToolGateway()
  const smithTrigger = createSmithTrigger()
  const memoryStore = new MemoryStore()
  const analytics = new AnalyticsCollector(memoryStore)
  const pendingSmithSessions = new Set<string>()

  const taskManager = createTaskManagerHook()
  const systemTransform = createSystemTransformHook()

  // 初始化为默认配置，config hook 调用后会更新
  let resolvedAgentConfigs: Record<string, AgentConfig> = loadXAgtConfig({}).agentConfigs

  return {
    // ── 工具拦截器 ──────────────────────────────
    // 在 Vox 调用 read/write/edit/bash 时直接拦截
    "tool.execute.before": async (input: any, output: any) => {
      const agentName = resolveAgentFromSession(input.sessionID || "")
      const result = gateway.check(agentName, input.tool, output.args)

      if (!result.allow) {
        output.args = {
          _blocked: true,
          _error: `[xAgt] ${result.reason}`,
        }
        return
      }

      await taskManager["tool.execute.before"](input, output)
    },

    "tool.execute.after": async (input: any, output: any) => {
      // M7-b: 采集 Judge 拒绝 / Fixer 失败事件
      if (input.tool === "task" && input.sessionID) {
        const agentName = resolveAgentFromSession(input.sessionID)
        const outputText = output?.output ?? ""
        if (agentName === "judge" && (outputText.includes("不通过") || outputText.includes("拒绝"))) {
          await analytics.recordJudgeRejection(
            outputText.slice(0, 200),
            { sessionID: input.sessionID }
          )
        }
        if (agentName === "fixer" && (outputText.includes("失败") || output.title?.includes("failed"))) {
          await analytics.recordFixerFailure(
            outputText.slice(0, 200),
            { sessionID: input.sessionID }
          )
        }
      }
      await taskManager["tool.execute.after"](input, output)
    },

    // ── 消息注入（看板）──────────────────────────
    "experimental.chat.messages.transform":
      taskManager["experimental.chat.messages.transform"],

    // ── 系统约束注入 ─────────────────────────────
    "experimental.chat.system.transform": async (input: any, output: any) => {
      // 先注入系统约束
      await systemTransform["experimental.chat.system.transform"](input, output)

      // 注入 Smith 激活指令
      if (input?.sessionID && pendingSmithSessions.has(input.sessionID)) {
        pendingSmithSessions.delete(input.sessionID)
        output.system = output.system || []
        const analyticsReport = await analytics.getReportForSmith()
        output.system.push(
          "\n## Smith 定期审查已触发\n" +
          "本回合 Smith（锐匠）需要执行一次定期审查。\n" +
          "请调度 Smith 审查 xAgt 源代码，检查 Prompt 一致性和规范合规性。\n" +
          "以下是近期分析数据，可辅助审查：\n\n" +
          analyticsReport + "\n\n" +
          "基于以上数据，请向 Vox 提出具体的提示词或工具配置微调建议。"
        )
      }
    },

    // ── 输出拦截器 ───────────────────────────────
    // 监听 Vox 回复，若含代码却无 task() 调用，替换为警告
    "chat.message": async (input: any, output: any) => {
      if (input.agent !== "vox") return

      // Smith 频率计数
      if (input.sessionID) {
        smithTrigger.activate(input.sessionID)
        if (smithTrigger.shouldActivate(input.sessionID)) {
          pendingSmithSessions.add(input.sessionID)
        }
      }

      const text = (output.parts || [])
        .filter((p: any) => p.type === "text")
        .map((p: any) => p.text)
        .join("")

      const hasCodeBlock = /```[\s\S]*```/.test(text)
      const hasInlineCode = /`.+`/.test(text)
      const hasTaskCall = /task\s*\(/.test(text)

      // 有代码但没 task() → 判定违规
      if ((hasCodeBlock || hasInlineCode) && !hasTaskCall) {
        console.log(`[xAgt] blocked vox reply with code but no task()`)
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
