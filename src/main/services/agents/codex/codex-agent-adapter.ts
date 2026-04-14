import { execFile } from 'node:child_process';
import { constants } from 'node:fs';
import { access } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

import type { CodexAvailability } from '@shared/contracts/codex';
import type { AppConfig, CodexAgentSettings, ProjectConfig } from '@shared/domain/config';
import type { LaunchSpec } from '@shared/domain/launch';
import { getLocalProjectRoot, isSshProject, type ProjectRef, type SshProjectRef } from '@shared/domain/project';

import { SshCommandRunner } from '@main/services/ssh/ssh-command-runner';
import { SshLaunchBuilder } from '@main/services/ssh/ssh-launch-builder';
import { tMain } from '@main/app/i18n';

import {
  buildRemoteCodexHookSetupCommand,
  createLocalCodexHookRuntime,
} from '../agent-activity';
import { buildLocalAgentEnvironment } from '../local-command-env';

const execFileAsync = promisify(execFile);
const REMOTE_AVAILABILITY_TTL_MS = 30_000;

interface CachedAvailability {
  expiresAt: number;
  value: CodexAvailability;
}

function pushTomlOverride(args: string[], key: string, value: boolean | string): void {
  const serializedValue = typeof value === 'string' ? JSON.stringify(value) : String(value);
  args.push('-c', `${key}=${serializedValue}`);
}

function mergeCodexSettings(
  globalSettings: CodexAgentSettings,
  projectOverrides: CodexAgentSettings,
): CodexAgentSettings {
  return {
    model: projectOverrides.model ?? globalSettings.model,
    modelReasoningEffort:
      projectOverrides.modelReasoningEffort ?? globalSettings.modelReasoningEffort,
    approvalPolicy: projectOverrides.approvalPolicy ?? globalSettings.approvalPolicy,
    sandboxMode: projectOverrides.sandboxMode ?? globalSettings.sandboxMode,
    webSearch: projectOverrides.webSearch ?? globalSettings.webSearch,
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

export class CodexAgentAdapter {
  private readonly remoteAvailabilityCache = new Map<string, CachedAvailability>();

  constructor(
    private readonly sshCommandRunner: SshCommandRunner,
    private readonly sshLaunchBuilder: SshLaunchBuilder,
  ) {}

  async getAvailability(project: ProjectRef): Promise<CodexAvailability> {
    if (isSshProject(project)) {
      return this.getRemoteAvailability(project);
    }

    const commandPath = await this.resolveCommandPath();

    if (commandPath) {
      return {
        available: true,
      };
    }

    return {
      available: false,
      reason: tMain('availability.codexMissing'),
    };
  }

  async buildNewSessionLaunchSpec(
    project: ProjectRef,
    appConfig: AppConfig,
    projectConfig: ProjectConfig,
  ): Promise<LaunchSpec> {
    if (isSshProject(project)) {
      return this.sshLaunchBuilder.buildAgentLaunchSpec({
        project,
        kind: 'codex',
        displayLabel: 'Codex',
        iconKind: 'codex',
        command: 'codex',
        args: this.buildSharedArgs(project, appConfig, projectConfig),
        remoteSetupCommand: buildRemoteCodexHookSetupCommand(),
      });
    }

    const command = await this.requireCommandPath();
    const localProjectRoot = getLocalProjectRoot(project);
    const localHookRuntime = await createLocalCodexHookRuntime();

    return {
      kind: 'codex',
      spawn: {
        transport: 'local_pty',
        command,
        args: this.buildSharedArgs(project, appConfig, projectConfig),
        envOverrides: await buildLocalAgentEnvironment({
          CODEX_HOME: localHookRuntime.codexHomePath,
          TERM: 'xterm-256color',
        }),
        cwd: localProjectRoot,
      },
      project,
      workingDirectory: localProjectRoot,
      displayLabel: 'Codex',
      iconKind: 'codex',
      cleanupLocalPaths: localHookRuntime.cleanupPaths,
      capabilities: {
        supportsResume: true,
        supportsStatusProbe: false,
      },
    };
  }

  async buildResumeLaunchSpec(
    project: ProjectRef,
    sessionId: string,
    appConfig: AppConfig,
    projectConfig: ProjectConfig,
  ): Promise<LaunchSpec> {
    const trimmedSessionId = sessionId.trim();

    if (trimmedSessionId.length === 0) {
      throw new Error('Codex session id is required.');
    }

    if (isSshProject(project)) {
      return this.sshLaunchBuilder.buildAgentLaunchSpec({
        project,
        kind: 'codex',
        displayLabel: 'Codex',
        iconKind: 'codex',
        command: 'codex',
        args: ['resume', ...this.buildSharedArgs(project, appConfig, projectConfig), trimmedSessionId],
        remoteSetupCommand: buildRemoteCodexHookSetupCommand(),
        resumeMeta: {
          source: 'codex',
          sessionId: trimmedSessionId,
        },
      });
    }

    const command = await this.requireCommandPath();
    const localProjectRoot = getLocalProjectRoot(project);
    const localHookRuntime = await createLocalCodexHookRuntime();

    return {
      kind: 'codex',
      spawn: {
        transport: 'local_pty',
        command,
        args: ['resume', ...this.buildSharedArgs(project, appConfig, projectConfig), trimmedSessionId],
        envOverrides: await buildLocalAgentEnvironment({
          CODEX_HOME: localHookRuntime.codexHomePath,
          TERM: 'xterm-256color',
        }),
        cwd: localProjectRoot,
      },
      project,
      workingDirectory: localProjectRoot,
      displayLabel: 'Codex',
      iconKind: 'codex',
      cleanupLocalPaths: localHookRuntime.cleanupPaths,
      resumeMeta: {
        source: 'codex',
        sessionId: trimmedSessionId,
      },
      capabilities: {
        supportsResume: true,
        supportsStatusProbe: false,
      },
    };
  }

  private buildSharedArgs(
    project: ProjectRef,
    appConfig: AppConfig,
    projectConfig: ProjectConfig,
  ): string[] {
    const workingDirectory = isSshProject(project)
      ? project.locator.remotePath
      : getLocalProjectRoot(project);
    const args = ['--enable', 'codex_hooks', '-C', workingDirectory];
    const overrides = mergeCodexSettings(appConfig.agentSettings.codex, projectConfig.agentOverrides.codex);

    if (overrides.model) {
      args.push('-m', overrides.model);
    }

    if (overrides.modelReasoningEffort) {
      pushTomlOverride(args, 'model_reasoning_effort', overrides.modelReasoningEffort);
    }

    if (overrides.approvalPolicy) {
      args.push('-a', overrides.approvalPolicy);
    }

    if (overrides.sandboxMode) {
      args.push('-s', overrides.sandboxMode);
    }

    if (overrides.webSearch) {
      pushTomlOverride(args, 'web_search', overrides.webSearch);
    }

    return args;
  }

  private async getRemoteAvailability(project: SshProjectRef): Promise<CodexAvailability> {
    const cacheKey = project.locator.host;
    const cachedValue = this.remoteAvailabilityCache.get(cacheKey);

    if (cachedValue && cachedValue.expiresAt > Date.now()) {
      return cachedValue.value;
    }

    try {
      await this.sshCommandRunner.runInInteractiveLoginShell(
        project.locator.host,
        'command -v codex >/dev/null 2>&1',
        {
          debugLabel: 'codex-availability',
        },
      );

      console.info('[codex] remote availability confirmed', {
        host: project.locator.host,
      });

      const value: CodexAvailability = {
        available: true,
      };
      this.remoteAvailabilityCache.set(cacheKey, {
        expiresAt: Date.now() + REMOTE_AVAILABILITY_TTL_MS,
        value,
      });
      return value;
    } catch (error) {
      console.warn('[codex] remote availability probe failed', {
        host: project.locator.host,
        error: error instanceof Error ? error.message : String(error),
      });

      const value: CodexAvailability = {
        available: false,
        reason: tMain('availability.codexRemoteUnavailable'),
      };

      this.remoteAvailabilityCache.set(cacheKey, {
        expiresAt: Date.now() + REMOTE_AVAILABILITY_TTL_MS,
        value,
      });
      return value;
    }
  }

  private async requireCommandPath(): Promise<string> {
    const commandPath = await this.resolveCommandPath();

    if (!commandPath) {
      throw new Error(tMain('availability.codexMissing'));
    }

    return commandPath;
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
      const candidate = path.join(pathEntry, 'codex');

      if (await isExecutable(candidate)) {
        return candidate;
      }
    }

    return null;
  }

  private async resolveFromLoginShell(): Promise<string | null> {
    const shellPath = process.env.SHELL || '/bin/zsh';

    try {
      const { stdout } = await execFileAsync(shellPath, ['-lic', 'command -v codex']);
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
