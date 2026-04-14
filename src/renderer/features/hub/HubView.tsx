import type { PointerEvent as ReactPointerEvent, ReactElement } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';

import type { ClaudeCodeProjectHomeData } from '@shared/contracts/claude';
import type { CodexProjectHomeData } from '@shared/contracts/codex';
import type { ProjectGitData, ProjectGitDiffPreview } from '@shared/contracts/git';
import type { OpenCodeProjectHomeData } from '@shared/contracts/opencode';
import {
  isWorkspaceEditorMenuCommand,
  type MenuCommand,
  type WorkspaceEditorMenuCommand,
} from '@shared/contracts/menu';
import type { ProjectBootstrapData } from '@shared/contracts/project';
import type { ProjectSkillsData } from '@shared/contracts/skills';
import type { WorkspaceEntryKind, WorkspaceTreeEntry } from '@shared/contracts/workspace';
import type { AppIconTheme, ProjectConfig, ProjectUiState } from '@shared/domain/config';
import type { GitCommitFileRecord, GitCommitRecord } from '@shared/domain/git';

import { tRenderer } from '@renderer/app/i18n';
import { ProjectHomeContent } from '@renderer/features/project-home/ProjectHomeContent';
import type { FileTabState } from '@renderer/features/terminals/workspace-tabs';

import { FilePreviewPane } from './FilePreviewPane';
import { FileTree } from './FileTree';
import { GitDiffPreviewPane } from './GitDiffPreviewPane';
import { GitHistorySection } from './GitHistorySection';
import { TreeActionInput } from './TreeActionInput';
import { TreeContextMenu, type TreeContextMenuItem } from './TreeContextMenu';

const GIT_COMMITS_PAGE_SIZE = 24;
const HUB_RESIZE_HANDLE_SIZE = 10;
const MIN_HUB_SIDEBAR_WIDTH = 220;
const MAX_HUB_SIDEBAR_WIDTH = 520;
const MIN_HUB_MAIN_WIDTH = 320;
const MIN_HUB_GIT_SECTION_HEIGHT = 112;
const MIN_HUB_FILES_SECTION_HEIGHT = 180;

interface OpenFileOptions {
  pinned?: boolean;
}

interface SelectedGitDiffState {
  commit: GitCommitRecord;
  file: GitCommitFileRecord;
}

interface HubViewProps {
  projectBootstrap: ProjectBootstrapData;
  menuCommandEvent: {
    id: number;
    command: MenuCommand;
  } | null;
  iconTheme: AppIconTheme;
  claudeCodeProjectHomeData: ClaudeCodeProjectHomeData;
  codexProjectHomeData: CodexProjectHomeData;
  openCodeProjectHomeData: OpenCodeProjectHomeData;
  isProjectHomeLoading: boolean;
  claudeCodeProjectHomeLoadError: string | null;
  codexProjectHomeLoadError: string | null;
  openCodeProjectHomeLoadError: string | null;
  projectSkillsData: ProjectSkillsData;
  isProjectSkillsLoading: boolean;
  projectSkillsLoadError: string | null;
  activeFileTab: FileTabState | null;
  pinnedFilePaths: ReadonlySet<string>;
  hasProjectDraftFile: boolean;
  projectDraftRelativePath: string | null;
  isCreatingClaudeCode: boolean;
  isCreatingCodex: boolean;
  isCreatingOpenCode: boolean;
  isCreatingShell: boolean;
  resumingClaudeCodeSessionId: string | null;
  resumingCodexSessionId: string | null;
  resumingOpenCodeSessionId: string | null;
  onCreateClaudeCode: () => void;
  onCreateCodex: () => void;
  onCreateOpenCode: () => void;
  onCreateShell: () => void;
  onResumeClaudeCode: (sessionId: string) => void;
  onResumeCodex: (sessionId: string) => void;
  onResumeOpenCode: (sessionId: string) => void;
  onUpdateProjectConfig: (nextProjectConfig: ProjectConfig) => Promise<void>;
  onUpdateProjectUiState: (nextProjectUiState: ProjectUiState) => Promise<void>;
  onFocusHub: () => void;
  onOpenFile: (relativePath: string, options?: OpenFileOptions) => Promise<void>;
  onChangeFileDraft: (tabId: string, nextContent: string) => void;
  onSaveFile: (tabId: string) => void | Promise<void>;
  onPinFile: (relativePath: string) => void;
  onConfirmDeleteEntry: (relativePath: string) => boolean;
  onSyncFileTabsAfterRename: (previousPath: string, nextPath: string) => void;
  onSyncFileTabsAfterDelete: (deletedPath: string) => void;
}

type TreeContextTarget =
  | {
      kind: 'root';
      relativePath: '';
    }
  | {
      kind: WorkspaceEntryKind;
      relativePath: string;
    };

interface TreeContextMenuState {
  x: number;
  y: number;
  target: TreeContextTarget;
}

type ResizeHandleKind = 'sidebar' | 'git';

interface ResizeDragState {
  kind: ResizeHandleKind;
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startSidebarWidth: number;
  startGitSectionHeight: number;
}

type TreeActionDraft =
  | {
      mode: 'create';
      kind: WorkspaceEntryKind;
      parentRelativePath: string;
      value: string;
    }
  | {
      mode: 'rename';
      kind: WorkspaceEntryKind;
      relativePath: string;
      value: string;
    };

function addToPathSet(currentSet: ReadonlySet<string>, nextValue: string): Set<string> {
  const nextSet = new Set(currentSet);
  nextSet.add(nextValue);
  return nextSet;
}

function removeFromPathSet(currentSet: ReadonlySet<string>, value: string): Set<string> {
  const nextSet = new Set(currentSet);
  nextSet.delete(value);
  return nextSet;
}

function getParentRelativePath(relativePath: string): string {
  const segments = relativePath.split('/').filter(Boolean);

  if (segments.length <= 1) {
    return '';
  }

  return segments.slice(0, -1).join('/');
}

function getEntryName(relativePath: string): string {
  return relativePath.split('/').filter(Boolean).at(-1) ?? relativePath;
}

function getPathLabel(relativePath: string): string {
  return relativePath.length > 0 ? relativePath : tRenderer('hub.tree.projectRoot');
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

function getCreateParentRelativePath(target: TreeContextTarget): string {
  if (target.kind === 'root') {
    return '';
  }

  return target.kind === 'directory' ? target.relativePath : getParentRelativePath(target.relativePath);
}

function getDefaultEntryName(kind: WorkspaceEntryKind): string {
  return kind === 'directory' ? 'new-folder' : 'untitled.txt';
}

function remapExpandedDirectories(
  currentSet: ReadonlySet<string>,
  fromPath: string,
  toPath: string,
): Set<string> {
  const nextSet = new Set<string>();

  for (const relativePath of currentSet) {
    if (relativePath === '') {
      nextSet.add('');
      continue;
    }

    if (isSameOrDescendantPath(relativePath, fromPath)) {
      nextSet.add(remapRelativePath(relativePath, fromPath, toPath));
      continue;
    }

    nextSet.add(relativePath);
  }

  nextSet.add('');
  return nextSet;
}

function pruneExpandedDirectories(
  currentSet: ReadonlySet<string>,
  deletedPath: string,
): Set<string> {
  const nextSet = new Set<string>();

  for (const relativePath of currentSet) {
    if (relativePath === '') {
      nextSet.add('');
      continue;
    }

    if (!isSameOrDescendantPath(relativePath, deletedPath)) {
      nextSet.add(relativePath);
    }
  }

  nextSet.add('');
  return nextSet;
}

function clampValue(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function clampSidebarWidth(sidebarWidth: number, containerWidth: number): number {
  if (containerWidth <= 0) {
    return Math.round(sidebarWidth);
  }

  const maxWidth = Math.min(MAX_HUB_SIDEBAR_WIDTH, containerWidth - MIN_HUB_MAIN_WIDTH);

  return Math.round(clampValue(sidebarWidth, MIN_HUB_SIDEBAR_WIDTH, Math.max(MIN_HUB_SIDEBAR_WIDTH, maxWidth)));
}

function clampGitSectionHeight(gitSectionHeight: number, sidebarBodyHeight: number): number {
  if (sidebarBodyHeight <= 0) {
    return Math.round(gitSectionHeight);
  }

  const maxHeight = sidebarBodyHeight - MIN_HUB_FILES_SECTION_HEIGHT - HUB_RESIZE_HANDLE_SIZE;

  return Math.round(
    clampValue(
      gitSectionHeight,
      MIN_HUB_GIT_SECTION_HEIGHT,
      Math.max(MIN_HUB_GIT_SECTION_HEIGHT, maxHeight),
    ),
  );
}

function areProjectUiStatesEqual(left: ProjectUiState, right: ProjectUiState): boolean {
  return (
    left.version === right.version &&
    left.sidebarWidth === right.sidebarWidth &&
    left.gitSectionHeight === right.gitSectionHeight
  );
}

export function HubView({
  projectBootstrap,
  menuCommandEvent,
  iconTheme,
  claudeCodeProjectHomeData,
  codexProjectHomeData,
  openCodeProjectHomeData,
  isProjectHomeLoading,
  claudeCodeProjectHomeLoadError,
  codexProjectHomeLoadError,
  openCodeProjectHomeLoadError,
  projectSkillsData,
  isProjectSkillsLoading,
  projectSkillsLoadError,
  activeFileTab,
  pinnedFilePaths,
  hasProjectDraftFile,
  projectDraftRelativePath,
  isCreatingClaudeCode,
  isCreatingCodex,
  isCreatingOpenCode,
  isCreatingShell,
  resumingClaudeCodeSessionId,
  resumingCodexSessionId,
  resumingOpenCodeSessionId,
  onCreateClaudeCode,
  onCreateCodex,
  onCreateOpenCode,
  onCreateShell,
  onResumeClaudeCode,
  onResumeCodex,
  onResumeOpenCode,
  onUpdateProjectConfig,
  onUpdateProjectUiState,
  onFocusHub,
  onOpenFile,
  onChangeFileDraft,
  onSaveFile,
  onPinFile,
  onConfirmDeleteEntry,
  onSyncFileTabsAfterRename,
  onSyncFileTabsAfterDelete,
}: HubViewProps): ReactElement {
  const workspaceCapabilities = projectBootstrap.capabilities.workspace;
  const gitCapabilities = projectBootstrap.capabilities.git;
  const [layoutState, setLayoutState] = useState<ProjectUiState>(projectBootstrap.projectUiState);
  const [entriesByParent, setEntriesByParent] = useState<Record<string, WorkspaceTreeEntry[]>>({});
  const [expandedDirectories, setExpandedDirectories] = useState<Set<string>>(new Set(['']));
  const [loadingDirectories, setLoadingDirectories] = useState<Set<string>>(new Set(['']));
  const [treeError, setTreeError] = useState<string | null>(null);
  const [treeContextMenu, setTreeContextMenu] = useState<TreeContextMenuState | null>(null);
  const [treeActionDraft, setTreeActionDraft] = useState<TreeActionDraft | null>(null);
  const [treeActionError, setTreeActionError] = useState<string | null>(null);
  const [isApplyingTreeAction, setIsApplyingTreeAction] = useState(false);
  const [projectGitData, setProjectGitData] = useState<ProjectGitData | null>(null);
  const [isProjectGitLoading, setIsProjectGitLoading] = useState(true);
  const [projectGitLoadError, setProjectGitLoadError] = useState<string | null>(null);
  const [isProjectGitLoadingMore, setIsProjectGitLoadingMore] = useState(false);
  const [expandedGitCommitHash, setExpandedGitCommitHash] = useState<string | null>(null);
  const [gitCommitFilesByHash, setGitCommitFilesByHash] = useState<Record<string, GitCommitFileRecord[]>>({});
  const [gitCommitFilesLoadErrors, setGitCommitFilesLoadErrors] = useState<
    Record<string, string | undefined>
  >({});
  const [loadingGitCommitHashes, setLoadingGitCommitHashes] = useState<Set<string>>(new Set());
  const [selectedGitDiff, setSelectedGitDiff] = useState<SelectedGitDiffState | null>(null);
  const [projectGitDiffPreview, setProjectGitDiffPreview] = useState<ProjectGitDiffPreview | null>(
    null,
  );
  const [isProjectGitDiffLoading, setIsProjectGitDiffLoading] = useState(false);
  const [projectGitDiffLoadError, setProjectGitDiffLoadError] = useState<string | null>(null);
  const [isEditorWordWrapEnabled, setIsEditorWordWrapEnabled] = useState(false);
  const [editorMenuCommandEvent, setEditorMenuCommandEvent] = useState<{
    id: number;
    command: WorkspaceEditorMenuCommand;
  } | null>(null);
  const [activeResizeHandle, setActiveResizeHandle] = useState<ResizeHandleKind | null>(null);
  const [hubShellWidth, setHubShellWidth] = useState(0);
  const [sidebarBodyHeight, setSidebarBodyHeight] = useState(0);
  const projectGitRequestSequenceRef = useRef(0);
  const projectGitDiffRequestSequenceRef = useRef(0);
  const projectGitDataRef = useRef<ProjectGitData | null>(null);
  const hubShellRef = useRef<HTMLElement | null>(null);
  const sidebarBodyRef = useRef<HTMLDivElement | null>(null);
  const layoutStateRef = useRef(layoutState);
  const persistedProjectUiStateRef = useRef(projectBootstrap.projectUiState);
  const resizeDragStateRef = useRef<ResizeDragState | null>(null);
  const isLoadingRootDirectory = loadingDirectories.has('') && !entriesByParent[''];
  const rootEntries = entriesByParent[''] ?? [];
  const hasLoadedRootDirectory = Object.prototype.hasOwnProperty.call(entriesByParent, '');
  const selectedFilePath = activeFileTab?.relativePath ?? null;
  const activeContextPath =
    treeContextMenu?.target.kind === 'root' ? null : treeContextMenu?.target.relativePath ?? null;
  const isTextEditorActive = activeFileTab?.fileContent?.kind === 'text';
  const shouldShowRootTreeError = treeError !== null && !hasLoadedRootDirectory;
  const treeInlineError = treeError !== null && hasLoadedRootDirectory ? treeError : null;
  const effectiveSidebarWidth = clampSidebarWidth(layoutState.sidebarWidth, hubShellWidth);
  const effectiveGitSectionHeight = clampGitSectionHeight(
    layoutState.gitSectionHeight,
    sidebarBodyHeight,
  );

  useEffect(() => {
    if (!menuCommandEvent) {
      return;
    }

    if (
      menuCommandEvent.command === 'workspace.toggle-word-wrap' &&
      activeFileTab?.fileContent?.kind === 'text'
    ) {
      setIsEditorWordWrapEnabled((currentValue) => !currentValue);
      return;
    }

    if (
      isWorkspaceEditorMenuCommand(menuCommandEvent.command) &&
      activeFileTab?.fileContent?.kind === 'text'
    ) {
      setEditorMenuCommandEvent({
        id: menuCommandEvent.id,
        command: menuCommandEvent.command,
      });
    }
  }, [activeFileTab?.fileContent?.kind, menuCommandEvent]);

  useEffect(() => {
    projectGitDataRef.current = projectGitData;
  }, [projectGitData]);

  useEffect(() => {
    layoutStateRef.current = layoutState;
  }, [layoutState]);

  useEffect(() => {
    persistedProjectUiStateRef.current = projectBootstrap.projectUiState;
  }, [
    projectBootstrap.project.fingerprint,
    projectBootstrap.projectUiState.gitSectionHeight,
    projectBootstrap.projectUiState.sidebarWidth,
  ]);

  useEffect(() => {
    if (!areProjectUiStatesEqual(layoutStateRef.current, projectBootstrap.projectUiState)) {
      setLayoutState(projectBootstrap.projectUiState);
    }
  }, [
    projectBootstrap.project.fingerprint,
    projectBootstrap.projectUiState.gitSectionHeight,
    projectBootstrap.projectUiState.sidebarWidth,
  ]);

  useEffect(() => {
    setExpandedGitCommitHash(null);
    setGitCommitFilesByHash({});
    setGitCommitFilesLoadErrors({});
    setLoadingGitCommitHashes(new Set());
    setSelectedGitDiff(null);
    setProjectGitDiffPreview(null);
    setIsProjectGitDiffLoading(false);
    setProjectGitDiffLoadError(null);
  }, [projectBootstrap.project.fingerprint]);

  useEffect(() => {
    if (!projectDraftRelativePath || !hasProjectDraftFile) {
      return;
    }

    const parentRelativePath = getParentRelativePath(projectDraftRelativePath);
    const draftEntryName = getEntryName(projectDraftRelativePath);

    setEntriesByParent((currentEntriesByParent) => {
      const parentEntries = currentEntriesByParent[parentRelativePath];

      if (!parentEntries || parentEntries.some((entry) => entry.relativePath === projectDraftRelativePath)) {
        return currentEntriesByParent;
      }

      const nextParentEntries = [...parentEntries, {
        name: draftEntryName,
        relativePath: projectDraftRelativePath,
        kind: 'file',
      } satisfies WorkspaceTreeEntry].sort((left, right) => {
        if (left.kind !== right.kind) {
          return left.kind === 'directory' ? -1 : 1;
        }

        return left.name.localeCompare(right.name, undefined, {
          numeric: true,
          sensitivity: 'base',
        });
      });

      return {
        ...currentEntriesByParent,
        [parentRelativePath]: nextParentEntries,
      };
    });
  }, [hasProjectDraftFile, projectDraftRelativePath]);

  useEffect(() => {
    const hubShellElement = hubShellRef.current;
    const sidebarBodyElement = sidebarBodyRef.current;

    if (!hubShellElement && !sidebarBodyElement) {
      return;
    }

    const syncLayoutBounds = (): void => {
      setHubShellWidth(hubShellRef.current?.clientWidth ?? 0);
      setSidebarBodyHeight(sidebarBodyRef.current?.clientHeight ?? 0);
    };

    syncLayoutBounds();

    const resizeObserver = new ResizeObserver(() => {
      syncLayoutBounds();
    });

    if (hubShellElement) {
      resizeObserver.observe(hubShellElement);
    }

    if (sidebarBodyElement) {
      resizeObserver.observe(sidebarBodyElement);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, [gitCapabilities.enabled]);

  useEffect(() => {
    return () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadRootDirectory(): Promise<void> {
      try {
        setEntriesByParent({});
        setExpandedDirectories(new Set(['']));
        setTreeError(null);
        setTreeContextMenu(null);
        setTreeActionDraft(null);
        setTreeActionError(null);
        setLoadingDirectories(new Set(['']));
        const entries = await window.viboApp.listWorkspaceDirectory({
          relativePath: '',
        });

        if (!cancelled) {
          setEntriesByParent({
            '': entries,
          });
        }
      } catch (error) {
        if (!cancelled) {
          setTreeError(error instanceof Error ? error.message : tRenderer('hub.tree.readFailed'));
        }
      } finally {
        if (!cancelled) {
          setLoadingDirectories((currentSet) => removeFromPathSet(currentSet, ''));
        }
      }
    }

    void loadRootDirectory();

    return () => {
      cancelled = true;
    };
  }, [projectBootstrap.project.fingerprint]);

  useEffect(() => {
    if (!gitCapabilities.enabled) {
      setProjectGitData(null);
      setIsProjectGitLoading(false);
      setProjectGitLoadError(null);
      return;
    }

    void loadProjectGitData();
  }, [gitCapabilities.enabled, projectBootstrap.project.fingerprint]);

  useEffect(() => {
    if (!treeContextMenu) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        setTreeContextMenu(null);
      }
    }

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [treeContextMenu]);

  function setResizeCursor(kind: ResizeHandleKind | null): void {
    document.body.style.cursor = kind === 'sidebar' ? 'col-resize' : kind === 'git' ? 'row-resize' : '';
    document.body.style.userSelect = kind ? 'none' : '';
  }

  function persistProjectUiStateIfNeeded(nextProjectUiState: ProjectUiState): void {
    if (areProjectUiStatesEqual(nextProjectUiState, persistedProjectUiStateRef.current)) {
      return;
    }

    void onUpdateProjectUiState(nextProjectUiState).catch(() => {});
  }

  function finishResizeDrag(kind: ResizeHandleKind, pointerId: number): void {
    const dragState = resizeDragStateRef.current;

    if (!dragState || dragState.kind !== kind || dragState.pointerId !== pointerId) {
      return;
    }

    resizeDragStateRef.current = null;
    setActiveResizeHandle(null);
    setResizeCursor(null);
    persistProjectUiStateIfNeeded(layoutStateRef.current);
  }

  function handleSidebarResizePointerDown(event: ReactPointerEvent<HTMLDivElement>): void {
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    resizeDragStateRef.current = {
      kind: 'sidebar',
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startSidebarWidth: effectiveSidebarWidth,
      startGitSectionHeight: effectiveGitSectionHeight,
    };
    setActiveResizeHandle('sidebar');
    setResizeCursor('sidebar');
  }

  function handleSidebarResizePointerMove(event: ReactPointerEvent<HTMLDivElement>): void {
    const dragState = resizeDragStateRef.current;

    if (!dragState || dragState.kind !== 'sidebar' || dragState.pointerId !== event.pointerId) {
      return;
    }

    const deltaX = event.clientX - dragState.startClientX;
    const nextSidebarWidth = clampSidebarWidth(dragState.startSidebarWidth + deltaX, hubShellWidth);

    setLayoutState((currentState) =>
      currentState.sidebarWidth === nextSidebarWidth
        ? currentState
        : {
            ...currentState,
            sidebarWidth: nextSidebarWidth,
          },
    );
  }

  function handleGitResizePointerDown(event: ReactPointerEvent<HTMLDivElement>): void {
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    resizeDragStateRef.current = {
      kind: 'git',
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startSidebarWidth: effectiveSidebarWidth,
      startGitSectionHeight: effectiveGitSectionHeight,
    };
    setActiveResizeHandle('git');
    setResizeCursor('git');
  }

  function handleGitResizePointerMove(event: ReactPointerEvent<HTMLDivElement>): void {
    const dragState = resizeDragStateRef.current;

    if (!dragState || dragState.kind !== 'git' || dragState.pointerId !== event.pointerId) {
      return;
    }

    const deltaY = dragState.startClientY - event.clientY;
    const nextGitSectionHeight = clampGitSectionHeight(
      dragState.startGitSectionHeight + deltaY,
      sidebarBodyHeight,
    );

    setLayoutState((currentState) =>
      currentState.gitSectionHeight === nextGitSectionHeight
        ? currentState
        : {
            ...currentState,
            gitSectionHeight: nextGitSectionHeight,
          },
    );
  }

  async function loadDirectory(relativePath: string, force = false): Promise<WorkspaceTreeEntry[]> {
    if (!force && entriesByParent[relativePath]) {
      return entriesByParent[relativePath];
    }

    setTreeError(null);
    setLoadingDirectories((currentSet) => addToPathSet(currentSet, relativePath));

    try {
      const entries = await window.viboApp.listWorkspaceDirectory({
        relativePath,
      });

      setEntriesByParent((currentEntries) => ({
        ...currentEntries,
        [relativePath]: entries,
      }));

      return entries;
    } catch (error) {
      setTreeError(error instanceof Error ? error.message : tRenderer('hub.tree.readDirectoryFailed'));
      throw error;
    } finally {
      setLoadingDirectories((currentSet) => removeFromPathSet(currentSet, relativePath));
    }
  }

  async function loadProjectGitData(options?: {
    append?: boolean;
  }): Promise<void> {
    if (!gitCapabilities.enabled) {
      return;
    }

    const append = options?.append === true;
    const currentProjectGitData = projectGitDataRef.current;
    const offset = append ? currentProjectGitData?.commits.length ?? 0 : 0;
    const requestSequence = projectGitRequestSequenceRef.current + 1;
    projectGitRequestSequenceRef.current = requestSequence;

    if (append) {
      setIsProjectGitLoadingMore(true);
    } else {
      setIsProjectGitLoading(true);
      setProjectGitLoadError(null);
    }

    try {
      const nextProjectGitData = await window.viboApp.getProjectGitData({
        offset,
        limit: GIT_COMMITS_PAGE_SIZE,
      });

      if (projectGitRequestSequenceRef.current !== requestSequence) {
        return;
      }

      setProjectGitLoadError(null);
      setProjectGitData((currentData) => {
        if (!append || !currentData || currentData.state !== 'ready' || nextProjectGitData.state !== 'ready') {
          return nextProjectGitData;
        }

        return {
          ...nextProjectGitData,
          commits: [...currentData.commits, ...nextProjectGitData.commits],
        };
      });
    } catch (error) {
      if (projectGitRequestSequenceRef.current !== requestSequence) {
        return;
      }

      if (!append || currentProjectGitData === null) {
        setProjectGitData(null);
        setProjectGitLoadError(error instanceof Error ? error.message : tRenderer('hub.git.readHistoryFailed'));
      }
    } finally {
      if (projectGitRequestSequenceRef.current !== requestSequence) {
        return;
      }

      if (append) {
        setIsProjectGitLoadingMore(false);
      } else {
        setIsProjectGitLoading(false);
      }
    }
  }

  function handleLoadMoreProjectGitData(): void {
    if (isProjectGitLoading || isProjectGitLoadingMore) {
      return;
    }

    if (projectGitData?.state !== 'ready' || !projectGitData.hasMore) {
      return;
    }

    void loadProjectGitData({
      append: true,
    });
  }

  async function handleToggleGitCommit(commit: GitCommitRecord): Promise<void> {
    if (expandedGitCommitHash === commit.hash) {
      setExpandedGitCommitHash(null);

      if (selectedGitDiff?.commit.hash === commit.hash) {
        setSelectedGitDiff(null);
        setProjectGitDiffPreview(null);
        setProjectGitDiffLoadError(null);
        setIsProjectGitDiffLoading(false);
      }

      return;
    }

    setExpandedGitCommitHash(commit.hash);

    if (gitCommitFilesByHash[commit.hash] || loadingGitCommitHashes.has(commit.hash)) {
      return;
    }

    setLoadingGitCommitHashes((currentHashes) => addToPathSet(currentHashes, commit.hash));
    setGitCommitFilesLoadErrors((currentErrors) => ({
      ...currentErrors,
      [commit.hash]: undefined,
    }));

    try {
      const commitFilesData = await window.viboApp.getProjectGitCommitFiles({
        commitHash: commit.hash,
      });

      setGitCommitFilesByHash((currentFilesByHash) => ({
        ...currentFilesByHash,
        [commit.hash]: commitFilesData.files,
      }));
    } catch (error) {
      setGitCommitFilesLoadErrors((currentErrors) => ({
        ...currentErrors,
        [commit.hash]:
          error instanceof Error ? error.message : tRenderer('hub.git.readCommitFilesFailed'),
      }));
    } finally {
      setLoadingGitCommitHashes((currentHashes) => removeFromPathSet(currentHashes, commit.hash));
    }
  }

  async function handleSelectGitDiff(
    commit: GitCommitRecord,
    file: GitCommitFileRecord,
  ): Promise<void> {
    onFocusHub();
    const requestSequence = projectGitDiffRequestSequenceRef.current + 1;
    projectGitDiffRequestSequenceRef.current = requestSequence;
    setSelectedGitDiff({
      commit,
      file,
    });
    setProjectGitDiffPreview(null);
    setProjectGitDiffLoadError(null);
    setIsProjectGitDiffLoading(true);

    try {
      const diffPreview = await window.viboApp.getProjectGitFileDiff({
        commitHash: commit.hash,
        filePath: file.path,
        previousPath: file.previousPath,
        status: file.status,
      });

      if (projectGitDiffRequestSequenceRef.current !== requestSequence) {
        return;
      }

      setProjectGitDiffPreview(diffPreview);
    } catch (error) {
      if (projectGitDiffRequestSequenceRef.current !== requestSequence) {
        return;
      }

      setProjectGitDiffLoadError(
        error instanceof Error ? error.message : tRenderer('hub.git.readDiffFailed'),
      );
    } finally {
      if (projectGitDiffRequestSequenceRef.current !== requestSequence) {
        return;
      }

      setIsProjectGitDiffLoading(false);
    }
  }

  function handleCloseGitDiffPreview(): void {
    projectGitDiffRequestSequenceRef.current += 1;
    setSelectedGitDiff(null);
    setProjectGitDiffPreview(null);
    setProjectGitDiffLoadError(null);
    setIsProjectGitDiffLoading(false);
  }

  async function reloadExpandedDirectories(nextExpandedDirectories: ReadonlySet<string>): Promise<void> {
    const normalizedExpandedDirectories = new Set(nextExpandedDirectories);
    normalizedExpandedDirectories.add('');
    setExpandedDirectories(normalizedExpandedDirectories);
    setTreeError(null);
    setLoadingDirectories(new Set(normalizedExpandedDirectories));

    try {
      const nextEntries: Record<string, WorkspaceTreeEntry[]> = {};
      const sortedPaths = Array.from(normalizedExpandedDirectories).sort(
        (left, right) => left.split('/').length - right.split('/').length,
      );

      for (const relativePath of sortedPaths) {
        try {
          nextEntries[relativePath] = await window.viboApp.listWorkspaceDirectory({
            relativePath,
          });
        } catch (error) {
          if (relativePath === '') {
            throw error;
          }
        }
      }

      setEntriesByParent(nextEntries);
    } catch (error) {
      setTreeError(error instanceof Error ? error.message : tRenderer('hub.tree.refreshFailed'));
    } finally {
      setLoadingDirectories(new Set());
    }
  }

  async function handleToggleDirectory(relativePath: string): Promise<void> {
    setTreeContextMenu(null);

    if (expandedDirectories.has(relativePath)) {
      setExpandedDirectories((currentSet) => removeFromPathSet(currentSet, relativePath));
      return;
    }

    setExpandedDirectories((currentSet) => addToPathSet(currentSet, relativePath));
    await loadDirectory(relativePath);
  }

  async function handleSelectFile(relativePath: string): Promise<void> {
    setTreeContextMenu(null);
    await onOpenFile(relativePath);
  }

  function handleOpenTreeContextMenu(
    relativePath: string,
    kind: WorkspaceEntryKind,
    x: number,
    y: number,
  ): void {
    setTreeActionDraft(null);
    setTreeActionError(null);
    setTreeContextMenu({
      x,
      y,
      target: {
        kind,
        relativePath,
      },
    });
  }

  function handleOpenRootContextMenu(x: number, y: number): void {
    setTreeActionDraft(null);
    setTreeActionError(null);
    setTreeContextMenu({
      x,
      y,
      target: {
        kind: 'root',
        relativePath: '',
      },
    });
  }

  function handleStartCreate(kind: WorkspaceEntryKind, target: TreeContextTarget): void {
    setTreeContextMenu(null);
    setTreeActionError(null);
    setTreeActionDraft({
      mode: 'create',
      kind,
      parentRelativePath: getCreateParentRelativePath(target),
      value: getDefaultEntryName(kind),
    });
  }

  function handleStartRename(target: Exclude<TreeContextTarget, { kind: 'root' }>): void {
    setTreeContextMenu(null);
    setTreeActionError(null);
    setTreeActionDraft({
      mode: 'rename',
      kind: target.kind,
      relativePath: target.relativePath,
      value: getEntryName(target.relativePath),
    });
  }

  function closeTreeActionDraft(): void {
    setTreeActionDraft(null);
    setTreeActionError(null);
  }

  async function handleSubmitTreeAction(): Promise<void> {
    if (!treeActionDraft) {
      return;
    }

    try {
      setIsApplyingTreeAction(true);
      setTreeActionError(null);

      if (treeActionDraft.mode === 'create') {
        const createdEntry = await window.viboApp.createWorkspaceEntry({
          parentRelativePath: treeActionDraft.parentRelativePath,
          name: treeActionDraft.value,
          kind: treeActionDraft.kind,
        });
        const nextExpandedDirectories = addToPathSet(
          expandedDirectories,
          treeActionDraft.parentRelativePath,
        );

        closeTreeActionDraft();
        await reloadExpandedDirectories(nextExpandedDirectories);

        if (createdEntry.kind === 'file') {
          await onOpenFile(createdEntry.relativePath);
        }

        return;
      }

      const renamedEntry = await window.viboApp.renameWorkspaceEntry({
        relativePath: treeActionDraft.relativePath,
        nextName: treeActionDraft.value,
      });

      onSyncFileTabsAfterRename(treeActionDraft.relativePath, renamedEntry.relativePath);
      closeTreeActionDraft();
      await reloadExpandedDirectories(
        remapExpandedDirectories(
          expandedDirectories,
          treeActionDraft.relativePath,
          renamedEntry.relativePath,
        ),
      );
    } catch (error) {
      setTreeActionError(error instanceof Error ? error.message : tRenderer('hub.tree.actionFailed'));
    } finally {
      setIsApplyingTreeAction(false);
    }
  }

  async function handleDeleteEntry(relativePath: string): Promise<void> {
    setTreeContextMenu(null);
    setTreeActionDraft(null);
    setTreeActionError(null);

    if (!onConfirmDeleteEntry(relativePath)) {
      return;
    }

    try {
      await window.viboApp.deleteWorkspaceEntry({
        relativePath,
      });

      onSyncFileTabsAfterDelete(relativePath);
      await reloadExpandedDirectories(pruneExpandedDirectories(expandedDirectories, relativePath));
    } catch (error) {
      window.alert(error instanceof Error ? error.message : tRenderer('hub.tree.deleteFailed'));
    }
  }

  async function handleRevealEntry(relativePath: string): Promise<void> {
    setTreeContextMenu(null);

    try {
      await window.viboApp.revealWorkspaceEntry({
        relativePath,
      });
    } catch (error) {
      window.alert(error instanceof Error ? error.message : tRenderer('hub.tree.revealFailed'));
    }
  }

  const treeContextMenuItems = useMemo<TreeContextMenuItem[]>(() => {
    if (!treeContextMenu) {
      return [];
    }

    const isProjectDraftTarget =
      treeContextMenu.target.kind === 'file' &&
      projectDraftRelativePath !== null &&
      treeContextMenu.target.relativePath === projectDraftRelativePath;

    const createItems: TreeContextMenuItem[] = [
      {
        key: 'new-file',
        label: tRenderer('common.actions.newFile'),
      },
      {
        key: 'new-folder',
        label: tRenderer('common.actions.newFolder'),
      },
    ];

    if (treeContextMenu.target.kind === 'root') {
      return [
        ...createItems,
        ...(workspaceCapabilities.canRevealInSystemShell
          ? [
              {
                key: 'reveal',
                label: tRenderer('common.actions.revealInFinder'),
              } satisfies TreeContextMenuItem,
            ]
          : []),
      ];
    }

    return [
      ...createItems,
      ...(treeContextMenu.target.kind === 'file' &&
      !isProjectDraftTarget &&
      !pinnedFilePaths.has(treeContextMenu.target.relativePath)
        ? [
            {
              key: 'pin',
              label: tRenderer('common.actions.pin'),
            } satisfies TreeContextMenuItem,
          ]
        : []),
      ...(!isProjectDraftTarget
        ? [
            {
              key: 'rename',
              label: tRenderer('common.actions.rename'),
            } satisfies TreeContextMenuItem,
            {
              key: 'delete',
              label:
                workspaceCapabilities.deleteMode === 'permanent'
                  ? tRenderer('common.actions.deletePermanently')
                  : tRenderer('common.actions.delete'),
              danger: true,
            } satisfies TreeContextMenuItem,
          ]
        : []),
      ...(workspaceCapabilities.canRevealInSystemShell
        ? [
            {
              key: 'reveal',
              label: tRenderer('common.actions.revealInFinder'),
            } satisfies TreeContextMenuItem,
          ]
        : []),
    ];
  }, [
    pinnedFilePaths,
    projectDraftRelativePath,
    treeContextMenu,
    workspaceCapabilities.canRevealInSystemShell,
    workspaceCapabilities.deleteMode,
  ]);

  function handleTreeContextMenuSelect(actionKey: string): void {
    if (!treeContextMenu) {
      return;
    }

    switch (actionKey) {
      case 'new-file':
        handleStartCreate('file', treeContextMenu.target);
        break;
      case 'new-folder':
        handleStartCreate('directory', treeContextMenu.target);
        break;
      case 'pin':
        if (treeContextMenu.target.kind === 'file') {
          setTreeContextMenu(null);
          onPinFile(treeContextMenu.target.relativePath);
        }
        break;
      case 'rename':
        if (treeContextMenu.target.kind !== 'root') {
          handleStartRename(treeContextMenu.target);
        }
        break;
      case 'delete':
        if (treeContextMenu.target.kind !== 'root') {
          void handleDeleteEntry(treeContextMenu.target.relativePath);
        }
        break;
      case 'reveal':
        void handleRevealEntry(treeContextMenu.target.relativePath);
        break;
      default:
        setTreeContextMenu(null);
        break;
    }
  }

  const treeActionTitle =
    treeActionDraft?.mode === 'create'
      ? treeActionDraft.kind === 'directory'
        ? tRenderer('common.actions.newFolder')
        : tRenderer('common.actions.newFile')
      : treeActionDraft
        ? tRenderer('common.actions.rename')
        : '';

  const treeActionScopeLabel =
    treeActionDraft?.mode === 'create'
      ? tRenderer('hub.tree.action.newFileScope', {
          path: getPathLabel(treeActionDraft.parentRelativePath),
        })
      : treeActionDraft
        ? tRenderer('hub.tree.action.renameScope', {
            path: getPathLabel(treeActionDraft.relativePath),
          })
        : '';

  const treeActionSubmitLabel =
    treeActionDraft?.mode === 'create'
      ? tRenderer('common.actions.create')
      : treeActionDraft
        ? tRenderer('common.actions.rename')
        : '';
  const rootTreeState = shouldShowRootTreeError
    ? {
        tone: 'error' as const,
        title: tRenderer('hub.tree.readProjectFilesFailedTitle'),
        detail: treeError ?? tRenderer('hub.tree.readProjectFilesFailedDetail'),
      }
    : isLoadingRootDirectory
      ? {
          tone: 'muted' as const,
          title: tRenderer('hub.tree.loadingTitle'),
          detail: tRenderer('hub.tree.loadingDetail'),
        }
      : hasLoadedRootDirectory && rootEntries.length === 0
        ? {
            tone: 'muted' as const,
            title: tRenderer('hub.tree.emptyTitle'),
            detail: tRenderer('hub.tree.emptyDetail'),
          }
        : null;
  const hubShellStyle = {
    gridTemplateColumns: `${effectiveSidebarWidth}px ${HUB_RESIZE_HANDLE_SIZE}px minmax(0, 1fr)`,
  };
  const hubSidebarBodyStyle = gitCapabilities.enabled
    ? {
        gridTemplateRows: `minmax(${MIN_HUB_FILES_SECTION_HEIGHT}px, 1fr) ${HUB_RESIZE_HANDLE_SIZE}px ${effectiveGitSectionHeight}px`,
      }
    : undefined;

  return (
    <section
      className={`hub-shell ${isTextEditorActive ? 'hub-shell-editor-active' : ''}`}
      ref={hubShellRef}
      style={hubShellStyle}
    >
      <aside className="hub-sidebar">
        <div className="hub-sidebar-body" ref={sidebarBodyRef} style={hubSidebarBodyStyle}>
          <section className="hub-files-section">
            <header className="hub-sidebar-header">
              <div className="hub-sidebar-header-main">
                <p className="sidebar-section-title">{tRenderer('hub.files')}</p>
              </div>
            </header>

            {treeActionDraft ? (
              <TreeActionInput
                title={treeActionTitle}
                scopeLabel={treeActionScopeLabel}
                submitLabel={treeActionSubmitLabel}
                value={treeActionDraft.value}
                error={treeActionError}
                isSubmitting={isApplyingTreeAction}
                onChange={(nextValue) => {
                  setTreeActionError(null);
                  setTreeActionDraft((currentDraft) =>
                    currentDraft
                      ? {
                          ...currentDraft,
                          value: nextValue,
                        }
                      : currentDraft,
                  );
                }}
                onSubmit={() => {
                  void handleSubmitTreeAction();
                }}
                onCancel={closeTreeActionDraft}
              />
            ) : null}

            <div
              className="hub-files-body"
              onContextMenu={(event) => {
                event.preventDefault();
                handleOpenRootContextMenu(event.clientX, event.clientY);
              }}
            >
              {rootTreeState ? (
                <div
                  className={`hub-tree-state ${rootTreeState.tone === 'error' ? 'hub-tree-state-error' : ''}`}
                >
                  <p className="hub-tree-state-title">{rootTreeState.title}</p>
                  <p className="hub-tree-state-copy">{rootTreeState.detail}</p>
                </div>
              ) : (
                <>
                  {treeInlineError ? (
                    <p className="hub-tree-inline-note">{treeInlineError}</p>
                  ) : null}

                  <FileTree
                    entriesByParent={entriesByParent}
                    expandedDirectories={expandedDirectories}
                    loadingDirectories={loadingDirectories}
                    iconTheme={iconTheme}
                    activeContextPath={activeContextPath}
                    selectedFilePath={selectedFilePath}
                    onToggleDirectory={(relativePath) => {
                      void handleToggleDirectory(relativePath);
                    }}
                    onSelectFile={(relativePath) => {
                      void handleSelectFile(relativePath);
                    }}
                    onPinFile={onPinFile}
                    onOpenContextMenu={handleOpenTreeContextMenu}
                  />
                </>
              )}
            </div>
          </section>

          {gitCapabilities.enabled ? (
            <>
              <div
                className={`hub-panel-resize-handle hub-panel-resize-handle-horizontal ${activeResizeHandle === 'git' ? 'hub-panel-resize-handle-active' : ''}`}
                role="separator"
                aria-orientation="horizontal"
                aria-label={tRenderer('hub.resizeGitPanel')}
                onPointerDown={handleGitResizePointerDown}
                onPointerMove={handleGitResizePointerMove}
                onPointerUp={(event) => {
                  finishResizeDrag('git', event.pointerId);
                }}
                onPointerCancel={(event) => {
                  finishResizeDrag('git', event.pointerId);
                }}
              />
              <GitHistorySection
                data={projectGitData}
                isLoading={isProjectGitLoading}
                isLoadingMore={isProjectGitLoadingMore}
                loadError={projectGitLoadError}
                expandedCommitHash={expandedGitCommitHash}
                commitFilesByHash={gitCommitFilesByHash}
                commitFilesLoadErrors={gitCommitFilesLoadErrors}
                loadingCommitHashes={loadingGitCommitHashes}
                selectedDiffKey={selectedGitDiff ? `${selectedGitDiff.commit.hash}:${selectedGitDiff.file.path}` : null}
                onToggleCommit={(commit) => {
                  void handleToggleGitCommit(commit);
                }}
                onSelectFile={(commit, file) => {
                  void handleSelectGitDiff(commit, file);
                }}
                onLoadMore={handleLoadMoreProjectGitData}
              />
            </>
          ) : null}
        </div>
      </aside>

      <div
        className={`hub-panel-resize-handle hub-panel-resize-handle-vertical ${activeResizeHandle === 'sidebar' ? 'hub-panel-resize-handle-active' : ''}`}
        role="separator"
        aria-orientation="vertical"
        aria-label={tRenderer('hub.resizeSidebar')}
        onPointerDown={handleSidebarResizePointerDown}
        onPointerMove={handleSidebarResizePointerMove}
        onPointerUp={(event) => {
          finishResizeDrag('sidebar', event.pointerId);
        }}
        onPointerCancel={(event) => {
          finishResizeDrag('sidebar', event.pointerId);
        }}
      />

      <section className={`hub-main ${isTextEditorActive ? 'hub-main-editor' : ''}`}>
        {activeFileTab ? (
          <FilePreviewPane
            filePath={activeFileTab.relativePath}
            menuCommandEvent={editorMenuCommandEvent}
            fileContent={activeFileTab.fileContent}
            draftContent={activeFileTab.draftContent}
            isWordWrapEnabled={isEditorWordWrapEnabled}
            isLoading={activeFileTab.isLoading}
            isSaving={activeFileTab.isSaving}
            saveError={activeFileTab.saveError}
            onChange={(nextContent) => {
              onChangeFileDraft(activeFileTab.id, nextContent);
            }}
            onSave={() => onSaveFile(activeFileTab.id)}
            onToggleWordWrap={() => {
              setIsEditorWordWrapEnabled((currentValue) => !currentValue);
            }}
          />
        ) : selectedGitDiff ? (
          <GitDiffPreviewPane
            commit={selectedGitDiff.commit}
            file={selectedGitDiff.file}
            diffPreview={projectGitDiffPreview}
            isLoading={isProjectGitDiffLoading}
            loadError={projectGitDiffLoadError}
            onClose={handleCloseGitDiffPreview}
          />
        ) : (
          <ProjectHomeContent
            claudeCodeProjectHomeData={claudeCodeProjectHomeData}
            codexProjectHomeData={codexProjectHomeData}
            openCodeProjectHomeData={openCodeProjectHomeData}
            isProjectHomeLoading={isProjectHomeLoading}
            claudeCodeProjectHomeLoadError={claudeCodeProjectHomeLoadError}
            codexProjectHomeLoadError={codexProjectHomeLoadError}
            openCodeProjectHomeLoadError={openCodeProjectHomeLoadError}
            appConfig={projectBootstrap.appConfig}
            projectConfig={projectBootstrap.projectConfig}
            projectSkillsData={projectSkillsData}
            globalDefaultAgent={projectBootstrap.appConfig.defaultAgent}
            isProjectSkillsLoading={isProjectSkillsLoading}
            projectSkillsLoadError={projectSkillsLoadError}
            isCreatingClaudeCode={isCreatingClaudeCode}
            isCreatingCodex={isCreatingCodex}
            isCreatingOpenCode={isCreatingOpenCode}
            isCreatingShell={isCreatingShell}
            resumingClaudeCodeSessionId={resumingClaudeCodeSessionId}
            resumingCodexSessionId={resumingCodexSessionId}
            resumingOpenCodeSessionId={resumingOpenCodeSessionId}
            onCreateClaudeCode={onCreateClaudeCode}
            onCreateCodex={onCreateCodex}
            onCreateOpenCode={onCreateOpenCode}
            onCreateShell={onCreateShell}
            onResumeClaudeCode={onResumeClaudeCode}
            onResumeCodex={onResumeCodex}
            onResumeOpenCode={onResumeOpenCode}
            onUpdateProjectConfig={onUpdateProjectConfig}
          />
        )}
      </section>

      {treeContextMenu ? (
        <TreeContextMenu
          x={treeContextMenu.x}
          y={treeContextMenu.y}
          items={treeContextMenuItems}
          onSelect={handleTreeContextMenuSelect}
          onClose={() => {
            setTreeContextMenu(null);
          }}
        />
      ) : null}
    </section>
  );
}
