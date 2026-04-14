import type {
  ResolvedTerminalWorkspaceLink,
  WorkspaceEntryKind,
  WorkspaceFileContent,
  WorkspaceTreeEntry,
} from '@shared/contracts/workspace';
import type { ProjectRef } from '@shared/domain/project';

export interface WorkspaceService {
  listDirectory(project: ProjectRef, relativePath: string): Promise<WorkspaceTreeEntry[]>;
  createEntry(
    project: ProjectRef,
    parentRelativePath: string,
    name: string,
    kind: WorkspaceEntryKind,
  ): Promise<WorkspaceTreeEntry>;
  readFileContent(project: ProjectRef, relativePath: string): Promise<WorkspaceFileContent>;
  writeFileContent(project: ProjectRef, relativePath: string, content: string): Promise<void>;
  renameEntry(
    project: ProjectRef,
    relativePath: string,
    nextName: string,
  ): Promise<WorkspaceTreeEntry>;
  deleteEntry(project: ProjectRef, relativePath: string): Promise<void>;
  resolveTerminalLink(
    project: ProjectRef,
    rawText: string,
  ): Promise<ResolvedTerminalWorkspaceLink | null>;
  revealEntry(project: ProjectRef, relativePath: string): Promise<void>;
}
