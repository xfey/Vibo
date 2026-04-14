import { BrowserWindow, ipcMain } from 'electron';

import type { AppServices } from '@main/app/bootstrap';
import { refreshApplicationMenu } from '@main/app/application-menu';
import { setMainLocale } from '@main/app/i18n';
import {
  broadcastAppConfigUpdated,
  broadcastGlobalSkillsUpdated,
  createSettingsWindow,
  createProjectWindow,
  getProjectBootstrap,
  getWindowContext,
  updateProjectWindowProjectConfig,
  updateProjectWindowProjectUiState,
  updateProjectWindowsAppConfig,
} from '@main/app/windows';
import type { ResumeClaudeCodeSessionRequest } from '@shared/contracts/claude';
import type { ResumeCodexSessionRequest } from '@shared/contracts/codex';
import type { ResumeOpenCodeSessionRequest } from '@shared/contracts/opencode';
import type {
  UpdateAppConfigRequest,
  UpdateProjectConfigRequest,
  UpdateProjectUiStateRequest,
} from '@shared/contracts/config';
import type {
  GetProjectGitCommitFilesRequest,
  GetProjectGitDataRequest,
  GetProjectGitFileDiffRequest,
  ProjectGitCommitFilesData,
  ProjectGitData,
  ProjectGitDiffPreview,
} from '@shared/contracts/git';
import type {
  BrowseRemoteDirectoriesRequest,
  BrowseRemoteDirectoriesResponse,
  ListSshHostsResponse,
  OpenRemoteProjectRequest,
  ProbeSshHostRequest,
  ProbeSshHostResponse,
} from '@shared/contracts/project';
import type {
  OpenRecentProjectRequest,
  RemoveRecentProjectRequest,
  RevealRecentProjectRequest,
  SetRecentProjectPinnedRequest,
} from '@shared/contracts/recents';
import type {
  GetTerminalSessionSnapshotRequest,
  ReportTerminalAgentActivityRequest,
  RenameTerminalSessionRequest,
  ResizeTerminalRequest,
  WriteTerminalInputRequest,
} from '@shared/contracts/terminal';
import type {
  CreateWorkspaceEntryRequest,
  DeleteWorkspaceEntryRequest,
  ListWorkspaceDirectoryRequest,
  ReadWorkspaceFileRequest,
  RenameWorkspaceEntryRequest,
  RevealWorkspaceEntryRequest,
  ResolveTerminalWorkspaceLinkRequest,
  WriteWorkspaceFileRequest,
} from '@shared/contracts/workspace';

import { ipcChannels } from './channels';

export function registerIpcHandlers(services: AppServices): void {
  ipcMain.removeHandler(ipcChannels.getWindowContext);
  ipcMain.removeHandler(ipcChannels.getAppConfig);
  ipcMain.removeHandler(ipcChannels.updateAppConfig);
  ipcMain.removeHandler(ipcChannels.openSettingsWindow);
  ipcMain.removeHandler(ipcChannels.notifyGlobalSkillsUpdated);
  ipcMain.removeHandler(ipcChannels.openProjectFolder);
  ipcMain.removeHandler(ipcChannels.openRemoteProject);
  ipcMain.removeHandler(ipcChannels.listSshHosts);
  ipcMain.removeHandler(ipcChannels.probeSshHost);
  ipcMain.removeHandler(ipcChannels.browseRemoteDirectories);
  ipcMain.removeHandler(ipcChannels.openRecentProject);
  ipcMain.removeHandler(ipcChannels.getProjectBootstrap);
  ipcMain.removeHandler(ipcChannels.updateProjectConfig);
  ipcMain.removeHandler(ipcChannels.updateProjectUiState);
  ipcMain.removeHandler(ipcChannels.listRecentProjects);
  ipcMain.removeHandler(ipcChannels.setRecentProjectPinned);
  ipcMain.removeHandler(ipcChannels.removeRecentProject);
  ipcMain.removeHandler(ipcChannels.revealRecentProject);
  ipcMain.removeHandler(ipcChannels.getClaudeCodeProjectHomeData);
  ipcMain.removeHandler(ipcChannels.getCodexProjectHomeData);
  ipcMain.removeHandler(ipcChannels.getOpenCodeProjectHomeData);
  ipcMain.removeHandler(ipcChannels.getProjectGitData);
  ipcMain.removeHandler(ipcChannels.getProjectGitCommitFiles);
  ipcMain.removeHandler(ipcChannels.getProjectGitFileDiff);
  ipcMain.removeHandler(ipcChannels.getGlobalSkillsData);
  ipcMain.removeHandler(ipcChannels.getProjectSkillsData);
  ipcMain.removeHandler(ipcChannels.listWorkspaceDirectory);
  ipcMain.removeHandler(ipcChannels.readWorkspaceFile);
  ipcMain.removeHandler(ipcChannels.writeWorkspaceFile);
  ipcMain.removeHandler(ipcChannels.createWorkspaceEntry);
  ipcMain.removeHandler(ipcChannels.renameWorkspaceEntry);
  ipcMain.removeHandler(ipcChannels.deleteWorkspaceEntry);
  ipcMain.removeHandler(ipcChannels.revealWorkspaceEntry);
  ipcMain.removeHandler(ipcChannels.resolveTerminalWorkspaceLink);
  ipcMain.removeHandler(ipcChannels.listTerminalSessions);
  ipcMain.removeHandler(ipcChannels.createClaudeCodeSession);
  ipcMain.removeHandler(ipcChannels.createCodexSession);
  ipcMain.removeHandler(ipcChannels.createOpenCodeSession);
  ipcMain.removeHandler(ipcChannels.createShellSession);
  ipcMain.removeHandler(ipcChannels.resumeClaudeCodeSession);
  ipcMain.removeHandler(ipcChannels.resumeCodexSession);
  ipcMain.removeHandler(ipcChannels.resumeOpenCodeSession);
  ipcMain.removeHandler(ipcChannels.getTerminalSessionSnapshot);
  ipcMain.removeHandler(ipcChannels.writeTerminalInput);
  ipcMain.removeHandler(ipcChannels.reportTerminalAgentActivity);
  ipcMain.removeHandler(ipcChannels.resizeTerminal);
  ipcMain.removeHandler(ipcChannels.closeTerminalSession);
  ipcMain.removeHandler(ipcChannels.renameTerminalSession);

  ipcMain.handle(ipcChannels.getWindowContext, (event) => {
    return getWindowContext(event.sender.id);
  });

  ipcMain.handle(ipcChannels.getAppConfig, () => {
    return services.projectService.readAppConfig();
  });

  ipcMain.handle(ipcChannels.updateAppConfig, async (_event, request: UpdateAppConfigRequest) => {
    const nextAppConfig = await services.projectService.updateAppConfig(request.appConfig);
    setMainLocale(nextAppConfig.locale);
    updateProjectWindowsAppConfig(nextAppConfig);
    broadcastAppConfigUpdated(nextAppConfig);
    await refreshApplicationMenu();
    return nextAppConfig;
  });

  ipcMain.handle(ipcChannels.openSettingsWindow, async () => {
    const appConfig = await services.projectService.readAppConfig();
    await createSettingsWindow(appConfig);
  });

  ipcMain.handle(ipcChannels.notifyGlobalSkillsUpdated, async () => {
    broadcastGlobalSkillsUpdated();
  });

  ipcMain.handle(ipcChannels.openProjectFolder, async (event) => {
    const sourceWindow = BrowserWindow.fromWebContents(event.sender);
    const sourceContext = getWindowContext(event.sender.id);
    const result = await services.projectService.openProjectFolder(event.sender);

    if (!result.canceled && result.bootstrap) {
      await services.recentProjectsService.recordProjectOpen(
        result.bootstrap.project,
        result.bootstrap.projectConfig.preferredAgent ?? result.bootstrap.appConfig.defaultAgent,
      );
      await createProjectWindow(result.bootstrap);

      if (sourceContext?.kind === 'launcher') {
        setTimeout(() => {
          sourceWindow?.close();
        }, 0);
      }

      await refreshApplicationMenu();

      return {
        canceled: false,
        project: result.bootstrap.project,
      };
    }

    return {
      canceled: true,
    };
  });

  ipcMain.handle(
    ipcChannels.openRemoteProject,
    async (event, request: OpenRemoteProjectRequest) => {
      const sourceWindow = BrowserWindow.fromWebContents(event.sender);
      const sourceContext = getWindowContext(event.sender.id);
      const result = await services.projectService.openRemoteProject(request);

      if (!result.canceled && result.bootstrap) {
        await services.recentProjectsService.recordProjectOpen(
          result.bootstrap.project,
          result.bootstrap.projectConfig.preferredAgent ?? result.bootstrap.appConfig.defaultAgent,
        );
        await createProjectWindow(result.bootstrap);

        if (sourceContext?.kind === 'launcher') {
          setTimeout(() => {
            sourceWindow?.close();
          }, 0);
        }

        await refreshApplicationMenu();

        return {
          canceled: false,
          project: result.bootstrap.project,
        };
      }

      return {
        canceled: true,
      };
    },
  );

  ipcMain.handle(ipcChannels.listSshHosts, async (): Promise<ListSshHostsResponse> => {
    return {
      items: await services.sshConfigService.listHostOptions(),
    };
  });

  ipcMain.handle(
    ipcChannels.probeSshHost,
    async (_event, request: ProbeSshHostRequest): Promise<ProbeSshHostResponse> => {
      return services.sshDirectoryBrowserService.probeHost(request);
    },
  );

  ipcMain.handle(
    ipcChannels.browseRemoteDirectories,
    async (
      _event,
      request: BrowseRemoteDirectoriesRequest,
    ): Promise<BrowseRemoteDirectoriesResponse> => {
      return services.sshDirectoryBrowserService.browseDirectories(request);
    },
  );

  ipcMain.handle(ipcChannels.openRecentProject, async (event, request: OpenRecentProjectRequest) => {
    const sourceWindow = BrowserWindow.fromWebContents(event.sender);
    const sourceContext = getWindowContext(event.sender.id);
    const recentProject = await services.recentProjectsService.getRecentProject(
      request.projectFingerprint,
    );

    if (!recentProject) {
      throw new Error('Recent project was not found.');
    }

    const bootstrap = await services.projectService.bootstrapProject(recentProject.project);

    await services.recentProjectsService.recordProjectOpen(
      bootstrap.project,
      bootstrap.projectConfig.preferredAgent ?? bootstrap.appConfig.defaultAgent,
    );
    await createProjectWindow(bootstrap);

    if (sourceContext?.kind === 'launcher') {
      setTimeout(() => {
        sourceWindow?.close();
      }, 0);
    }

    await refreshApplicationMenu();

    return {
      canceled: false,
      project: bootstrap.project,
    };
  });

  ipcMain.handle(ipcChannels.getProjectBootstrap, (event) => {
    return getProjectBootstrap(event.sender.id);
  });

  ipcMain.handle(
    ipcChannels.updateProjectConfig,
    async (event, request: UpdateProjectConfigRequest) => {
      const projectBootstrap = getProjectBootstrap(event.sender.id);

      if (!projectBootstrap) {
        throw new Error('Project bootstrap data is not available for this window.');
      }

      const nextProjectConfig = await services.projectService.updateProjectConfig(
        projectBootstrap.project,
        request.projectConfig,
      );

      updateProjectWindowProjectConfig(event.sender.id, nextProjectConfig);
      return nextProjectConfig;
    },
  );

  ipcMain.handle(
    ipcChannels.updateProjectUiState,
    async (event, request: UpdateProjectUiStateRequest) => {
      const projectBootstrap = getProjectBootstrap(event.sender.id);

      if (!projectBootstrap) {
        throw new Error('Project bootstrap data is not available for this window.');
      }

      const nextProjectUiState = await services.projectService.updateProjectUiState(
        projectBootstrap.project,
        request.projectUiState,
      );

      updateProjectWindowProjectUiState(event.sender.id, nextProjectUiState);
      return nextProjectUiState;
    },
  );

  ipcMain.handle(ipcChannels.listRecentProjects, async () => {
    return {
      items: await services.recentProjectsService.listRecentProjects(),
    };
  });

  ipcMain.handle(
    ipcChannels.setRecentProjectPinned,
    async (_event, request: SetRecentProjectPinnedRequest) => {
      const items = await services.recentProjectsService.setPinned(
        request.projectFingerprint,
        request.pinned,
      );
      await refreshApplicationMenu();
      return {
        items,
      };
    },
  );

  ipcMain.handle(
    ipcChannels.removeRecentProject,
    async (_event, request: RemoveRecentProjectRequest) => {
      const items = await services.recentProjectsService.remove(request.projectFingerprint);
      await refreshApplicationMenu();
      return {
        items,
      };
    },
  );

  ipcMain.handle(
    ipcChannels.revealRecentProject,
    async (_event, request: RevealRecentProjectRequest) => {
      await services.recentProjectsService.reveal(request.projectFingerprint);
    },
  );

  ipcMain.handle(ipcChannels.getClaudeCodeProjectHomeData, async (event) => {
    const projectBootstrap = getProjectBootstrap(event.sender.id);

    if (!projectBootstrap) {
      throw new Error('Project bootstrap data is not available for this window.');
    }

    const [availability, recentSessionCards] = await Promise.all([
      services.claudeCodeAgentAdapter.getAvailability(projectBootstrap.project),
      services.recentSessionsService.listClaudeCardsForProject(projectBootstrap.project),
    ]);

    return {
      availability,
      recentSessionCards,
    };
  });

  ipcMain.handle(ipcChannels.getCodexProjectHomeData, async (event) => {
    const projectBootstrap = getProjectBootstrap(event.sender.id);

    if (!projectBootstrap) {
      throw new Error('Project bootstrap data is not available for this window.');
    }

    const [availability, recentSessionCards] = await Promise.all([
      services.codexAgentAdapter.getAvailability(projectBootstrap.project),
      services.recentSessionsService.listCodexCardsForProject(projectBootstrap.project),
    ]);

    return {
      availability,
      recentSessionCards,
    };
  });

  ipcMain.handle(ipcChannels.getOpenCodeProjectHomeData, async (event) => {
    const projectBootstrap = getProjectBootstrap(event.sender.id);

    if (!projectBootstrap) {
      throw new Error('Project bootstrap data is not available for this window.');
    }

    const [availability, recentSessionCards] = await Promise.all([
      services.opencodeAgentAdapter.getAvailability(projectBootstrap.project),
      services.recentSessionsService.listOpenCodeCardsForProject(projectBootstrap.project),
    ]);

    return {
      availability,
      recentSessionCards,
    };
  });

  ipcMain.handle(
    ipcChannels.getProjectGitData,
    async (event, request: GetProjectGitDataRequest | undefined): Promise<ProjectGitData> => {
      const projectBootstrap = getProjectBootstrap(event.sender.id);

      if (!projectBootstrap) {
        throw new Error('Project bootstrap data is not available for this window.');
      }

      return services.projectGitService.getProjectGitData(projectBootstrap.project, request);
    },
  );

  ipcMain.handle(
    ipcChannels.getProjectGitCommitFiles,
    async (
      event,
      request: GetProjectGitCommitFilesRequest,
    ): Promise<ProjectGitCommitFilesData> => {
      const projectBootstrap = getProjectBootstrap(event.sender.id);

      if (!projectBootstrap) {
        throw new Error('Project bootstrap data is not available for this window.');
      }

      return services.projectGitService.getCommitFiles(projectBootstrap.project, request.commitHash);
    },
  );

  ipcMain.handle(
    ipcChannels.getProjectGitFileDiff,
    async (event, request: GetProjectGitFileDiffRequest): Promise<ProjectGitDiffPreview> => {
      const projectBootstrap = getProjectBootstrap(event.sender.id);

      if (!projectBootstrap) {
        throw new Error('Project bootstrap data is not available for this window.');
      }

      return services.projectGitService.getFileDiff(projectBootstrap.project, request);
    },
  );

  ipcMain.handle(ipcChannels.getGlobalSkillsData, async () => {
    return services.skillsLibraryService.scanGlobalSkills();
  });

  ipcMain.handle(ipcChannels.getProjectSkillsData, async (event) => {
    const projectBootstrap = getProjectBootstrap(event.sender.id);

    if (!projectBootstrap) {
      throw new Error('Project bootstrap data is not available for this window.');
    }

    if (projectBootstrap.project.kind !== 'local') {
      const globalSkillsData = await services.skillsLibraryService.scanGlobalSkills();

      return {
        agents: {
          codex: {
            globalSkills: globalSkillsData.items.filter((item) => item.agent === 'codex'),
            projectSkills: [],
          },
          claude_code: {
            globalSkills: globalSkillsData.items.filter((item) => item.agent === 'claude_code'),
            projectSkills: [],
          },
          opencode: {
            globalSkills: globalSkillsData.items.filter((item) => item.agent === 'opencode'),
            projectSkills: [],
          },
        },
        errors: globalSkillsData.errors,
      };
    }

    return services.projectSkillsService.getProjectSkillsData(projectBootstrap.project.locator.path);
  });

  ipcMain.handle(ipcChannels.listWorkspaceDirectory, async (event, request: ListWorkspaceDirectoryRequest) => {
    const projectBootstrap = getProjectBootstrap(event.sender.id);

    if (!projectBootstrap) {
      throw new Error('Project bootstrap data is not available for this window.');
    }

    return services.workspaceService.listDirectory(
      projectBootstrap.project,
      request.relativePath,
    );
  });

  ipcMain.handle(ipcChannels.readWorkspaceFile, async (event, request: ReadWorkspaceFileRequest) => {
    const projectBootstrap = getProjectBootstrap(event.sender.id);

    if (!projectBootstrap) {
      throw new Error('Project bootstrap data is not available for this window.');
    }

    return services.workspaceService.readFileContent(
      projectBootstrap.project,
      request.relativePath,
    );
  });

  ipcMain.handle(ipcChannels.writeWorkspaceFile, async (event, request: WriteWorkspaceFileRequest) => {
    const projectBootstrap = getProjectBootstrap(event.sender.id);

    if (!projectBootstrap) {
      throw new Error('Project bootstrap data is not available for this window.');
    }

    await services.workspaceService.writeFileContent(
      projectBootstrap.project,
      request.relativePath,
      request.content,
    );
  });

  ipcMain.handle(ipcChannels.createWorkspaceEntry, async (event, request: CreateWorkspaceEntryRequest) => {
    const projectBootstrap = getProjectBootstrap(event.sender.id);

    if (!projectBootstrap) {
      throw new Error('Project bootstrap data is not available for this window.');
    }

    return services.workspaceService.createEntry(
      projectBootstrap.project,
      request.parentRelativePath,
      request.name,
      request.kind,
    );
  });

  ipcMain.handle(ipcChannels.renameWorkspaceEntry, async (event, request: RenameWorkspaceEntryRequest) => {
    const projectBootstrap = getProjectBootstrap(event.sender.id);

    if (!projectBootstrap) {
      throw new Error('Project bootstrap data is not available for this window.');
    }

    return services.workspaceService.renameEntry(
      projectBootstrap.project,
      request.relativePath,
      request.nextName,
    );
  });

  ipcMain.handle(ipcChannels.deleteWorkspaceEntry, async (event, request: DeleteWorkspaceEntryRequest) => {
    const projectBootstrap = getProjectBootstrap(event.sender.id);

    if (!projectBootstrap) {
      throw new Error('Project bootstrap data is not available for this window.');
    }

    await services.workspaceService.deleteEntry(projectBootstrap.project, request.relativePath);
  });

  ipcMain.handle(ipcChannels.revealWorkspaceEntry, async (event, request: RevealWorkspaceEntryRequest) => {
    const projectBootstrap = getProjectBootstrap(event.sender.id);

    if (!projectBootstrap) {
      throw new Error('Project bootstrap data is not available for this window.');
    }

    await services.workspaceService.revealEntry(projectBootstrap.project, request.relativePath);
  });

  ipcMain.handle(
    ipcChannels.resolveTerminalWorkspaceLink,
    async (event, request: ResolveTerminalWorkspaceLinkRequest) => {
      const projectBootstrap = getProjectBootstrap(event.sender.id);

      if (!projectBootstrap) {
        throw new Error('Project bootstrap data is not available for this window.');
      }

      return services.workspaceService.resolveTerminalLink(projectBootstrap.project, request.rawText);
    },
  );

  ipcMain.handle(ipcChannels.listTerminalSessions, (event) => {
    return services.terminalManager.listSessionsForWindow(event.sender.id);
  });

  ipcMain.handle(ipcChannels.createClaudeCodeSession, async (event) => {
    const projectBootstrap = getProjectBootstrap(event.sender.id);

    if (!projectBootstrap) {
      throw new Error('Project bootstrap data is not available for this window.');
    }

    const launchSpec = await services.claudeCodeAgentAdapter.buildNewSessionLaunchSpec(
      projectBootstrap.project,
      projectBootstrap.appConfig,
      projectBootstrap.projectConfig,
    );

    await services.recentProjectsService.updateLastUsedAgent(projectBootstrap.project, 'claude_code');
    return services.terminalManager.createSession(event.sender, launchSpec);
  });

  ipcMain.handle(ipcChannels.createCodexSession, async (event) => {
    const projectBootstrap = getProjectBootstrap(event.sender.id);

    if (!projectBootstrap) {
      throw new Error('Project bootstrap data is not available for this window.');
    }

    const launchSpec = await services.codexAgentAdapter.buildNewSessionLaunchSpec(
      projectBootstrap.project,
      projectBootstrap.appConfig,
      projectBootstrap.projectConfig,
    );

    await services.recentProjectsService.updateLastUsedAgent(projectBootstrap.project, 'codex');
    return services.terminalManager.createSession(event.sender, launchSpec);
  });

  ipcMain.handle(ipcChannels.createOpenCodeSession, async (event) => {
    const projectBootstrap = getProjectBootstrap(event.sender.id);

    if (!projectBootstrap) {
      throw new Error('Project bootstrap data is not available for this window.');
    }

    const launchSpec = await services.opencodeAgentAdapter.buildNewSessionLaunchSpec(
      projectBootstrap.project,
      projectBootstrap.appConfig,
      projectBootstrap.projectConfig,
    );

    await services.recentProjectsService.updateLastUsedAgent(projectBootstrap.project, 'opencode');
    return services.terminalManager.createSession(event.sender, launchSpec);
  });

  ipcMain.handle(ipcChannels.createShellSession, async (event) => {
    const projectBootstrap = getProjectBootstrap(event.sender.id);

    if (!projectBootstrap) {
      throw new Error('Project bootstrap data is not available for this window.');
    }

    const launchSpec = await services.shellLaunchBuilder.buildForProject(projectBootstrap.project);
    await services.recentProjectsService.updateLastUsedAgent(projectBootstrap.project, 'shell');
    return services.terminalManager.createSession(event.sender, launchSpec);
  });

  ipcMain.handle(
    ipcChannels.resumeClaudeCodeSession,
    async (event, request: ResumeClaudeCodeSessionRequest) => {
      const projectBootstrap = getProjectBootstrap(event.sender.id);

      if (!projectBootstrap) {
        throw new Error('Project bootstrap data is not available for this window.');
      }

      const launchSpec = await services.claudeCodeAgentAdapter.buildResumeLaunchSpec(
        projectBootstrap.project,
        request.sessionId,
        projectBootstrap.appConfig,
        projectBootstrap.projectConfig,
      );

      await services.recentProjectsService.updateLastUsedAgent(projectBootstrap.project, 'claude_code');
      return services.terminalManager.createSession(event.sender, launchSpec);
    },
  );

  ipcMain.handle(
    ipcChannels.resumeCodexSession,
    async (event, request: ResumeCodexSessionRequest) => {
      const projectBootstrap = getProjectBootstrap(event.sender.id);

      if (!projectBootstrap) {
        throw new Error('Project bootstrap data is not available for this window.');
      }

      const launchSpec = await services.codexAgentAdapter.buildResumeLaunchSpec(
        projectBootstrap.project,
        request.sessionId,
        projectBootstrap.appConfig,
        projectBootstrap.projectConfig,
      );

      await services.recentProjectsService.updateLastUsedAgent(projectBootstrap.project, 'codex');
      return services.terminalManager.createSession(event.sender, launchSpec);
    },
  );

  ipcMain.handle(
    ipcChannels.resumeOpenCodeSession,
    async (event, request: ResumeOpenCodeSessionRequest) => {
      const projectBootstrap = getProjectBootstrap(event.sender.id);

      if (!projectBootstrap) {
        throw new Error('Project bootstrap data is not available for this window.');
      }

      const launchSpec = await services.opencodeAgentAdapter.buildResumeLaunchSpec(
        projectBootstrap.project,
        request.sessionId,
        projectBootstrap.appConfig,
        projectBootstrap.projectConfig,
      );

      await services.recentProjectsService.updateLastUsedAgent(projectBootstrap.project, 'opencode');
      return services.terminalManager.createSession(event.sender, launchSpec);
    },
  );

  ipcMain.handle(
    ipcChannels.getTerminalSessionSnapshot,
    (_event, request: GetTerminalSessionSnapshotRequest) => {
      return services.terminalManager.readSessionSnapshot(request.sessionId);
    },
  );

  ipcMain.handle(ipcChannels.writeTerminalInput, (_event, request: WriteTerminalInputRequest) => {
    services.terminalManager.writeToSession(request.sessionId, request.data);
  });

  ipcMain.handle(
    ipcChannels.reportTerminalAgentActivity,
    (_event, request: ReportTerminalAgentActivityRequest) => {
      services.terminalManager.reportAgentActivity(request.sessionId, request.activity);
    },
  );

  ipcMain.handle(ipcChannels.resizeTerminal, (_event, request: ResizeTerminalRequest) => {
    services.terminalManager.resizeSession(request.sessionId, request.cols, request.rows);
  });

  ipcMain.handle(ipcChannels.closeTerminalSession, (_event, sessionId: string) => {
    services.terminalManager.closeSession(sessionId);
  });

  ipcMain.handle(
    ipcChannels.renameTerminalSession,
    (_event, request: RenameTerminalSessionRequest) => {
      return services.terminalManager.renameSession(request.sessionId, request.label);
    },
  );
}
