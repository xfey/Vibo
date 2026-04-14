import { createReadStream, existsSync } from 'node:fs';
import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { homedir } from 'node:os';
import { createInterface } from 'node:readline';
import { DatabaseSync } from 'node:sqlite';

import type { RecentSessionRecord } from '@shared/domain/session';
import { isLocalProject, type ProjectRef, type SshProjectRef } from '@shared/domain/project';

import { SshCommandRunner } from '@main/services/ssh/ssh-command-runner';

import { getRemoteFileSize, listRemoteFiles, readRemoteFile } from './remote-session-utils';

interface CodexThreadRow {
  id: string;
  cwd: string;
  title: string;
  first_user_message: string;
  created_at: number;
  updated_at: number;
}

interface CodexHistoryEntry {
  session_id?: unknown;
  ts?: unknown;
  text?: unknown;
}

const MAX_REMOTE_CODEX_HISTORY_BYTES = 8 * 1024 * 1024;
const CODEX_STATE_DATABASE_PATTERN = /^state_(\d+)\.sqlite$/i;

interface TemporaryDatabaseFile {
  name: string;
  buffer: Buffer;
}

function normalizeMessage(input: string): string {
  return input.trim().replace(/\s+/g, ' ').slice(0, 160);
}

function applyHistoryEntry(
  latestMessages: Map<string, { ts: number; text: string }>,
  sessionIds: Set<string>,
  parsedEntry: CodexHistoryEntry,
): void {
  if (
    typeof parsedEntry.session_id !== 'string' ||
    !sessionIds.has(parsedEntry.session_id) ||
    typeof parsedEntry.text !== 'string'
  ) {
    return;
  }

  const normalizedText = normalizeMessage(parsedEntry.text);

  if (normalizedText.length === 0) {
    return;
  }

  const timestamp = typeof parsedEntry.ts === 'number' ? parsedEntry.ts : 0;
  const currentEntry = latestMessages.get(parsedEntry.session_id);

  if (!currentEntry || timestamp >= currentEntry.ts) {
    latestMessages.set(parsedEntry.session_id, {
      ts: timestamp,
      text: normalizedText,
    });
  }
}

function getStateDatabaseVersion(filePath: string): number | null {
  const fileName = path.posix.basename(filePath);
  const matchedVersion = fileName.match(CODEX_STATE_DATABASE_PATTERN)?.[1];

  if (!matchedVersion) {
    return null;
  }

  const parsedVersion = Number.parseInt(matchedVersion, 10);
  return Number.isFinite(parsedVersion) ? parsedVersion : null;
}

function sortStateDatabasePaths(filePaths: string[]): string[] {
  return [...new Set(filePaths)].sort((leftPath, rightPath) => {
    const leftVersion = getStateDatabaseVersion(leftPath) ?? -1;
    const rightVersion = getStateDatabaseVersion(rightPath) ?? -1;

    if (leftVersion !== rightVersion) {
      return rightVersion - leftVersion;
    }

    return rightPath.localeCompare(leftPath);
  });
}

async function withTemporaryDatabaseFiles<T>(
  prefix: string,
  files: TemporaryDatabaseFile[],
  mainFileName: string,
  run: (databasePath: string) => Promise<T> | T,
): Promise<T> {
  const temporaryDirectoryPath = await mkdtemp(path.join(tmpdir(), prefix));
  const databasePath = path.join(temporaryDirectoryPath, mainFileName);

  try {
    await Promise.all(
      files.map((file) => writeFile(path.join(temporaryDirectoryPath, file.name), file.buffer)),
    );
    return await run(databasePath);
  } finally {
    await rm(temporaryDirectoryPath, {
      recursive: true,
      force: true,
    });
  }
}

export class CodexRecentSessionProvider {
  private readonly codexDirectoryPath = path.join(homedir(), '.codex');

  constructor(private readonly sshCommandRunner?: SshCommandRunner) {}

  async listSessions(project: ProjectRef): Promise<RecentSessionRecord[]> {
    return isLocalProject(project)
      ? this.listLocalSessions()
      : this.listRemoteSessions(project);
  }

  private async listLocalSessions(): Promise<RecentSessionRecord[]> {
    try {
      const threadRows = await this.readLocalThreadRows();

      if (threadRows.length === 0) {
        return [];
      }

      const sessionIds = new Set(threadRows.map((row) => row.id));
      const lastMessages = await this.readLocalLastMessages(sessionIds);

      return threadRows.map((row) => ({
        agent: 'codex',
        sessionId: row.id,
        projectPath: row.cwd,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        lastUserMessage:
          lastMessages.get(row.id) ||
          normalizeMessage(row.first_user_message) ||
          normalizeMessage(row.title) ||
          'Resume Codex session',
        resumeKind: 'native_resume',
      }));
    } catch (error) {
      console.warn('Failed to read Codex recent sessions.', error);
      return [];
    }
  }

  private async listRemoteSessions(project: SshProjectRef): Promise<RecentSessionRecord[]> {
    if (!this.sshCommandRunner) {
      return [];
    }

    try {
      const threadRows = await this.readRemoteThreadRows(project.locator.host);

      if (threadRows.length === 0) {
        return [];
      }

      const sessionIds = new Set(threadRows.map((row) => row.id));
      const lastMessages = await this.readRemoteLastMessages(project.locator.host, sessionIds);

      return threadRows.map((row) => ({
        agent: 'codex',
        sessionId: row.id,
        projectPath: row.cwd,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        lastUserMessage:
          lastMessages.get(row.id) ||
          normalizeMessage(row.first_user_message) ||
          normalizeMessage(row.title) ||
          'Resume Codex session',
        resumeKind: 'native_resume',
      }));
    } catch (error) {
      console.warn('Failed to read remote Codex recent sessions.', error);
      return [];
    }
  }

  private getStateDatabasePath(): string {
    return path.join(this.codexDirectoryPath, 'state_5.sqlite');
  }

  private getHistoryPath(): string {
    return path.join(this.codexDirectoryPath, 'history.jsonl');
  }

  private async readLocalThreadRows(): Promise<CodexThreadRow[]> {
    const candidateDatabasePaths = await this.listLocalStateDatabasePaths();

    for (const candidatePath of candidateDatabasePaths) {
      const threadRows = this.readThreadRowsFromDatabasePath(candidatePath);

      if (threadRows.length > 0) {
        return threadRows;
      }
    }

    return [];
  }

  private async listLocalStateDatabasePaths(): Promise<string[]> {
    try {
      const directoryEntries = await readdir(this.codexDirectoryPath, {
        withFileTypes: true,
      });
      const candidatePaths = directoryEntries
        .filter((entry) => entry.isFile() && CODEX_STATE_DATABASE_PATTERN.test(entry.name))
        .map((entry) => path.join(this.codexDirectoryPath, entry.name));

      if (candidatePaths.length > 0) {
        return sortStateDatabasePaths(candidatePaths);
      }
    } catch (error) {
      console.warn('[codex-recents] failed to list local state databases', {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return [this.getStateDatabasePath()];
  }

  private async readRemoteThreadRows(host: string): Promise<CodexThreadRow[]> {
    if (!this.sshCommandRunner) {
      return [];
    }

    const candidateDatabasePaths = await this.listRemoteStateDatabasePaths(host);

    for (const candidatePath of candidateDatabasePaths) {
      try {
        const databaseBuffer = await readRemoteFile(this.sshCommandRunner, host, candidatePath);

        if (!databaseBuffer) {
          continue;
        }

        const mainFileName = path.posix.basename(candidatePath);
        const companionFiles: TemporaryDatabaseFile[] = [
          {
            name: mainFileName,
            buffer: databaseBuffer,
          },
        ];
        const walBuffer = await readRemoteFile(this.sshCommandRunner, host, `${candidatePath}-wal`);
        const shmBuffer = await readRemoteFile(this.sshCommandRunner, host, `${candidatePath}-shm`);

        if (walBuffer) {
          companionFiles.push({
            name: `${mainFileName}-wal`,
            buffer: walBuffer,
          });
        }

        if (shmBuffer) {
          companionFiles.push({
            name: `${mainFileName}-shm`,
            buffer: shmBuffer,
          });
        }

        const threadRows = await withTemporaryDatabaseFiles(
          'vibo-codex-remote-',
          companionFiles,
          mainFileName,
          (databasePath) => this.readThreadRowsFromDatabasePath(databasePath),
        );

        console.info('[codex-recents] remote state database inspected', {
          host,
          databasePath: candidatePath,
          hasWal: walBuffer !== null,
          hasShm: shmBuffer !== null,
          threadCount: threadRows.length,
        });

        if (threadRows.length > 0) {
          return threadRows;
        }
      } catch (error) {
        console.warn('[codex-recents] failed to inspect remote state database', {
          host,
          databasePath: candidatePath,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return [];
  }

  private async listRemoteStateDatabasePaths(host: string): Promise<string[]> {
    if (!this.sshCommandRunner) {
      return ['~/.codex/state_5.sqlite'];
    }

    try {
      const remoteFiles = await listRemoteFiles(this.sshCommandRunner, host, '~/.codex');
      const candidatePaths = remoteFiles.filter((filePath) =>
        CODEX_STATE_DATABASE_PATTERN.test(path.posix.basename(filePath)),
      );

      if (candidatePaths.length > 0) {
        return sortStateDatabasePaths(candidatePaths);
      }
    } catch (error) {
      console.warn('[codex-recents] failed to list remote state databases', {
        host,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return ['~/.codex/state_5.sqlite'];
  }

  private readThreadRowsFromDatabasePath(stateDatabasePath: string): CodexThreadRow[] {
    if (!existsSync(stateDatabasePath)) {
      return [];
    }

    const database = new DatabaseSync(stateDatabasePath, {
      readOnly: true,
    });

    try {
      const statement = database.prepare(`
        select
          id,
          cwd,
          title,
          first_user_message,
          created_at,
          updated_at
        from threads
        where archived = 0
        order by updated_at desc
      `);

      return statement.all() as unknown as CodexThreadRow[];
    } finally {
      database.close();
    }
  }

  private async readLocalLastMessages(sessionIds: Set<string>): Promise<Map<string, string>> {
    const historyPath = this.getHistoryPath();

    if (!existsSync(historyPath) || sessionIds.size === 0) {
      return new Map();
    }

    const latestMessages = new Map<string, { ts: number; text: string }>();
    const historyStream = createReadStream(historyPath, {
      encoding: 'utf8',
    });
    const lineReader = createInterface({
      input: historyStream,
      crlfDelay: Infinity,
    });

    try {
      for await (const line of lineReader) {
        const trimmedLine = line.trim();

        if (trimmedLine.length === 0) {
          continue;
        }

        let parsedEntry: CodexHistoryEntry;

        try {
          parsedEntry = JSON.parse(trimmedLine) as CodexHistoryEntry;
        } catch {
          continue;
        }

        applyHistoryEntry(latestMessages, sessionIds, parsedEntry);
      }
    } finally {
      lineReader.close();
      historyStream.close();
    }

    return new Map(
      [...latestMessages.entries()].map(([sessionId, entry]) => [sessionId, entry.text]),
    );
  }

  private async readRemoteLastMessages(
    host: string,
    sessionIds: Set<string>,
  ): Promise<Map<string, string>> {
    if (!this.sshCommandRunner || sessionIds.size === 0) {
      return new Map();
    }

    const historyFileSize = await getRemoteFileSize(
      this.sshCommandRunner,
      host,
      '~/.codex/history.jsonl',
    );

    if (
      historyFileSize === null ||
      historyFileSize === 0 ||
      historyFileSize > MAX_REMOTE_CODEX_HISTORY_BYTES
    ) {
      return new Map();
    }

    const historyBuffer = await readRemoteFile(this.sshCommandRunner, host, '~/.codex/history.jsonl');

    if (!historyBuffer) {
      return new Map();
    }

    const latestMessages = new Map<string, { ts: number; text: string }>();

    for (const line of historyBuffer.toString('utf8').split(/\r?\n/u)) {
      const trimmedLine = line.trim();

      if (trimmedLine.length === 0) {
        continue;
      }

      let parsedEntry: CodexHistoryEntry;

      try {
        parsedEntry = JSON.parse(trimmedLine) as CodexHistoryEntry;
      } catch {
        continue;
      }

      applyHistoryEntry(latestMessages, sessionIds, parsedEntry);
    }

    return new Map(
      [...latestMessages.entries()].map(([sessionId, entry]) => [sessionId, entry.text]),
    );
  }
}
