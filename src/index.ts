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
import { createRolloverHandler } from "./memory/context-rollover"
import { buildMemoryContext } from "./memory/hierarchy"
import { ToolResultCache } from "./cost/cache"
import { TaskStatePersistence } from "./hooks/task-state-persistence"
import { createSmithAgent } from "./agents/smith"

export const xAgt: Plugin = async (ctx) => {
  console.log("[xAgt] plugin loaded")

  const gateway = new ToolGateway()
  const smithTrigger = createSmithTrigger()
  const memoryStore = new MemoryStore()
  const analytics = new AnalyticsCollector(memoryStore)
  const rolloverHandler = createRolloverHandler(memoryStore)
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
      const agentName = resolveAgentFromSession(input.sessionID || "")
      const result = gateway.check(agentName, input.tool, output.args)

      if (!result.allow) {
        output.args = {
          _blocked: true,
          _error: `[xAgt] ${result.reason}`,
        }
        return
      }

      // M6: 文件修改时清除相关缓存
      if (result.allow && (input.tool === "edit" || input.tool === "write")) {
        ToolResultCache.invalidateByPrefix("grep:")
        ToolResultCache.invalidateByPrefix("glob:")
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
    "experimental.chat.messages.transform":
      taskManager["experimental.chat.messages.transform"],

    // ── 会话压缩（记忆持久化）──────────────────────
    "experimental.session.compacting": rolloverHandler,

    // ── 系统约束注入 ─────────────────────────────
    "experimental.chat.system.transform": async (input: any, output: any) => {
      // 先注入系统约束
      await systemTransform["experimental.chat.system.transform"](input, output)

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
