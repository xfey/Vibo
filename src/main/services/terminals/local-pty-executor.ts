import path from 'node:path';

import { spawn, type IPty } from 'node-pty';

import type { LaunchSpec } from '@shared/domain/launch';

const DEFAULT_TERM_NAME = 'xterm-256color';

function resolveTerminalName(launchSpec: LaunchSpec): string {
  const configuredTermName = launchSpec.spawn.envOverrides.TERM?.trim();

  return configuredTermName && configuredTermName.length > 0
    ? configuredTermName
    : DEFAULT_TERM_NAME;
}

export class LocalPtyExecutor {
  execute(launchSpec: LaunchSpec): IPty {
    return spawn(launchSpec.spawn.command, launchSpec.spawn.args, {
      // `name` is the PTY terminal emulation identifier, not the shell command name.
      name: resolveTerminalName(launchSpec),
      cols: 120,
      rows: 32,
      cwd: launchSpec.spawn.cwd,
      env: {
        ...process.env,
        COLORTERM: 'truecolor',
        TERM_PROGRAM: 'Vibo',
        ...launchSpec.spawn.envOverrides,
      },
    });
  }
}
