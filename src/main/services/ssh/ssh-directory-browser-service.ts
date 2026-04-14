import path from 'node:path';

import type {
  BrowseRemoteDirectoriesRequest,
  BrowseRemoteDirectoriesResponse,
  ProbeSshHostRequest,
  ProbeSshHostResponse,
  RemoteDirectoryOption,
} from '@shared/contracts/project';
import { tMain } from '@main/app/i18n';

import { SshCommandRunner } from './ssh-command-runner';

const directoryNameCollator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: 'base',
});

function parseFirstNonEmptyLine(output: string): string {
  const resolvedValue = output
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .find((line) => line.length > 0);

  if (!resolvedValue) {
    throw new Error(tMain('workspace.remoteResponseEmpty'));
  }

  return resolvedValue;
}

function parseDirectoryList(stdout: Buffer): RemoteDirectoryOption[] {
  const items = stdout
    .toString('utf8')
    .split('\0')
    .filter((value) => value.length > 0);
  const directories: RemoteDirectoryOption[] = [];

  for (let index = 0; index < items.length; index += 2) {
    const name = items[index];
    const directoryPath = items[index + 1];

    if (!name || !directoryPath) {
      continue;
    }

    directories.push({
      name,
      path: directoryPath,
    });
  }

  return directories.sort((left, right) => directoryNameCollator.compare(left.name, right.name));
}

export class SshDirectoryBrowserService {
  constructor(private readonly sshCommandRunner: SshCommandRunner) {}

  async probeHost(request: ProbeSshHostRequest): Promise<ProbeSshHostResponse> {
    const output = await this.sshCommandRunner.runInLoginShell(
      request.host,
      'cd ~ && pwd -P',
      {
        debugLabel: 'probe-ssh-host',
      },
    );

    return {
      homePath: parseFirstNonEmptyLine(output),
    };
  }

  async browseDirectories(
    request: BrowseRemoteDirectoriesRequest,
  ): Promise<BrowseRemoteDirectoriesResponse> {
    const rawPath = request.path.trim().length > 0 ? request.path : '~';
    const resolvedPath = await this.sshCommandRunner.resolveRemoteProjectDirectory(
      request.host,
      rawPath,
    );
    const directoryListResult = await this.sshCommandRunner.runScript(
      request.host,
      [
        'set -eu',
        'target=$1',
        'if [ ! -d "$target" ]; then',
        `  printf '%s\\n' ${JSON.stringify(tMain('workspace.remotePathNotDirectory'))} >&2`,
        '  exit 1',
        'fi',
        "find \"$target\" -mindepth 1 -maxdepth 1 -type d -printf '%f\\0%p\\0'",
      ].join('\n'),
      [resolvedPath],
      {
        debugLabel: 'browse-remote-directories',
      },
    );
    const parentPath = resolvedPath === '/' ? null : path.posix.dirname(resolvedPath);

    return {
      resolvedPath,
      parentPath,
      directories: parseDirectoryList(directoryListResult.stdout),
    };
  }
}
