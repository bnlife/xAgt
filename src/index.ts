import type { Plugin } from "@opencode-ai/plugin"
import { createVoxAgent } from "./agents/vox"
import { createLynxAgent } from "./agents/lynx"
import { createFixerAgent } from "./agents/fixer"
import { createJudgeAgent } from "./agents/judge"
import { createTaskManagerHook } from "./hooks"
import { createSystemTransformHook } from "./hooks/system-transform"
import { loadXAgtConfig, getReasoningForAgent } from "./config"
import type { AgentConfig } from "./config"
import type { AgentName } from "./agents"
import { SessionAgentRegistry } from "./gateway/session-registry"
import { ToolGateway } from "./gateway/interceptor"
import { createSmithTrigger } from "./hooks/smith-trigger"
import { AnalyticsCollector } from "./analytics/collector"
import { MemoryStore } from "./memory/store"
import { createRolloverHandler } from "./memory/context-rollover"
import { SessionArchiver } from "./memory/session-archiver"
import { buildMemoryContext } from "./memory/hierarchy"
import { ToolResultCache } from "./cost/cache"
import { TaskStatePersistence } from "./hooks/task-state-persistence"
import { createSmithAgent } from "./agents/smith"
import { logger, initLogClient } from "./utils/logger"
import { CODE_PATTERNS, CODE_EXEMPTIONS, CODE_BLOCK_MESSAGE } from "./rules/output-rules"

// ── Judge 强制审查状态机 ─────────────────────
// 追踪 Fixer→Judge 流程，确保 Fixer 完成后必须经过 Judge 审查
const judgeGateMap = new Map<string, { fixerDone: boolean; fixerAt: number; judgeDone: boolean }>()
const pendingFixerDispatch = new Set<string>()

export const xAgt: Plugin = async (ctx) => {
  logger.info("plugin::init", "plugin_loaded", { cwd: process.cwd(), hasCtx: !!ctx })

  // 注入 OpenCode client 到日志系统（日志会出现在 Ctrl+L 面板）
  if (ctx.client) {
    initLogClient(ctx.client)
  }

  const gateway = new ToolGateway()
  const sessionRegistry = new SessionAgentRegistry()
  const smithTrigger = createSmithTrigger()
  const memoryStore = new MemoryStore()
  const analytics = new AnalyticsCollector(memoryStore)
  const rolloverHandler = createRolloverHandler(memoryStore)
  const sessionArchiver = new SessionArchiver()
  const pendingSmithSessions = new Set<string>()
  const taskState = new TaskStatePersistence()

  const taskManager = createTaskManagerHook()
  const systemTransform = createSystemTransformHook()

  // 初始化为默认配置，config hook 调用后会更新
  let resolvedAgentConfigs: Record<string, AgentConfig> = loadXAgtConfig({}).agentConfigs

  return {
    // ── 工具拦截器 ──────────────────────────────
    // 在 Vox 调用 read/write/edit/bash 时直接拦截
    "tool.execute.before": async (input: any, output: any) => {
      const agentName = sessionRegistry.resolve(input.sessionID || "")

      // #1: Judge 强制审查阻断 — Fixer 完成但未 Judge 审查，禁止派其他子代理
      if (input.tool === "task" && input.sessionID) {
        const entry = judgeGateMap.get(input.sessionID)
        if (entry && entry.fixerDone && !entry.judgeDone) {
          if (Date.now() - entry.fixerAt > 30 * 60 * 1000) {
            judgeGateMap.delete(input.sessionID)
          } else {
            const args = output?.args as any
            const targetAgent = args?.subagent_type
            if (targetAgent === "fixer") {
              pendingFixerDispatch.add(input.sessionID)
            }
            if (targetAgent && targetAgent !== "judge") {
              throw new Error(`[xAgt] judge_required | Fixer 已完成修改但尚未通过 Judge 审查。请先派 @judge 审查，审查通过后才能继续其他任务。`)
            }
          }
        }
      }

      // 非 xAgt agent 且无法解析 agentName → 放行
      if (!agentName) return

      // 分两步检查：
      // 1. 不在 xAgt 白名单 → 非 xAgt agent → 拦截（禁止 OpenCode 原生 agent 调用）
      // 2. 在白名单但没配策略 → 放行无限制（用户没限制就是全放）
      // 3. 在白名单且有策略 → 按策略执行
      const XAGT_AGENTS: AgentName[] = ["vox", "lynx", "fixer", "judge", "smith"]
      if (!(XAGT_AGENTS as string[]).includes(agentName)) {
        logger.error("gateway::policy", "unknown_agent", { sessionID: input.sessionID, agent: agentName }, "E1001")
        throw new Error(`[xAgt] unknown_agent | sessionID=${input.sessionID} resolved="${agentName}" | xAgt agents only`)
      }

      if (!gateway.hasPolicy(agentName)) {
        // xAgt agent 但没配策略 → 放行，不校验
        return
      }

      const result = gateway.check(agentName, input.tool, output.args)

      if (!result.allow) {
        logger.error("gateway::policy", "policy_blocked", { agent: agentName, tool: input.tool, reason: result.reason }, "E1002")
        throw new Error(`[xAgt] ${result.reason}`)
      }

      // M6: 文件修改时清除相关缓存
      if (input.tool === "edit" || input.tool === "write") {
        ToolResultCache.invalidateByPrefix("grep:")
        ToolResultCache.invalidateByPrefix("glob:")
      }

      await taskManager["tool.execute.before"](input, output)
    },

    "tool.execute.after": async (input: any, output: any) => {
      // M7-b: 采集 Judge 拒绝 / Fixer 失败事件
      if (input.tool === "task" && input.sessionID) {
        const agentName = sessionRegistry.resolve(input.sessionID)
        const outputText = output?.output ?? ""

        // #1: Judge 强制审查状态追踪
        if (agentName === "fixer" && (output.title?.includes("completed") && !output.title?.includes("failed"))) {
          if (pendingFixerDispatch.has(input.sessionID)) {
            judgeGateMap.set(input.sessionID, { fixerDone: true, fixerAt: Date.now(), judgeDone: false })
            pendingFixerDispatch.delete(input.sessionID)
          }
        }
        if (agentName === "judge" && (outputText.includes("通过") || outputText.includes("拒绝"))) {
          const entry = judgeGateMap.get(input.sessionID)
          if (entry) {
            entry.judgeDone = true
          }
        }

        if (agentName === "judge" && (outputText.includes("不通过") || outputText.includes("拒绝"))) {
          await analytics.recordJudgeRejection(
            outputText.slice(0, 200),
            undefined,
            { sessionID: input.sessionID }
          )
        }
        if (agentName === "fixer" && (outputText.includes("失败") || output.title?.includes("failed"))) {
          await analytics.recordFixerFailure(
            outputText.slice(0, 200),
            undefined,
            { sessionID: input.sessionID }
          )
        }

        // M5: Fixer 任务失败时保存状态，完成时清除
        if (agentName === "fixer") {
          if (output.title?.includes("failed") || outputText.includes("失败")) {
            await taskState.save({
              version: 1,
              updatedAt: new Date().toISOString(),
              activeTask: {
                taskID: `fixer-${Date.now()}`,
                sandboxRef: { branchName: "", worktreePath: "", baseCommit: "" },
                instruction: { files: [], operation: outputText.slice(0, 200), verification: "" },
                completedSteps: [],
                nextStepIndex: 0,
                totalSteps: 1,
                modifiedFiles: [],
                contextSummary: outputText.slice(0, 200),
                lastError: outputText.slice(0, 200),
              },
              pendingTasks: [],
            })
          } else if (output.title?.includes("completed")) {
            await taskState.clear()
          }
        }
      }
      await taskManager["tool.execute.after"](input, output)
    },

    // ── 消息注入（看板）──────────────────────────
    "experimental.chat.messages.transform": async (input: any, output: any) => {
      return taskManager["experimental.chat.messages.transform"](input, output)
    },

    // ── 会话压缩（记忆持久化）──────────────────────
    "experimental.session.compacting": rolloverHandler,

    // ── 系统约束注入 ─────────────────────────────
    "experimental.chat.system.transform": async (input: any, output: any) => {
      // 先注入系统约束
      await systemTransform["experimental.chat.system.transform"](input, output)

      // 强制 Vox 输出结构化思考痕迹（覆盖 Communication 的"直接回答"）
      output.system = output.system || []
      output.system.push(
        "\n## 输出要求\n" +
        "每次回复必须在内容中显式输出思考过程，格式（不超过 3 行）：\n" +
        "> 拆解：[一句话说清用户需求]\n" +
        "> 策略：[选谁 + 怎么派 + 串并行]\n" +
        "> 风险：[信息足够吗？有无循环风险？]\n" +
        "然后再输出结论或调度指令。"
      )

      // 注入记忆上下文
      try {
        const memoryCtx = await buildMemoryContext(memoryStore)
        if (memoryCtx.longTermMemory) {
          output.system = output.system || []
          output.system.push("\n" + memoryCtx.longTermMemory)
        }
      } catch {
        // 记忆注入失败不影响主流程
      }

      // M5: 断点续传 — 检测未完成任务
      try {
        const pending = await taskState.load()
        if (pending?.activeTask) {
          output.system = output.system || []
          output.system.push(
            "\n## 断点续传：检测到未完成的任务\n" +
            `检测到上一个 Fixer 任务（${pending.activeTask.taskID}）未完成。\n` +
            `已完成 ${pending.activeTask.completedSteps.length}/${pending.activeTask.totalSteps} 步。\n` +
            `上下文：${pending.activeTask.contextSummary}\n` +
            `请根据情况决定是否恢复或重新分派。`
          )
        }
      } catch {
        // 续传信息不影响主流程
      }

      // Smith 定期审查：写报告到文件，Vox 仅提醒用户
      if (input?.sessionID && pendingSmithSessions.has(input.sessionID)) {
        pendingSmithSessions.delete(input.sessionID)
        output.system = output.system || []

        // 生成报告并写入文件
        try {
          const { join } = await import("path")
          const { mkdir, writeFile } = await import("fs/promises")
          const { existsSync } = await import("fs")
          const { XAGT_DIR } = await import("./constants")
          const reportsDir = join(process.cwd(), XAGT_DIR, "reports")
          if (!existsSync(reportsDir)) await mkdir(reportsDir, { recursive: true })
          const reportContent = await analytics.getReportForSmith()
          await writeFile(join(reportsDir, "smith-latest.md"), reportContent, "utf-8")
        } catch {
          // 报告写入失败不影响主流程
        }

        output.system.push(
          "\n## Smith 分析报告已生成\n" +
          "Smith 的定期分析报告已写入 .xagt/reports/smith-latest.md。\n" +
          "请用户查阅后自行决定是否需要调整提示词或工具配置。"
        )
      }

      // 注入最近对话存档摘要
      const recentSummary = await sessionArchiver.getRecentSummary(5)
      if (recentSummary) {
        output.system = output.system || []
        output.system.push(`\n## 最近对话存档\n${recentSummary}\nVox 需要时可读取存档文件了解历史上下文。`)
      }
    },

    // ── 输出拦截器 ───────────────────────────────
    // 监听 Vox 回复，若含代码却无 task() 调用，替换为警告
    "chat.message": async (input: any, output: any) => {
      // 增量存档对话（所有 agent 的消息都存档）
      const msgSessionID = input?.sessionID || (input as any)?.session || ""
      const contentParts = output?.parts || output?.message?.content || output
      if (msgSessionID) {
        await sessionArchiver.appendMessage(msgSessionID, contentParts)
      }

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

      const hasCodeBlock = CODE_PATTERNS.codeBlock.test(text)
      const hasInlineCode = CODE_PATTERNS.inlineCode.test(text)
      const hasTaskCall = CODE_EXEMPTIONS.hasTaskCall.test(text)

      // 有代码但没 task() → 判定违规
      if ((hasCodeBlock || hasInlineCode) && !hasTaskCall) {
        logger.warn("plugin::output", "blocked_code_without_task", { session: input.sessionID })
        output.parts = [
          {
            type: "text",
            text: CODE_BLOCK_MESSAGE,
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
      const smithAgent = createSmithAgent()

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
      ;(config as any).agent.smith = merged.disabled.includes("smith" as any) ? undefined : applyOverrides(smithAgent, "smith")

      // 删除非 xAgt 白名单 agent（如 opencode 内置的 explore/general），防止 Vox 调度到它们
      const xAgtAgentNames = new Set(["vox", "lynx", "fixer", "judge", "smith"])
      for (const key of Object.keys((config as any).agent)) {
        if (!xAgtAgentNames.has(key)) {
          delete (config as any).agent[key]
        }
      }
    },

    "chat.params": async (input: any, output: any) => {
      if (!input?.agent) return
      const agentName = input.agent as string

      // 注册 sessionID→agent 映射，供 tool.execute.before/after 使用
      // 这是识别 primary agent（如 Vox）身份的可靠数据源，因为它的 sessionID 不含 agent 前缀
      if (input.sessionID) {
        sessionRegistry.register(input.sessionID, agentName)
      }

      const reasoning = getReasoningForAgent(agentName, resolvedAgentConfigs)
      if (reasoning) {
        output.options = { ...output.options, ...reasoning }
      }
    },
  } as any
}
