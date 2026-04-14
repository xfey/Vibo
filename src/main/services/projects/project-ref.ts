import { createHash } from 'node:crypto';
import path from 'node:path';

import type { LocalProjectRef, SshProjectRef } from '@shared/domain/project';

function createProjectFingerprint(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 16);
}

export function toLocalProjectRef(projectRoot: string): LocalProjectRef {
  return {
    kind: 'local',
    displayName: path.basename(projectRoot),
    locator: {
      kind: 'local',
      path: projectRoot,
    },
    fingerprint: createProjectFingerprint(`local:${projectRoot}`),
  };
}

export function toSshProjectRef(host: string, remotePath: string): SshProjectRef {
  return {
    kind: 'ssh',
    displayName: path.posix.basename(remotePath) || remotePath || host,
    locator: {
      kind: 'ssh',
      host,
      remotePath,
      os: 'linux',
    },
    fingerprint: createProjectFingerprint(`ssh:${host}:${remotePath}`),
  };
}
