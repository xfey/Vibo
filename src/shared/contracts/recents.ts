import type { RecentProjectRecord } from '@shared/domain/recent-project';

export interface OpenRecentProjectRequest {
  projectFingerprint: string;
}

export interface SetRecentProjectPinnedRequest {
  projectFingerprint: string;
  pinned: boolean;
}

export interface RemoveRecentProjectRequest {
  projectFingerprint: string;
}

export interface RevealRecentProjectRequest {
  projectFingerprint: string;
}

export interface RecentProjectsResponse {
  items: RecentProjectRecord[];
}
