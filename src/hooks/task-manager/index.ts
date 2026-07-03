import type { Hooks } from "@opencode-ai/plugin"
import type { Part } from "@opencode-ai/sdk"
import { BackgroundJobBoard } from "../../utils/background-job-board"

const BOARD_SENTINEL = "SENTINEL: background-job-board-v1"

type ToolExecuteBeforeHandler = NonNullable<Hooks["tool.execute.before"]>
type ToolExecuteAfterHandler = NonNullable<Hooks["tool.execute.after"]>
type MessagesTransformHandler = NonNullable<Hooks["experimental.chat.messages.transform"]>
type EventHandler = NonNullable<Hooks["event"]>

export interface TaskManagerHook {
  getBoard(): BackgroundJobBoard
  "tool.execute.before": ToolExecuteBeforeHandler
  "tool.execute.after": ToolExecuteAfterHandler
  "experimental.chat.messages.transform": MessagesTransformHandler
  event: EventHandler
}

export function createTaskManagerHook(): TaskManagerHook {
  const board = new BackgroundJobBoard()

  return {
    getBoard: () => board,

    "tool.execute.before": async (input, output) => {
      try {
        if (input.tool !== "task") return
        const args = output.args as { subagent_type?: string; prompt?: string }
        board.launch(input.callID, {
          agent: args.subagent_type ?? "unknown",
          prompt: args.prompt ?? "",
        })
      } catch (err) {
        console.error("[xAgt] tool.execute.before 错误:", err)
      }
    },

    "tool.execute.after": async (input, output) => {
      try {
        if (input.tool !== "task") return
        const completed = output.title?.startsWith("Background task completed")
        const failed = output.title?.startsWith("Background task failed")
        if (completed) {
          board.complete(input.callID, output.output)
        } else if (failed) {
          board.fail(input.callID, output.output)
        }
      } catch (err) {
        console.error("[xAgt] tool.execute.after 错误:", err)
      }
    },

    "experimental.chat.messages.transform": async (_input, output) => {
      try {
        const active = board.getActive()
        if (active.length === 0) return

        // 检查最新一条用户消息是否已含 sentinel，避免同一轮重复注入
        const lastMsg = output.messages[output.messages.length - 1]
        if (!lastMsg) return

        // 只向用户消息注入看板，不向助手消息注入
        if (lastMsg.info?.role !== "user") return

        for (const part of lastMsg.parts) {
          if (part.type === "text" && part.text?.includes(BOARD_SENTINEL)) return
        }

        const summary = active
          .map((t) => {
            const state = t.state === "running" ? "运行中" : "已完成"
            const brief = t.prompt.slice(0, 40)
            return `- @${t.agent} [${state}]: ${brief}${t.prompt.length > 40 ? "..." : ""}`
          })
          .join("\n")

        lastMsg.parts.push({
          type: "text",
          text: `## 后台任务看板\n${summary}\n${BOARD_SENTINEL}`,
        } as Part)
      } catch (err) {
        console.error("[xAgt] experimental.chat.messages.transform 错误:", err)
      }
    },

    event: async (input) => {
      try {
        if (input.event.type === "session.idle" || input.event.type === "session.status") {
          board.reconcileAll()
          board.cleanReconciled()
        }
      } catch (err) {
        console.error("[xAgt] event 错误:", err)
      }
    },
  }
}
