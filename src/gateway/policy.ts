/**
 * Tool Gateway — 策略定义
 *
 * 声明式定义每个 Agent 允许/禁止的工具列表和危险命令检测规则。
 */

export type ToolPermission = "allow" | "deny"

import { DANGER_RULES } from "./danger-rules"

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
        "playwright_browser_click": "allow",
        "playwright_browser_close": "allow",
        "playwright_browser_console_messages": "allow",
        "playwright_browser_drag": "allow",
        "playwright_browser_drop": "allow",
        "playwright_browser_evaluate": "allow",
        "playwright_browser_file_upload": "allow",
        "playwright_browser_fill_form": "allow",
        "playwright_browser_handle_dialog": "allow",
        "playwright_browser_hover": "allow",
        "playwright_browser_navigate": "allow",
        "playwright_browser_navigate_back": "allow",
        "playwright_browser_network_request": "allow",
        "playwright_browser_network_requests": "allow",
        "playwright_browser_press_key": "allow",
        "playwright_browser_resize": "allow",
        "playwright_browser_run_code_unsafe": "deny",
        "playwright_browser_select_option": "allow",
        "playwright_browser_snapshot": "allow",
        "playwright_browser_take_screenshot": "allow",
        "playwright_browser_type": "allow",
        "playwright_browser_wait_for": "allow",
        "playwright_browser_tabs": "allow",
        "shadcn-vue_get_project_registries": "allow",
        "shadcn-vue_list_items_in_registries": "allow",
        "shadcn-vue_search_items_in_registries": "allow",
        "shadcn-vue_view_items_in_registries": "allow",
        "shadcn-vue_get_item_examples_from_registries": "allow",
        "shadcn-vue_get_audit_checklist": "allow",
        "shadcn-vue_get_add_command_for_items": "allow",
      },
    },
    fixer: {
      tools: {
        read: "allow",
        write: "allow",
        edit: "allow",
        bash: "allow",
        skill: "allow",
        "shadcn-vue_get_audit_checklist": "allow",
        "shadcn-vue_get_add_command_for_items": "allow",
      },
      dangerRules: DANGER_RULES,
    },
    judge: {
      tools: {
        read: "allow",
        grep: "allow",
        glob: "allow",
        "shadcn-vue_get_project_registries": "allow",
        "shadcn-vue_list_items_in_registries": "allow",
        "shadcn-vue_search_items_in_registries": "allow",
        "shadcn-vue_view_items_in_registries": "allow",
        "shadcn-vue_get_item_examples_from_registries": "allow",
        "shadcn-vue_get_audit_checklist": "allow",
        "shadcn-vue_get_add_command_for_items": "allow",
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
