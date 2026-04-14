import { realpath } from 'node:fs/promises';

import { BrowserWindow, dialog, type OpenDialogOptions, WebContents } from 'electron';

import type { OpenRemoteProjectRequest, ProjectBootstrapData } from '@shared/contracts/project';
import type { AppConfig, ProjectConfig, ProjectUiState } from '@shared/domain/config';
import type { ProjectRef } from '@shared/domain/project';

import { ConfigStore } from '@main/services/config/config-store';
import { tMain } from '@main/app/i18n';
import { SshCommandRunner } from '@main/services/ssh/ssh-command-runner';
import { toLocalProjectRef, toSshProjectRef } from './project-ref';

function resolveParentWindow(sender: WebContents): BrowserWindow | undefined {
  return BrowserWindow.fromWebContents(sender) ?? undefined;
}

export class ProjectService {
  constructor(
    private readonly configStore: ConfigStore,
    private readonly sshCommandRunner: SshCommandRunner,
  ) {}

  async openProjectFolder(
    sender: WebContents,
  ): Promise<{ canceled: true } | { canceled: false; bootstrap: ProjectBootstrapData }> {
    const parentWindow = resolveParentWindow(sender);
    const dialogOptions: OpenDialogOptions = {
      title: tMain('app.dialog.openProjectFolder.title'),
      properties: ['openDirectory', 'createDirectory'],
      buttonLabel: tMain('app.dialog.openProjectFolder.button'),
    };

    const result = parentWindow
      ? await dialog.showOpenDialog(parentWindow, dialogOptions)
      : await dialog.showOpenDialog(dialogOptions);

    if (result.canceled || result.filePaths.length === 0) {
      return {
        canceled: true,
      };
    }

    return {
      canceled: false,
      bootstrap: await this.bootstrapLocalProject(result.filePaths[0]),
    };
  }

  async openRemoteProject(
    request: OpenRemoteProjectRequest,
  ): Promise<{ canceled: true } | { canceled: false; bootstrap: ProjectBootstrapData }> {
    console.info('[project] open remote project requested', {
      host: request.host.trim(),
      remotePath: request.remotePath,
    });

    return {
      canceled: false,
      bootstrap: await this.bootstrapRemoteProject(request),
    };
  }

  async bootstrapLocalProject(projectRoot: string): Promise<ProjectBootstrapData> {
    const normalizedRoot = await realpath(projectRoot);
    const project = toLocalProjectRef(normalizedRoot);

    await this.configStore.ensureGlobalFiles();

    const [appConfig, storage] = await Promise.all([
      this.configStore.readAppConfig(),
      this.configStore.ensureProjectFiles(project),
    ]);

    const [projectConfig, projectUiState] = await Promise.all([
      this.configStore.readProjectConfig(project),
      this.configStore.readProjectUiState(project),
    ]);

    return {
      project,
      storage,
      capabilities: this.configStore.createProjectCapabilities(project),
      appConfig,
      projectConfig,
      projectUiState,
    };
  }

  async bootstrapProject(project: ProjectRef): Promise<ProjectBootstrapData> {
    if (project.kind === 'local') {
      return this.bootstrapLocalProject(project.locator.path);
    }

    return this.bootstrapRemoteProject({
      host: project.locator.host,
      remotePath: project.locator.remotePath,
    });
  }

  async bootstrapRemoteProject(request: OpenRemoteProjectRequest): Promise<ProjectBootstrapData> {
    const normalizedHost = request.host.trim();
    const resolvedRemotePath = await this.sshCommandRunner.resolveRemoteProjectDirectory(
      normalizedHost,
      request.remotePath,
    );
    const project = toSshProjectRef(normalizedHost, resolvedRemotePath);

    console.info('[project] remote project resolved', {
      host: normalizedHost,
      requestedPath: request.remotePath,
      resolvedPath: resolvedRemotePath,
    });

    await this.configStore.ensureGlobalFiles();

    const [appConfig, storage] = await Promise.all([
      this.configStore.readAppConfig(),
      this.configStore.ensureProjectFiles(project),
    ]);

    const [projectConfig, projectUiState] = await Promise.all([
      this.configStore.readProjectConfig(project),
      this.configStore.readProjectUiState(project),
    ]);

    return {
      project,
      storage,
      capabilities: this.configStore.createProjectCapabilities(project),
      appConfig,
      projectConfig,
      projectUiState,
    };
  }

  async readAppConfig(): Promise<AppConfig> {
    return this.configStore.readAppConfig();
  }

  async updateAppConfig(appConfig: AppConfig): Promise<AppConfig> {
    await this.configStore.writeAppConfig(appConfig);
    return this.configStore.readAppConfig();
  }

  async updateProjectConfig(project: ProjectRef, projectConfig: ProjectConfig): Promise<ProjectConfig> {
    await this.configStore.writeProjectConfig(project, projectConfig);
    return this.configStore.readProjectConfig(project);
  }

  async updateProjectUiState(
    project: ProjectRef,
    projectUiState: ProjectUiState,
  ): Promise<ProjectUiState> {
    await this.configStore.writeProjectUiState(project, projectUiState);
    return this.configStore.readProjectUiState(project);
  }
}
