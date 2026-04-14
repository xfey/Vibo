export const AGENT_IDS = ['codex', 'claude_code', 'opencode', 'shell'] as const;

export type AgentId = (typeof AGENT_IDS)[number];

export const DEFAULT_AGENT_ID: AgentId = 'codex';
