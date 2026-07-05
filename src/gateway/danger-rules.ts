/**
 * 危险命令规则。
 *
 * 从 gateway/policy.ts 的 DEFAULT_POLICY.agents.fixer.dangerRules 中提取。
 * 独立导出，可被 policy.ts 引用，也可被 Smith 审查时对照检查。
 */

export interface DangerRule {
  pattern: RegExp
  reason: string
}

export const DANGER_RULES: DangerRule[] = [
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
]
