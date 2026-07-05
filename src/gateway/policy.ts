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
        read: "allow",
        skill: "allow",
        todowrite: "allow",
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
        skill: "allow",
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
        skill: "allow",
      },
      dangerRules: [
        { pattern: /\brm\s+-rf\b/i, reason: "禁止递归删除（rm -rf）" },
        { pattern: /\bgit\s+push\s+.*(--force|-f)\b/i, reason: "禁止强制推送（git push --force）" },
        { pattern: /\bnpm\s+(publish|unpublish)\b/i, reason: "禁止 npm 发布操作" },
        { pattern: /\bnpm\s+install\s+(-g|--global)\b/i, reason: "禁止全局安装 npm 包" },
        { pattern: /\bnpm\s+i(nstall)?\s+(?!-g\b)(?!--global\b)(?!--save-dev\b)/i, reason: "禁止主动安装依赖（npm install），使用项目已有依赖" },
        { pattern: /\bchmod\s+.*777\b/i, reason: "禁止 chmod 777 权限全开" },
        { pattern: /\b(Remove-Item|rm|del)\s+.*(-Recurse|-Force|-r|-f)\s+.*(C:|D:|\/etc|\/home|\/usr|\/var|\/boot|C:\\Windows|C:\\Program)\b/i, reason: "禁止递归强制删除系统/用户目录" },
        { pattern: /\bdocker\s+(rm|rmi|system\s+prune)\b/i, reason: "禁止 Docker 清理操作" },
        { pattern: /\bgit\s+reset\s+--hard\b/i, reason: "禁止 git reset --hard（会丢失改动）" },
        { pattern: /\bgit\s+checkout\s+--\s/i, reason: "禁止 git checkout --（会丢弃文件改动）" },
        { pattern: /\b(Format-Volume|format\s+[a-z]:)\b/i, reason: "禁止格式化磁盘" },
        { pattern: /\bSet-ExecutionPolicy\b/i, reason: "禁止修改 PowerShell 执行策略" },
        { pattern: /\b(shutdown|reboot|restart-computer)\b/i, reason: "禁止关机/重启操作" },
        { pattern: /\bcurl\s+.*\|\s*(ba)?sh\b/i, reason: "禁止 curl pipe shell（远程代码执行）" },
        { pattern: /\bwget\s+.*-O-\s*\|\s*(ba)?sh\b/i, reason: "禁止 wget pipe shell（远程代码执行）" },
        { pattern: /\bInvoke-(Expression|WebRequest|RestMethod)\b/i, reason: "禁止 PowerShell 远程代码执行" },
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
        skill: "allow",
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
        skill: "allow",
      },
    },
  },
}
