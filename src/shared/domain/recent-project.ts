import type { AgentId } from './agent';
import type { ProjectRef } from './project';

export interface RecentProjectRecord {
  project: ProjectRef;
  lastOpenedAt: number;
  pinned: boolean;
  lastUsedAgent?: AgentId;
}
