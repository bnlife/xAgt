/**
 * 标准日志工具 — 符合 logrule 规范
 * 前缀: FE:: (Node.js/TS 层)
 * 格式: [MM-DD HH:mm:ss][LEVEL] FE::module | key=value | msg=verb
 *
 * 级别过滤: XAGT_LOG 环境变量控制（默认 INFO）
 * 双通道: OpenCode client.app.log()（优先）+ 文件（fallback）
 * 降噪: 5s 窗口去重，相同 module+msg 仅首条输出，每 5 条输出一次汇总
 */

import * as fs from 'node:fs'
import * as path from 'node:path'

/** OpenCode client 引用，通过 initLogClient() 注入 */
let _client: any = null

// ── 常量 ──────────────────────────────────────────
const LOG_FILE = path.join(process.cwd(), '.xagt', 'logs', 'app.log')
const DEDUP_WINDOW_MS = 5000
const DEDUP_MAX_KEYS = 100
const MAX_LINE_LENGTH = 200
const MAX_VALUE_LENGTH = 60

// ── 类型 & 级别 ───────────────────────────────────
type LogLevel = 'TRACE' | 'DEBUG' | 'INFO' | 'WARN' | 'ERROR'

const LEVEL_ORDER: Record<LogLevel, number> = {
  TRACE: 0,
  DEBUG: 1,
  INFO: 2,
  WARN: 3,
  ERROR: 4,
}

/** 控制台仅输出这些级别 */
const CONSOLE_LEVELS: ReadonlySet<LogLevel> = new Set(['INFO', 'WARN', 'ERROR'])

/** 敏感字段名（值将被脱敏） */
const SENSITIVE_FIELDS: ReadonlySet<string> = new Set([
  'token',
  'key',
  'secret',
  'auth',
  'password',
])

// ── 级别过滤 ──────────────────────────────────────
let _effectiveLevel: number | null = null

function getEffectiveLevel(): number {
  if (_effectiveLevel === null) {
    const raw = (process.env.XAGT_LOG || 'INFO').toUpperCase() as LogLevel
    _effectiveLevel = LEVEL_ORDER[raw] ?? LEVEL_ORDER['INFO']
  }
  return _effectiveLevel
}

/** 重置级别缓存（仅测试用） */
export function resetLevelCache(): void {
  _effectiveLevel = null
}

// ── 降噪（LRU 去重） ──────────────────────────────
const dedupMap = new Map<string, { firstSeen: number; count: number }>()

function checkDedup(
  module: string,
  msg: string,
): { skip: boolean; repeated?: number } {
  const key = `${module}::${msg}`
  const now = Date.now()
  const entry = dedupMap.get(key)

  if (!entry) {
    // 首次出现 → 正常输出
    if (dedupMap.size >= DEDUP_MAX_KEYS) {
      const oldest = dedupMap.keys().next().value
      if (oldest !== undefined) dedupMap.delete(oldest)
    }
    dedupMap.set(key, { firstSeen: now, count: 0 })
    return { skip: false }
  }

  if (now - entry.firstSeen > DEDUP_WINDOW_MS) {
    // 窗口过期 → 重置
    dedupMap.set(key, { firstSeen: now, count: 0 })
    return { skip: false }
  }

  // 窗口内重复
  entry.count++
  if (entry.count % 5 === 0) {
    const repeated = entry.count
    entry.count = 0 // 重置计数器
    return { skip: false, repeated }
  }
  return { skip: true }
}

// ── 格式化辅助 ────────────────────────────────────
function timestamp(): string {
  const d = new Date()
  const MM = String(d.getMonth() + 1).padStart(2, '0')
  const DD = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  const ss = String(d.getSeconds()).padStart(2, '0')
  return `[${MM}-${DD} ${hh}:${mm}:${ss}]`
}

function formatValue(k: string, v: unknown): string {
  if (v === undefined || v === null) return `${k}=`
  let sv: string
  if (typeof v === 'object') {
    try {
      sv = JSON.stringify(v)
    } catch {
      sv = String(v)
    }
  } else {
    sv = String(v)
  }

  // 敏感字段脱敏
  if (SENSITIVE_FIELDS.has(k)) {
    if (sv.length <= 8) {
      sv = sv.slice(0, 2) + '***' + sv.slice(-2)
    } else {
      sv = sv.slice(0, 4) + '***' + sv.slice(-4)
    }
  }

  // 长值截断
  if (sv.length > MAX_VALUE_LENGTH) {
    sv = sv.slice(0, MAX_VALUE_LENGTH - 3) + `…(${sv.length})`
  }
  return `${k}=${sv}`
}

function buildFieldStr(
  fields?: Record<string, unknown>,
  extraFields?: Record<string, string>,
): string {
  const parts: string[] = []

  // 额外字段（code、repeated 等）在前
  if (extraFields) {
    for (const [k, v] of Object.entries(extraFields)) {
      parts.push(`${k}=${v}`)
    }
  }

  if (fields) {
    for (const [k, v] of Object.entries(fields)) {
      // errorCode 已提取为额外字段，不在 fields 中重复输出
      if (k === 'errorCode') continue
      parts.push(formatValue(k, v))
    }
  }

  return parts.length > 0 ? ' | ' + parts.join(' ') : ''
}

// ── 文件写入 ──────────────────────────────────────
let fileDirCreated = false

function writeToFile(line: string): void {
  try {
    if (!fileDirCreated) {
      const dir = path.dirname(LOG_FILE)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
      fileDirCreated = true
    }
    fs.appendFileSync(LOG_FILE, line + '\n', 'utf-8')
  } catch {
    // 目录创建或文件写入失败静默处理，不干扰主流程
  }
}

// ── 核心日志函数 ──────────────────────────────────
function log(
  level: LogLevel,
  module: string,
  msg: string,
  fields?: Record<string, unknown>,
  errorCode?: string,
): void {
  // 1. 级别过滤（低于阈值直接跳过，不做任何格式化）
  if (LEVEL_ORDER[level] < getEffectiveLevel()) return

  // 2. 解析 errorCode：优先使用显式参数，其次从 fields 中提取（向后兼容）
  let resolvedCode = errorCode
  if (!resolvedCode && fields && 'errorCode' in fields) {
    resolvedCode = String(fields.errorCode)
  }

  // 3. 降噪检查
  const dedup = checkDedup(module, msg)
  if (dedup.skip) return

  // 4. 构建额外字段
  const extra: Record<string, string> = {}
  if (resolvedCode) extra['code'] = resolvedCode
  if (dedup.repeated) extra['repeated'] = String(dedup.repeated)

  // 5. 格式化行
  const fieldStr = buildFieldStr(fields, extra)
  const levelStr = `[${level.padEnd(5)}]`
  const line = `${timestamp()}${levelStr} FE::${module}${fieldStr}${msg ? ` | msg=${msg}` : ''}`
  const output = line.length > MAX_LINE_LENGTH ? line.slice(0, MAX_LINE_LENGTH - 5) + `…(${line.length})` : line

  // 6. 控制台输出（默认关闭，避免 OpenCode TUI 界面污染）
  //    仅当 XAGT_LOG_CONSOLE=1 时启用（开发调试用）
  if (process.env.XAGT_LOG_CONSOLE === '1' && CONSOLE_LEVELS.has(level)) {
    console.log(output)
  }

  // 7. 文件输出（全部经过级别过滤的级别）
  writeToFile(output)

  // 8. 如果 OpenCode client 可用，发送到 OpenCode 日志系统
  if (_client && typeof _client.app?.log === 'function') {
    const opencodeLevel = level === 'TRACE' ? 'debug' : level.toLowerCase() as 'debug' | 'info' | 'warn' | 'error'
    _client.app.log({
      body: {
        service: 'xagt',
        level: opencodeLevel,
        message: `${module} | ${msg || '—'}`,
        extra: fields ? { module, ...fields } : { module },
      },
    }).catch(() => { /* 静默处理，不影响主流程 */ })
  }
}

/**
 * 注入 OpenCode client 引用。
 * 调用后日志会同时发送到 OpenCode 日志系统（Ctrl+L 面板可见）。
 * 在插件初始化时由 index.ts 调用，测试环境不调用即可。
 */
export function initLogClient(client: any): void {
  _client = client
}

// ── 导出接口 ──────────────────────────────────────
export const logger = {
  trace: (module: string, msg: string, fields?: Record<string, unknown>) =>
    log('TRACE', module, msg, fields),
  debug: (module: string, msg: string, fields?: Record<string, unknown>) =>
    log('DEBUG', module, msg, fields),
  info: (module: string, msg: string, fields?: Record<string, unknown>) =>
    log('INFO', module, msg, fields),
  warn: (module: string, msg: string, fields?: Record<string, unknown>) =>
    log('WARN', module, msg, fields),
  error: (
    module: string,
    msg: string,
    fields?: Record<string, unknown>,
    errorCode?: string,
  ) => log('ERROR', module, msg, fields, errorCode),
}
