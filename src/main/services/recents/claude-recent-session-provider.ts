import { createReadStream, existsSync } from 'node:fs';
import { readdir, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { homedir } from 'node:os';
import { createInterface } from 'node:readline';

import type { RecentSessionRecord } from '@shared/domain/session';
import { isLocalProject, type ProjectRef, type SshProjectRef } from '@shared/domain/project';

import { SshCommandRunner } from '@main/services/ssh/ssh-command-runner';

import { listRemoteFiles, readRemoteFile } from './remote-session-utils';

interface ClaudeTranscriptEntry {
  type?: unknown;
  sessionId?: unknown;
  timestamp?: unknown;
  message?: {
    role?: unknown;
    content?: unknown;
  };
}

interface ClaudeSessionSnapshot {
  createdAt: number;
  updatedAt: number;
  lastUserMessage: string | null;
}

const SESSION_FILE_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jsonl$/i;

function normalizeMessage(input: string): string {
  return input.trim().replace(/\s+/g, ' ').slice(0, 160);
}

function toUnixSeconds(value: number): number {
  return Math.floor(value / 1000);
}

function toClaudeProjectDirectoryName(projectPath: string): string {
  return path.resolve(projectPath).replace(/[/:\\]/g, '-');
}

function applyTranscriptEntry(
  snapshot: ClaudeSessionSnapshot,
  parsedEntry: ClaudeTranscriptEntry,
): ClaudeSessionSnapshot {
  const parsedTimestamp =
    typeof parsedEntry.timestamp === 'string' ? Date.parse(parsedEntry.timestamp) : Number.NaN;

  if (Number.isFinite(parsedTimestamp)) {
    const unixSeconds = toUnixSeconds(parsedTimestamp);
    snapshot.createdAt = Math.min(snapshot.createdAt, unixSeconds);
    snapshot.updatedAt = Math.max(snapshot.updatedAt, unixSeconds);
  }

  if (
    parsedEntry.type === 'user' &&
    parsedEntry.message?.role === 'user' &&
    typeof parsedEntry.message.content === 'string'
  ) {
    const normalizedMessage = normalizeMessage(parsedEntry.message.content);

    if (normalizedMessage.length > 0) {
      snapshot.lastUserMessage = normalizedMessage;
    }
  }

  return snapshot;
}

async function readLocalSessionSnapshot(filePath: string): Promise<ClaudeSessionSnapshot> {
  const fileStats = await stat(filePath);
  const fallbackTimestamp = toUnixSeconds(fileStats.mtimeMs);
  const lineReader = createInterface({
    input: createReadStream(filePath, {
      encoding: 'utf8',
    }),
    crlfDelay: Infinity,
  });
  const snapshot: ClaudeSessionSnapshot = {
    createdAt: fallbackTimestamp,
    updatedAt: fallbackTimestamp,
    lastUserMessage: null,
  };

  try {
    for await (const line of lineReader) {
      const trimmedLine = line.trim();

      if (trimmedLine.length === 0) {
        continue;
      }

      let parsedEntry: ClaudeTranscriptEntry;

      try {
        parsedEntry = JSON.parse(trimmedLine) as ClaudeTranscriptEntry;
      } catch {
        continue;
      }

      applyTranscriptEntry(snapshot, parsedEntry);
    }
  } finally {
    lineReader.close();
  }

  return snapshot;
}

function readRemoteSessionSnapshot(fileContents: string): ClaudeSessionSnapshot {
  const snapshot: ClaudeSessionSnapshot = {
    createdAt: 0,
    updatedAt: 0,
    lastUserMessage: null,
  };

  for (const line of fileContents.split(/\r?\n/u)) {
    const trimmedLine = line.trim();

    if (trimmedLine.length === 0) {
      continue;
    }

    let parsedEntry: ClaudeTranscriptEntry;

    try {
      parsedEntry = JSON.parse(trimmedLine) as ClaudeTranscriptEntry;
    } catch {
      continue;
    }

    applyTranscriptEntry(snapshot, parsedEntry);
  }

  return snapshot;
}

export class ClaudeRecentSessionProvider {
  private readonly claudeProjectsDirectoryPath = path.join(homedir(), '.claude', 'projects');

  constructor(private readonly sshCommandRunner?: SshCommandRunner) {}

  async listSessions(project: ProjectRef): Promise<RecentSessionRecord[]> {
    return isLocalProject(project)
      ? this.listLocalSessionsForProject(project.locator.path)
      : this.listRemoteSessionsForProject(project);
  }

  private async listLocalSessionsForProject(projectPath: string): Promise<RecentSessionRecord[]> {
    try {
      const candidateDirectories = [
        toClaudeProjectDirectoryName(projectPath),
      ];

      try {
        const resolvedProjectPath = await realpath(projectPath);
        const resolvedDirectory = toClaudeProjectDirectoryName(resolvedProjectPath);

        if (!candidateDirectories.includes(resolvedDirectory)) {
          candidateDirectories.push(resolvedDirectory);
        }
      } catch {
        // Ignore realpath failures and fall back to the raw project path.
      }

      const sessionRecords: RecentSessionRecord[] = [];
      const seenSessionIds = new Set<string>();

      for (const directoryName of candidateDirectories) {
        const sessionsDirectoryPath = path.join(this.claudeProjectsDirectoryPath, directoryName);

        if (!existsSync(sessionsDirectoryPath)) {
          continue;
        }

        const directoryEntries = await readdir(sessionsDirectoryPath, {
          withFileTypes: true,
        });

        for (const directoryEntry of directoryEntries) {
          if (!directoryEntry.isFile() || !SESSION_FILE_PATTERN.test(directoryEntry.name)) {
            continue;
          }

          const sessionId = directoryEntry.name.replace(/\.jsonl$/i, '');

          if (seenSessionIds.has(sessionId)) {
            continue;
          }

          const snapshot = await readLocalSessionSnapshot(
            path.join(sessionsDirectoryPath, directoryEntry.name),
          );

          sessionRecords.push({
            agent: 'claude_code',
            sessionId,
            projectPath,
            createdAt: snapshot.createdAt,
            updatedAt: snapshot.updatedAt,
            lastUserMessage: snapshot.lastUserMessage ?? 'Resume Claude Code session',
            resumeKind: 'native_resume',
          });
          seenSessionIds.add(sessionId);
        }
      }

      return sessionRecords;
    } catch (error) {
      console.warn('Failed to read Claude Code recent sessions.', error);
      return [];
    }
  }

  private async listRemoteSessionsForProject(project: SshProjectRef): Promise<RecentSessionRecord[]> {
    if (!this.sshCommandRunner) {
      return [];
    }

    try {
      const sessionsDirectoryPath = `~/.claude/projects/${toClaudeProjectDirectoryName(
        project.locator.remotePath,
      )}`;
      const sessionFiles = await listRemoteFiles(
        this.sshCommandRunner,
        project.locator.host,
        sessionsDirectoryPath,
      );
      const sessionRecords: RecentSessionRecord[] = [];
      const seenSessionIds = new Set<string>();

      for (const filePath of sessionFiles) {
        const fileName = path.posix.basename(filePath);

        if (!SESSION_FILE_PATTERN.test(fileName)) {
          continue;
        }

        const sessionId = fileName.replace(/\.jsonl$/i, '');

        if (seenSessionIds.has(sessionId)) {
          continue;
        }

        const sessionBuffer = await readRemoteFile(this.sshCommandRunner, project.locator.host, filePath);

        if (!sessionBuffer) {
          continue;
        }

        const snapshot = readRemoteSessionSnapshot(sessionBuffer.toString('utf8'));

        sessionRecords.push({
          agent: 'claude_code',
          sessionId,
          projectPath: project.locator.remotePath,
          createdAt: snapshot.createdAt,
          updatedAt: snapshot.updatedAt,
          lastUserMessage: snapshot.lastUserMessage ?? 'Resume Claude Code session',
          resumeKind: 'native_resume',
        });
        seenSessionIds.add(sessionId);
      }

      return sessionRecords;
    } catch (error) {
      console.warn('Failed to read remote Claude Code recent sessions.', error);
      return [];
    }
  }
}
