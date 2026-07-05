// ── 任务模式定义 ─────────────────────────────────
// 控制 xAgt 的行为严格程度

export const MODE_TAG_PREFIX = "<!--XAGT_MODE:"

export type TaskMode = "standard" | "simple" | "free"

const MODE_PATTERN = /<!--XAGT_MODE:(standard|simple|free)-->/

/**
 * 从 Vox 回复文本中提取模式标记。
 * 返回匹配的模式，如果没有匹配则返回 null。
 */
export function parseModeTag(text: string): TaskMode | null {
  const match = MODE_PATTERN.exec(text)
  if (match) {
    return match[1] as TaskMode
  }
  return null
}

/**
 * 根据当前模式构建硬约束字符串。
 * 返回要追加到 system 中的文本，如果没有额外约束则返回 null。
 */
export function buildHardConstraints(mode: TaskMode): string | null {
  switch (mode) {
    case "standard":
      return (
        "\n## 标准任务模式约束\n" +
        "- 严格遵循 Judge 强制审查流程：Fixer 完成后必须由 Judge 审查\n" +
        "- 所有代码修改必须通过 task() 调用子代理完成\n" +
        "- Vox 输出必须包含结构化思考过程（拆解/策略/风险）\n" +
        "- Smith 定期审查处于活跃状态"
      )

    case "simple":
      return (
        "\n## 简单任务模式约束\n" +
        "- 跳过 Judge 强制审查，Fixer 可直接完成修改\n" +
        "- 仍要求通过 task() 调用子代理执行代码修改\n" +
        "- Vox 输出仍需结构化思考过程\n" +
        "- Smith 定期审查已跳过"
      )

    case "free":
      return (
        "\n## 自由任务模式约束\n" +
        "- 不强制结构化输出，Vox 可直接回复\n" +
        "- 代码输出拦截已禁用（允许 Vox 直接返回含代码的回复）\n" +
        "- 所有审查和频率限制均已跳过"
      )

    default:
      return null
  }
}

export function renderStandardWorkflow(): string {
  return (
    "1. **Vox ≡ 用户对齐需求** — 确认意图后再行动\n" +
    "   │ 需要信息 → 派 Lynx 调研\n" +
    "   │ 调研结果 → 回步骤 1 对齐方案\n" +
    "   ▼\n" +
    "2. **Vox → 用户确认方案** — 方案确认后才进入实现\n" +
    "   ▼\n" +
    "3. **Vox → Fixer 实现** — 派 Fixer 写代码/改文件\n" +
    "   ▼\n" +
    "4. **Fixer → Judge 审查**\n" +
    "   ├─ 通过 → 汇报 Vox，进入下一阶段\n" +
    "   └─ 不通过 → Fixer 修改 → 重复步骤 4（重试 ≤3 次）\n" +
    "      └─ 3 次不通过 → Vox 评估决策\n" +
    "         ├─ 可以决策 → 放行/决策\n" +
    "         └─ 无法决策 → Lynx 调研 → 回步骤 1\n" +
    "\n" +
    "**关键规则：**\n" +
    "- 每阶段完成后必须和用户确认再进入下一阶段\n" +
    "- Fixer 完成后必须派 Judge 审查，通过才算完成\n" +
    "- Judge 连续不通过 3 次，暂停上报 Vox 评估\n" +
    "- Vox 无法决策时回到 Lynx 调研或用户对齐"
  )
}

/**
 * 渲染任务模式判断指南，供 Vox prompt 使用。
 * 描述三种模式的适用场景，帮助 Vox 根据任务复杂度选择合适的模式。
 */
export function renderModeGuide(): string {
  return (
    "根据任务复杂度选择模式，在回复末尾以 HTML 注释标记：\n" +
    "\n" +
    "1. **standard（默认）** — 涉及核心逻辑、新功能、重构、多文件修改\n" +
    "   → 标记：<!--XAGT_MODE:standard-->\n" +
    "   → 特点：严格审查、完整测试、Vox 结构化输出\n" +
    "   → 工作流：\n" +
    renderStandardWorkflow().replace(/^/gm, "     ") + "\n" +
    "\n" +
    "2. **simple** — 简单修改（改参数/单文件小改动/配置调整）\n" +
    "   → 标记：<!--XAGT_MODE:simple-->\n" +
    "   → 特点：跳过 Judge 审查、Fixer 可直接完成\n" +
    "\n" +
    "3. **free** — 对话/调研/读代码/纯思路讨论\n" +
    "   → 标记：<!--XAGT_MODE:free-->\n" +
    "   → 特点：无结构化输出要求、Vox 可直接回复含代码\n" +
    "\n" +
    "注：默认未指定时走 standard 模式。简单问题显式标记 simple 可提速。"
  )
}
