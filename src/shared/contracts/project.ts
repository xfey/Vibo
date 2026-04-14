import type { AppConfig, ProjectConfig, ProjectUiState } from '@shared/domain/config';
import type { ProjectRef } from '@shared/domain/project';

export type ProjectStoragePaths =
  | {
      kind: 'local_vibo';
      projectRoot: string;
      viboDir: string;
      projectConfigPath: string;
      projectUiStatePath: string;
    }
  | {
      kind: 'remote_cache';
      cacheDir: string;
      metadataPath: string;
      projectConfigPath: string;
      projectUiStatePath: string;
    };

export interface ProjectCapabilities {
  workspace: {
    deleteMode: 'trash' | 'permanent';
    canRevealInSystemShell: boolean;
    supportsImagePreview: boolean;
  };
  git: {
    enabled: boolean;
    reason?: string;
  };
  sessions: {
    supportsRecentResume: boolean;
  };
  skills: {
    supportsProjectLocalDiscovery: boolean;
  };
}

export interface RemoteProjectMetadata {
  version: 1;
  host: string;
  remotePath: string;
}

export interface OpenRemoteProjectRequest {
  host: string;
  remotePath: string;
}

export interface SshHostOption {
  alias: string;
  hostname?: string;
  user?: string;
  port?: number;
}

export interface ListSshHostsResponse {
  items: SshHostOption[];
}

export interface ProbeSshHostRequest {
  host: string;
}

export interface ProbeSshHostResponse {
  homePath: string;
}

export interface RemoteDirectoryOption {
  name: string;
  path: string;
}

export interface BrowseRemoteDirectoriesRequest {
  host: string;
  path: string;
}

export interface BrowseRemoteDirectoriesResponse {
  resolvedPath: string;
  parentPath: string | null;
  directories: RemoteDirectoryOption[];
}

export interface ProjectBootstrapData {
  project: ProjectRef;
  storage: ProjectStoragePaths;
  capabilities: ProjectCapabilities;
  appConfig: AppConfig;
  projectConfig: ProjectConfig;
  projectUiState: ProjectUiState;
}

export interface OpenProjectResult {
  canceled: boolean;
  project?: ProjectRef;
}
