import { isLocalProject, type ProjectRef } from '@shared/domain/project';

import type { WorkspaceService } from './workspace-service';

export class WorkspaceRouterService implements WorkspaceService {
  constructor(
    private readonly localWorkspaceService: WorkspaceService,
    private readonly sshWorkspaceService: WorkspaceService,
  ) {}

  listDirectory(project: ProjectRef, relativePath: string) {
    return this.getWorkspaceService(project).listDirectory(project, relativePath);
  }

  createEntry(project: ProjectRef, parentRelativePath: string, name: string, kind: 'file' | 'directory') {
    return this.getWorkspaceService(project).createEntry(project, parentRelativePath, name, kind);
  }

  readFileContent(project: ProjectRef, relativePath: string) {
    return this.getWorkspaceService(project).readFileContent(project, relativePath);
  }

  writeFileContent(project: ProjectRef, relativePath: string, content: string) {
    return this.getWorkspaceService(project).writeFileContent(project, relativePath, content);
  }

  renameEntry(project: ProjectRef, relativePath: string, nextName: string) {
    return this.getWorkspaceService(project).renameEntry(project, relativePath, nextName);
  }

  deleteEntry(project: ProjectRef, relativePath: string) {
    return this.getWorkspaceService(project).deleteEntry(project, relativePath);
  }

  resolveTerminalLink(project: ProjectRef, rawText: string) {
    return this.getWorkspaceService(project).resolveTerminalLink(project, rawText);
  }

  revealEntry(project: ProjectRef, relativePath: string) {
    return this.getWorkspaceService(project).revealEntry(project, relativePath);
  }

  private getWorkspaceService(project: ProjectRef): WorkspaceService {
    return isLocalProject(project) ? this.localWorkspaceService : this.sshWorkspaceService;
  }
}
