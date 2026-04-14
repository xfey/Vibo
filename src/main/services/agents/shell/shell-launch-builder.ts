import { getLocalProjectRoot, isSshProject, type ProjectRef } from '@shared/domain/project';
import type { LaunchSpec } from '@shared/domain/launch';

import { SshLaunchBuilder } from '@main/services/ssh/ssh-launch-builder';

function resolveDefaultShell(): string {
  return process.env.SHELL || '/bin/zsh';
}

export class ShellLaunchBuilder {
  constructor(private readonly sshLaunchBuilder: SshLaunchBuilder) {}

  async buildForProject(project: ProjectRef): Promise<LaunchSpec> {
    if (isSshProject(project)) {
      return this.sshLaunchBuilder.buildShellLaunchSpec(project);
    }

    const shellPath = resolveDefaultShell();
    const localProjectRoot = getLocalProjectRoot(project);

    return {
      kind: 'shell',
      spawn: {
        transport: 'local_pty',
        command: shellPath,
        args: ['-l'],
        envOverrides: {
          TERM: 'xterm-256color',
        },
        cwd: localProjectRoot,
      },
      project,
      workingDirectory: localProjectRoot,
      displayLabel: 'Shell',
      iconKind: 'shell',
      capabilities: {
        supportsResume: false,
        supportsStatusProbe: false,
      },
    };
  }
}
