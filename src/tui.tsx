/** @jsxImportSource @opentui/solid */
import { createMemo, createSignal, For, Show, onCleanup } from "solid-js"
import type { TuiPluginModule, TuiPluginApi } from "@opencode-ai/plugin/tui"
import type { TuiSidebarMcpItem } from "@opencode-ai/plugin/tui"

// ─── 布局常量 ───────────────────────────────────────────────
const LABEL_WIDTH = 9
const PADDING = 2
const MCP_POLL_MS = 3000
const PLUGIN_NAME = "xAgt"
const PLUGIN_VERSION = "v0.1"

// ─── 安全工具 ───────────────────────────────────────────────

/** 安全截断，防 undefined/null 和超长文本 */
function safeText(s: unknown, max = 28): string {
  if (s == null || typeof s !== "string") return ""
  return s.length <= max ? s : s.slice(0, max - 1) + "…"
}

/** 安全获取主题色，字段缺失时回退到 textMuted */
function themeColor(t: Record<string, string> | undefined, key: string): string {
  if (!t) return ""
  return (t as Record<string, string>)[key] ?? t.textMuted ?? ""
}

/** 安全读 config agent，任何异常返回空数组 */
function safeAgentConfig(state: TuiPluginApi["state"]): Record<string, Record<string, unknown>> {
  try {
    const c = (state.config as Record<string, unknown>)?.agent
    if (!c || typeof c !== "object") return {}
    return c as Record<string, Record<string, unknown>>
  } catch {
    return {}
  }
}

/** 安全读 MCP 列表，任何异常返回空数组 */
function safeMcpList(state: TuiPluginApi["state"]): TuiSidebarMcpItem[] {
  try {
    const list = state.mcp()
    if (!Array.isArray(list)) return []
    return list as unknown as TuiSidebarMcpItem[]
  } catch {
    return []
  }
}

/** 模型 ID 拆分为 provider/model */
function splitModel(id: string): { p: string; m: string } {
  const i = id.indexOf("/")
  return i === -1 ? { p: "", m: id } : { p: id.slice(0, i), m: id.slice(i + 1) }
}

// ─── Agent 行（3行：角色 / 模型 / MCP[名称列表]） ──────

function AgentRows(props: {
  name: string
  model: string
  mcps: string[]
  t: Record<string, string>
}) {
  const t = () => props.t
  const mcpLabel = createMemo(() => {
    const list = props.mcps
    if (list.length === 0) return ""
    return "MCP[" + list.join(" ") + "]"
  })
  return (
    <box width="100%" flexDirection="column" marginBottom={1}>
      {/* 第1行：角色 */}
      <text fg={themeColor(t(), "textMuted")} selectable={false}>{props.name}</text>
      {/* 第2行：模型名（完整provider/model，无标签） */}
      <text fg={themeColor(t(), "textMuted")} paddingLeft={PADDING} selectable={false}>
        {safeText(props.model, 32)}
      </text>
      {/* 第3行：MCP[名称列表] */}
      <Show when={mcpLabel()}>
        <text fg={themeColor(t(), "textMuted")} paddingLeft={PADDING} selectable={false}>
          {safeText(mcpLabel(), 32)}
        </text>
      </Show>
    </box>
  )
}

// ─── 主面板 ────────────────────────────────────────────────

function SidebarPanel(props: { api: TuiPluginApi; sessionID: string }) {
  const t = () => {
    try {
      return props.api.theme.current as unknown as Record<string, string>
    } catch {
      return {} as Record<string, string>
    }
  }

  // Agent 列表（防御性读取）
  const agentList = createMemo(() => {
    try {
      const cfg = safeAgentConfig(props.api.state)
      const list: {
        name: string
        model: string
        mcps: string[]
      }[] = []
      for (const [name, c] of Object.entries(cfg)) {
        if (c?.disable) continue
        const perm = c?.permission as Record<string, unknown> | undefined
        const mcpPerms = perm?.mcp as Record<string, string> | undefined
        const mcps = mcpPerms ? Object.keys(mcpPerms) : []
        list.push({
          name,
          model: typeof c?.model === "string" ? c.model : "pending",
          mcps,
        })
      }
      return list
    } catch {
      return []
    }
  })

  // 当前会话模型（防御性读取）
  const sessionLabel = createMemo(() => {
    try {
      const s = props.api.state.session.get(props.sessionID)
      const m = s?.model
      if (!m) return null
      const pid = typeof m.providerID === "string" ? m.providerID : ""
      const mid = typeof m.id === "string" ? m.id : ""
      return pid && mid ? `${pid}/${mid}` : null
    } catch {
      return null
    }
  })

  // MCP 状态（带 try/catch 的轮询）
  const [mcpItems, setMcpItems] = createSignal<TuiSidebarMcpItem[]>([])
  const refreshMcp = () => {
    try {
      setMcpItems(safeMcpList(props.api.state))
    } catch { /* 静默 */ }
  }
  refreshMcp()
  const mcpi = setInterval(refreshMcp, MCP_POLL_MS)
  onCleanup(() => clearInterval(mcpi))

  // 确保插件退出时也清理
  try { props.api.lifecycle.onDispose(() => clearInterval(mcpi)) } catch { /* 静默 */ }

  const mcpTotal = () => mcpItems().length
  const mcpOk = () => mcpItems().filter(i => i.status === "connected").length
  const mcpBad = () => mcpItems().filter(i => i.status !== "connected").length

  return (
    <box width="100%" flexDirection="column" paddingLeft={1} paddingRight={1} paddingTop={1} paddingBottom={1}>
      {/* 标题行 */}
      <box width="100%" flexDirection="row" justifyContent="space-between" alignItems="center">
        <box paddingLeft={1} paddingRight={1}>
          <text fg={themeColor(t(), "accent")} selectable={false}>{PLUGIN_NAME}</text>
        </box>
        <text fg={themeColor(t(), "textMuted")} selectable={false}>{PLUGIN_VERSION}</text>
      </box>

      {/* Agents 列表 */}
      <Show when={agentList().length > 0}>
        <box width="100%" flexDirection="column" marginTop={1}>
          <For each={agentList()}>
            {(a) => <AgentRows name={a.name} model={a.model} mcps={a.mcps} t={t()} />}
          </For>
        </box>
      </Show>

      {/* 当前会话 */}
      <Show when={sessionLabel()}>
        <box width="100%" flexDirection="column" marginTop={1}>
          <box width="100%" flexDirection="row" paddingLeft={PADDING}>
            <text fg={themeColor(t(), "textMuted")} width={LABEL_WIDTH} selectable={false}>session</text>
            <text fg={themeColor(t(), "textMuted")} selectable={false}>{safeText(sessionLabel()!, 28)}</text>
          </box>
        </box>
      </Show>

      {/* MCP 摘要 */}
      <Show when={mcpTotal() > 0}>
        <box width="100%" flexDirection="row" marginTop={1} alignItems="center">
          <text fg={themeColor(t(), "textMuted")} selectable={false}>mcp  </text>
          <text fg={themeColor(t(), "success")} selectable={false}>{mcpOk()}</text>
          <text fg={themeColor(t(), "textMuted")} selectable={false}>/{mcpTotal()}</text>
          <Show when={mcpBad() > 0}>
            <text fg={themeColor(t(), "textMuted")} selectable={false}>  </text>
            <text fg={themeColor(t(), "error")} selectable={false}>✗{mcpBad()}</text>
          </Show>
        </box>
      </Show>
    </box>
  )
}

// ─── 插件入口 ───────────────────────────────────────────────

const plugin: TuiPluginModule & { id: string } = {
  id: "xagt.sidebar",
  tui: async (api) => {
    try {
      api.slots.register({
        order: 500,
        slots: {
          sidebar_content(_ctx, props) {
            try {
              return <SidebarPanel api={api} sessionID={props.session_id} />
            } catch {
              return null
            }
          },
        },
      })
      api.event.on("session.status", () => {
        try { api.renderer.requestRender() } catch { /* 静默 */ }
      })
    } catch (err) {
      console.error(`[${PLUGIN_NAME}] 插件初始化失败:`, err)
    }
  },
}

export default plugin
