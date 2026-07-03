import { BackgroundJobBoard } from "../../utils/background-job-board"

const BOARD_SENTINEL = "SENTINEL: background-job-board-v1"

export interface TaskManagerHook {
  getBoard(): BackgroundJobBoard
  "tool.execute.before": (input: { tool: string; sessionID: string; callID: string }, output: { args: any }) => Promise<void>
  "tool.execute.after": (input: { tool: string; sessionID: string; callID: string; args: any }, output: { title: string; output: string; metadata: any }) => Promise<void>
  "experimental.chat.messages.transform": (input: {}, output: { messages: Array<{ info: { role: string }; parts: Array<{ type: string; text: string }> }> }) => Promise<void>
  event: (input: { event: { type: string; properties?: any } }) => Promise<void>
}

export function createTaskManagerHook(): TaskManagerHook {
  const board = new BackgroundJobBoard()

  return {
    getBoard: () => board,

    "tool.execute.before": async (input, output) => {
      if (input.tool !== "task") return
      const args = output.args as { subagent_type?: string; prompt?: string }
      board.launch(input.callID, {
        agent: args.subagent_type ?? "unknown",
        prompt: args.prompt ?? "",
      })
    },

    "tool.execute.after": async (input, output) => {
      if (input.tool !== "task") return
      const completed = output.title?.startsWith("Background task completed")
      const failed = output.title?.startsWith("Background task failed")
      if (completed) {
        board.complete(input.callID, output.output)
      } else if (failed) {
        board.fail(input.callID, output.output)
      }
    },

    "experimental.chat.messages.transform": async (_input, output) => {
      const active = board.getActive()
      if (active.length === 0) return

      // 检查最新一条用户消息是否已含 sentinel，避免同一轮重复注入
      const lastMsg = output.messages[output.messages.length - 1]
      if (!lastMsg) return
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
      })
    },

    event: async (input) => {
      // session idle 或 status 变化时，自动归档已注入过的完成任务
      if (input.event.type === "session.idle" || input.event.type === "session.status") {
        const count = board.reconcileAll("")
        if (count > 0) {
          board.cleanReconciled()
        }
      }
    },
  }
}
