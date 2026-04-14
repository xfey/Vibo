import { realpath } from 'node:fs/promises';

import { shell } from 'electron';

import type { AgentId } from '@shared/domain/agent';
import type { RecentProjectRecord } from '@shared/domain/recent-project';
import type { ProjectRef } from '@shared/domain/project';
import {
  getProjectLocatorIdentity,
  isLocalProject,
} from '@shared/domain/project';

import { ConfigStore } from '@main/services/config/config-store';
import { toLocalProjectRef } from '@main/services/projects/project-ref';
import { tMain } from '@main/app/i18n';

function sortRecentProjects(records: RecentProjectRecord[]): RecentProjectRecord[] {
  return [...records].sort((left, right) => {
    if (left.pinned !== right.pinned) {
      return left.pinned ? -1 : 1;
    }

    return right.lastOpenedAt - left.lastOpenedAt;
  });
}

export class RecentProjectsService {
  constructor(private readonly configStore: ConfigStore) {}

  async listRecentProjects(): Promise<RecentProjectRecord[]> {
    const currentRecords = await this.configStore.readRecentProjects();
    const normalizedRecords: RecentProjectRecord[] = [];
    let didChange = false;

    for (const record of currentRecords) {
      const normalizedRecord = await this.normalizeRecord(record);

      if (!normalizedRecord) {
        didChange = true;
        continue;
      }

      normalizedRecords.push(normalizedRecord);

      if (
        getProjectLocatorIdentity(normalizedRecord.project) !==
          getProjectLocatorIdentity(record.project) ||
        normalizedRecord.project.displayName !== record.project.displayName ||
        normalizedRecord.project.fingerprint !== record.project.fingerprint
      ) {
        didChange = true;
      }
    }

    const sortedRecords = sortRecentProjects(normalizedRecords);

    if (didChange) {
      await this.configStore.writeRecentProjects(sortedRecords);
    }

    return sortedRecords;
  }

  async recordProjectOpen(project: ProjectRef, lastUsedAgent?: AgentId): Promise<void> {
    const currentRecords = await this.configStore.readRecentProjects();
    const nextRecords = currentRecords.filter(
      (record) =>
        record.project.fingerprint !== project.fingerprint &&
        getProjectLocatorIdentity(record.project) !== getProjectLocatorIdentity(project),
    );
    const existingRecord = currentRecords.find(
      (record) =>
        record.project.fingerprint === project.fingerprint ||
        getProjectLocatorIdentity(record.project) === getProjectLocatorIdentity(project),
    );

    nextRecords.push({
      project,
      lastOpenedAt: Date.now(),
      pinned: existingRecord?.pinned ?? false,
      lastUsedAgent: lastUsedAgent ?? existingRecord?.lastUsedAgent,
    });

    await this.configStore.writeRecentProjects(sortRecentProjects(nextRecords));
  }

  async updateLastUsedAgent(project: ProjectRef, lastUsedAgent: AgentId): Promise<void> {
    await this.recordProjectOpen(project, lastUsedAgent);
  }

  async setPinned(projectFingerprint: string, pinned: boolean): Promise<RecentProjectRecord[]> {
    const currentRecords = await this.listRecentProjects();
    const nextRecords = currentRecords.map((record) =>
      record.project.fingerprint === projectFingerprint
        ? {
            ...record,
            pinned,
          }
        : record,
    );

    await this.configStore.writeRecentProjects(sortRecentProjects(nextRecords));
    return sortRecentProjects(nextRecords);
  }

  async remove(projectFingerprint: string): Promise<RecentProjectRecord[]> {
    const currentRecords = await this.listRecentProjects();
    const nextRecords = currentRecords.filter(
      (record) => record.project.fingerprint !== projectFingerprint,
    );

    await this.configStore.writeRecentProjects(nextRecords);
    return nextRecords;
  }

  async reveal(projectFingerprint: string): Promise<void> {
    const record = await this.getRecentProject(projectFingerprint);

    if (!record) {
      throw new Error(tMain('recentProjects.notFound'));
    }

    if (!isLocalProject(record.project)) {
      throw new Error(tMain('recentProjects.remoteRevealUnsupported'));
    }

    shell.showItemInFolder(record.project.locator.path);
  }

  async getRecentProject(projectFingerprint: string): Promise<RecentProjectRecord | null> {
    const currentRecords = await this.listRecentProjects();

    return (
      currentRecords.find((record) => record.project.fingerprint === projectFingerprint) ?? null
    );
  }

  private async normalizeRecord(record: RecentProjectRecord): Promise<RecentProjectRecord | null> {
    if (!isLocalProject(record.project)) {
      return record;
    }

    try {
      const normalizedRoot = await realpath(record.project.locator.path);

      return {
        ...record,
        project: toLocalProjectRef(normalizedRoot),
      };
    } catch {
      return null;
    }
  }
}
