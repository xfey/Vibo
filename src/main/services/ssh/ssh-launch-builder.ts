import { homedir } from 'node:os';

import type { LaunchSpec } from '@shared/domain/launch';
import type { SshProjectRef } from '@shared/domain/project';

import {
  buildRemoteLoginShellCommand,
  joinPosixCommand,
  quotePosixShell,
  SshCommandRunner,
} from './ssh-command-runner';

function resolveLocalSpawnCwd(): string {
  return process.env.HOME || homedir();
}

function buildRemoteInteractiveShellCommand(remotePath: string): string {
  return [
    `cd -- ${quotePosixShell(remotePath)} &&`,
    'if [ -n "${SHELL:-}" ]; then',
    '  exec "$SHELL" -l;',
    'elif command -v bash >/dev/null 2>&1; then',
    '  exec bash -l;',
    'else',
    '  exec sh -l;',
    'fi',
  ].join(' ');
}

function buildRemoteExecCommand(
  remotePath: string,
  command: string,
  args: string[],
  options: {
    setupCommand?: string;
  } = {},
): string {
  const execCommand = [options.setupCommand?.trim(), `exec ${joinPosixCommand(command, args)}`]
    .filter((segment): segment is string => Boolean(segment))
    .join('\n');

  return [
    `cd -- ${quotePosixShell(remotePath)} &&`,
    buildRemoteLoginShellCommand(execCommand, {
      interactive: true,
    }),
  ].join(' ');
}

export class SshLaunchBuilder {
  constructor(private readonly sshCommandRunner: SshCommandRunner) {}

  async buildShellLaunchSpec(project: SshProjectRef): Promise<LaunchSpec> {
    const sshCommand = await this.sshCommandRunner.requireCommandPath();

    console.info('[ssh-launch] build remote shell session', {
      host: project.locator.host,
      remotePath: project.locator.remotePath,
    });

    return {
      kind: 'shell',
      spawn: {
        transport: 'local_pty',
        command: sshCommand,
        args: ['-tt', project.locator.host, buildRemoteInteractiveShellCommand(project.locator.remotePath)],
        envOverrides: {
          TERM: 'xterm-256color',
        },
        cwd: resolveLocalSpawnCwd(),
      },
      project,
      workingDirectory: project.locator.remotePath,
      displayLabel: 'Shell',
      iconKind: 'shell',
      capabilities: {
        supportsResume: false,
        supportsStatusProbe: false,
      },
    };
  }

  async buildAgentLaunchSpec(options: {
    project: SshProjectRef;
    kind: 'codex' | 'claude_code' | 'opencode';
    displayLabel: string;
    iconKind: 'codex' | 'claude_code' | 'opencode';
    command: string;
    args: string[];
    remoteSetupCommand?: string;
    resumeMeta?: LaunchSpec['resumeMeta'];
  }): Promise<LaunchSpec> {
    const sshCommand = await this.sshCommandRunner.requireCommandPath();

    console.info('[ssh-launch] build remote agent session', {
      kind: options.kind,
      host: options.project.locator.host,
      remotePath: options.project.locator.remotePath,
      command: options.command,
      args: options.args,
      resumeSessionId: options.resumeMeta?.sessionId ?? null,
    });

    return {
      kind: options.kind,
      spawn: {
        transport: 'local_pty',
        command: sshCommand,
        args: [
          '-tt',
          options.project.locator.host,
          buildRemoteExecCommand(
            options.project.locator.remotePath,
            options.command,
            options.args,
            {
              setupCommand: options.remoteSetupCommand,
            },
          ),
        ],
        envOverrides: {
          TERM: 'xterm-256color',
        },
        cwd: resolveLocalSpawnCwd(),
      },
      project: options.project,
      workingDirectory: options.project.locator.remotePath,
      displayLabel: options.displayLabel,
      iconKind: options.iconKind,
      resumeMeta: options.resumeMeta,
      capabilities: {
        supportsResume: true,
        supportsStatusProbe: false,
      },
    };
  }
}
