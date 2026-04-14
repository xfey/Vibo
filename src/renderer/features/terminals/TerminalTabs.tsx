import type { FocusEvent, ReactElement, WheelEvent } from 'react';
import { useRef, useState } from 'react';

import type { AgentId } from '@shared/domain/agent';
import type { AppIconTheme } from '@shared/domain/config';
import { isAgentTerminalKind } from '@shared/domain/terminal';

import { tRenderer } from '@renderer/app/i18n';
import { AgentBrandIcon } from '@renderer/icons/agent-branding';
import { DraftNoteIcon } from '@renderer/icons/draft-note';
import { FileEntryIcon } from '@renderer/icons/file-icons';

import type { WorkspaceTabDescriptor } from './workspace-tabs';

interface TerminalTabsProps {
  tabs: WorkspaceTabDescriptor[];
  windowTitle: string;
  iconTheme: AppIconTheme;
  areShortcutHintsVisible: boolean;
  tabShortcutLabels: Record<string, string>;
  createSessionShortcutLabel: string;
  onSelectTab: (tabId: string) => void;
  onCloseTab: (tabId: string) => void;
  onRenameTerminalTab: (tabId: string) => void;
  onPinFileTab: (tabId: string) => void;
  primaryAgent: AgentId;
  onCreatePrimarySession: () => void;
  onCreateCodexSession: () => void;
  onCreateClaudeCodeSession: () => void;
  onCreateOpenCodeSession: () => void;
  onCreateShellSession: () => void;
  isCreatingSession: boolean;
}

const MAX_FILE_TAB_LABEL_LENGTH = 32;

function getTerminalDisplayState(tab: WorkspaceTabDescriptor): {
  label: string;
  tone: string;
} {
  switch (tab.status) {
    case 'idle':
      return {
        label: tRenderer('terminal.status.idle'),
        tone: 'idle',
      };
    case 'starting':
      return {
        label: tRenderer('terminal.status.starting'),
        tone: 'starting',
      };
    case 'failed':
      return {
        label: tRenderer('terminal.status.failed'),
        tone: 'failed',
      };
    case 'exited':
      return {
        label: tRenderer('terminal.status.exited'),
        tone: 'exited',
      };
    default:
      break;
  }

  if (tab.sessionKind && isAgentTerminalKind(tab.sessionKind)) {
    if (tab.agentActivity === 'working') {
      return {
        label: tRenderer('terminal.status.working'),
        tone: 'working',
      };
    }

    if (tab.agentActivity === 'waiting_input') {
      return {
        label: tRenderer('terminal.status.waiting'),
        tone: 'waiting',
      };
    }
  }

  return {
    label: tRenderer('terminal.status.running'),
    tone: 'running',
  };
}

function renderStatusLabel(tab: WorkspaceTabDescriptor): string {
  if (tab.kind !== 'terminal') {
    return '';
  }

  return getTerminalDisplayState(tab).label;
}

function getDisplayedTabLabel(tab: WorkspaceTabDescriptor): string {
  if (tab.kind !== 'file' || tab.label.length <= MAX_FILE_TAB_LABEL_LENGTH) {
    return tab.label;
  }

  return `${tab.label.slice(0, 16)}...${tab.label.slice(-16)}`;
}

function renderTabChip(
  tab: WorkspaceTabDescriptor,
  iconTheme: AppIconTheme,
  areShortcutHintsVisible: boolean,
  tabShortcutLabels: Record<string, string>,
  onSelectTab: (tabId: string) => void,
  onCloseTab: (tabId: string) => void,
  onRenameTerminalTab: (tabId: string) => void,
  onPinFileTab: (tabId: string) => void,
): ReactElement {
  const displayedLabel = getDisplayedTabLabel(tab);
  const accessibleLabel = tab.title ?? tab.label;
  const terminalDisplayState = tab.kind === 'terminal' ? getTerminalDisplayState(tab) : null;

  return (
    <div
      key={tab.id}
      className={[
        'tab-chip',
        tab.kind === 'terminal' ? 'tab-chip-session' : '',
        tab.kind === 'terminal' &&
        terminalDisplayState?.tone === 'waiting' &&
        tab.needsAttention
          ? `tab-chip-session-${terminalDisplayState.tone}`
          : '',
        tab.kind === 'file' ? 'tab-chip-file' : '',
        tab.isPreview ? 'tab-chip-preview' : '',
        tab.isActive ? 'tab-chip-active' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      onClick={() => onSelectTab(tab.id)}
      onDoubleClick={() => {
        if (tab.kind === 'terminal') {
          onRenameTerminalTab(tab.id);
          return;
        }

        if (tab.kind === 'file' && tab.isPreview) {
          onPinFileTab(tab.id);
        }
      }}
      role="button"
      tabIndex={0}
      title={
        tab.kind === 'terminal' && terminalDisplayState
          ? `${accessibleLabel} · ${terminalDisplayState.label}`
          : accessibleLabel
      }
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelectTab(tab.id);
        }
      }}
    >
      {areShortcutHintsVisible && tabShortcutLabels[tab.id] ? (
        <span className="tab-shortcut-overlay" aria-hidden="true">
          <span className="tab-shortcut-badge">{tabShortcutLabels[tab.id]}</span>
        </span>
      ) : null}

      {tab.kind === 'terminal' && tab.sessionKind ? (
        <AgentBrandIcon
          agentId={tab.sessionKind}
          size="sm"
          className="tab-leading-icon tab-leading-icon-agent"
        />
      ) : tab.kind === 'file' && tab.filePath ? (
        <FileEntryIcon
          entryKind="file"
          entryName={tab.filePath.split('/').filter(Boolean).at(-1) ?? tab.label}
          iconTheme={iconTheme}
          size="sm"
          className="tab-leading-icon tab-leading-icon-file"
        />
      ) : tab.kind === 'hub' ? (
        <span className="tab-hub-icon" aria-hidden="true" />
      ) : null}

      <span className="tab-label">{displayedLabel}</span>

      {tab.kind === 'terminal' ? (
        <span
          className={`status-dot status-${terminalDisplayState?.tone ?? 'idle'}`}
          aria-hidden="true"
        />
      ) : null}

      {tab.kind === 'terminal' && terminalDisplayState && tab.isActive ? (
        <span className="tab-caption">{renderStatusLabel(tab)}</span>
      ) : null}

      {tab.kind === 'file' && tab.isDirty ? (
        <span className="tab-file-dirty-indicator" aria-hidden="true" />
      ) : null}

      {tab.isClosable ? (
        <button
          className="tab-close-button"
          onClick={(event) => {
            event.stopPropagation();
            onCloseTab(tab.id);
          }}
          aria-label={tRenderer('terminal.closeTab', {
            label: accessibleLabel,
          })}
        >
          ×
        </button>
      ) : null}
    </div>
  );
}

export function TerminalTabs({
  tabs,
  windowTitle,
  iconTheme,
  areShortcutHintsVisible,
  tabShortcutLabels,
  createSessionShortcutLabel,
  onSelectTab,
  onCloseTab,
  onRenameTerminalTab,
  onPinFileTab,
  primaryAgent,
  onCreatePrimarySession,
  onCreateCodexSession,
  onCreateClaudeCodeSession,
  onCreateOpenCodeSession,
  onCreateShellSession,
  isCreatingSession,
}: TerminalTabsProps): ReactElement {
  const tabsListRef = useRef<HTMLDivElement | null>(null);
  const createMenuRef = useRef<HTMLDivElement | null>(null);
  const [isCreateMenuExpanded, setIsCreateMenuExpanded] = useState(false);
  const hubTab = tabs.find((tab) => tab.kind === 'hub') ?? null;
  const draftTab = tabs.find((tab) => tab.kind === 'draft') ?? null;
  const shouldRenderAnchorTabs = hubTab !== null && draftTab !== null;
  const scrollableTabs = shouldRenderAnchorTabs
    ? tabs.filter((tab) => tab.kind !== 'hub' && tab.kind !== 'draft')
    : tabs;

  function handleTabsWheel(event: WheelEvent<HTMLElement>): void {
    const tabsList = tabsListRef.current;

    if (!tabsList || tabsList.scrollWidth <= tabsList.clientWidth) {
      return;
    }

    const horizontalDelta = event.deltaX !== 0 ? event.deltaX : event.deltaY;

    if (horizontalDelta === 0) {
      return;
    }

    event.preventDefault();
    tabsList.scrollLeft += horizontalDelta;
  }

  function openCreateMenu(): void {
    setIsCreateMenuExpanded(true);

    requestAnimationFrame(() => {
      const tabsList = tabsListRef.current;

      if (!tabsList) {
        return;
      }

      tabsList.scrollLeft = tabsList.scrollWidth;
    });
  }

  function handleCreateMenuBlur(event: FocusEvent<HTMLDivElement>): void {
    const nextFocusedElement = event.relatedTarget;

    if (
      nextFocusedElement instanceof Node &&
      createMenuRef.current?.contains(nextFocusedElement)
    ) {
      return;
    }

    setIsCreateMenuExpanded(false);
  }

  function handleCreateMenuAction(action: () => void): void {
    setIsCreateMenuExpanded(false);
    action();
  }

  const createSessionActions: Array<{
    agentId: AgentId;
    label: string;
    onCreate: () => void;
  }> = [
    {
      agentId: 'codex',
      label: tRenderer('terminal.newCodex'),
      onCreate: onCreateCodexSession,
    },
    {
      agentId: 'claude_code',
      label: tRenderer('terminal.newClaudeCode'),
      onCreate: onCreateClaudeCodeSession,
    },
    {
      agentId: 'opencode',
      label: tRenderer('terminal.newOpenCode'),
      onCreate: onCreateOpenCodeSession,
    },
    {
      agentId: 'shell',
      label: tRenderer('terminal.newShell'),
      onCreate: onCreateShellSession,
    },
  ];
  const orderedCreateSessionActions = [
    ...createSessionActions.filter((action) => action.agentId === primaryAgent),
    ...createSessionActions.filter((action) => action.agentId !== primaryAgent),
  ];

  return (
    <section className="workspace-tabs panel" onWheel={handleTabsWheel}>
      <div className="workspace-tabs-strip">
        {shouldRenderAnchorTabs ? (
          <div
            className="workspace-anchor-tabs"
            role="tablist"
            aria-label={tRenderer('terminal.workspaceViews')}
          >
            <button
              type="button"
              className={[
                'workspace-anchor-tab',
                hubTab.isActive ? 'workspace-anchor-tab-active' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => onSelectTab(hubTab.id)}
              title={hubTab.title ?? hubTab.label}
            >
              {areShortcutHintsVisible && tabShortcutLabels[hubTab.id] ? (
                <span className="tab-shortcut-overlay" aria-hidden="true">
                  <span className="tab-shortcut-badge">{tabShortcutLabels[hubTab.id]}</span>
                </span>
              ) : null}
              <span className="tab-hub-icon" aria-hidden="true" />
              <span className="workspace-anchor-label">{hubTab.label}</span>
            </button>

            <span className="workspace-anchor-divider" aria-hidden="true" />

            <button
              type="button"
              className={[
                'workspace-anchor-tab',
                draftTab.isActive ? 'workspace-anchor-tab-active' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => onSelectTab(draftTab.id)}
              title={draftTab.title ?? draftTab.label}
            >
              {areShortcutHintsVisible && tabShortcutLabels[draftTab.id] ? (
                <span className="tab-shortcut-overlay" aria-hidden="true">
                  <span className="tab-shortcut-badge">{tabShortcutLabels[draftTab.id]}</span>
                </span>
              ) : null}
              <DraftNoteIcon className="tab-leading-icon tab-leading-icon-draft" size="sm" />
              <span className="workspace-anchor-label">{draftTab.label}</span>
              {draftTab.isDirty ? (
                <span className="workspace-anchor-dirty-indicator" aria-hidden="true" />
              ) : null}
            </button>
          </div>
        ) : null}

        <div ref={tabsListRef} className="workspace-tabs-list">
          {scrollableTabs.map((tab) =>
            renderTabChip(
              tab,
              iconTheme,
              areShortcutHintsVisible,
              tabShortcutLabels,
              onSelectTab,
              onCloseTab,
              onRenameTerminalTab,
              onPinFileTab,
            ),
          )}

          <div
            ref={createMenuRef}
            className={[
              'tab-create-menu',
              isCreateMenuExpanded ? 'tab-create-menu-expanded' : '',
              isCreatingSession ? 'tab-create-menu-busy' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            onMouseEnter={openCreateMenu}
            onMouseLeave={() => setIsCreateMenuExpanded(false)}
            onFocusCapture={openCreateMenu}
            onBlurCapture={handleCreateMenuBlur}
          >
            <button
              type="button"
              className="tab-create-button tab-create-menu-trigger"
              onClick={onCreatePrimarySession}
              disabled={isCreatingSession}
              aria-label={tRenderer('terminal.createSession')}
              title={tRenderer('terminal.createSession')}
            >
              {areShortcutHintsVisible && !isCreateMenuExpanded ? (
                <span className="tab-shortcut-overlay" aria-hidden="true">
                  <span className="tab-shortcut-badge">{createSessionShortcutLabel}</span>
                </span>
              ) : null}
              <span className="tab-create-menu-trigger-glyph" aria-hidden="true">
                {isCreatingSession ? '…' : '+'}
              </span>
            </button>

            <div className="tab-create-menu-actions" aria-hidden={!isCreateMenuExpanded}>
              {orderedCreateSessionActions.map((action) => (
                <button
                  key={action.agentId}
                  type="button"
                  className="tab-create-menu-option"
                  onClick={() => handleCreateMenuAction(action.onCreate)}
                  disabled={isCreatingSession}
                  tabIndex={isCreateMenuExpanded ? 0 : -1}
                  aria-label={`${action.label} session`}
                  title={action.label}
                >
                  <AgentBrandIcon agentId={action.agentId} size="md" />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="workspace-window-title">{windowTitle}</div>
    </section>
  );
}
