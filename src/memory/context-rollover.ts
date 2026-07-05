/**
 * Context Rollover — 上下文轮转
 *
 * 在会话上下文窗口快满时，从最近对话中提取经验教训。
 * 支持多种记忆类型：经验教训、决策记录、工作模式。
 */

import { MemoryStore, MemoryType } from "./store"
import { logger } from "../utils/logger"

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
 * 从消息中提取有意义的 lessons。
 * 按内容特征分类记忆类型。
 */
export function classifyMessages(messages: any[]): Array<{ type: MemoryType; content: string }> {
  const results: Array<{ type: MemoryType; content: string }> = []
  if (!messages || messages.length < 2) return results

  // 遍历用户消息和助手回复对，提取关键信息
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i]
    if (!msg || typeof msg.content !== "string") continue

    const content = msg.content.trim()

    // 跳过太短的消息
    if (content.length < 15) continue

    // 识别决策点（包含"决定"、"选择"、"采用"等关键词）
    if (/决定|选择|采用|改用|方案|决策|decided|decide|chose|chosen|opted|switch to|decision/i.test(content) && content.length < 300) {
      results.push({ type: "decision", content: content.slice(0, 200) })
      logger.debug("memory::rollover::compact", "extracted", { type: "decision", content: content.slice(0, 200) })
      continue
    }

    // 识别工作模式/经验（包含"先.*再"、"需要"、"建议"、"注意"等）
    if (/(先.*再|需要|建议|注意|必须|不要|避免|first.*then|need to|should|must|avoid|beware|recommend)/i.test(content) && content.length < 200) {
      results.push({ type: "pattern", content: content.slice(0, 200) })
      logger.debug("memory::rollover::compact", "extracted", { type: "pattern", content: content.slice(0, 200) })
      continue
    }

    // 识别经验教训（包含"报错"、"失败"、"问题"、"修复"等）
    if (/(报错|失败|问题.*解决|修复|错误|bug|教训|error|failed|failure|issue.*fix|fixed|fix|lesson learned)/i.test(content) && content.length < 200) {
      results.push({ type: "lesson", content: content.slice(0, 200) })
      logger.debug("memory::rollover::compact", "extracted", { type: "lesson", content: content.slice(0, 200) })
      continue
    }

    // 助手回复中较长的、内容丰富的，作为 lessons 候选
    if (msg.role === "assistant" && content.length > 80 && content.length < 500) {
      results.push({ type: "lesson", content: content.slice(0, 150) })
      logger.debug("memory::rollover::compact", "extracted", { type: "lesson", content: content.slice(0, 150) })
    }
  }

  return results
}

/**
 * 创建上下文轮转处理器。
 */
export function createRolloverHandler(store: MemoryStore): RolloverHandler {
  return async (_input: SessionCompactingInput, output: SessionCompactingOutput): Promise<void> => {
    logger.debug("memory::rollover::compact", "entry", { messageCount: output.messages?.length })
    if (!output.messages || output.messages.length < 4) return

    const entries = classifyMessages(output.messages)

    // 限制单次提取数量，避免写入过多
    const toSave = entries.slice(0, 5)

    for (const entry of toSave) {
      await store.append({
        type: entry.type,
        content: `checkpoint: ${entry.content}`,
      })
    }
  }
}
