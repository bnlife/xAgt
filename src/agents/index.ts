import { createVoxAgent } from "./vox"
import { createLynxAgent } from "./lynx"
import { createFixerAgent } from "./fixer"

export type AgentName = "vox" | "lynx" | "fixer"

export const AGENT_DESCRIPTIONS: Record<AgentName, string> = {
  vox: "总指挥：只调度不干活，规划→派活→监控→整合",
  lynx: "眼睛：搜文件、查文档、读图、联网调研",
  fixer: "双手：精确改代码、建文件、跑命令",
}

export function getAgents(disabled: AgentName[] = []): Record<string, any> {
  const agents: Record<string, any> = {
    vox: createVoxAgent(),
    lynx: createLynxAgent(),
    fixer: createFixerAgent(),
  }

  for (const name of disabled) {
    delete agents[name]
  }

  return agents
}
