import { BackgroundJobBoard, type TaskRecord } from "../../utils/background-job-board"

export interface TaskManagerHook {
  getBoard(): BackgroundJobBoard
  "tool.execute.before": (input: { tool: string; sessionID: string; callID: string }, output: { args: any }) => Promise<void>
  "tool.execute.after": (input: { tool: string; sessionID: string; callID: string; args: any }, output: { title: string; output: string; metadata: any }) => Promise<void>
  "experimental.chat.messages.transform": (input: {}, output: { messages: Array<{ info: { role: string }; parts: Array<{ type: string; text: string }> }> }) => Promise<void>
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
      const running = board.getAllRunning()
      if (running.length === 0) return

      const summary = running
        .map((t) => `- ${t.id}: ${t.agent} → ${t.prompt}`)
        .join("\n")

      const lastMsg = output.messages[output.messages.length - 1]
      if (lastMsg) {
        lastMsg.parts.push({
          type: "text",
          text: `## 后台任务看板\n${summary}`,
        })
      }
    },
  }
}
