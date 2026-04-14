import type { GitCommitFileRecord, GitCommitFileStatus, GitCommitRecord } from '@shared/domain/git';

export type ProjectGitState =
  | 'ready'
  | 'git_unavailable'
  | 'not_repository'
  | 'empty_repository';

export interface GetProjectGitDataRequest {
  offset?: number;
  limit?: number;
}

export interface GetProjectGitCommitFilesRequest {
  commitHash: string;
}

export interface GetProjectGitFileDiffRequest {
  commitHash: string;
  filePath: string;
  previousPath?: string | null;
  status: GitCommitFileStatus;
}

export interface ProjectGitData {
  state: ProjectGitState;
  repositoryName: string | null;
  branchName: string | null;
  isDetachedHead: boolean;
  scopePath: string;
  commits: GitCommitRecord[];
  hasMore: boolean;
  reason: string | null;
}

export interface ProjectGitCommitFilesData {
  commitHash: string;
  files: GitCommitFileRecord[];
}

export interface ProjectGitDiffPreview {
  commitHash: string;
  filePath: string;
  previousPath: string | null;
  status: GitCommitFileStatus;
  patch: string;
}
