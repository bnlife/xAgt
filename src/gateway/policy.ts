/**
 * Tool Gateway — 策略定义
 *
 * 声明式定义每个 Agent 允许/禁止的工具列表和危险命令检测规则。
 */

export type ToolPermission = "allow" | "deny"

export interface DangerRule {
  /** 危险命令的正则模式 */
  pattern: RegExp
  /** 拦截理由 */
  reason: string
}

export interface AgentToolPolicy {
  /** 工具级别的权限映射（工具名 → allow/deny） */
  tools: Record<string, ToolPermission>
  /** bash 命令的危险模式检测 */
  dangerRules?: DangerRule[]
}

export interface GatewayConfig {
  /** Agent 名称 → 策略 */
  agents: Record<string, AgentToolPolicy>
}

/**
 * 默认策略配置。
 * 白名单模式：只允许显式列出的工具，未列出或标记 deny 的均被拦截。
 */
export const DEFAULT_POLICY: GatewayConfig = {
  agents: {
    vox: {
      tools: {
        task: "allow",
        read: "deny",
        write: "deny",
        edit: "deny",
        bash: "deny",
        grep: "deny",
        glob: "deny",
        apply_diff: "deny",
      },
    },
    lynx: {
      tools: {
        read: "allow",
        grep: "allow",
        glob: "allow",
        "context7_query-docs": "allow",
        "context7_resolve-library-id": "allow",
        "gh_grep_searchGitHub": "allow",
        webfetch: "allow",
        write: "deny",
        edit: "deny",
        bash: "deny",
      },
    },
    fixer: {
      tools: {
        read: "allow",
        write: "allow",
        edit: "allow",
        bash: "allow",
      },
      dangerRules: [
        { pattern: /\brm\s+-rf\b/i, reason: "禁止递归删除（rm -rf）" },
      ],
    },
    judge: {
      tools: {
        read: "allow",
        grep: "allow",
        glob: "allow",
        write: "deny",
        edit: "deny",
        bash: "deny",
      },
    },
    smith: {
      tools: {
        read: "allow",
        grep: "allow",
        glob: "allow",
        write: "deny",
        edit: "deny",
        bash: "deny",
      },
    },
  },
}
