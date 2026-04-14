export type WorkspaceEntryKind = 'file' | 'directory';

export interface WorkspaceTreeEntry {
  name: string;
  relativePath: string;
  kind: WorkspaceEntryKind;
}

export interface ListWorkspaceDirectoryRequest {
  relativePath: string;
}

export interface ReadWorkspaceFileRequest {
  relativePath: string;
}

export interface WriteWorkspaceFileRequest {
  relativePath: string;
  content: string;
}

export interface CreateWorkspaceEntryRequest {
  parentRelativePath: string;
  name: string;
  kind: WorkspaceEntryKind;
}

export interface RenameWorkspaceEntryRequest {
  relativePath: string;
  nextName: string;
}

export interface DeleteWorkspaceEntryRequest {
  relativePath: string;
}

export interface RevealWorkspaceEntryRequest {
  relativePath: string;
}

export interface ResolveTerminalWorkspaceLinkRequest {
  rawText: string;
}

export interface ResolvedTerminalWorkspaceLink {
  relativePath: string;
  line: number | null;
  column: number | null;
}

export interface WorkspaceFilePreviewBase<TKind extends string, TByteSize extends number | null> {
  kind: TKind;
  relativePath: string;
  byteSize: TByteSize;
}

export interface WorkspaceTextFileContent extends WorkspaceFilePreviewBase<'text', number> {
  content: string;
}

export interface WorkspaceImageFileContent extends WorkspaceFilePreviewBase<'image', number> {
  mediaType: string;
  width: number;
  height: number;
  dataUrl: string;
}

export type WorkspaceUnsupportedIssueCode =
  | 'not_a_file'
  | 'file_too_large'
  | 'image_too_large'
  | 'binary_file'
  | 'image_decode_failed'
  | 'read_failed';

export interface WorkspaceUnsupportedFileContent
  extends WorkspaceFilePreviewBase<'unsupported', number | null> {
  issueCode: WorkspaceUnsupportedIssueCode;
  title: string;
  message: string;
}

export type WorkspaceFileContent =
  | WorkspaceTextFileContent
  | WorkspaceImageFileContent
  | WorkspaceUnsupportedFileContent;
