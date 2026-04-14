import { execFile } from 'node:child_process';
import { constants } from 'node:fs';
import { access } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

import type {
  GetProjectGitDataRequest,
  GetProjectGitFileDiffRequest,
  ProjectGitCommitFilesData,
  ProjectGitData,
  ProjectGitDiffPreview,
} from '@shared/contracts/git';
import type {
  GitCommitFileRecord,
  GitCommitFileStatus,
  GitCommitRecord,
} from '@shared/domain/git';
import { getLocalProjectRoot, type ProjectRef } from '@shared/domain/project';
import { tMain } from '@main/app/i18n';

const execFileAsync = promisify(execFile);
const DEFAULT_GIT_COMMITS_LIMIT = 24;
const MAX_GIT_COMMITS_LIMIT = 80;
const GIT_OUTPUT_SEPARATOR = '\u001f';
const GIT_RECORD_SEPARATOR = '\u001e';

async function isExecutable(filePath: string): Promise<boolean> {
  try {
    await access(filePath, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function normalizeGitStdout(stdout: string): string {
  return stdout.trim();
}

function normalizeScopePath(scopePath: string): string {
  return scopePath.replace(/\/+$/, '').trim();
}

function parseRefNames(rawRefNames: string): string[] {
  return rawRefNames
    .split(',')
    .map((refName) => refName.trim())
    .filter((refName) => refName.length > 0);
}

function parseGitCommits(stdout: string): GitCommitRecord[] {
  return stdout
    .split(GIT_RECORD_SEPARATOR)
    .map((record) => record.trim())
    .filter((record) => record.length > 0)
    .map((record) => {
      const [hash, shortHash, authorName, committedAtText, subject, rawRefNames] = record.split(
        GIT_OUTPUT_SEPARATOR,
      );
      const committedAt = Number.parseInt(committedAtText ?? '', 10);

      return {
        hash,
        shortHash,
        authorName,
        committedAt: Number.isFinite(committedAt) ? committedAt : 0,
        subject: subject && subject.length > 0 ? subject : '(no commit message)',
        refNames: parseRefNames(rawRefNames ?? ''),
      };
    })
    .filter((record) => record.hash.length > 0 && record.shortHash.length > 0);
}

function toGitCommitFileStatus(statusCode: string): GitCommitFileStatus {
  switch (statusCode[0]) {
    case 'A':
      return 'added';
    case 'M':
      return 'modified';
    case 'D':
      return 'deleted';
    case 'R':
      return 'renamed';
    case 'C':
      return 'copied';
    case 'T':
      return 'type_changed';
    case 'U':
      return 'unmerged';
    default:
      return 'unknown';
  }
}

function parseGitCommitFiles(stdout: string): GitCommitFileRecord[] {
  return stdout
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      const parts = line.split('\t');
      const statusCode = parts[0] ?? '';
      const status = toGitCommitFileStatus(statusCode);

      if (status === 'renamed' || status === 'copied') {
        const previousPath = parts[1] ?? '';
        const nextPath = parts[2] ?? '';

        return {
          path: nextPath,
          previousPath: previousPath.length > 0 ? previousPath : null,
          status,
        } satisfies GitCommitFileRecord;
      }

      return {
        path: parts[1] ?? '',
        previousPath: null,
        status,
      } satisfies GitCommitFileRecord;
    })
    .filter((record) => record.path.length > 0);
}

function normalizeLimit(limit: number | undefined): number {
  if (!Number.isFinite(limit)) {
    return DEFAULT_GIT_COMMITS_LIMIT;
  }

  return Math.max(1, Math.min(MAX_GIT_COMMITS_LIMIT, Math.floor(limit as number)));
}

function normalizeOffset(offset: number | undefined): number {
  if (!Number.isFinite(offset)) {
    return 0;
  }

  return Math.max(0, Math.floor(offset as number));
}

export class ProjectGitService {
  async getProjectGitData(
    project: ProjectRef,
    request: GetProjectGitDataRequest = {},
  ): Promise<ProjectGitData> {
    const localProjectRoot = getLocalProjectRoot(project);
    const gitCommand = await this.resolveCommandPath();
    const limit = normalizeLimit(request.limit);
    const offset = normalizeOffset(request.offset);

    if (!gitCommand) {
      return {
        state: 'git_unavailable',
        repositoryName: null,
        branchName: null,
        isDetachedHead: false,
        scopePath: '',
        commits: [],
        hasMore: false,
        reason: tMain('git.unavailableReason'),
      };
    }

    const repositoryRoot = await this.resolveRepositoryRoot(gitCommand, localProjectRoot);

    if (!repositoryRoot) {
      return {
        state: 'not_repository',
        repositoryName: null,
        branchName: null,
        isDetachedHead: false,
        scopePath: '',
        commits: [],
        hasMore: false,
        reason: tMain('git.notRepositoryReason'),
      };
    }

    const scopePath = await this.resolveScopePath(gitCommand, localProjectRoot);
    const [branchState, hasHead] = await Promise.all([
      this.resolveBranchState(gitCommand, localProjectRoot),
      this.hasHeadCommit(gitCommand, localProjectRoot),
    ]);

    if (!hasHead) {
      return {
        state: 'empty_repository',
        repositoryName: path.basename(repositoryRoot),
        branchName: branchState.branchName,
        isDetachedHead: branchState.isDetachedHead,
        scopePath,
        commits: [],
        hasMore: false,
        reason: tMain('git.emptyRepositoryReason'),
      };
    }

    const commitPage = await this.listCommits(gitCommand, localProjectRoot, scopePath, {
      offset,
      limit,
    });

    return {
      state: 'ready',
      repositoryName: path.basename(repositoryRoot),
      branchName: branchState.branchName,
      isDetachedHead: branchState.isDetachedHead,
      scopePath,
      commits: commitPage.items,
      hasMore: commitPage.hasMore,
      reason: null,
    };
  }

  async getCommitFiles(
    project: ProjectRef,
    commitHash: string,
  ): Promise<ProjectGitCommitFilesData> {
    const gitCommand = await this.requireCommandPath();
    const localProjectRoot = getLocalProjectRoot(project);
    const trimmedCommitHash = commitHash.trim();

    if (trimmedCommitHash.length === 0) {
      throw new Error(tMain('git.commitHashRequired'));
    }

    const { stdout } = await execFileAsync(
      gitCommand,
      [
        'show',
        '--format=',
        '--name-status',
        '--relative',
        '--find-renames=40%',
        '--no-ext-diff',
        '--no-color',
        trimmedCommitHash,
      ],
      {
        cwd: localProjectRoot,
        maxBuffer: 512 * 1024,
      },
    );

    return {
      commitHash: trimmedCommitHash,
      files: parseGitCommitFiles(stdout),
    };
  }

  async getFileDiff(
    project: ProjectRef,
    request: GetProjectGitFileDiffRequest,
  ): Promise<ProjectGitDiffPreview> {
    const gitCommand = await this.requireCommandPath();
    const localProjectRoot = getLocalProjectRoot(project);
    const trimmedCommitHash = request.commitHash.trim();
    const trimmedFilePath = request.filePath.trim();
    const trimmedPreviousPath = request.previousPath?.trim() ?? '';

    if (trimmedCommitHash.length === 0 || trimmedFilePath.length === 0) {
      throw new Error('Commit hash and file path are required.');
    }

    const pathspecs = Array.from(
      new Set(
        [trimmedPreviousPath, trimmedFilePath].filter((pathValue) => pathValue.length > 0),
      ),
    );
    const args = [
      'show',
      '--format=',
      '--relative',
      '--find-renames=40%',
      '--no-ext-diff',
      '--no-color',
      trimmedCommitHash,
      '--',
      ...pathspecs,
    ];
    const { stdout } = await execFileAsync(gitCommand, args, {
      cwd: localProjectRoot,
      maxBuffer: 1024 * 1024,
    });

    return {
      commitHash: trimmedCommitHash,
      filePath: trimmedFilePath,
      previousPath: trimmedPreviousPath.length > 0 ? trimmedPreviousPath : null,
      status: request.status,
      patch: stdout.trimEnd(),
    };
  }

  private async listCommits(
    gitCommand: string,
    cwd: string,
    scopePath: string,
    options: {
      offset: number;
      limit: number;
    },
  ): Promise<{
    items: GitCommitRecord[];
    hasMore: boolean;
  }> {
    const args = [
      'log',
      '--date-order',
      `--max-count=${options.limit + 1}`,
      `--skip=${options.offset}`,
      '--decorate=short',
      `--format=%H${GIT_OUTPUT_SEPARATOR}%h${GIT_OUTPUT_SEPARATOR}%an${GIT_OUTPUT_SEPARATOR}%at${GIT_OUTPUT_SEPARATOR}%s${GIT_OUTPUT_SEPARATOR}%D${GIT_RECORD_SEPARATOR}`,
    ];

    if (scopePath.length > 0) {
      args.push('--', scopePath);
    }

    const { stdout } = await execFileAsync(gitCommand, args, {
      cwd,
      maxBuffer: 512 * 1024,
    });

    const parsedCommits = parseGitCommits(stdout);

    return {
      items: parsedCommits.slice(0, options.limit),
      hasMore: parsedCommits.length > options.limit,
    };
  }

  private async hasHeadCommit(gitCommand: string, cwd: string): Promise<boolean> {
    try {
      await execFileAsync(gitCommand, ['rev-parse', '--verify', 'HEAD'], {
        cwd,
      });
      return true;
    } catch {
      return false;
    }
  }

  private async resolveRepositoryRoot(gitCommand: string, cwd: string): Promise<string | null> {
    try {
      const { stdout } = await execFileAsync(gitCommand, ['rev-parse', '--show-toplevel'], {
        cwd,
      });
      const repositoryRoot = normalizeGitStdout(stdout);
      return repositoryRoot.length > 0 ? repositoryRoot : null;
    } catch {
      return null;
    }
  }

  private async resolveScopePath(gitCommand: string, cwd: string): Promise<string> {
    try {
      const { stdout } = await execFileAsync(gitCommand, ['rev-parse', '--show-prefix'], {
        cwd,
      });
      return normalizeScopePath(stdout);
    } catch {
      return '';
    }
  }

  private async resolveBranchState(
    gitCommand: string,
    cwd: string,
  ): Promise<{
    branchName: string | null;
    isDetachedHead: boolean;
  }> {
    try {
      const { stdout } = await execFileAsync(gitCommand, ['rev-parse', '--abbrev-ref', 'HEAD'], {
        cwd,
      });
      const branchName = normalizeGitStdout(stdout);

      if (branchName.length === 0) {
        return {
          branchName: null,
          isDetachedHead: false,
        };
      }

      if (branchName === 'HEAD') {
        return {
          branchName: null,
          isDetachedHead: true,
        };
      }

      return {
        branchName,
        isDetachedHead: false,
      };
    } catch {
      return {
        branchName: null,
        isDetachedHead: false,
      };
    }
  }

  private async resolveCommandPath(): Promise<string | null> {
    const commandFromPath = await this.resolveFromEnvironmentPath();

    if (commandFromPath) {
      return commandFromPath;
    }

    return this.resolveFromLoginShell();
  }

  private async requireCommandPath(): Promise<string> {
    const commandPath = await this.resolveCommandPath();

    if (!commandPath) {
      throw new Error('Git 当前不可用，无法读取提交历史。');
    }

    return commandPath;
  }

  private async resolveFromEnvironmentPath(): Promise<string | null> {
    const pathEntries = (process.env.PATH ?? '')
      .split(path.delimiter)
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);

    for (const pathEntry of pathEntries) {
      const candidate = path.join(pathEntry, 'git');

      if (await isExecutable(candidate)) {
        return candidate;
      }
    }

    return null;
  }

  private async resolveFromLoginShell(): Promise<string | null> {
    const shellPath = process.env.SHELL || '/bin/zsh';

    try {
      const { stdout } = await execFileAsync(shellPath, ['-lic', 'command -v git']);
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
