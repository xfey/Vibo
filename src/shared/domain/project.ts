export interface LocalProjectRef {
  kind: 'local';
  displayName: string;
  locator: {
    kind: 'local';
    path: string;
  };
  fingerprint: string;
}

export interface SshProjectRef {
  kind: 'ssh';
  displayName: string;
  locator: {
    kind: 'ssh';
    host: string;
    remotePath: string;
    os: 'linux';
  };
  fingerprint: string;
}

export type ProjectRef = LocalProjectRef | SshProjectRef;

export function isLocalProject(project: ProjectRef): project is LocalProjectRef {
  return project.kind === 'local';
}

export function isSshProject(project: ProjectRef): project is SshProjectRef {
  return project.kind === 'ssh';
}

export function getLocalProjectRoot(project: ProjectRef): string {
  if (!isLocalProject(project)) {
    throw new Error('当前项目不是本地项目。');
  }

  return project.locator.path;
}

export function getProjectLocationLabel(project: ProjectRef): string {
  return isLocalProject(project)
    ? project.locator.path
    : `${project.locator.host}:${project.locator.remotePath}`;
}

export function getProjectLocatorIdentity(project: ProjectRef): string {
  return isLocalProject(project)
    ? `local:${project.locator.path}`
    : `ssh:${project.locator.host}:${project.locator.remotePath}`;
}

export function getProjectWindowTitle(project: ProjectRef): string {
  return `${project.displayName} [${getProjectLocationLabel(project)}]`;
}
