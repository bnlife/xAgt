import * as fs from "node:fs"
import * as path from "node:path"
import { homedir } from "node:os"

// ─── 类型定义 ───────────────────────────────────────────────

export interface XagtUserConfig {
  model?: Record<string, string>
  provider?: Record<string, Record<string, unknown>>
  mcp?: Record<string, Record<string, boolean> | undefined>
}

// ─── 常量 ───────────────────────────────────────────────────

const CONFIG_FILE_NAME = "xagt.config.jsonc"

// ─── 工具 ───────────────────────────────────────────────────

/** 去掉 JSONC 中的注释和尾部逗号，返回纯净 JSON */
function stripJsonc(raw: string): string {
  // 分两步：先保护字符串内容，再处理注释
  // 1. 把带引号的字符串临时替换为占位符，避免误伤 URL 中的 //
  const strings: string[] = []
  const withoutStrings = raw.replace(/"([^"\\]|\\.)*"/g, (m) => {
    strings.push(m)
    return `__STR${strings.length - 1}__`
  })
  // 2. 去掉行注释 // 和块注释 /* */
  const noComments = withoutStrings.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "")
  // 3. 恢复字符串
  const restored = noComments.replace(/__STR(\d+)__/g, (_, i) => strings[parseInt(i)])
  // 4. 去掉对象/数组末尾多余的逗号
  return restored.replace(/,\s*([}\]])/g, "$1")
}

/** 搜索配置文件的路径，返回第一个找到的 */
function findConfigPath(projectDir?: string): string | null {
  const candidates: string[] = []

  // 1. 项目级 .opencode/xagt.config.jsonc
  if (projectDir) {
    candidates.push(path.join(projectDir, ".opencode", CONFIG_FILE_NAME))
  }
  // 2. 全局 ~/.config/opencode/xagt.config.jsonc
  candidates.push(path.join(homedir(), ".config", "opencode", CONFIG_FILE_NAME))

  for (const p of candidates) {
    try {
      if (fs.statSync(p).isFile()) return p
    } catch {
      // 文件不存在，跳过
    }
  }
  return null
}

/** 从 JSONC 文件加载配置，失败返回空对象 */
export function loadXagtConfig(projectDir?: string): XagtUserConfig {
  try {
    const configPath = findConfigPath(projectDir)
    if (!configPath) return {}

    const raw = fs.readFileSync(configPath, "utf-8")
    const clean = stripJsonc(raw)
    const parsed = JSON.parse(clean)

    // 基本类型校验
    const result: XagtUserConfig = {}
    if (parsed.model && typeof parsed.model === "object" && !Array.isArray(parsed.model)) {
      result.model = parsed.model as Record<string, string>
    }
    if (parsed.provider && typeof parsed.provider === "object" && !Array.isArray(parsed.provider)) {
      result.provider = parsed.provider as Record<string, Record<string, unknown>>
    }
    if (parsed.mcp && typeof parsed.mcp === "object" && !Array.isArray(parsed.mcp)) {
      result.mcp = parsed.mcp as Record<string, Record<string, boolean> | undefined>
    }
    return result
  } catch {
    return {}
  }
}
