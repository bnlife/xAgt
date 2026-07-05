/**
 * 协作协议 — Vox 给子代理发指令的模板。
 *
 * 从 vox.ts 的 extraSections["调度协议"] 中提取。
 * 规范了 Vox 派发任务时必须使用的格式。
 */

export interface AgentProtocol {
  /** 子代理名称 */
  name: string
  /** 指令模板中的字段 */
  fields: string[]
  /** 格式模板，{field} 为变量占位符 */
  template: string
}

export const PROTOCOLS: Record<string, AgentProtocol> = {
  lynx: {
    name: "Lynx",
    fields: ["目标", "线索", "期望"],
    template: "【目标】具体问题 | 【线索】日志/关键词 | 【期望】返回格式",
  },
  fixer: {
    name: "Fixer",
    fields: ["文件", "操作", "验收"],
    template: "【文件】路径:行号 | 【操作】精确修改 | 【验收】验证命令",
  },
  judge: {
    name: "Judge",
    fields: ["审查", "重点", "标准"],
    template: "【审查】文件路径 | 【重点】合规/测试/日志 | 【标准】通过条件",
  },
}

/**
 * 将协议渲染为 Vox prompt 中的文本格式。
 */
export function renderProtocolBlock(): string {
  const lines: string[] = [
    "给子代理的指令必须用以下模板，不写背景、不写理由：",
    "",
    `Fixer: ${PROTOCOLS.fixer.template}`,
    `Lynx:  ${PROTOCOLS.lynx.template}`,
    `Judge: ${PROTOCOLS.judge.template}`,
  ]
  return lines.join("\n")
}
