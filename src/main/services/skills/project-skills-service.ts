import { readdir } from 'node:fs/promises';
import path from 'node:path';

import type {
  ProjectSkillsData,
  ProjectSkillsAgentData,
  SkillOperationError,
} from '@shared/contracts/skills';
import type { GlobalSkillRecord, ProjectSkillRecord, SkillAgentId } from '@shared/domain/skill';

import {
  createShortHash,
  normalizePath,
  pathExists,
  readSkillDirectoryMetadata,
} from './skill-source-utils';
import { SkillsLibraryService } from './skills-library-service';

const PROJECT_SKILL_ROOTS: Record<SkillAgentId, string[]> = {
  codex: [path.join('.agents', 'skills')],
  claude_code: [path.join('.claude', 'skills')],
  opencode: [
    path.join('.opencode', 'skill'),
    path.join('.opencode', 'skills'),
    path.join('.claude', 'skills'),
    path.join('.agents', 'skills'),
  ],
};

function toProjectRelativePath(relativePath: string): string {
  return relativePath.split(path.sep).join('/');
}

function compareProjectSkills(left: ProjectSkillRecord, right: ProjectSkillRecord): number {
  return (
    left.name.localeCompare(right.name, undefined, { sensitivity: 'base' }) ||
    left.relativePath.localeCompare(right.relativePath, undefined, { sensitivity: 'base' })
  );
}

function toSkillOperationError(sourcePath: string, error: unknown): SkillOperationError {
  return {
    sourcePath,
    message: error instanceof Error ? error.message : 'Unknown project skill error.',
  };
}

export class ProjectSkillsService {
  constructor(private readonly skillsLibraryService: SkillsLibraryService) {}

  async getProjectSkillsData(projectRoot: string): Promise<ProjectSkillsData> {
    const [globalSkillsResponse, repoScanResult] = await Promise.all([
      this.skillsLibraryService.scanGlobalSkills(),
      this.scanProjectSkills(projectRoot),
    ]);

    return {
      agents: {
        codex: this.buildAgentData('codex', globalSkillsResponse.items, repoScanResult.itemsByAgent.codex),
        claude_code: this.buildAgentData(
          'claude_code',
          globalSkillsResponse.items,
          repoScanResult.itemsByAgent.claude_code,
        ),
        opencode: this.buildAgentData(
          'opencode',
          globalSkillsResponse.items,
          repoScanResult.itemsByAgent.opencode,
        ),
      },
      errors: [...globalSkillsResponse.errors, ...repoScanResult.errors],
    };
  }

  private buildAgentData(
    agent: SkillAgentId,
    globalSkills: GlobalSkillRecord[],
    projectSkills: ProjectSkillRecord[],
  ): ProjectSkillsAgentData {
    return {
      globalSkills: globalSkills.filter((item) => item.agent === agent),
      projectSkills,
    };
  }

  private async scanProjectSkills(projectRoot: string): Promise<{
    itemsByAgent: Record<SkillAgentId, ProjectSkillRecord[]>;
    errors: SkillOperationError[];
  }> {
    const [codexSkills, claudeSkills, openCodeSkills] = await Promise.all([
      this.scanProjectSkillsForAgent(projectRoot, 'codex'),
      this.scanProjectSkillsForAgent(projectRoot, 'claude_code'),
      this.scanProjectSkillsForAgent(projectRoot, 'opencode'),
    ]);

    return {
      itemsByAgent: {
        codex: codexSkills.items,
        claude_code: claudeSkills.items,
        opencode: openCodeSkills.items,
      },
      errors: [...codexSkills.errors, ...claudeSkills.errors, ...openCodeSkills.errors],
    };
  }

  private async scanProjectSkillsForAgent(
    projectRoot: string,
    agent: SkillAgentId,
  ): Promise<{
    items: ProjectSkillRecord[];
    errors: SkillOperationError[];
  }> {
    const items: ProjectSkillRecord[] = [];
    const errors: SkillOperationError[] = [];
    const seenSourcePaths = new Set<string>();

    for (const relativeRootPath of PROJECT_SKILL_ROOTS[agent]) {
      const absoluteRootPath = path.join(projectRoot, relativeRootPath);

      if (!(await pathExists(absoluteRootPath))) {
        continue;
      }

      const entries = await readdir(absoluteRootPath, {
        withFileTypes: true,
      });

      entries.sort((left, right) => left.name.localeCompare(right.name));

      for (const entry of entries) {
        if (!entry.isDirectory() && !entry.isSymbolicLink()) {
          continue;
        }

        const logicalRelativePath = toProjectRelativePath(path.join(relativeRootPath, entry.name));
        const absoluteSourcePath = path.join(absoluteRootPath, entry.name);

        if (!(await pathExists(path.join(absoluteSourcePath, 'SKILL.md')))) {
          continue;
        }

        try {
          const normalizedSourcePath = await normalizePath(absoluteSourcePath);

          if (seenSourcePaths.has(normalizedSourcePath)) {
            continue;
          }

          seenSourcePaths.add(normalizedSourcePath);
          const metadata = await readSkillDirectoryMetadata(normalizedSourcePath);

          items.push({
            id: `project_${agent}_${createShortHash(logicalRelativePath)}`,
            agent,
            scope: 'project',
            name: metadata.originalName,
            description: metadata.description,
            license: metadata.license,
            compatibility: metadata.compatibility,
            homepage: metadata.homepage,
            allowedTools: metadata.allowedTools,
            metadataRaw: metadata.metadataRaw,
            extraFrontmatterRaw: metadata.extraFrontmatterRaw,
            sourcePath: normalizedSourcePath,
            relativePath: logicalRelativePath,
          });
        } catch (error) {
          errors.push(toSkillOperationError(logicalRelativePath, error));
        }
      }
    }

    return {
      items: items.sort(compareProjectSkills),
      errors,
    };
  }
}
