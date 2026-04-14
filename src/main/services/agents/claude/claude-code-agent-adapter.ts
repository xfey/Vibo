import { execFile } from 'node:child_process';
import { constants } from 'node:fs';
import { access } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

import type { ClaudeCodeAvailability } from '@shared/contracts/claude';
import type { AppConfig, ClaudeCodeAgentSettings, ProjectConfig } from '@shared/domain/config';
import type { LaunchSpec } from '@shared/domain/launch';
import { getLocalProjectRoot, isSshProject, type ProjectRef, type SshProjectRef } from '@shared/domain/project';

import { SshCommandRunner } from '@main/services/ssh/ssh-command-runner';
import { SshLaunchBuilder } from '@main/services/ssh/ssh-launch-builder';
import { tMain } from '@main/app/i18n';

import { buildClaudeCodeSettingsOverride } from '../agent-activity';
import { buildLocalAgentEnvironment } from '../local-command-env';

const execFileAsync = promisify(execFile);
const REMOTE_AVAILABILITY_TTL_MS = 30_000;
const SUPPORTED_CLAUDE_EFFORT_LEVELS = new Set(['low', 'medium', 'high', 'max']);
const SUPPORTED_CLAUDE_PERMISSION_MODES = new Set([
  'default',
  'acceptEdits',
  'auto',
  'plan',
  'dontAsk',
  'bypassPermissions',
]);

interface CachedAvailability {
  expiresAt: number;
  value: ClaudeCodeAvailability;
}

function mergeClaudeSettings(
  globalSettings: ClaudeCodeAgentSettings,
  projectOverrides: ClaudeCodeAgentSettings,
): ClaudeCodeAgentSettings {
  return {
    model: projectOverrides.model ?? globalSettings.model,
    effort: projectOverrides.effort ?? globalSettings.effort,
    permission: projectOverrides.permission ?? globalSettings.permission,
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

export class ClaudeCodeAgentAdapter {
  private readonly remoteAvailabilityCache = new Map<string, CachedAvailability>();

  constructor(
    private readonly sshCommandRunner: SshCommandRunner,
    private readonly sshLaunchBuilder: SshLaunchBuilder,
  ) {}

  async getAvailability(project: ProjectRef): Promise<ClaudeCodeAvailability> {
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
      reason: tMain('availability.claudeMissing'),
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
        kind: 'claude_code',
        displayLabel: 'Claude Code',
        iconKind: 'claude_code',
        command: 'claude',
        args: this.buildSharedArgs(appConfig, projectConfig),
      });
    }

    const command = await this.requireCommandPath();
    const localProjectRoot = getLocalProjectRoot(project);

    return {
      kind: 'claude_code',
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
      displayLabel: 'Claude Code',
      iconKind: 'claude_code',
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
      throw new Error('Claude Code session id is required.');
    }

    if (isSshProject(project)) {
      return this.sshLaunchBuilder.buildAgentLaunchSpec({
        project,
        kind: 'claude_code',
        displayLabel: 'Claude Code',
        iconKind: 'claude_code',
        command: 'claude',
        args: ['--resume', trimmedSessionId, ...this.buildSharedArgs(appConfig, projectConfig)],
        resumeMeta: {
          source: 'claude_code',
          sessionId: trimmedSessionId,
        },
      });
    }

    const command = await this.requireCommandPath();
    const localProjectRoot = getLocalProjectRoot(project);

    return {
      kind: 'claude_code',
      spawn: {
        transport: 'local_pty',
        command,
        args: ['--resume', trimmedSessionId, ...this.buildSharedArgs(appConfig, projectConfig)],
        envOverrides: await buildLocalAgentEnvironment({
          TERM: 'xterm-256color',
        }),
        cwd: localProjectRoot,
      },
      project,
      workingDirectory: localProjectRoot,
      displayLabel: 'Claude Code',
      iconKind: 'claude_code',
      resumeMeta: {
        source: 'claude_code',
        sessionId: trimmedSessionId,
      },
      capabilities: {
        supportsResume: true,
        supportsStatusProbe: false,
      },
    };
  }

  private buildSharedArgs(appConfig: AppConfig, projectConfig: ProjectConfig): string[] {
    const overrides = mergeClaudeSettings(
      appConfig.agentSettings.claudeCode,
      projectConfig.agentOverrides.claudeCode,
    );
    const args: string[] = ['--settings', buildClaudeCodeSettingsOverride()];

    if (overrides.model) {
      args.push('--model', overrides.model);
    }

    if (overrides.effort && SUPPORTED_CLAUDE_EFFORT_LEVELS.has(overrides.effort)) {
      args.push('--effort', overrides.effort);
    }

    if (overrides.permission && SUPPORTED_CLAUDE_PERMISSION_MODES.has(overrides.permission)) {
      args.push('--permission-mode', overrides.permission);
    }

    return args;
  }

  private async getRemoteAvailability(project: SshProjectRef): Promise<ClaudeCodeAvailability> {
    const cacheKey = project.locator.host;
    const cachedValue = this.remoteAvailabilityCache.get(cacheKey);

    if (cachedValue && cachedValue.expiresAt > Date.now()) {
      return cachedValue.value;
    }

    try {
      await this.sshCommandRunner.runInInteractiveLoginShell(
        project.locator.host,
        'command -v claude >/dev/null 2>&1',
        {
          debugLabel: 'claude-availability',
        },
      );

      console.info('[claude] remote availability confirmed', {
        host: project.locator.host,
      });

      const value: ClaudeCodeAvailability = {
        available: true,
      };
      this.remoteAvailabilityCache.set(cacheKey, {
        expiresAt: Date.now() + REMOTE_AVAILABILITY_TTL_MS,
        value,
      });
      return value;
    } catch (error) {
      console.warn('[claude] remote availability probe failed', {
        host: project.locator.host,
        error: error instanceof Error ? error.message : String(error),
      });

      const value: ClaudeCodeAvailability = {
        available: false,
        reason: tMain('availability.claudeRemoteUnavailable'),
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
      throw new Error(tMain('availability.claudeMissing'));
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
      const candidate = path.join(pathEntry, 'claude');

      if (await isExecutable(candidate)) {
        return candidate;
      }
    }

    return null;
  }

  private async resolveFromLoginShell(): Promise<string | null> {
    const shellPath = process.env.SHELL || '/bin/zsh';

    try {
      const { stdout } = await execFileAsync(shellPath, ['-lic', 'command -v claude']);
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
