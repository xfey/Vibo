import type { AppConfig, ProjectConfig, ProjectUiState } from '@shared/domain/config';

export interface UpdateAppConfigRequest {
  appConfig: AppConfig;
}

export interface UpdateProjectConfigRequest {
  projectConfig: ProjectConfig;
}

export interface UpdateProjectUiStateRequest {
  projectUiState: ProjectUiState;
}
