export interface GitCommitRecord {
  hash: string;
  shortHash: string;
  subject: string;
  authorName: string;
  committedAt: number;
  refNames: string[];
}

export const GIT_COMMIT_FILE_STATUSES = [
  'added',
  'modified',
  'deleted',
  'renamed',
  'copied',
  'type_changed',
  'unmerged',
  'unknown',
] as const;

export type GitCommitFileStatus = (typeof GIT_COMMIT_FILE_STATUSES)[number];

export interface GitCommitFileRecord {
  path: string;
  previousPath: string | null;
  status: GitCommitFileStatus;
}
