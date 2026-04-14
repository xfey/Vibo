import { z } from 'zod';

import { AGENT_IDS } from '@shared/domain/agent';
import type { ProjectRef } from '@shared/domain/project';
import type { RecentProjectRecord } from '@shared/domain/recent-project';

const agentIdSchema = z.enum(AGENT_IDS);

const localProjectRefSchema = z.object({
  kind: z.literal('local'),
  displayName: z.string(),
  locator: z.object({
    kind: z.literal('local'),
    path: z.string(),
  }),
  fingerprint: z.string(),
});

const sshProjectRefSchema = z.object({
  kind: z.literal('ssh'),
  displayName: z.string(),
  locator: z.object({
    kind: z.literal('ssh'),
    host: z.string(),
    remotePath: z.string(),
    os: z.literal('linux'),
  }),
  fingerprint: z.string(),
});

const legacyLocalProjectRefSchema = z
  .object({
    kind: z.literal('local'),
    displayName: z.string(),
    locator: z.object({
      path: z.string(),
    }),
    fingerprint: z.string(),
  })
  .transform(
    (projectRef): ProjectRef => ({
      ...projectRef,
      locator: {
        kind: 'local',
        path: projectRef.locator.path,
      },
    }),
  );

const projectRefSchema = z.union([
  localProjectRefSchema,
  sshProjectRefSchema,
  legacyLocalProjectRefSchema,
]);

export const recentProjectRecordSchema = z.object({
  project: projectRefSchema,
  lastOpenedAt: z.number().int().nonnegative().default(0),
  pinned: z.boolean().default(false),
  lastUsedAgent: agentIdSchema.optional(),
});

export const recentProjectsSchema = z.array(recentProjectRecordSchema).default([]);

export function createDefaultRecentProjects(): RecentProjectRecord[] {
  return recentProjectsSchema.parse([]);
}
