/**
 * Context Rollover — 上下文轮转
 *
 * 监听 session.compacting 事件，在上下文窗口快满时：
 * 1. 从最近对话中提取经验教训
 * 2. 写入 MemoryStore
 * 3. 供后续会话注入
 */

import { MemoryStore } from "./store"

interface SessionCompactingInput {
  sessionID?: string
}

interface SessionCompactingOutput {
  system?: string[]
  messages?: any[]
}

type RolloverHandler = (
  input: SessionCompactingInput,
  output: SessionCompactingOutput
) => Promise<void>

/**
 * 创建上下文轮转处理器。
 * 绑定到 experimental.session.compacting 钩子使用。
 *
 * @param store MemoryStore 实例
 */
export function createRolloverHandler(store: MemoryStore): RolloverHandler {
  return async (_input: SessionCompactingInput, output: SessionCompactingOutput): Promise<void> => {
    // 检查是否有消息需要分析
    if (!output.messages || output.messages.length < 4) {
      return // 消息太少，不提取
    }

    // 简单提取策略：将最后一条 assistant 回复作为 lesson 候选
    // TODO: 后续可以升级为 LLM 驱动的总结提取
    const assistantMessages = output.messages.filter((m: Record<string, unknown>) => m.role === "assistant")
    if (assistantMessages.length > 0) {
      const lastAssistant = assistantMessages[assistantMessages.length - 1]
      const content = typeof lastAssistant.content === "string"
        ? lastAssistant.content.slice(0, 200)
        : ""

      // 只有内容有意义且长度合适时才记录
      if (content.length > 20 && content.length < 500) {
        await store.append({
          type: "lesson",
          content: `会话压缩点：${content.slice(0, 100)}...`,
        })
      }
    }
  }
}
