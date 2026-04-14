import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { homedir } from 'node:os';

import type { GlobalSkillsResponse, SkillOperationError } from '@shared/contracts/skills';
import type { GlobalSkillRecord, SkillAgentId } from '@shared/domain/skill';

import {
  createShortHash,
  normalizePath,
  pathExists,
  readSkillDirectoryMetadata,
} from './skill-source-utils';

interface GlobalSkillRoot {
  agent: SkillAgentId;
  rootPath: string;
}

const GLOBAL_SKILL_ROOTS: GlobalSkillRoot[] = [
  {
    agent: 'codex',
    rootPath: path.join(homedir(), '.codex', 'skills'),
  },
  {
    agent: 'codex',
    rootPath: path.join(homedir(), '.agents', 'skills'),
  },
  {
    agent: 'claude_code',
    rootPath: path.join(homedir(), '.claude', 'skills'),
  },
  {
    agent: 'opencode',
    rootPath: path.join(homedir(), '.config', 'opencode', 'skill'),
  },
  {
    agent: 'opencode',
    rootPath: path.join(homedir(), '.config', 'opencode', 'skills'),
  },
  {
    agent: 'opencode',
    rootPath: path.join(homedir(), '.opencode', 'skill'),
  },
  {
    agent: 'opencode',
    rootPath: path.join(homedir(), '.opencode', 'skills'),
  },
  {
    agent: 'opencode',
    rootPath: path.join(homedir(), '.claude', 'skills'),
  },
  {
    agent: 'opencode',
    rootPath: path.join(homedir(), '.agents', 'skills'),
  },
];

function compareGlobalSkills(left: GlobalSkillRecord, right: GlobalSkillRecord): number {
  return (
    left.agent.localeCompare(right.agent) ||
    left.name.localeCompare(right.name, undefined, { sensitivity: 'base' }) ||
    left.sourcePath.localeCompare(right.sourcePath, undefined, { sensitivity: 'base' })
  );
}

function toSkillOperationError(sourcePath: string, error: unknown): SkillOperationError {
  return {
    sourcePath,
    message: error instanceof Error ? error.message : 'Unknown skill discovery error.',
  };
}

export class SkillsLibraryService {
  async scanGlobalSkills(): Promise<GlobalSkillsResponse> {
    const items: GlobalSkillRecord[] = [];
    const errors: SkillOperationError[] = [];
    const seenSourcePaths = new Set<string>();

    for (const root of GLOBAL_SKILL_ROOTS) {
      if (!(await pathExists(root.rootPath))) {
        continue;
      }

      const entries = await readdir(root.rootPath, {
        withFileTypes: true,
      });

      entries.sort((left, right) => left.name.localeCompare(right.name));

      for (const entry of entries) {
        if (!entry.isDirectory() && !entry.isSymbolicLink()) {
          continue;
        }

        const sourcePath = path.join(root.rootPath, entry.name);

        if (!(await pathExists(path.join(sourcePath, 'SKILL.md')))) {
          continue;
        }

        try {
          const normalizedSourcePath = await normalizePath(sourcePath);
          const sourceKey = `${root.agent}:${normalizedSourcePath}`;

          if (seenSourcePaths.has(sourceKey)) {
            continue;
          }

          seenSourcePaths.add(sourceKey);
          const metadata = await readSkillDirectoryMetadata(normalizedSourcePath);

          items.push({
            id: `global_${root.agent}_${createShortHash(normalizedSourcePath)}`,
            agent: root.agent,
            scope: 'global',
            name: metadata.originalName,
            description: metadata.description,
            license: metadata.license,
            compatibility: metadata.compatibility,
            homepage: metadata.homepage,
            allowedTools: metadata.allowedTools,
            metadataRaw: metadata.metadataRaw,
            extraFrontmatterRaw: metadata.extraFrontmatterRaw,
            sourcePath: normalizedSourcePath,
          });
        } catch (error) {
          errors.push(toSkillOperationError(sourcePath, error));
        }
      }
    }

    return {
      items: items.sort(compareGlobalSkills),
      errors,
    };
  }
}
