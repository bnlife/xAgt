import { resolveAgentFromSession } from "./interceptor"

/**
 * Session-Agent 注册表
 *
 * 通过 chat.params hook 的 input.agent 字段建立 sessionID→agent 的可靠映射，
 * 解决 primary agent sessionID 不含 agent 名前缀导致拦截失效的问题。
 *
 * 解析顺序：
 * 1. chat.params 注册过的 sessionID → 直接取映射值
 * 2. 兜底：前缀正则解析（用于 subagent sessionID 如 "fixer-xxx"）
 * 3. 都失败：返回空字符串（由调用方决定是否拦截）
 */
export class SessionAgentRegistry {
  private map = new Map<string, string>()

  /** chat.params hook 触发时注册 sessionID 与 agent 的关联 */
  register(sessionID: string, agentName: string): void {
    if (!sessionID || !agentName) return
    this.map.set(sessionID, agentName.toLowerCase())
  }

  /** 解析 sessionID 对应的 agent 名称 */
  resolve(sessionID: string): string {
    if (!sessionID) return ""
    const hit = this.map.get(sessionID)
    if (hit) return hit
    // 兜底：subagent 的 sessionID 可能确实带 agent 前缀
    return resolveAgentFromSession(sessionID)
  }

  /** 清除指定 sessionID 的映射（用于非 xAgt agent 清理） */
  clearSession(sessionID: string): void {
    this.map.delete(sessionID)
  }

  /** 判断 sessionID 是否有已注册的映射 */
  hasMapping(sessionID: string): boolean {
    return this.map.has(sessionID)
  }

  /** 测试用：清除映射 */
  clear(): void {
    this.map.clear()
  }
}
