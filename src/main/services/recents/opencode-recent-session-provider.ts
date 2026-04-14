import { execFile } from 'node:child_process';
import { constants } from 'node:fs';
import { access } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

import type { RecentSessionRecord } from '@shared/domain/session';
import {
  getLocalProjectRoot,
  isLocalProject,
  type ProjectRef,
  type SshProjectRef,
} from '@shared/domain/project';

import {
  quotePosixShell,
  SshCommandRunner,
} from '@main/services/ssh/ssh-command-runner';

const execFileAsync = promisify(execFile);
const OPEN_CODE_RECENTS_TIMEOUT_MS = 20_000;

interface OpenCodeSessionListEntry {
  id?: unknown;
  title?: unknown;
  created?: unknown;
  updated?: unknown;
  directory?: unknown;
}

function normalizeTitle(input: string): string {
  return input.trim().replace(/\s+/g, ' ').slice(0, 160);
}

function toUnixSeconds(value: number): number {
  return Math.floor(value / 1000);
}

function toSessionRecord(entry: OpenCodeSessionListEntry): RecentSessionRecord | null {
  if (
    typeof entry.id !== 'string' ||
    typeof entry.directory !== 'string' ||
    typeof entry.created !== 'number' ||
    typeof entry.updated !== 'number'
  ) {
    return null;
  }

  const title = typeof entry.title === 'string' ? normalizeTitle(entry.title) : '';

  return {
    agent: 'opencode',
    sessionId: entry.id,
    projectPath: entry.directory,
    createdAt: toUnixSeconds(entry.created),
    updatedAt: toUnixSeconds(entry.updated),
    lastUserMessage: title || 'Resume OpenCode session',
    resumeKind: 'native_resume',
  };
}

async function isExecutable(filePath: string): Promise<boolean> {
  try {
    await access(filePath, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

export class OpenCodeRecentSessionProvider {
  constructor(private readonly sshCommandRunner?: SshCommandRunner) {}

  async listSessions(project: ProjectRef): Promise<RecentSessionRecord[]> {
    return isLocalProject(project)
      ? this.listLocalSessions(getLocalProjectRoot(project))
      : this.listRemoteSessions(project);
  }

  private async listLocalSessions(projectRoot: string): Promise<RecentSessionRecord[]> {
    try {
      const commandPath = await this.resolveCommandPath();

      if (!commandPath) {
        return [];
      }

      const { stdout } = await execFileAsync(
        commandPath,
        ['session', 'list', '--format', 'json'],
        {
          cwd: projectRoot,
          timeout: OPEN_CODE_RECENTS_TIMEOUT_MS,
        },
      );

      return this.parseSessionList(stdout);
    } catch (error) {
      console.warn('Failed to read OpenCode recent sessions.', error);
      return [];
    }
  }

  private async listRemoteSessions(project: SshProjectRef): Promise<RecentSessionRecord[]> {
    if (!this.sshCommandRunner) {
      return [];
    }

    try {
      const stdout = await this.sshCommandRunner.runInLoginShell(
        project.locator.host,
        [
          `cd -- ${quotePosixShell(project.locator.remotePath)} &&`,
          'opencode session list --format json',
        ].join(' '),
        {
          timeoutMs: OPEN_CODE_RECENTS_TIMEOUT_MS,
          debugLabel: 'opencode-recents',
        },
      );

      return this.parseSessionList(stdout);
    } catch (error) {
      console.warn('Failed to read remote OpenCode recent sessions.', error);
      return [];
    }
  }

  private parseSessionList(stdout: string): RecentSessionRecord[] {
    const trimmedOutput = stdout.trim();

    if (trimmedOutput.length === 0) {
      return [];
    }

    const parsed = this.parseJsonPayload(trimmedOutput);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((item) => toSessionRecord(item as OpenCodeSessionListEntry))
      .filter((item): item is RecentSessionRecord => Boolean(item))
      .sort((left, right) => right.updatedAt - left.updatedAt);
  }

  private parseJsonPayload(output: string): unknown {
    try {
      return JSON.parse(output) as unknown;
    } catch {
      const arrayStart = output.indexOf('[');
      const arrayEnd = output.lastIndexOf(']');

      if (arrayStart === -1 || arrayEnd === -1 || arrayEnd <= arrayStart) {
        throw new Error('OpenCode session list did not return JSON.');
      }

      return JSON.parse(output.slice(arrayStart, arrayEnd + 1)) as unknown;
    }
  }

  private async resolveCommandPath(): Promise<string | null> {
    const commandFromPath = await this.resolveFromEnvironmentPath();

    if (commandFromPath) {
      return commandFromPath;
    }

    return this.resolveFromLoginShell();
  }

  private async resolveFromEnvironmentPath(): Promise<string | null> {
    const pathEntries = (process.env.PATH ?? '')
      .split(path.delimiter)
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);

    for (const pathEntry of pathEntries) {
      const candidate = path.join(pathEntry, 'opencode');

      if (await isExecutable(candidate)) {
        return candidate;
      }
    }

    return null;
  }

  private async resolveFromLoginShell(): Promise<string | null> {
    const shellPath = process.env.SHELL || '/bin/zsh';

    try {
      const { stdout } = await execFileAsync(shellPath, ['-lic', 'command -v opencode']);
      const candidate = stdout
        .split('\n')
        .map((line) => line.trim())
        .find((line) => line.length > 0);

      if (!candidate) {
        return null;
      }

      return (await isExecutable(candidate)) ? candidate : null;
    } catch {
      return null;
    }
  }
}
