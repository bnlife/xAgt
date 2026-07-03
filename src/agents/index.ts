import { createVoxAgent } from "./vox"
import { createLynxAgent } from "./lynx"
import { createFixerAgent } from "./fixer"

export type AgentName = "vox" | "lynx" | "fixer"

export interface AgentConfig {
  description: string
  mode: "primary" | "subagent"
  model: string
  prompt: string
  permission?: { mcp?: Record<string, string> }
  [key: string]: unknown
}

export const AGENT_DESCRIPTIONS: Record<AgentName, string> = {
  vox: "总指挥：只调度不干活，规划→派活→监控→整合",
  lynx: "眼睛：搜文件、查文档、读图、联网调研",
  fixer: "双手：精确改代码、建文件、跑命令",
}

const AGENT_BUILDERS: Record<AgentName, () => AgentConfig> = {
  vox: createVoxAgent,
  lynx: createLynxAgent,
  fixer: createFixerAgent,
}

export function getAgents(disabled: AgentName[] = []): Record<AgentName, AgentConfig> {
  const agents = {} as Record<AgentName, AgentConfig>
  for (const [name, builder] of Object.entries(AGENT_BUILDERS)) {
    if (!disabled.includes(name as AgentName)) {
      agents[name as AgentName] = builder()
    }
  }
  return agents
}
