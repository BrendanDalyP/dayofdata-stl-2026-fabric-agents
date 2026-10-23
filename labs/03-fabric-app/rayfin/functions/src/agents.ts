// The agent team. Agent URLs are not secrets (a caller still needs a token and
// workspace access), so they live here, in code you can review. Values come from
// labs/01-data-agent/published-agents.json after running create_agents.py.

export const AGENTS = {
  sales: {
    name: 'SpaceParts Sales Analyst',
    url: 'https://api.fabric.microsoft.com/v1/mcp/workspaces/aa68b708-7b45-4701-abf0-bc1c91be1c59/dataagents/8bc6b722-80b6-45aa-b04d-51872f9b99cb/agent',
  },
  operations: {
    name: 'SpaceParts Operations',
    url: 'https://api.fabric.microsoft.com/v1/mcp/workspaces/aa68b708-7b45-4701-abf0-bc1c91be1c59/dataagents/54a41e5b-4721-4832-936e-345b896fd502/agent',
  },
  planning: {
    name: 'SpaceParts Planning',
    url: 'https://api.fabric.microsoft.com/v1/mcp/workspaces/aa68b708-7b45-4701-abf0-bc1c91be1c59/dataagents/3dfe145b-7328-40d3-9751-a7d696565517/agent',
  },
} as const;

export type AgentKey = keyof typeof AGENTS;

export function isAgentKey(value: string): value is AgentKey {
  return Object.prototype.hasOwnProperty.call(AGENTS, value);
}
