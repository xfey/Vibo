import { ipcRenderer } from 'electron';

import { ipcChannels } from '@main/ipc/channels';
import type {
  ClaudeCodeProjectHomeData,
  ResumeClaudeCodeSessionRequest,
} from '@shared/contracts/claude';
import type { CodexProjectHomeData, ResumeCodexSessionRequest } from '@shared/contracts/codex';
import type {
  OpenCodeProjectHomeData,
  ResumeOpenCodeSessionRequest,
} from '@shared/contracts/opencode';
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
  OpenProjectResult,
  OpenRemoteProjectRequest,
  ProbeSshHostRequest,
  ProbeSshHostResponse,
  ProjectBootstrapData,
} from '@shared/contracts/project';
import type {
  OpenRecentProjectRequest,
  RecentProjectsResponse,
  RemoveRecentProjectRequest,
  RevealRecentProjectRequest,
  SetRecentProjectPinnedRequest,
} from '@shared/contracts/recents';
import type { MenuCommand } from '@shared/contracts/menu';
import type { GlobalSkillsResponse, ProjectSkillsData } from '@shared/contracts/skills';
import type {
  GetTerminalSessionSnapshotRequest,
  ReportTerminalAgentActivityRequest,
  RenameTerminalSessionRequest,
  ResizeTerminalRequest,
  TerminalEvent,
  TerminalSessionSnapshot,
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
  ResolvedTerminalWorkspaceLink,
  WriteWorkspaceFileRequest,
  WorkspaceFileContent,
  WorkspaceTreeEntry,
} from '@shared/contracts/workspace';
import type { WindowContext } from '@shared/contracts/window';
import type { AppConfig, ProjectConfig, ProjectUiState } from '@shared/domain/config';
import type { TerminalSessionRecord } from '@shared/domain/terminal';

export type TerminalEventListener = (event: TerminalEvent) => void;
export type MenuCommandListener = (command: MenuCommand) => void;
export type AppConfigUpdatedListener = (appConfig: AppConfig) => void;
export type GlobalSkillsUpdatedListener = () => void;

export interface ViboApi {
  getWindowContext: () => Promise<WindowContext | null>;
  getAppConfig: () => Promise<AppConfig>;
  updateAppConfig: (request: UpdateAppConfigRequest) => Promise<AppConfig>;
  openSettingsWindow: () => Promise<void>;
  notifyGlobalSkillsUpdated: () => Promise<void>;
  openProjectFolder: () => Promise<OpenProjectResult>;
  openRemoteProject: (request: OpenRemoteProjectRequest) => Promise<OpenProjectResult>;
  listSshHosts: () => Promise<ListSshHostsResponse>;
  probeSshHost: (request: ProbeSshHostRequest) => Promise<ProbeSshHostResponse>;
  browseRemoteDirectories: (
    request: BrowseRemoteDirectoriesRequest,
  ) => Promise<BrowseRemoteDirectoriesResponse>;
  openRecentProject: (request: OpenRecentProjectRequest) => Promise<OpenProjectResult>;
  getProjectBootstrap: () => Promise<ProjectBootstrapData | null>;
  updateProjectConfig: (request: UpdateProjectConfigRequest) => Promise<ProjectConfig>;
  updateProjectUiState: (request: UpdateProjectUiStateRequest) => Promise<ProjectUiState>;
  listRecentProjects: () => Promise<RecentProjectsResponse>;
  setRecentProjectPinned: (
    request: SetRecentProjectPinnedRequest,
  ) => Promise<RecentProjectsResponse>;
  removeRecentProject: (request: RemoveRecentProjectRequest) => Promise<RecentProjectsResponse>;
  revealRecentProject: (request: RevealRecentProjectRequest) => Promise<void>;
  getClaudeCodeProjectHomeData: () => Promise<ClaudeCodeProjectHomeData>;
  getCodexProjectHomeData: () => Promise<CodexProjectHomeData>;
  getOpenCodeProjectHomeData: () => Promise<OpenCodeProjectHomeData>;
  getProjectGitData: (request?: GetProjectGitDataRequest) => Promise<ProjectGitData>;
  getProjectGitCommitFiles: (
    request: GetProjectGitCommitFilesRequest,
  ) => Promise<ProjectGitCommitFilesData>;
  getProjectGitFileDiff: (request: GetProjectGitFileDiffRequest) => Promise<ProjectGitDiffPreview>;
  getGlobalSkillsData: () => Promise<GlobalSkillsResponse>;
  getProjectSkillsData: () => Promise<ProjectSkillsData>;
  listWorkspaceDirectory: (request: ListWorkspaceDirectoryRequest) => Promise<WorkspaceTreeEntry[]>;
  readWorkspaceFile: (request: ReadWorkspaceFileRequest) => Promise<WorkspaceFileContent>;
  writeWorkspaceFile: (request: WriteWorkspaceFileRequest) => Promise<void>;
  createWorkspaceEntry: (request: CreateWorkspaceEntryRequest) => Promise<WorkspaceTreeEntry>;
  renameWorkspaceEntry: (request: RenameWorkspaceEntryRequest) => Promise<WorkspaceTreeEntry>;
  deleteWorkspaceEntry: (request: DeleteWorkspaceEntryRequest) => Promise<void>;
  revealWorkspaceEntry: (request: RevealWorkspaceEntryRequest) => Promise<void>;
  resolveTerminalWorkspaceLink: (
    request: ResolveTerminalWorkspaceLinkRequest,
  ) => Promise<ResolvedTerminalWorkspaceLink | null>;
  listTerminalSessions: () => Promise<TerminalSessionRecord[]>;
  createClaudeCodeSession: () => Promise<TerminalSessionRecord>;
  createCodexSession: () => Promise<TerminalSessionRecord>;
  createOpenCodeSession: () => Promise<TerminalSessionRecord>;
  createShellSession: () => Promise<TerminalSessionRecord>;
  resumeClaudeCodeSession: (
    request: ResumeClaudeCodeSessionRequest,
  ) => Promise<TerminalSessionRecord>;
  resumeCodexSession: (request: ResumeCodexSessionRequest) => Promise<TerminalSessionRecord>;
  resumeOpenCodeSession: (request: ResumeOpenCodeSessionRequest) => Promise<TerminalSessionRecord>;
  getTerminalSessionSnapshot: (
    request: GetTerminalSessionSnapshotRequest,
  ) => Promise<TerminalSessionSnapshot | null>;
  writeTerminalInput: (request: WriteTerminalInputRequest) => Promise<void>;
  reportTerminalAgentActivity: (request: ReportTerminalAgentActivityRequest) => Promise<void>;
  resizeTerminal: (request: ResizeTerminalRequest) => Promise<void>;
  closeTerminalSession: (sessionId: string) => Promise<void>;
  renameTerminalSession: (
    request: RenameTerminalSessionRequest,
  ) => Promise<TerminalSessionRecord | null>;
  onTerminalEvent: (listener: TerminalEventListener) => () => void;
  onMenuCommand: (listener: MenuCommandListener) => () => void;
  onAppConfigUpdated: (listener: AppConfigUpdatedListener) => () => void;
  onGlobalSkillsUpdated: (listener: GlobalSkillsUpdatedListener) => () => void;
}

export function createViboApi(): ViboApi {
  return {
    getWindowContext: () => ipcRenderer.invoke(ipcChannels.getWindowContext),
    getAppConfig: () => ipcRenderer.invoke(ipcChannels.getAppConfig),
    updateAppConfig: (request) => ipcRenderer.invoke(ipcChannels.updateAppConfig, request),
    openSettingsWindow: () => ipcRenderer.invoke(ipcChannels.openSettingsWindow),
    notifyGlobalSkillsUpdated: () => ipcRenderer.invoke(ipcChannels.notifyGlobalSkillsUpdated),
    openProjectFolder: () => ipcRenderer.invoke(ipcChannels.openProjectFolder),
    openRemoteProject: (request) => ipcRenderer.invoke(ipcChannels.openRemoteProject, request),
    listSshHosts: () => ipcRenderer.invoke(ipcChannels.listSshHosts),
    probeSshHost: (request) => ipcRenderer.invoke(ipcChannels.probeSshHost, request),
    browseRemoteDirectories: (request) =>
      ipcRenderer.invoke(ipcChannels.browseRemoteDirectories, request),
    openRecentProject: (request) => ipcRenderer.invoke(ipcChannels.openRecentProject, request),
    getProjectBootstrap: () => ipcRenderer.invoke(ipcChannels.getProjectBootstrap),
    updateProjectConfig: (request) => ipcRenderer.invoke(ipcChannels.updateProjectConfig, request),
    updateProjectUiState: (request) =>
      ipcRenderer.invoke(ipcChannels.updateProjectUiState, request),
    listRecentProjects: () => ipcRenderer.invoke(ipcChannels.listRecentProjects),
    setRecentProjectPinned: (request) =>
      ipcRenderer.invoke(ipcChannels.setRecentProjectPinned, request),
    removeRecentProject: (request) =>
      ipcRenderer.invoke(ipcChannels.removeRecentProject, request),
    revealRecentProject: (request) =>
      ipcRenderer.invoke(ipcChannels.revealRecentProject, request),
    getClaudeCodeProjectHomeData: () =>
      ipcRenderer.invoke(ipcChannels.getClaudeCodeProjectHomeData),
    getCodexProjectHomeData: () => ipcRenderer.invoke(ipcChannels.getCodexProjectHomeData),
    getOpenCodeProjectHomeData: () =>
      ipcRenderer.invoke(ipcChannels.getOpenCodeProjectHomeData),
    getProjectGitData: (request) => ipcRenderer.invoke(ipcChannels.getProjectGitData, request),
    getProjectGitCommitFiles: (request) =>
      ipcRenderer.invoke(ipcChannels.getProjectGitCommitFiles, request),
    getProjectGitFileDiff: (request) =>
      ipcRenderer.invoke(ipcChannels.getProjectGitFileDiff, request),
    getGlobalSkillsData: () => ipcRenderer.invoke(ipcChannels.getGlobalSkillsData),
    getProjectSkillsData: () => ipcRenderer.invoke(ipcChannels.getProjectSkillsData),
    listWorkspaceDirectory: (request) => ipcRenderer.invoke(ipcChannels.listWorkspaceDirectory, request),
    readWorkspaceFile: (request) => ipcRenderer.invoke(ipcChannels.readWorkspaceFile, request),
    writeWorkspaceFile: (request) => ipcRenderer.invoke(ipcChannels.writeWorkspaceFile, request),
    createWorkspaceEntry: (request) => ipcRenderer.invoke(ipcChannels.createWorkspaceEntry, request),
    renameWorkspaceEntry: (request) => ipcRenderer.invoke(ipcChannels.renameWorkspaceEntry, request),
    deleteWorkspaceEntry: (request) => ipcRenderer.invoke(ipcChannels.deleteWorkspaceEntry, request),
    revealWorkspaceEntry: (request) => ipcRenderer.invoke(ipcChannels.revealWorkspaceEntry, request),
    resolveTerminalWorkspaceLink: (request) =>
      ipcRenderer.invoke(ipcChannels.resolveTerminalWorkspaceLink, request),
    listTerminalSessions: () => ipcRenderer.invoke(ipcChannels.listTerminalSessions),
    createClaudeCodeSession: () => ipcRenderer.invoke(ipcChannels.createClaudeCodeSession),
    createCodexSession: () => ipcRenderer.invoke(ipcChannels.createCodexSession),
    createOpenCodeSession: () => ipcRenderer.invoke(ipcChannels.createOpenCodeSession),
    createShellSession: () => ipcRenderer.invoke(ipcChannels.createShellSession),
    resumeClaudeCodeSession: (request) =>
      ipcRenderer.invoke(ipcChannels.resumeClaudeCodeSession, request),
    resumeCodexSession: (request) => ipcRenderer.invoke(ipcChannels.resumeCodexSession, request),
    resumeOpenCodeSession: (request) =>
      ipcRenderer.invoke(ipcChannels.resumeOpenCodeSession, request),
    getTerminalSessionSnapshot: (request) =>
      ipcRenderer.invoke(ipcChannels.getTerminalSessionSnapshot, request),
    writeTerminalInput: (request) => ipcRenderer.invoke(ipcChannels.writeTerminalInput, request),
    reportTerminalAgentActivity: (request) =>
      ipcRenderer.invoke(ipcChannels.reportTerminalAgentActivity, request),
    resizeTerminal: (request) => ipcRenderer.invoke(ipcChannels.resizeTerminal, request),
    closeTerminalSession: (sessionId) =>
      ipcRenderer.invoke(ipcChannels.closeTerminalSession, sessionId),
    renameTerminalSession: (request) =>
      ipcRenderer.invoke(ipcChannels.renameTerminalSession, request),
    onTerminalEvent: (listener) => {
      const wrappedListener = (_event: Electron.IpcRendererEvent, terminalEvent: TerminalEvent) => {
        listener(terminalEvent);
      };

      ipcRenderer.on(ipcChannels.terminalEvent, wrappedListener);

      return () => {
        ipcRenderer.off(ipcChannels.terminalEvent, wrappedListener);
      };
    },
    onMenuCommand: (listener) => {
      const wrappedListener = (_event: Electron.IpcRendererEvent, command: MenuCommand) => {
        listener(command);
      };

      ipcRenderer.on(ipcChannels.menuCommand, wrappedListener);

      return () => {
        ipcRenderer.off(ipcChannels.menuCommand, wrappedListener);
      };
    },
    onAppConfigUpdated: (listener) => {
      const wrappedListener = (_event: Electron.IpcRendererEvent, appConfig: AppConfig) => {
        listener(appConfig);
      };

      ipcRenderer.on(ipcChannels.appConfigUpdated, wrappedListener);

      return () => {
        ipcRenderer.off(ipcChannels.appConfigUpdated, wrappedListener);
      };
    },
    onGlobalSkillsUpdated: (listener) => {
      const wrappedListener = () => {
        listener();
      };

      ipcRenderer.on(ipcChannels.globalSkillsUpdated, wrappedListener);

      return () => {
        ipcRenderer.off(ipcChannels.globalSkillsUpdated, wrappedListener);
      };
    },
  };
}
