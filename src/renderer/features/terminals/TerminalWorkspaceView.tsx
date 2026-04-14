import type { ReactElement } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';

import type { ClaudeCodeProjectHomeData } from '@shared/contracts/claude';
import type { CodexProjectHomeData } from '@shared/contracts/codex';
import type { MenuCommand } from '@shared/contracts/menu';
import type { OpenCodeProjectHomeData } from '@shared/contracts/opencode';
import type { ProjectBootstrapData } from '@shared/contracts/project';
import type { ProjectSkillsData } from '@shared/contracts/skills';
import type { TerminalEvent } from '@shared/contracts/terminal';
import type { AgentId } from '@shared/domain/agent';
import type { AppIconTheme, ProjectConfig, ProjectUiState } from '@shared/domain/config';
import {
  PROJECT_DRAFT_FILE_NAME,
  PROJECT_DRAFT_RELATIVE_PATH,
  PROJECT_DRAFT_TAB_ID,
  PROJECT_VIBO_DIRECTORY_RELATIVE_PATH,
  isProjectDraftRelativePath,
} from '@shared/domain/draft';
import { getProjectWindowTitle } from '@shared/domain/project';
import type { TerminalSessionActivity, TerminalSessionRecord } from '@shared/domain/terminal';

import { tRenderer } from '@renderer/app/i18n';
import { HubView } from '@renderer/features/hub/HubView';

import { TerminalPane } from './TerminalPane';
import { TerminalTabs } from './TerminalTabs';
import { TerminalRuntimeStore } from './terminal-runtime';
import { useWorkspaceTabShortcuts } from './useWorkspaceTabShortcuts';
import {
  HUB_TAB_ID,
  type FileTabState,
  getFileTabLabel,
  isFileTabDirty,
  type WorkspaceTabDescriptor,
} from './workspace-tabs';

interface TerminalWorkspaceViewProps {
  appearanceSignature: string;
  iconTheme: AppIconTheme;
  projectBootstrap: ProjectBootstrapData;
  skillsRevision: number;
  menuCommandEvent: {
    id: number;
    command: MenuCommand;
  } | null;
  areWorkspaceShortcutsEnabled: boolean;
  onUpdateProjectConfig: (nextProjectConfig: ProjectConfig) => Promise<void>;
  onUpdateProjectUiState: (nextProjectUiState: ProjectUiState) => Promise<void>;
}

interface OpenFileOptions {
  pinned?: boolean;
}

function upsertSession(
  sessions: TerminalSessionRecord[],
  nextSession: TerminalSessionRecord,
): TerminalSessionRecord[] {
  const existingIndex = sessions.findIndex((session) => session.id === nextSession.id);

  if (existingIndex === -1) {
    return [...sessions, nextSession];
  }

  return sessions.map((session) => (session.id === nextSession.id ? nextSession : session));
}

function getPrimaryAgent(projectBootstrap: ProjectBootstrapData): AgentId {
  return projectBootstrap.projectConfig.preferredAgent ?? projectBootstrap.appConfig.defaultAgent;
}

function createFileTab(tabId: string, relativePath: string, preview: boolean): FileTabState {
  return {
    id: tabId,
    relativePath,
    preview,
    fileContent: null,
    draftContent: '',
    isLoading: true,
    isSaving: false,
    saveError: null,
  };
}

function createProjectDraftTab(): FileTabState {
  return {
    id: PROJECT_DRAFT_TAB_ID,
    relativePath: PROJECT_DRAFT_RELATIVE_PATH,
    preview: false,
    fileContent: null,
    draftContent: '',
    isLoading: false,
    isSaving: false,
    saveError: null,
  };
}

function createReadFailedFileContent(relativePath: string, error: unknown): FileTabState['fileContent'] {
  return {
    kind: 'unsupported',
    relativePath,
    byteSize: null,
    issueCode: 'read_failed',
    title: tRenderer('hub.fileReadFailed.title'),
    message: error instanceof Error ? error.message : tRenderer('hub.fileReadFailed.message'),
  };
}

function isEntryAlreadyExistsError(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : '';
  return (
    message.includes('已存在') ||
    message.includes('already exists') ||
    message.includes('eexist')
  );
}

function createProjectDraftInitialContent(): string {
  return [
    tRenderer('terminal.projectDraftIntroLine1'),
    tRenderer('terminal.projectDraftIntroLine2'),
    '',
  ].join('\n');
}

function isSameOrDescendantPath(candidatePath: string, targetPath: string): boolean {
  if (targetPath.length === 0) {
    return true;
  }

  return candidatePath === targetPath || candidatePath.startsWith(`${targetPath}/`);
}

function remapRelativePath(currentPath: string, fromPath: string, toPath: string): string {
  if (currentPath === fromPath) {
    return toPath;
  }

  if (currentPath.startsWith(`${fromPath}/`)) {
    return `${toPath}${currentPath.slice(fromPath.length)}`;
  }

  return currentPath;
}

function getNextFileTabSelection(fileTabs: FileTabState[], removedTabIds: string[], selectedTabId: string): string {
  if (!removedTabIds.includes(selectedTabId)) {
    return selectedTabId;
  }

  const removedTabSet = new Set(removedTabIds);
  const selectedIndex = fileTabs.findIndex((tab) => tab.id === selectedTabId);

  for (let index = selectedIndex + 1; index < fileTabs.length; index += 1) {
    if (!removedTabSet.has(fileTabs[index].id)) {
      return fileTabs[index].id;
    }
  }

  for (let index = selectedIndex - 1; index >= 0; index -= 1) {
    if (!removedTabSet.has(fileTabs[index].id)) {
      return fileTabs[index].id;
    }
  }

  return HUB_TAB_ID;
}

function createEmptyProjectSkillsData(): ProjectSkillsData {
  return {
    agents: {
      codex: {
        globalSkills: [],
        projectSkills: [],
      },
      claude_code: {
        globalSkills: [],
        projectSkills: [],
      },
      opencode: {
        globalSkills: [],
        projectSkills: [],
      },
    },
    errors: [],
  };
}

function createEmptyCodexProjectHomeData(): CodexProjectHomeData {
  return {
    availability: {
      available: false,
    },
    recentSessionCards: [],
  };
}

function createEmptyClaudeCodeProjectHomeData(): ClaudeCodeProjectHomeData {
  return {
    availability: {
      available: false,
    },
    recentSessionCards: [],
  };
}

function createEmptyOpenCodeProjectHomeData(): OpenCodeProjectHomeData {
  return {
    availability: {
      available: false,
    },
    recentSessionCards: [],
  };
}

function isAgentUnavailable(available: boolean): boolean {
  return !available;
}

function shouldAutoCloseSession(session: TerminalSessionRecord): boolean {
  return session.status === 'exited' || (session.kind === 'shell' && session.status === 'failed');
}

function getProjectHomeLoadErrorMessage(agentLabel: string): string {
  return tRenderer('projectHome.loadAgentStateFailed', {
    agent: agentLabel,
  });
}

function shouldFallbackToShellFromCreateError(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : '';

  return (
    message.includes('未安装') ||
    message.includes('not installed') ||
    message.includes('command not found') ||
    message.includes('not found') ||
    message.includes('exit code 127')
  );
}

const PROJECT_HOME_REFRESH_TTL_MS = 15_000;

export function TerminalWorkspaceView({
  appearanceSignature,
  iconTheme,
  projectBootstrap,
  skillsRevision,
  menuCommandEvent,
  areWorkspaceShortcutsEnabled,
  onUpdateProjectConfig,
  onUpdateProjectUiState,
}: TerminalWorkspaceViewProps): ReactElement {
  const supportsProjectDraft = projectBootstrap.project.kind === 'local';
  const [sessions, setSessions] = useState<TerminalSessionRecord[]>([]);
  const [fileTabs, setFileTabs] = useState<FileTabState[]>([]);
  const [draftTab, setDraftTab] = useState<FileTabState>(createProjectDraftTab);
  const [hasProjectDraftFile, setHasProjectDraftFile] = useState(false);
  const [sessionActivities, setSessionActivities] = useState<Record<string, TerminalSessionActivity>>(
    {},
  );
  const [sessionAttention, setSessionAttention] = useState<Record<string, boolean>>({});
  const [selectedTabId, setSelectedTabId] = useState<string>(HUB_TAB_ID);
  const [claudeCodeProjectHomeData, setClaudeCodeProjectHomeData] =
    useState<ClaudeCodeProjectHomeData>(createEmptyClaudeCodeProjectHomeData());
  const [codexProjectHomeData, setCodexProjectHomeData] = useState<CodexProjectHomeData>(
    createEmptyCodexProjectHomeData(),
  );
  const [openCodeProjectHomeData, setOpenCodeProjectHomeData] = useState<OpenCodeProjectHomeData>(
    createEmptyOpenCodeProjectHomeData(),
  );
  const [projectSkillsData, setProjectSkillsData] = useState<ProjectSkillsData>(
    createEmptyProjectSkillsData(),
  );
  const [isProjectHomeLoading, setIsProjectHomeLoading] = useState(true);
  const [claudeCodeProjectHomeLoadError, setClaudeCodeProjectHomeLoadError] =
    useState<string | null>(null);
  const [codexProjectHomeLoadError, setCodexProjectHomeLoadError] = useState<string | null>(null);
  const [openCodeProjectHomeLoadError, setOpenCodeProjectHomeLoadError] =
    useState<string | null>(null);
  const [isProjectSkillsLoading, setIsProjectSkillsLoading] = useState(false);
  const [projectSkillsLoadError, setProjectSkillsLoadError] = useState<string | null>(null);
  const [isCreatingClaudeCode, setIsCreatingClaudeCode] = useState(false);
  const [isCreatingCodex, setIsCreatingCodex] = useState(false);
  const [isCreatingOpenCode, setIsCreatingOpenCode] = useState(false);
  const [isCreatingShell, setIsCreatingShell] = useState(false);
  const [resumingClaudeCodeSessionId, setResumingClaudeCodeSessionId] = useState<string | null>(
    null,
  );
  const [resumingCodexSessionId, setResumingCodexSessionId] = useState<string | null>(null);
  const [resumingOpenCodeSessionId, setResumingOpenCodeSessionId] = useState<string | null>(null);
  const nextFileTabIdRef = useRef(1);
  const draftTabRef = useRef(draftTab);
  const draftLoadRequestSequenceRef = useRef(0);
  const fileTabsRef = useRef<FileTabState[]>([]);
  const fileLoadRequestSequenceRef = useRef<Record<string, number>>({});
  const projectHomeRefreshSequenceRef = useRef(0);
  const projectHomeLastRefreshedAtRef = useRef(0);
  const sessionsRef = useRef<TerminalSessionRecord[]>([]);
  const pendingAutoCloseSessionIdsRef = useRef<Set<string>>(new Set());
  const sessionActivitiesRef = useRef<Record<string, TerminalSessionActivity>>({});
  const terminalRuntimeStoreRef = useRef<TerminalRuntimeStore | null>(null);
  const selectedTabIdRef = useRef(selectedTabId);

  if (terminalRuntimeStoreRef.current === null) {
    terminalRuntimeStoreRef.current = new TerminalRuntimeStore({
      loadSnapshot: async (sessionId) =>
        window.viboApp.getTerminalSessionSnapshot({
          sessionId,
        }),
      onAgentActivityChange: (sessionId, activity) => {
        if (sessionActivitiesRef.current[sessionId] !== activity) {
          sessionActivitiesRef.current = {
            ...sessionActivitiesRef.current,
            [sessionId]: activity,
          };
          void window.viboApp
            .reportTerminalAgentActivity({
              sessionId,
              activity,
            })
            .catch((error) => {
              console.warn('Failed to report terminal agent activity.', error);
            });
        }

        setSessionActivities((currentActivities) => {
          if (currentActivities[sessionId] === activity) {
            return currentActivities;
          }

          return {
            ...currentActivities,
            [sessionId]: activity,
          };
        });
        setSessionAttention((currentAttention) => {
          if (activity !== 'waiting_input') {
            if (!(sessionId in currentAttention)) {
              return currentAttention;
            }

            const nextAttention = {
              ...currentAttention,
            };

            delete nextAttention[sessionId];
            return nextAttention;
          }

          const nextNeedsAttention = selectedTabIdRef.current !== sessionId;

          if (currentAttention[sessionId] === nextNeedsAttention) {
            return currentAttention;
          }

          if (!nextNeedsAttention) {
            if (!(sessionId in currentAttention)) {
              return currentAttention;
            }

            const nextAttention = {
              ...currentAttention,
            };

            delete nextAttention[sessionId];
            return nextAttention;
          }

          return {
            ...currentAttention,
            [sessionId]: true,
          };
        });
      },
      onInput: (sessionId, data) => {
        void window.viboApp.writeTerminalInput({
          sessionId,
          data,
        });
      },
      onResize: (sessionId, cols, rows) => {
        void window.viboApp.resizeTerminal({
          sessionId,
          cols,
          rows,
        });
      },
      onOpenWorkspaceLink: async (rawText) => {
        try {
          const resolvedLink = await window.viboApp.resolveTerminalWorkspaceLink({
            rawText,
          });

          if (!resolvedLink) {
            return;
          }

          await handleOpenFile(resolvedLink.relativePath);
        } catch (error) {
          console.warn('Failed to open terminal workspace link.', error);
        }
      },
    });
  }

  const terminalRuntimeStore = terminalRuntimeStoreRef.current;

  useEffect(() => {
    sessionsRef.current = sessions;
  }, [sessions]);

  useEffect(() => {
    for (const session of sessions) {
      if (!shouldAutoCloseSession(session)) {
        continue;
      }

      if (pendingAutoCloseSessionIdsRef.current.has(session.id)) {
        continue;
      }

      pendingAutoCloseSessionIdsRef.current.add(session.id);
      void window.viboApp.closeTerminalSession(session.id).catch((error) => {
        pendingAutoCloseSessionIdsRef.current.delete(session.id);
        console.warn('Failed to auto-close terminal session.', {
          sessionId: session.id,
          kind: session.kind,
          status: session.status,
          error,
        });
      });
    }
  }, [sessions]);

  useEffect(() => {
    fileTabsRef.current = fileTabs;
  }, [fileTabs]);

  useEffect(() => {
    draftTabRef.current = draftTab;
  }, [draftTab]);

  useEffect(() => {
    sessionActivitiesRef.current = sessionActivities;
  }, [sessionActivities]);

  useEffect(() => {
    selectedTabIdRef.current = selectedTabId;
  }, [selectedTabId]);

  useEffect(() => {
    setDraftTab(createProjectDraftTab());
    setHasProjectDraftFile(false);
    draftLoadRequestSequenceRef.current = 0;
  }, [projectBootstrap.project.fingerprint]);

  useEffect(() => {
    if (!menuCommandEvent || !areWorkspaceShortcutsEnabled) {
      return;
    }

    switch (menuCommandEvent.command) {
      case 'project.new-primary-session':
        void handleCreatePrimarySession();
        break;
      case 'project.new-codex-session':
        void handleCreateCodex();
        break;
      case 'project.new-claude-code-session':
        void handleCreateClaudeCode();
        break;
      case 'project.new-opencode-session':
        void handleCreateOpenCode();
        break;
      case 'project.new-shell-session':
        void handleCreateShell();
        break;
      case 'workspace.save-active-file': {
        const activeFileTab =
          selectedTabIdRef.current === PROJECT_DRAFT_TAB_ID
            ? draftTabRef.current
            : fileTabsRef.current.find((tab) => tab.id === selectedTabIdRef.current);

        if (activeFileTab) {
          void handleSaveFile(activeFileTab.id);
        }
        break;
      }
      case 'workspace.close-active-tab':
        if (selectedTabIdRef.current !== HUB_TAB_ID) {
          void handleCloseTab(selectedTabIdRef.current);
        }
        break;
      default:
        break;
    }
  }, [areWorkspaceShortcutsEnabled, menuCommandEvent]);

  useEffect(() => {
    let cancelled = false;

    async function hydrateWorkspace(): Promise<void> {
      const existingSessions = await window.viboApp.listTerminalSessions();

      if (!cancelled) {
        setSessions(existingSessions);
      }
    }

    void hydrateWorkspace();

    const unsubscribe = window.viboApp.onTerminalEvent((event) => {
      if (cancelled) {
        return;
      }

      handleTerminalEvent(event);
    });

    return () => {
      cancelled = true;
      unsubscribe();
      terminalRuntimeStore.disposeAll();
    };
  }, [terminalRuntimeStore]);

  async function refreshProjectHomeData(): Promise<void> {
    const requestSequence = projectHomeRefreshSequenceRef.current + 1;
    projectHomeRefreshSequenceRef.current = requestSequence;
    setIsProjectHomeLoading(true);
    setClaudeCodeProjectHomeLoadError(null);
    setCodexProjectHomeLoadError(null);
    setOpenCodeProjectHomeLoadError(null);
    setIsProjectSkillsLoading(true);

    const [claudeResult, codexResult, openCodeResult, projectSkillsResult] = await Promise.allSettled([
      window.viboApp.getClaudeCodeProjectHomeData(),
      window.viboApp.getCodexProjectHomeData(),
      window.viboApp.getOpenCodeProjectHomeData(),
      window.viboApp.getProjectSkillsData(),
    ]);

    if (projectHomeRefreshSequenceRef.current !== requestSequence) {
      return;
    }

    if (claudeResult.status === 'fulfilled') {
      setClaudeCodeProjectHomeData(claudeResult.value);
      setClaudeCodeProjectHomeLoadError(null);
    } else {
      console.warn('Failed to load Claude Code project home data.', claudeResult.reason);
      setClaudeCodeProjectHomeData(createEmptyClaudeCodeProjectHomeData());
      setClaudeCodeProjectHomeLoadError(getProjectHomeLoadErrorMessage('Claude Code'));
    }

    if (codexResult.status === 'fulfilled') {
      setCodexProjectHomeData(codexResult.value);
      setCodexProjectHomeLoadError(null);
    } else {
      console.warn('Failed to load Codex project home data.', codexResult.reason);
      setCodexProjectHomeData(createEmptyCodexProjectHomeData());
      setCodexProjectHomeLoadError(getProjectHomeLoadErrorMessage('Codex'));
    }

    if (openCodeResult.status === 'fulfilled') {
      setOpenCodeProjectHomeData(openCodeResult.value);
      setOpenCodeProjectHomeLoadError(null);
    } else {
      console.warn('Failed to load OpenCode project home data.', openCodeResult.reason);
      setOpenCodeProjectHomeData(createEmptyOpenCodeProjectHomeData());
      setOpenCodeProjectHomeLoadError(getProjectHomeLoadErrorMessage('OpenCode'));
    }

    if (projectSkillsResult.status === 'fulfilled') {
      setProjectSkillsData(projectSkillsResult.value);
      setProjectSkillsLoadError(null);
    } else {
      setProjectSkillsData(createEmptyProjectSkillsData());
      setProjectSkillsLoadError(
        projectSkillsResult.reason instanceof Error
          ? projectSkillsResult.reason.message
          : tRenderer('projectHome.skillsLoadFailed'),
      );
    }

    setIsProjectHomeLoading(false);
    setIsProjectSkillsLoading(false);
    projectHomeLastRefreshedAtRef.current = Date.now();
  }

  useEffect(() => {
    projectHomeLastRefreshedAtRef.current = Date.now();
    void refreshProjectHomeData();
  }, [projectBootstrap.project.fingerprint, skillsRevision]);

  useEffect(() => {
    if (selectedTabId !== HUB_TAB_ID) {
      return;
    }

    if (Date.now() - projectHomeLastRefreshedAtRef.current < PROJECT_HOME_REFRESH_TTL_MS) {
      return;
    }

    void refreshProjectHomeData();
  }, [selectedTabId]);

  useEffect(() => {
    terminalRuntimeStore.refreshAll();
  }, [appearanceSignature, terminalRuntimeStore]);

  const selectedSession = useMemo(
    () => sessions.find((session) => session.id === selectedTabId) ?? null,
    [selectedTabId, sessions],
  );

  const activeFileTab = useMemo(
    () =>
      selectedTabId === PROJECT_DRAFT_TAB_ID
        ? draftTab
        : fileTabs.find((tab) => tab.id === selectedTabId) ?? null,
    [draftTab, fileTabs, selectedTabId],
  );

  const pinnedFilePaths = useMemo(
    () => new Set(fileTabs.filter((tab) => !tab.preview).map((tab) => tab.relativePath)),
    [fileTabs],
  );

  const workspaceTabs = useMemo<WorkspaceTabDescriptor[]>(
    () => [
      {
        id: HUB_TAB_ID,
        kind: 'hub',
        label: tRenderer('terminal.tab.hub'),
        title: tRenderer('terminal.tab.hub'),
        isActive: selectedTabId === HUB_TAB_ID,
        isClosable: false,
      },
      ...(supportsProjectDraft
        ? [
            {
              id: PROJECT_DRAFT_TAB_ID,
              kind: 'draft' as const,
              label: tRenderer('terminal.tab.notes'),
              title: `${tRenderer('terminal.tab.notes')} · ${PROJECT_DRAFT_RELATIVE_PATH}${
                isFileTabDirty(draftTab) ? ` · ${tRenderer('terminal.tab.modifiedSuffix')}` : ''
              }`,
              filePath: PROJECT_DRAFT_RELATIVE_PATH,
              isActive: selectedTabId === PROJECT_DRAFT_TAB_ID,
              isClosable: false,
              isDirty: isFileTabDirty(draftTab),
            },
          ]
        : []),
      ...fileTabs.map((tab) => ({
        id: tab.id,
        kind: 'file' as const,
        label: getFileTabLabel(tab.relativePath),
        title: `${tab.relativePath}${
          isFileTabDirty(tab) ? ` · ${tRenderer('terminal.tab.modifiedSuffix')}` : ''
        }`,
        filePath: tab.relativePath,
        isActive: selectedTabId === tab.id,
        isClosable: true,
        isPreview: tab.preview,
        isDirty: isFileTabDirty(tab),
      })),
      ...sessions.map((session) => ({
        id: session.id,
        kind: 'terminal' as const,
        label: session.label,
        title: session.label,
        status: session.status,
        agentActivity: sessionActivities[session.id],
        needsAttention: sessionAttention[session.id] === true,
        sessionKind: session.kind,
        isActive: selectedTabId === session.id,
        isClosable: true,
      })),
    ],
    [draftTab, fileTabs, selectedTabId, sessionActivities, sessionAttention, sessions, supportsProjectDraft],
  );

  function handleSelectTab(tabId: string): void {
    if (tabId === PROJECT_DRAFT_TAB_ID) {
      void handleOpenProjectDraft();
      return;
    }

    setSelectedTabId(tabId);

    if (sessionActivities[tabId] !== 'waiting_input' || sessionAttention[tabId] !== true) {
      return;
    }

    setSessionAttention((currentAttention) => {
      if (!(tabId in currentAttention)) {
        return currentAttention;
      }

      const nextAttention = {
        ...currentAttention,
      };

      delete nextAttention[tabId];
      return nextAttention;
    });
  }

  function createNextFileTabId(): string {
    const nextId = `file:${nextFileTabIdRef.current}`;
    nextFileTabIdRef.current += 1;
    return nextId;
  }

  async function ensureProjectDraftExists(): Promise<boolean> {
    if (!supportsProjectDraft) {
      throw new Error(tRenderer('terminal.projectDraftUnsupported'));
    }

    try {
      await window.viboApp.createWorkspaceEntry({
        parentRelativePath: PROJECT_VIBO_DIRECTORY_RELATIVE_PATH,
        name: PROJECT_DRAFT_FILE_NAME,
        kind: 'file',
      });
      setHasProjectDraftFile(true);
      return true;
    } catch (error) {
      if (!isEntryAlreadyExistsError(error)) {
        throw error;
      }

      setHasProjectDraftFile(true);
      return false;
    }
  }

  async function loadProjectDraftTab(): Promise<void> {
    const requestSequence = draftLoadRequestSequenceRef.current + 1;
    draftLoadRequestSequenceRef.current = requestSequence;

    setDraftTab((currentDraftTab) => ({
      ...currentDraftTab,
      fileContent: null,
      draftContent: '',
      isLoading: true,
      isSaving: false,
      saveError: null,
    }));

    try {
      const nextFileContent = await window.viboApp.readWorkspaceFile({
        relativePath: PROJECT_DRAFT_RELATIVE_PATH,
      });

      if (draftLoadRequestSequenceRef.current !== requestSequence) {
        return;
      }

      setHasProjectDraftFile(true);
      setDraftTab((currentDraftTab) => ({
        ...currentDraftTab,
        fileContent: nextFileContent,
        draftContent: nextFileContent.kind === 'text' ? nextFileContent.content : '',
        isLoading: false,
        isSaving: false,
        saveError: null,
      }));
    } catch (error) {
      if (draftLoadRequestSequenceRef.current !== requestSequence) {
        return;
      }

      setDraftTab((currentDraftTab) => ({
        ...currentDraftTab,
        fileContent: createReadFailedFileContent(PROJECT_DRAFT_RELATIVE_PATH, error),
        draftContent: '',
        isLoading: false,
        isSaving: false,
        saveError: null,
      }));
    }
  }

  async function handleOpenProjectDraft(): Promise<void> {
    if (!supportsProjectDraft) {
      return;
    }

    setSelectedTabId(PROJECT_DRAFT_TAB_ID);

    const currentDraftTab = draftTabRef.current;

    if (currentDraftTab.isLoading || currentDraftTab.isSaving || isFileTabDirty(currentDraftTab)) {
      return;
    }

    if (currentDraftTab.fileContent?.kind === 'text') {
      return;
    }

    setDraftTab((staleDraftTab) => ({
      ...staleDraftTab,
      fileContent: null,
      draftContent: '',
      isLoading: true,
      isSaving: false,
      saveError: null,
    }));

    try {
      const didCreateDraft = await ensureProjectDraftExists();

      if (didCreateDraft) {
        await window.viboApp.writeWorkspaceFile({
          relativePath: PROJECT_DRAFT_RELATIVE_PATH,
          content: createProjectDraftInitialContent(),
        });
      }

      await loadProjectDraftTab();
    } catch (error) {
      setDraftTab((staleDraftTab) => ({
        ...staleDraftTab,
        fileContent: createReadFailedFileContent(PROJECT_DRAFT_RELATIVE_PATH, error),
        draftContent: '',
        isLoading: false,
        isSaving: false,
        saveError: null,
      }));
    }
  }

  function handleTerminalEvent(event: TerminalEvent): void {
    switch (event.type) {
      case 'data':
        terminalRuntimeStore.appendOutput(event.sessionId, event.chunk, event.sequence);
        break;
      case 'session_updated':
        setSessions((currentSessions) => upsertSession(currentSessions, event.session));
        break;
      case 'session_removed':
        terminalRuntimeStore.disposeRuntime(event.sessionId);
        pendingAutoCloseSessionIdsRef.current.delete(event.sessionId);
        if (event.sessionId in sessionActivitiesRef.current) {
          const nextActivities = {
            ...sessionActivitiesRef.current,
          };

          delete nextActivities[event.sessionId];
          sessionActivitiesRef.current = nextActivities;
        }
        setSessionActivities((currentActivities) => {
          if (!(event.sessionId in currentActivities)) {
            return currentActivities;
          }

          const nextActivities = {
            ...currentActivities,
          };

          delete nextActivities[event.sessionId];
          return nextActivities;
        });
        setSessionAttention((currentAttention) => {
          if (!(event.sessionId in currentAttention)) {
            return currentAttention;
          }

          const nextAttention = {
            ...currentAttention,
          };

          delete nextAttention[event.sessionId];
          return nextAttention;
        });
        setSessions((currentSessions) =>
          currentSessions.filter((session) => session.id !== event.sessionId),
        );
        setSelectedTabId((currentSelectedTabId) =>
          currentSelectedTabId === event.sessionId ? HUB_TAB_ID : currentSelectedTabId,
        );
        break;
      case 'session_focus_requested':
        if (!sessionsRef.current.some((session) => session.id === event.sessionId)) {
          break;
        }

        setSelectedTabId(event.sessionId);
        setSessionAttention((currentAttention) => {
          if (!(event.sessionId in currentAttention)) {
            return currentAttention;
          }

          const nextAttention = {
            ...currentAttention,
          };

          delete nextAttention[event.sessionId];
          return nextAttention;
        });
        break;
      default:
        break;
    }
  }

  async function loadFileTab(tabId: string, relativePath: string): Promise<void> {
    const requestSequence = (fileLoadRequestSequenceRef.current[tabId] ?? 0) + 1;
    fileLoadRequestSequenceRef.current[tabId] = requestSequence;

    setFileTabs((currentTabs) =>
      currentTabs.map((tab) =>
        tab.id === tabId
          ? {
              ...tab,
              relativePath,
              fileContent: null,
              draftContent: '',
              isLoading: true,
              isSaving: false,
              saveError: null,
            }
          : tab,
      ),
    );

    try {
      const nextFileContent = await window.viboApp.readWorkspaceFile({
        relativePath,
      });

      if (fileLoadRequestSequenceRef.current[tabId] !== requestSequence) {
        return;
      }

      setFileTabs((currentTabs) =>
        currentTabs.map((tab) => {
          if (tab.id !== tabId || tab.relativePath !== relativePath) {
            return tab;
          }

          return {
            ...tab,
            fileContent: nextFileContent,
            draftContent: nextFileContent.kind === 'text' ? nextFileContent.content : '',
            isLoading: false,
            isSaving: false,
            saveError: null,
          };
        }),
      );
    } catch (error) {
      if (fileLoadRequestSequenceRef.current[tabId] !== requestSequence) {
        return;
      }

      setFileTabs((currentTabs) =>
        currentTabs.map((tab) => {
          if (tab.id !== tabId || tab.relativePath !== relativePath) {
            return tab;
          }

          return {
            ...tab,
            fileContent: createReadFailedFileContent(relativePath, error),
            draftContent: '',
            isLoading: false,
            isSaving: false,
            saveError: null,
          };
        }),
      );
    }
  }

  function confirmDiscardFileTab(
    fileTab: FileTabState,
    message = tRenderer('hub.unsavedChangesDiscardSingle'),
  ): boolean {
    if (!isFileTabDirty(fileTab)) {
      return true;
    }

    return window.confirm(message);
  }

  async function handleOpenFile(relativePath: string, options?: OpenFileOptions): Promise<void> {
    if (supportsProjectDraft && isProjectDraftRelativePath(relativePath)) {
      await handleOpenProjectDraft();
      return;
    }

    const openAsPinned = options?.pinned === true;
    const currentTabs = fileTabsRef.current;
    const existingTab = currentTabs.find((tab) => tab.relativePath === relativePath);

    if (existingTab) {
      if (openAsPinned && existingTab.preview) {
        setFileTabs((tabs) =>
          tabs.map((tab) => (tab.id === existingTab.id ? { ...tab, preview: false } : tab)),
        );
      }

      setSelectedTabId(existingTab.id);
      return;
    }

    if (openAsPinned) {
      const nextTab = createFileTab(createNextFileTabId(), relativePath, false);
      setFileTabs((tabs) => [...tabs, nextTab]);
      setSelectedTabId(nextTab.id);
      void loadFileTab(nextTab.id, relativePath);
      return;
    }

    const previewTab = currentTabs.find((tab) => tab.preview);

    if (previewTab) {
      if (
        !confirmDiscardFileTab(
          previewTab,
          tRenderer('hub.unsavedChangesDiscardPreview'),
        )
      ) {
        return;
      }

      setSelectedTabId(previewTab.id);
      void loadFileTab(previewTab.id, relativePath);
      return;
    }

    const nextTab = createFileTab(createNextFileTabId(), relativePath, true);
    setFileTabs((tabs) => [...tabs, nextTab]);
    setSelectedTabId(nextTab.id);
    void loadFileTab(nextTab.id, relativePath);
  }

  function handlePinFile(relativePath: string): void {
    void handleOpenFile(relativePath, {
      pinned: true,
    });
  }

  function handlePinFileTab(tabId: string): void {
    setFileTabs((currentTabs) =>
      currentTabs.map((tab) => (tab.id === tabId ? { ...tab, preview: false } : tab)),
    );
  }

  function handleChangeFileDraft(tabId: string, nextContent: string): void {
    if (tabId === PROJECT_DRAFT_TAB_ID) {
      setDraftTab((currentDraftTab) => ({
        ...currentDraftTab,
        draftContent: nextContent,
        saveError: null,
      }));
      return;
    }

    setFileTabs((currentTabs) =>
      currentTabs.map((tab) =>
        tab.id === tabId
          ? {
              ...tab,
              draftContent: nextContent,
              saveError: null,
            }
          : tab,
      ),
    );
  }

  async function handleSaveFile(tabId: string): Promise<void> {
    if (tabId === PROJECT_DRAFT_TAB_ID) {
      const targetTab = draftTabRef.current;

      if (
        targetTab.isSaving ||
        targetTab.fileContent?.kind !== 'text' ||
        !isFileTabDirty(targetTab)
      ) {
        return;
      }

      const saveTargetContent = targetTab.draftContent;

      setDraftTab((currentDraftTab) => ({
        ...currentDraftTab,
        isSaving: true,
        saveError: null,
      }));

      try {
        const didCreateDraft = await ensureProjectDraftExists();

        if (didCreateDraft) {
          await window.viboApp.writeWorkspaceFile({
            relativePath: PROJECT_DRAFT_RELATIVE_PATH,
            content: createProjectDraftInitialContent(),
          });
        }

        await window.viboApp.writeWorkspaceFile({
          relativePath: PROJECT_DRAFT_RELATIVE_PATH,
          content: saveTargetContent,
        });

        setHasProjectDraftFile(true);
        setDraftTab((currentDraftTab) => {
          if (currentDraftTab.fileContent?.kind !== 'text') {
            return {
              ...currentDraftTab,
              isSaving: false,
            };
          }

          return {
            ...currentDraftTab,
            isSaving: false,
            saveError: null,
            fileContent: {
              ...currentDraftTab.fileContent,
              content: saveTargetContent,
            },
          };
        });
      } catch (error) {
        setDraftTab((currentDraftTab) => ({
          ...currentDraftTab,
          isSaving: false,
          saveError: error instanceof Error ? error.message : tRenderer('hub.fileSaveFailed'),
        }));
      }

      return;
    }

    const targetTab = fileTabsRef.current.find((tab) => tab.id === tabId);

    if (
      !targetTab ||
      targetTab.isSaving ||
      targetTab.fileContent?.kind !== 'text' ||
      !isFileTabDirty(targetTab)
    ) {
      return;
    }

    const saveTargetPath = targetTab.relativePath;
    const saveTargetContent = targetTab.draftContent;

    setFileTabs((currentTabs) =>
      currentTabs.map((tab) =>
        tab.id === tabId
          ? {
              ...tab,
              isSaving: true,
              saveError: null,
            }
          : tab,
      ),
    );

    try {
      await window.viboApp.writeWorkspaceFile({
        relativePath: saveTargetPath,
        content: saveTargetContent,
      });

      setFileTabs((currentTabs) =>
        currentTabs.map((tab) => {
          if (tab.id !== tabId) {
            return tab;
          }

          if (tab.relativePath !== saveTargetPath || tab.fileContent?.kind !== 'text') {
            return {
              ...tab,
              isSaving: false,
            };
          }

          return {
            ...tab,
            isSaving: false,
            saveError: null,
            fileContent: {
              ...tab.fileContent,
              content: saveTargetContent,
            },
          };
        }),
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : tRenderer('hub.fileSaveFailed');
      const currentTab = fileTabsRef.current.find((tab) => tab.id === tabId);

      if (currentTab?.relativePath === saveTargetPath) {
        setFileTabs((currentTabs) =>
          currentTabs.map((tab) =>
            tab.id === tabId
              ? {
                  ...tab,
                  isSaving: false,
                  saveError: errorMessage,
                }
              : tab,
          ),
        );
      } else {
        setFileTabs((currentTabs) =>
          currentTabs.map((tab) =>
            tab.id === tabId
              ? {
                  ...tab,
                  isSaving: false,
                }
              : tab,
          ),
        );
        window.alert(errorMessage);
      }
    }
  }

  function handleCloseFileTab(tabId: string): void {
    const currentTabs = fileTabsRef.current;
    const targetTab = currentTabs.find((tab) => tab.id === tabId);

    if (!targetTab || !confirmDiscardFileTab(targetTab)) {
      return;
    }

    delete fileLoadRequestSequenceRef.current[tabId];
    setFileTabs((tabs) => tabs.filter((tab) => tab.id !== tabId));
    setSelectedTabId((currentSelectedTabId) =>
      currentSelectedTabId === tabId
        ? getNextFileTabSelection(currentTabs, [tabId], currentSelectedTabId)
        : currentSelectedTabId,
    );
  }

  function handleConfirmDeleteEntry(relativePath: string): boolean {
    const deleteMode = projectBootstrap.capabilities.workspace.deleteMode;
    const deleteActionLabel =
      deleteMode === 'permanent'
        ? tRenderer('hub.deleteAction.permanent')
        : tRenderer('hub.deleteAction.trash');
    const dirtyAffectedTabs = fileTabsRef.current.filter(
      (tab) => isSameOrDescendantPath(tab.relativePath, relativePath) && isFileTabDirty(tab),
    );
    const draftAffectedTabs =
      supportsProjectDraft &&
      isSameOrDescendantPath(PROJECT_DRAFT_RELATIVE_PATH, relativePath) &&
      isFileTabDirty(draftTabRef.current)
        ? [draftTabRef.current]
        : [];
    const dirtyTabs = [...dirtyAffectedTabs, ...draftAffectedTabs];

    if (dirtyTabs.length === 0) {
      if (deleteMode === 'permanent') {
        return window.confirm(
          tRenderer('hub.unsavedChangesDeletePermanent', {
            path: relativePath,
          }),
        );
      }

      return true;
    }

    if (dirtyTabs.length === 1) {
      return window.confirm(
        tRenderer('hub.unsavedChangesDeleteSingle', {
          path: dirtyTabs[0].relativePath,
          action: deleteActionLabel,
        }),
      );
    }

    return window.confirm(
      tRenderer('hub.unsavedChangesDeleteMultiple', {
        action: deleteActionLabel,
        count: dirtyTabs.length,
      }),
    );
  }

  function handleSyncFileTabsAfterRename(previousPath: string, nextPath: string): void {
    if (supportsProjectDraft) {
      if (isProjectDraftRelativePath(previousPath) && !isProjectDraftRelativePath(nextPath)) {
        setHasProjectDraftFile(false);
        setDraftTab(createProjectDraftTab());
      } else if (isProjectDraftRelativePath(nextPath)) {
        setHasProjectDraftFile(true);
        setDraftTab(createProjectDraftTab());
      }
    }

    setFileTabs((currentTabs) =>
      currentTabs.map((tab) => {
        if (!isSameOrDescendantPath(tab.relativePath, previousPath)) {
          return tab;
        }

        const nextRelativePath = remapRelativePath(tab.relativePath, previousPath, nextPath);

        return {
          ...tab,
          relativePath: nextRelativePath,
          fileContent: tab.fileContent
            ? {
                ...tab.fileContent,
                relativePath: remapRelativePath(tab.fileContent.relativePath, previousPath, nextPath),
              }
            : tab.fileContent,
        };
      }),
    );
  }

  function handleSyncFileTabsAfterDelete(deletedPath: string): void {
    if (supportsProjectDraft && isSameOrDescendantPath(PROJECT_DRAFT_RELATIVE_PATH, deletedPath)) {
      setHasProjectDraftFile(false);
      setDraftTab(createProjectDraftTab());
    }

    const currentTabs = fileTabsRef.current;
    const removedTabs = currentTabs.filter((tab) =>
      isSameOrDescendantPath(tab.relativePath, deletedPath),
    );

    if (removedTabs.length === 0) {
      return;
    }

    const removedTabIds = removedTabs.map((tab) => tab.id);

    for (const tabId of removedTabIds) {
      delete fileLoadRequestSequenceRef.current[tabId];
    }

    setFileTabs((tabs) =>
      tabs.filter((tab) => !isSameOrDescendantPath(tab.relativePath, deletedPath)),
    );
    setSelectedTabId((currentSelectedTabId) =>
      removedTabIds.includes(currentSelectedTabId)
        ? getNextFileTabSelection(currentTabs, removedTabIds, currentSelectedTabId)
        : currentSelectedTabId,
    );
  }

  async function handleCreateCodex(): Promise<void> {
    if (
      !isProjectHomeLoading &&
      isAgentUnavailable(codexProjectHomeData.availability.available)
    ) {
      await handleCreateShell();
      return;
    }

    let shouldFallbackToShell = false;

    try {
      setIsCreatingCodex(true);
      const session = await window.viboApp.createCodexSession();

      projectHomeLastRefreshedAtRef.current = 0;
      terminalRuntimeStore.getOrCreateRuntime(session.id);
      setSessions((currentSessions) => upsertSession(currentSessions, session));
      setSelectedTabId(session.id);
    } catch (error) {
      console.warn('Failed to create Codex session.', error);
      shouldFallbackToShell = shouldFallbackToShellFromCreateError(error);

      if (!shouldFallbackToShell) {
        window.alert(tRenderer('terminal.createCodexFailed'));
      }
    } finally {
      setIsCreatingCodex(false);
    }

    if (shouldFallbackToShell) {
      await handleCreateShell();
    }
  }

  async function handleCreateClaudeCode(): Promise<void> {
    if (
      !isProjectHomeLoading &&
      isAgentUnavailable(claudeCodeProjectHomeData.availability.available)
    ) {
      await handleCreateShell();
      return;
    }

    let shouldFallbackToShell = false;

    try {
      setIsCreatingClaudeCode(true);
      const session = await window.viboApp.createClaudeCodeSession();

      projectHomeLastRefreshedAtRef.current = 0;
      terminalRuntimeStore.getOrCreateRuntime(session.id);
      setSessions((currentSessions) => upsertSession(currentSessions, session));
      setSelectedTabId(session.id);
    } catch (error) {
      console.warn('Failed to create Claude Code session.', error);
      shouldFallbackToShell = shouldFallbackToShellFromCreateError(error);

      if (!shouldFallbackToShell) {
        window.alert(tRenderer('terminal.createClaudeFailed'));
      }
    } finally {
      setIsCreatingClaudeCode(false);
    }

    if (shouldFallbackToShell) {
      await handleCreateShell();
    }
  }

  async function handleCreateOpenCode(): Promise<void> {
    if (
      !isProjectHomeLoading &&
      isAgentUnavailable(openCodeProjectHomeData.availability.available)
    ) {
      await handleCreateShell();
      return;
    }

    let shouldFallbackToShell = false;

    try {
      setIsCreatingOpenCode(true);
      const session = await window.viboApp.createOpenCodeSession();

      projectHomeLastRefreshedAtRef.current = 0;
      terminalRuntimeStore.getOrCreateRuntime(session.id);
      setSessions((currentSessions) => upsertSession(currentSessions, session));
      setSelectedTabId(session.id);
    } catch (error) {
      console.warn('Failed to create OpenCode session.', error);
      shouldFallbackToShell = shouldFallbackToShellFromCreateError(error);

      if (!shouldFallbackToShell) {
        window.alert(tRenderer('terminal.createOpenCodeFailed'));
      }
    } finally {
      setIsCreatingOpenCode(false);
    }

    if (shouldFallbackToShell) {
      await handleCreateShell();
    }
  }

  async function handleCreateShell(): Promise<void> {
    try {
      setIsCreatingShell(true);
      const session = await window.viboApp.createShellSession();

      terminalRuntimeStore.getOrCreateRuntime(session.id);
      setSessions((currentSessions) => upsertSession(currentSessions, session));
      setSelectedTabId(session.id);
    } catch (error) {
      console.warn('Failed to create Shell session.', error);
      window.alert(tRenderer('terminal.createShellFailed'));
    } finally {
      setIsCreatingShell(false);
    }
  }

  async function handleResumeClaudeCode(sessionId: string): Promise<void> {
    try {
      setResumingClaudeCodeSessionId(sessionId);
      const session = await window.viboApp.resumeClaudeCodeSession({
        sessionId,
      });

      projectHomeLastRefreshedAtRef.current = 0;
      terminalRuntimeStore.getOrCreateRuntime(session.id);
      setSessions((currentSessions) => upsertSession(currentSessions, session));
      setSelectedTabId(session.id);
    } catch (error) {
      console.warn('Failed to resume Claude Code session.', error);
      window.alert(tRenderer('terminal.resumeClaudeFailed'));
    } finally {
      setResumingClaudeCodeSessionId(null);
    }
  }

  async function handleResumeCodex(sessionId: string): Promise<void> {
    try {
      setResumingCodexSessionId(sessionId);
      const session = await window.viboApp.resumeCodexSession({
        sessionId,
      });

      projectHomeLastRefreshedAtRef.current = 0;
      terminalRuntimeStore.getOrCreateRuntime(session.id);
      setSessions((currentSessions) => upsertSession(currentSessions, session));
      setSelectedTabId(session.id);
    } catch (error) {
      console.warn('Failed to resume Codex session.', error);
      window.alert(tRenderer('terminal.resumeCodexFailed'));
    } finally {
      setResumingCodexSessionId(null);
    }
  }

  async function handleResumeOpenCode(sessionId: string): Promise<void> {
    try {
      setResumingOpenCodeSessionId(sessionId);
      const session = await window.viboApp.resumeOpenCodeSession({
        sessionId,
      });

      projectHomeLastRefreshedAtRef.current = 0;
      terminalRuntimeStore.getOrCreateRuntime(session.id);
      setSessions((currentSessions) => upsertSession(currentSessions, session));
      setSelectedTabId(session.id);
    } catch (error) {
      console.warn('Failed to resume OpenCode session.', error);
      window.alert(tRenderer('terminal.resumeOpenCodeFailed'));
    } finally {
      setResumingOpenCodeSessionId(null);
    }
  }

  async function handleCreatePrimarySession(): Promise<void> {
    const primaryAgent = getPrimaryAgent(projectBootstrap);

    if (primaryAgent === 'shell') {
      await handleCreateShell();
      return;
    }

    if (primaryAgent === 'claude_code') {
      await handleCreateClaudeCode();
      return;
    }

    if (primaryAgent === 'opencode') {
      await handleCreateOpenCode();
      return;
    }

    await handleCreateCodex();
  }

  async function handleCloseSession(sessionId: string): Promise<void> {
    const session = sessions.find((candidate) => candidate.id === sessionId);

    if (!session) {
      return;
    }

    if (
      (session.status === 'running' || session.status === 'starting') &&
      !window.confirm(
        tRenderer('terminal.confirmCloseRunning', {
          label: session.label,
        }),
      )
    ) {
      return;
    }

    await window.viboApp.closeTerminalSession(sessionId);
  }

  async function handleRenameSession(sessionId: string): Promise<void> {
    const session = sessions.find((candidate) => candidate.id === sessionId);

    if (!session) {
      return;
    }

    const nextLabel = window.prompt(tRenderer('terminal.renamePromptTitle'), session.label)?.trim();

    if (!nextLabel || nextLabel === session.label) {
      return;
    }

    await window.viboApp.renameTerminalSession({
      sessionId,
      label: nextLabel,
    });
  }

  async function handleCloseTab(tabId: string): Promise<void> {
    if (tabId === PROJECT_DRAFT_TAB_ID) {
      return;
    }

    if (fileTabsRef.current.some((tab) => tab.id === tabId)) {
      handleCloseFileTab(tabId);
      return;
    }

    await handleCloseSession(tabId);
  }

  const { project } = projectBootstrap;
  const isCreatingSession =
    isCreatingClaudeCode ||
    isCreatingCodex ||
    isCreatingOpenCode ||
    isCreatingShell ||
    resumingClaudeCodeSessionId !== null ||
    resumingCodexSessionId !== null ||
    resumingOpenCodeSessionId !== null;
  const effectiveMenuCommandEvent = areWorkspaceShortcutsEnabled ? menuCommandEvent : null;
  const { areHintsVisible, tabShortcutLabels, createSessionShortcutLabel } =
    useWorkspaceTabShortcuts({
      enabled: areWorkspaceShortcutsEnabled,
      tabIds: workspaceTabs.map((tab) => tab.id),
      activeTabId: selectedTabId,
      onSelectTab: handleSelectTab,
    });
  const windowTitle = getProjectWindowTitle(project);
  const primaryAgent = getPrimaryAgent(projectBootstrap);

  return (
    <main className="workspace-app-shell project-window-shell">
      <TerminalTabs
        tabs={workspaceTabs}
        windowTitle={windowTitle}
        iconTheme={iconTheme}
        areShortcutHintsVisible={areHintsVisible}
        tabShortcutLabels={tabShortcutLabels}
        createSessionShortcutLabel={createSessionShortcutLabel}
        onSelectTab={handleSelectTab}
        onCloseTab={(tabId) => {
          void handleCloseTab(tabId);
        }}
        onRenameTerminalTab={(tabId) => {
          void handleRenameSession(tabId);
        }}
        onPinFileTab={handlePinFileTab}
        primaryAgent={primaryAgent}
        onCreatePrimarySession={handleCreatePrimarySession}
        onCreateCodexSession={handleCreateCodex}
        onCreateClaudeCodeSession={handleCreateClaudeCode}
        onCreateOpenCodeSession={handleCreateOpenCode}
        onCreateShellSession={handleCreateShell}
        isCreatingSession={isCreatingSession}
      />

      <section className="workspace-body">
        <section className="workspace-main">
          <section
            className={`workspace-panel ${selectedSession ? 'workspace-panel-hidden' : ''}`}
            aria-hidden={selectedSession !== null}
          >
            <HubView
              projectBootstrap={projectBootstrap}
              menuCommandEvent={effectiveMenuCommandEvent}
              iconTheme={iconTheme}
              claudeCodeProjectHomeData={claudeCodeProjectHomeData}
              codexProjectHomeData={codexProjectHomeData}
              openCodeProjectHomeData={openCodeProjectHomeData}
              isProjectHomeLoading={isProjectHomeLoading}
              claudeCodeProjectHomeLoadError={claudeCodeProjectHomeLoadError}
              codexProjectHomeLoadError={codexProjectHomeLoadError}
              openCodeProjectHomeLoadError={openCodeProjectHomeLoadError}
              projectSkillsData={projectSkillsData}
              isProjectSkillsLoading={isProjectSkillsLoading}
              projectSkillsLoadError={projectSkillsLoadError}
              activeFileTab={activeFileTab}
              pinnedFilePaths={pinnedFilePaths}
              hasProjectDraftFile={hasProjectDraftFile}
              projectDraftRelativePath={supportsProjectDraft ? PROJECT_DRAFT_RELATIVE_PATH : null}
              isCreatingClaudeCode={isCreatingClaudeCode}
              isCreatingCodex={isCreatingCodex}
              isCreatingOpenCode={isCreatingOpenCode}
              isCreatingShell={isCreatingShell}
              resumingClaudeCodeSessionId={resumingClaudeCodeSessionId}
              resumingCodexSessionId={resumingCodexSessionId}
              resumingOpenCodeSessionId={resumingOpenCodeSessionId}
              onCreateClaudeCode={handleCreateClaudeCode}
              onCreateCodex={handleCreateCodex}
              onCreateOpenCode={handleCreateOpenCode}
              onCreateShell={handleCreateShell}
              onResumeClaudeCode={handleResumeClaudeCode}
              onResumeCodex={handleResumeCodex}
              onResumeOpenCode={handleResumeOpenCode}
              onUpdateProjectConfig={onUpdateProjectConfig}
              onUpdateProjectUiState={onUpdateProjectUiState}
              onFocusHub={() => {
                setSelectedTabId(HUB_TAB_ID);
              }}
              onOpenFile={handleOpenFile}
              onChangeFileDraft={handleChangeFileDraft}
              onSaveFile={handleSaveFile}
              onPinFile={handlePinFile}
              onConfirmDeleteEntry={handleConfirmDeleteEntry}
              onSyncFileTabsAfterRename={handleSyncFileTabsAfterRename}
              onSyncFileTabsAfterDelete={handleSyncFileTabsAfterDelete}
            />
          </section>

          {sessions.map((session) => (
            <TerminalPane
              key={session.id}
              runtime={terminalRuntimeStore.getOrCreateRuntime(session.id)}
              isActive={selectedTabId === session.id}
            />
          ))}
        </section>
      </section>
    </main>
  );
}
