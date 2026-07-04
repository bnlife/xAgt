import { createVoxAgent } from "./vox"
import { createLynxAgent } from "./lynx"
import { createFixerAgent } from "./fixer"
import { createJudgeAgent } from "./judge"
import { createSmithAgent } from "./smith"

export type AgentName = "vox" | "lynx" | "fixer" | "judge" | "smith"

export const AGENT_DESCRIPTIONS: Record<AgentName, string> = {
  vox: "总指挥：只调度不干活，规划→派活→监控→整合",
  lynx: "眼睛：搜文件、查文档、读图、联网调研",
  fixer: "双手：精确改代码、建文件、跑命令",
  judge: "显微镜：审查代码合规性、测试真实性、日志规范",
  smith: "锐匠：定期审查 xAgt harness，提出优化建议（只读不写）",
}

export function getAgents(disabled: AgentName[] = []): Record<string, any> {
  const agents: Record<string, any> = {
    vox: createVoxAgent(),
    lynx: createLynxAgent(),
    fixer: createFixerAgent(),
    judge: createJudgeAgent(),
    smith: createSmithAgent(),
  }

  for (const name of disabled) {
    delete agents[name]
  }

  return agents
}
