import { execFile } from 'node:child_process';
import { constants } from 'node:fs';
import { access } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

import type { OpenCodeAvailability } from '@shared/contracts/opencode';
import type { AppConfig, OpenCodeAgentSettings, ProjectConfig } from '@shared/domain/config';
import type { LaunchSpec } from '@shared/domain/launch';
import {
  getLocalProjectRoot,
  isSshProject,
  type ProjectRef,
  type SshProjectRef,
} from '@shared/domain/project';

import { SshCommandRunner } from '@main/services/ssh/ssh-command-runner';
import { SshLaunchBuilder } from '@main/services/ssh/ssh-launch-builder';
import { tMain } from '@main/app/i18n';

import { buildLocalAgentEnvironment } from '../local-command-env';

const execFileAsync = promisify(execFile);
const REMOTE_AVAILABILITY_TTL_MS = 30_000;

interface CachedAvailability {
  expiresAt: number;
  value: OpenCodeAvailability;
}

function mergeOpenCodeSettings(
  globalSettings: OpenCodeAgentSettings,
  projectOverrides: OpenCodeAgentSettings,
): OpenCodeAgentSettings {
  return {
    model: projectOverrides.model ?? globalSettings.model,
    primaryAgent: projectOverrides.primaryAgent ?? globalSettings.primaryAgent,
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

export class OpenCodeAgentAdapter {
  private readonly remoteAvailabilityCache = new Map<string, CachedAvailability>();

  constructor(
    private readonly sshCommandRunner: SshCommandRunner,
    private readonly sshLaunchBuilder: SshLaunchBuilder,
  ) {}

  async getAvailability(project: ProjectRef): Promise<OpenCodeAvailability> {
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
      reason: tMain('availability.opencodeMissing'),
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
        kind: 'opencode',
        displayLabel: 'OpenCode',
        iconKind: 'opencode',
        command: 'opencode',
        args: this.buildSharedArgs(appConfig, projectConfig),
      });
    }

    const command = await this.requireCommandPath();
    const localProjectRoot = getLocalProjectRoot(project);

    return {
      kind: 'opencode',
      spawn: {
        transport: 'local_pty',
        command,
        args: this.buildSharedArgs(appConfig, projectConfig),
        envOverrides: await buildLocalAgentEnvironment({
          TERM: 'xterm-256color',
        }),
        cwd: localProjectRoot,
      },
      project,
      workingDirectory: localProjectRoot,
      displayLabel: 'OpenCode',
      iconKind: 'opencode',
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
      throw new Error('OpenCode session id is required.');
    }

    const resumeArgs = ['--session', trimmedSessionId, ...this.buildSharedArgs(appConfig, projectConfig)];

    if (isSshProject(project)) {
      return this.sshLaunchBuilder.buildAgentLaunchSpec({
        project,
        kind: 'opencode',
        displayLabel: 'OpenCode',
        iconKind: 'opencode',
        command: 'opencode',
        args: resumeArgs,
        resumeMeta: {
          source: 'opencode',
          sessionId: trimmedSessionId,
        },
      });
    }

    const command = await this.requireCommandPath();
    const localProjectRoot = getLocalProjectRoot(project);

    return {
      kind: 'opencode',
      spawn: {
        transport: 'local_pty',
        command,
        args: resumeArgs,
        envOverrides: await buildLocalAgentEnvironment({
          TERM: 'xterm-256color',
        }),
        cwd: localProjectRoot,
      },
      project,
      workingDirectory: localProjectRoot,
      displayLabel: 'OpenCode',
      iconKind: 'opencode',
      resumeMeta: {
        source: 'opencode',
        sessionId: trimmedSessionId,
      },
      capabilities: {
        supportsResume: true,
        supportsStatusProbe: false,
      },
    };
  }

  private buildSharedArgs(appConfig: AppConfig, projectConfig: ProjectConfig): string[] {
    const overrides = mergeOpenCodeSettings(
      appConfig.agentSettings.opencode,
      projectConfig.agentOverrides.opencode,
    );
    const args: string[] = [];

    if (overrides.model) {
      args.push('--model', overrides.model);
    }

    if (overrides.primaryAgent) {
      args.push('--agent', overrides.primaryAgent);
    }

    return args;
  }

  private async getRemoteAvailability(project: SshProjectRef): Promise<OpenCodeAvailability> {
    const cacheKey = project.locator.host;
    const cachedValue = this.remoteAvailabilityCache.get(cacheKey);

    if (cachedValue && cachedValue.expiresAt > Date.now()) {
      return cachedValue.value;
    }

    try {
      await this.sshCommandRunner.runInInteractiveLoginShell(
        project.locator.host,
        'command -v opencode >/dev/null 2>&1',
        {
          debugLabel: 'opencode-availability',
        },
      );

      console.info('[opencode] remote availability confirmed', {
        host: project.locator.host,
      });

      const value: OpenCodeAvailability = {
        available: true,
      };
      this.remoteAvailabilityCache.set(cacheKey, {
        expiresAt: Date.now() + REMOTE_AVAILABILITY_TTL_MS,
        value,
      });
      return value;
    } catch (error) {
      console.warn('[opencode] remote availability probe failed', {
        host: project.locator.host,
        error: error instanceof Error ? error.message : String(error),
      });

      const value: OpenCodeAvailability = {
        available: false,
        reason: tMain('availability.opencodeRemoteUnavailable'),
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
      throw new Error(tMain('availability.opencodeMissing'));
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
