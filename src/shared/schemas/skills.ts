import { z } from 'zod';

import type { GlobalSkillRecord, ProjectSkillRecord } from '@shared/domain/skill';
import { SKILL_AGENT_IDS } from '@shared/domain/skill';

const discoveredSkillRecordBaseSchema = z.object({
  id: z.string(),
  agent: z.enum(SKILL_AGENT_IDS),
  name: z.string(),
  description: z.string(),
  license: z.string().nullable(),
  compatibility: z.string().nullable(),
  homepage: z.string().nullable(),
  allowedTools: z.array(z.string()).default([]),
  metadataRaw: z.unknown(),
  extraFrontmatterRaw: z.record(z.string(), z.unknown()).default({}),
  sourcePath: z.string(),
});

export const globalSkillRecordSchema = discoveredSkillRecordBaseSchema.extend({
  scope: z.literal('global'),
});

export const projectSkillRecordSchema = discoveredSkillRecordBaseSchema.extend({
  scope: z.literal('project'),
  relativePath: z.string(),
});

export function parseGlobalSkillRecord(value: unknown): GlobalSkillRecord {
  return globalSkillRecordSchema.parse(value);
}

export function parseProjectSkillRecord(value: unknown): ProjectSkillRecord {
  return projectSkillRecordSchema.parse(value);
}
