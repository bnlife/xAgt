/**
 * Tool Gateway — 拦截核心
 *
 * 根据策略定义校验工具调用，决定放行或拦截。
 */

import { DEFAULT_POLICY } from "./policy"
import type { GatewayConfig, AgentToolPolicy } from "./policy"

export interface InterceptorResult {
  /** true=放行，false=拦截 */
  allow: boolean
  /** 拦截原因（仅 allow=false 时有值） */
  reason?: string
}

/**
 * 从 sessionID 中提取 Agent 名称。
 *
 * 规则：取 sessionID 中第一个非字母字符之前的部分，转为小写。
 * "vox-abc123" → "vox"
 * "lynx/session/xyz" → "lynx"
 * "fixer_001" → "fixer"
 * "Vox-Main" → "vox"
 */
export function resolveAgentFromSession(sessionID: string): string {
  if (!sessionID) return ""
  const match = sessionID.toLowerCase().match(/^([a-z]+)/)
  return match ? match[1] : sessionID.toLowerCase()
}

/**
 * 工具调用网关。
 * 校验工具调用是否允许，基于声明式策略配置。
 */
export class ToolGateway {
  constructor(private config: GatewayConfig = DEFAULT_POLICY) {}

  /**
   * 检查某个 Agent 的工具调用是否允许。
   * @param agentName Agent 名称（小写）
   * @param tool 工具名称
   * @param args 工具参数（用于危险命令检测）
   */
  check(agentName: string, tool: string, args?: any): InterceptorResult {
    // 1. 查找 Agent 策略
    const policy = this.config.agents[agentName]
    if (!policy) {
      return {
        allow: false,
        reason: `未知 Agent "${agentName}"，所有工具已被拦截`,
      }
    }

    // 2. 检查工具权限
    const permission = policy.tools[tool]
    if (permission === undefined) {
      return {
        allow: false,
        reason: `Agent "${agentName}" 不允许使用工具 "${tool}"（未配置）`,
      }
    }
    if (permission === "deny") {
      return {
        allow: false,
        reason: `Agent "${agentName}" 不允许使用工具 "${tool}"`,
      }
    }

    // 3. 如果是 bash，检查危险命令
    if (tool === "bash" && policy.dangerRules && policy.dangerRules.length > 0) {
      const command = typeof args === "string" ? args : (args?.command ?? args?.args ?? "")
      for (const rule of policy.dangerRules) {
        if (rule.pattern.test(command)) {
          return {
            allow: false,
            reason: `危险命令拦截：${rule.reason}`,
          }
        }
      }
    }

    return { allow: true }
  }
}
