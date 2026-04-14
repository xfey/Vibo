export const SKILL_AGENT_IDS = ['codex', 'claude_code', 'opencode'] as const;

export type SkillAgentId = (typeof SKILL_AGENT_IDS)[number];

interface DiscoveredSkillRecordBase {
  id: string;
  agent: SkillAgentId;
  name: string;
  description: string;
  license: string | null;
  compatibility: string | null;
  homepage: string | null;
  allowedTools: string[];
  metadataRaw: unknown;
  extraFrontmatterRaw: Record<string, unknown>;
  sourcePath: string;
}

export interface GlobalSkillRecord extends DiscoveredSkillRecordBase {
  scope: 'global';
}

export interface ProjectSkillRecord extends DiscoveredSkillRecordBase {
  scope: 'project';
  relativePath: string;
}
