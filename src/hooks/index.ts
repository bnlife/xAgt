import { logger } from "../utils/logger"

export interface TaskManagerHook {
  "tool.execute.before": (input: { tool: string; sessionID: string; callID: string }, output: { args: any }) => Promise<void>
  "tool.execute.after": (input: { tool: string; sessionID: string; callID: string; args: any }, output: { title: string; output: string; metadata: any }) => Promise<void>
  "experimental.chat.messages.transform": (input: {}, output: { messages: Array<{ info: { role: string }; parts: Array<{ type: string; text: string }> }> }) => Promise<void>
  event: (input: { event: { type: string; properties?: any; sessionID?: string } }) => Promise<void>
}

export function createTaskManagerHook(): TaskManagerHook {
  return {
    "tool.execute.before": async (input, _output) => {
      logger.debug("hook::task::execute_before", "entry", { tool: input.tool, sessionID: input.sessionID })
    },

    "tool.execute.after": async (input, _output) => {
      logger.debug("hook::task::execute_after", "entry", { tool: input.tool, sessionID: input.sessionID })
    },

    "experimental.chat.messages.transform": async (_input, _output) => {
      // 后台任务看板已移除
    },

    event: async (_input) => {
      // 后台任务看板已移除
    },
  }
}
