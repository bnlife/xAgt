/**
 * 输出拦截规则。
 *
 * 从 index.ts 和 system-transform.ts 中提取。
 * 定义 Vox 回复的代码检测模式和拦截行为。
 * 单一数据源：改规则只改此处，index.ts 和 system-transform 共同引用。
 */

/** 代码检测模式 */
export const CODE_PATTERNS = {
  /** 代码块（```...```） */
  codeBlock: /```[\s\S]*```/,
  /** 行内代码（超过 10 字符的 `...`） */
  inlineCode: /`[^`]{10,}`/,
} as const

/** 豁免条件：如果命中这些模式，即使有代码也不拦截 */
export const CODE_EXEMPTIONS = {
  /** 包含 task() 调度调用 */
  hasTaskCall: /task\s*\(/,
} as const

/** 拦截时显示的警告消息（Vox 回复被替换为此内容） */
export const CODE_BLOCK_MESSAGE = `⛔ **自动拦截：违规输出**

你的回复包含了代码片段，但没有使用 \`task()\` 调度子代理。

作为调度总指挥，请不要直接输出代码。请重新生成回复，使用以下方式之一：

- 改代码 → \`task("fixer", "精确指令")\`
- 查代码 → \`task("lynx", "侦察指令")\`
- 审代码 → \`task("judge", "审查指令")\``
