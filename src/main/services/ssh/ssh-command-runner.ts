import { spawn } from 'node:child_process';
import { constants } from 'node:fs';
import { access } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { tMain } from '@main/app/i18n';

const execFileAsync = promisify(execFile);
const DEFAULT_SSH_TIMEOUT_MS = 15000;
const SSH_DEBUG_COMMAND_PREVIEW_MAX_LENGTH = 220;

type SshTtyMode = 'disable' | 'force';

interface RunSshCommandOptions {
  stdin?: Buffer | string;
  timeoutMs?: number;
  batchMode?: boolean;
  tty?: SshTtyMode;
  debugLabel?: string;
}

interface RunSshLoginShellOptions extends RunSshCommandOptions {
  interactive?: boolean;
}

function normalizeHost(host: string): string {
  const normalizedHost = host.trim();

  if (normalizedHost.length === 0) {
    throw new Error(tMain('workspace.remoteHostEmpty'));
  }

  return normalizedHost;
}

async function isExecutable(filePath: string): Promise<boolean> {
  try {
    await access(filePath, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

async function executeLocalCommand(
  command: string,
  args: string[],
  options: {
    stdin?: Buffer | string;
    timeoutMs?: number;
  } = {},
): Promise<{
  stdout: Buffer;
  stderr: Buffer;
}> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'pipe',
      env: process.env,
    });
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    let settled = false;
    let timeoutHandle: NodeJS.Timeout | undefined;

    function finishWithError(error: Error): void {
      if (settled) {
        return;
      }

      settled = true;

      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }

      reject(error);
    }

    function finishWithSuccess(stdout: Buffer, stderr: Buffer): void {
      if (settled) {
        return;
      }

      settled = true;

      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }

      resolve({
        stdout,
        stderr,
      });
    }

    if (options.timeoutMs && options.timeoutMs > 0) {
      timeoutHandle = setTimeout(() => {
        try {
          child.kill('SIGKILL');
        } catch {
          // Ignore kill failures after timeout.
        }

        finishWithError(new Error(`Command timed out after ${options.timeoutMs}ms.`));
      }, options.timeoutMs);
    }

    child.once('error', (error) => {
      finishWithError(error instanceof Error ? error : new Error('Command failed to start.'));
    });

    child.stdout?.on('data', (chunk: Buffer | string) => {
      stdoutChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });

    child.stderr?.on('data', (chunk: Buffer | string) => {
      stderrChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });

    child.once('close', (code, signal) => {
      const stdout = Buffer.concat(stdoutChunks);
      const stderr = Buffer.concat(stderrChunks);

      if (code === 0) {
        finishWithSuccess(stdout, stderr);
        return;
      }

      const stderrText = stderr.toString('utf8').trim();
      const statusText = code === null ? `signal ${signal ?? 'unknown'}` : `exit code ${code}`;

      finishWithError(
        new Error(
          stderrText.length > 0
            ? stderrText
            : `Command failed with ${statusText}.`,
        ),
      );
    });

    if (options.stdin !== undefined) {
      child.stdin?.end(options.stdin);
      return;
    }

    child.stdin?.end();
  });
}

export function quotePosixShell(value: string): string {
  return `'${value.replace(/'/g, `'\"'\"'`)}'`;
}

export function joinPosixCommand(command: string, args: string[]): string {
  return [command, ...args].map((segment) => quotePosixShell(segment)).join(' ');
}

function formatDebugPreview(value: string): string {
  const normalized = value.replace(/\s+/g, ' ').trim();

  if (normalized.length <= SSH_DEBUG_COMMAND_PREVIEW_MAX_LENGTH) {
    return normalized;
  }

  return `${normalized.slice(0, SSH_DEBUG_COMMAND_PREVIEW_MAX_LENGTH - 1)}…`;
}

function getStdinByteLength(stdin: Buffer | string | undefined): number {
  if (stdin === undefined) {
    return 0;
  }

  return Buffer.isBuffer(stdin) ? stdin.byteLength : Buffer.byteLength(stdin);
}

export function buildRemoteLoginShellCommand(
  command: string,
  options: {
    interactive?: boolean;
  } = {},
): string {
  const quotedCommand = quotePosixShell(command);
  const shellFlags = options.interactive ? '-ilc' : '-lc';

  return [
    'if [ -n "${SHELL:-}" ]; then',
    `  exec "$SHELL" ${shellFlags} ${quotedCommand};`,
    'elif command -v bash >/dev/null 2>&1; then',
    `  exec bash ${shellFlags} ${quotedCommand};`,
    'else',
    `  exec sh ${shellFlags} ${quotedCommand};`,
    'fi',
  ].join(' ');
}

export function toRemoteShellPathExpression(rawPath: string): string {
  const normalizedPath = rawPath.trim();

  if (normalizedPath.length === 0) {
    throw new Error(tMain('workspace.remotePathEmpty'));
  }

  if (normalizedPath === '~') {
    return '"$HOME"';
  }

  if (normalizedPath.startsWith('~/')) {
    return `"${'$'}HOME"${quotePosixShell(normalizedPath.slice(1))}`;
  }

  if (normalizedPath.startsWith('/')) {
    return quotePosixShell(normalizedPath);
  }

  throw new Error(tMain('workspace.remotePathInvalid'));
}

export class SshCommandRunner {
  async resolveCommandPath(): Promise<string | null> {
    const commandFromPath = await this.resolveFromEnvironmentPath();

    if (commandFromPath) {
      return commandFromPath;
    }

    return this.resolveFromLoginShell();
  }

  async requireCommandPath(): Promise<string> {
    const commandPath = await this.resolveCommandPath();

    if (!commandPath) {
      throw new Error(tMain('workspace.sshUnavailable'));
    }

    return commandPath;
  }

  async run(
    host: string,
    remoteCommand: string,
    options: RunSshCommandOptions = {},
  ): Promise<{
    stdout: Buffer;
    stderr: Buffer;
  }> {
    const command = await this.requireCommandPath();
    const normalizedHost = normalizeHost(host);
    const ttyMode = options.tty ?? 'disable';
    const timeoutMs = options.timeoutMs ?? DEFAULT_SSH_TIMEOUT_MS;
    const startedAt = Date.now();
    const args = [ttyMode === 'force' ? '-tt' : '-T', '-o', 'ConnectTimeout=10'];

    if (options.batchMode !== false) {
      args.push('-o', 'BatchMode=yes');
    }

    args.push(normalizedHost, remoteCommand);

    if (options.debugLabel) {
      console.info(`[ssh:${options.debugLabel}] start`, {
        host: normalizedHost,
        tty: ttyMode,
        batchMode: options.batchMode !== false,
        timeoutMs,
        stdinBytes: getStdinByteLength(options.stdin),
        remoteCommand: formatDebugPreview(remoteCommand),
      });
    }

    try {
      const result = await executeLocalCommand(command, args, {
        stdin: options.stdin,
        timeoutMs,
      });

      if (options.debugLabel) {
        console.info(`[ssh:${options.debugLabel}] success`, {
          host: normalizedHost,
          durationMs: Date.now() - startedAt,
          stdoutBytes: result.stdout.byteLength,
          stderrBytes: result.stderr.byteLength,
        });
      }

      return result;
    } catch (error) {
      if (options.debugLabel) {
        console.warn(`[ssh:${options.debugLabel}] failed`, {
          host: normalizedHost,
          durationMs: Date.now() - startedAt,
          error: error instanceof Error ? error.message : String(error),
        });
      }

      throw error;
    }
  }

  async runText(
    host: string,
    remoteCommand: string,
    options: RunSshCommandOptions = {},
  ): Promise<string> {
    const result = await this.run(host, remoteCommand, options);
    return result.stdout.toString('utf8');
  }

  async runScript(
    host: string,
    script: string,
    args: string[] = [],
    options: Omit<RunSshCommandOptions, 'stdin'> = {},
  ): Promise<{
    stdout: Buffer;
    stderr: Buffer;
  }> {
    return this.run(
      host,
      joinPosixCommand('sh', ['-s', '--', ...args]),
      {
        ...options,
        stdin: script,
      },
    );
  }

  async runScriptText(
    host: string,
    script: string,
    args: string[] = [],
    options: Omit<RunSshCommandOptions, 'stdin'> = {},
  ): Promise<string> {
    const result = await this.runScript(host, script, args, options);
    return result.stdout.toString('utf8');
  }

  async runInLoginShell(
    host: string,
    command: string,
    options: RunSshLoginShellOptions = {},
  ): Promise<string> {
    return this.runText(
      host,
      buildRemoteLoginShellCommand(command, {
        interactive: options.interactive,
      }),
      options,
    );
  }

  async runInInteractiveLoginShell(
    host: string,
    command: string,
    options: Omit<RunSshCommandOptions, 'tty'> = {},
  ): Promise<string> {
    return this.runInLoginShell(host, command, {
      ...options,
      interactive: true,
      tty: 'force',
    });
  }

  async resolveRemoteProjectDirectory(host: string, rawPath: string): Promise<string> {
    const targetPathExpression = toRemoteShellPathExpression(rawPath);
    const stdout = await this.runText(
      host,
      [
        `target=${targetPathExpression};`,
        'if [ ! -d "$target" ]; then',
        `  printf '%s\n' 'Remote project directory was not found.' >&2;`,
        '  exit 1;',
        'fi;',
        'cd -- "$target" && pwd -P',
      ].join(' '),
      {
        batchMode: true,
        timeoutMs: DEFAULT_SSH_TIMEOUT_MS,
        debugLabel: 'resolve-project-directory',
      },
    );
    const resolvedPath = stdout
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .find((line) => line.length > 0);

    if (!resolvedPath) {
      throw new Error(tMain('workspace.remoteProjectResolveFailed'));
    }

    return resolvedPath;
  }

  private async resolveFromEnvironmentPath(): Promise<string | null> {
    const pathEntries = (process.env.PATH ?? '')
      .split(path.delimiter)
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);

    for (const pathEntry of pathEntries) {
      const candidate = path.join(pathEntry, 'ssh');

      if (await isExecutable(candidate)) {
        return candidate;
      }
    }

    return null;
  }

  private async resolveFromLoginShell(): Promise<string | null> {
    const shellPath = process.env.SHELL || '/bin/zsh';

    try {
      const { stdout } = await execFileAsync(shellPath, ['-lic', 'command -v ssh']);
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
