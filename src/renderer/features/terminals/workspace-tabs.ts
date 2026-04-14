import type { WorkspaceFileContent } from '@shared/contracts/workspace';
import type { TerminalSessionActivity, TerminalSessionRecord } from '@shared/domain/terminal';

export const HUB_TAB_ID = 'hub';

export interface FileTabState {
  id: string;
  relativePath: string;
  preview: boolean;
  fileContent: WorkspaceFileContent | null;
  draftContent: string;
  isLoading: boolean;
  isSaving: boolean;
  saveError: string | null;
}

export interface WorkspaceTabDescriptor {
  id: string;
  kind: 'hub' | 'draft' | 'file' | 'terminal';
  label: string;
  title?: string;
  caption?: string;
  status?: TerminalSessionRecord['status'];
  agentActivity?: TerminalSessionActivity;
  needsAttention?: boolean;
  filePath?: string;
  sessionKind?: TerminalSessionRecord['kind'];
  isActive: boolean;
  isClosable: boolean;
  isPreview?: boolean;
  isDirty?: boolean;
}

export function getFileTabLabel(relativePath: string): string {
  return relativePath.split('/').filter(Boolean).at(-1) ?? relativePath;
}

export function isFileTabDirty(fileTab: FileTabState): boolean {
  return fileTab.fileContent?.kind === 'text' && fileTab.draftContent !== fileTab.fileContent.content;
}
