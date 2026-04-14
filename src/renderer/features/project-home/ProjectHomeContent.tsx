import type { ReactElement } from 'react';
import { useEffect, useState } from 'react';

import type { ClaudeCodeProjectHomeData } from '@shared/contracts/claude';
import type { CodexProjectHomeData } from '@shared/contracts/codex';
import type { OpenCodeProjectHomeData } from '@shared/contracts/opencode';
import type { ProjectSkillsData } from '@shared/contracts/skills';
import type { AgentId } from '@shared/domain/agent';
import type { AppConfig, ProjectConfig } from '@shared/domain/config';

import { tRenderer } from '@renderer/app/i18n';
import { AgentBrandLabel, AgentBrandWatermark } from '@renderer/icons/agent-branding';

import { ProjectAgentSettingsSection } from './ProjectAgentSettingsSection';

interface ProjectHomeContentProps {
  claudeCodeProjectHomeData: ClaudeCodeProjectHomeData;
  codexProjectHomeData: CodexProjectHomeData;
  openCodeProjectHomeData: OpenCodeProjectHomeData;
  isProjectHomeLoading: boolean;
  claudeCodeProjectHomeLoadError: string | null;
  codexProjectHomeLoadError: string | null;
  openCodeProjectHomeLoadError: string | null;
  appConfig: AppConfig;
  projectConfig: ProjectConfig;
  projectSkillsData: ProjectSkillsData;
  globalDefaultAgent: AgentId;
  isProjectSkillsLoading: boolean;
  projectSkillsLoadError: string | null;
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
}

const INITIAL_VISIBLE_HISTORY_COUNT = 4;
const MORE_HISTORY_COUNT_STEP = 5;

function getUnavailableAgentNote(available: boolean, agentLabel: string): string | null {
  return available ? null : tRenderer('projectHome.agentUnavailable', {
    agent: agentLabel,
  });
}

function getAgentLoadErrorNote(loadError: string | null, agentLabel: string): string | null {
  return loadError
    ? tRenderer('projectHome.loadAgentStateFailed', {
        agent: agentLabel,
      })
    : null;
}

export function ProjectHomeContent({
  claudeCodeProjectHomeData,
  codexProjectHomeData,
  openCodeProjectHomeData,
  isProjectHomeLoading,
  claudeCodeProjectHomeLoadError,
  codexProjectHomeLoadError,
  openCodeProjectHomeLoadError,
  appConfig,
  projectConfig,
  projectSkillsData,
  globalDefaultAgent,
  isProjectSkillsLoading,
  projectSkillsLoadError,
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
}: ProjectHomeContentProps): ReactElement {
  const [isProjectSettingsExpanded, setIsProjectSettingsExpanded] = useState(false);
  const [visibleClaudeHistoryCount, setVisibleClaudeHistoryCount] =
    useState(INITIAL_VISIBLE_HISTORY_COUNT);
  const [visibleCodexHistoryCount, setVisibleCodexHistoryCount] =
    useState(INITIAL_VISIBLE_HISTORY_COUNT);
  const [visibleOpenCodeHistoryCount, setVisibleOpenCodeHistoryCount] =
    useState(INITIAL_VISIBLE_HISTORY_COUNT);
  const claudeUnavailableReason = getUnavailableAgentNote(
    claudeCodeProjectHomeData.availability.available,
    'Claude Code',
  );
  const codexUnavailableReason = getUnavailableAgentNote(
    codexProjectHomeData.availability.available,
    'Codex',
  );
  const openCodeUnavailableReason = getUnavailableAgentNote(
    openCodeProjectHomeData.availability.available,
    'OpenCode',
  );
  const claudeLoadErrorNote = getAgentLoadErrorNote(
    claudeCodeProjectHomeLoadError,
    'Claude Code',
  );
  const codexLoadErrorNote = getAgentLoadErrorNote(codexProjectHomeLoadError, 'Codex');
  const openCodeLoadErrorNote = getAgentLoadErrorNote(
    openCodeProjectHomeLoadError,
    'OpenCode',
  );
  const hasClaudeHistory = claudeCodeProjectHomeData.recentSessionCards.length > 0;
  const visibleClaudeHistoryCards = claudeCodeProjectHomeData.recentSessionCards.slice(
    0,
    visibleClaudeHistoryCount,
  );
  const hasMoreClaudeHistory =
    claudeCodeProjectHomeData.recentSessionCards.length > visibleClaudeHistoryCount;
  const hasCodexHistory = codexProjectHomeData.recentSessionCards.length > 0;
  const visibleCodexHistoryCards = codexProjectHomeData.recentSessionCards.slice(
    0,
    visibleCodexHistoryCount,
  );
  const hasMoreCodexHistory =
    codexProjectHomeData.recentSessionCards.length > visibleCodexHistoryCount;
  const hasOpenCodeHistory = openCodeProjectHomeData.recentSessionCards.length > 0;
  const visibleOpenCodeHistoryCards = openCodeProjectHomeData.recentSessionCards.slice(
    0,
    visibleOpenCodeHistoryCount,
  );
  const hasMoreOpenCodeHistory =
    openCodeProjectHomeData.recentSessionCards.length > visibleOpenCodeHistoryCount;
  const isCreateClaudeDisabled =
    isCreatingClaudeCode || isCreatingShell || claudeUnavailableReason !== null;
  const isCreateCodexDisabled =
    isCreatingCodex || isCreatingShell || codexUnavailableReason !== null;
  const isCreateOpenCodeDisabled =
    isCreatingOpenCode || isCreatingShell || openCodeUnavailableReason !== null;
  const claudeStateNote = claudeLoadErrorNote
    ? {
        tone: 'error' as const,
        text: claudeLoadErrorNote,
      }
    : isProjectHomeLoading && !hasClaudeHistory
      ? {
          tone: 'muted' as const,
          text: tRenderer('projectHome.loadingRecentSessions'),
        }
      : claudeUnavailableReason
        ? {
            tone: 'muted' as const,
            text: claudeUnavailableReason,
          }
        : null;
  const codexStateNote = codexLoadErrorNote
    ? {
        tone: 'error' as const,
        text: codexLoadErrorNote,
      }
    : isProjectHomeLoading && !hasCodexHistory
      ? {
          tone: 'muted' as const,
          text: tRenderer('projectHome.loadingRecentSessions'),
        }
      : codexUnavailableReason
        ? {
            tone: 'muted' as const,
            text: codexUnavailableReason,
          }
        : null;
  const openCodeStateNote = openCodeLoadErrorNote
    ? {
        tone: 'error' as const,
        text: openCodeLoadErrorNote,
      }
    : isProjectHomeLoading && !hasOpenCodeHistory
      ? {
          tone: 'muted' as const,
          text: tRenderer('projectHome.loadingRecentSessions'),
        }
      : openCodeUnavailableReason
        ? {
            tone: 'muted' as const,
            text: openCodeUnavailableReason,
          }
        : null;

  useEffect(() => {
    setVisibleClaudeHistoryCount(INITIAL_VISIBLE_HISTORY_COUNT);
  }, [claudeCodeProjectHomeData.recentSessionCards]);

  useEffect(() => {
    setVisibleCodexHistoryCount(INITIAL_VISIBLE_HISTORY_COUNT);
  }, [codexProjectHomeData.recentSessionCards]);

  useEffect(() => {
    setVisibleOpenCodeHistoryCount(INITIAL_VISIBLE_HISTORY_COUNT);
  }, [openCodeProjectHomeData.recentSessionCards]);

  return (
    <section className="project-home-shell">
      <section className="project-home-section">
        <header className="project-home-section-header">
          <h2 className="project-home-section-title">{tRenderer('projectHome.sessions')}</h2>
        </header>

        <div className="project-home-agent-block">
          <div className="project-home-agent-header">
            <h3 className="project-home-agent-title">
              <AgentBrandLabel agentId="codex" />
            </h3>
            {codexProjectHomeLoadError ? (
              <span className="project-home-agent-meta">{tRenderer('common.labels.issue')}</span>
            ) : codexUnavailableReason ? (
              <span className="project-home-agent-meta">{tRenderer('common.labels.unavailable')}</span>
            ) : null}
          </div>

          <div className="project-home-card-grid">
            <button
              className="project-home-card project-home-card-new"
              onClick={onCreateCodex}
              disabled={isCreateCodexDisabled}
              aria-label={
                isCreatingCodex
                  ? tRenderer('projectHome.creatingCodex')
                  : tRenderer('projectHome.createCodex')
              }
            >
              <AgentBrandWatermark agentId="codex" className="project-home-card-watermark" />
              <span aria-hidden="true" className="project-home-card-plus">
                +
              </span>
            </button>

            {visibleCodexHistoryCards.map((card) => (
              <button
                key={card.id}
                className="project-home-card project-home-card-history"
                onClick={() => onResumeCodex(card.sessionId)}
                disabled={codexUnavailableReason !== null || resumingCodexSessionId === card.sessionId}
              >
                <span className="project-home-card-title">{card.title}</span>
                <span className="project-home-card-subtitle">
                  {resumingCodexSessionId === card.sessionId
                    ? tRenderer('common.actions.resuming')
                    : card.subtitle}
                </span>
              </button>
            ))}
          </div>

          {hasMoreCodexHistory ? (
            <button
              className="project-home-more-button"
              onClick={() => {
                setVisibleCodexHistoryCount(
                  (currentCount) => currentCount + MORE_HISTORY_COUNT_STEP,
                );
              }}
            >
              {tRenderer('common.actions.more')}
            </button>
          ) : null}

          {codexStateNote ? (
            <p
              className={`project-home-session-note ${codexStateNote.tone === 'error' ? 'project-home-session-note-error' : ''}`}
            >
              {codexStateNote.text}
            </p>
          ) : null}
        </div>

        <div className="project-home-agent-block">
          <div className="project-home-agent-header">
            <h3 className="project-home-agent-title">
              <AgentBrandLabel agentId="opencode" />
            </h3>
            {openCodeProjectHomeLoadError ? (
              <span className="project-home-agent-meta">{tRenderer('common.labels.issue')}</span>
            ) : openCodeUnavailableReason ? (
              <span className="project-home-agent-meta">{tRenderer('common.labels.unavailable')}</span>
            ) : null}
          </div>

          <div className="project-home-card-grid">
            <button
              className="project-home-card project-home-card-new"
              onClick={onCreateOpenCode}
              disabled={isCreateOpenCodeDisabled}
              aria-label={
                isCreatingOpenCode
                  ? tRenderer('projectHome.creatingOpenCode')
                  : tRenderer('projectHome.createOpenCode')
              }
            >
              <AgentBrandWatermark agentId="opencode" className="project-home-card-watermark" />
              <span aria-hidden="true" className="project-home-card-plus">
                +
              </span>
            </button>

            {visibleOpenCodeHistoryCards.map((card) => (
              <button
                key={card.id}
                className="project-home-card project-home-card-history"
                onClick={() => onResumeOpenCode(card.sessionId)}
                disabled={
                  openCodeUnavailableReason !== null || resumingOpenCodeSessionId === card.sessionId
                }
              >
                <span className="project-home-card-title">{card.title}</span>
                <span className="project-home-card-subtitle">
                  {resumingOpenCodeSessionId === card.sessionId
                    ? tRenderer('common.actions.resuming')
                    : card.subtitle}
                </span>
              </button>
            ))}
          </div>

          {hasMoreOpenCodeHistory ? (
            <button
              className="project-home-more-button"
              onClick={() => {
                setVisibleOpenCodeHistoryCount(
                  (currentCount) => currentCount + MORE_HISTORY_COUNT_STEP,
                );
              }}
            >
              {tRenderer('common.actions.more')}
            </button>
          ) : null}

          {openCodeStateNote ? (
            <p
              className={`project-home-session-note ${openCodeStateNote.tone === 'error' ? 'project-home-session-note-error' : ''}`}
            >
              {openCodeStateNote.text}
            </p>
          ) : null}
        </div>

        <div className="project-home-agent-block">
          <div className="project-home-agent-header">
            <h3 className="project-home-agent-title">
              <AgentBrandLabel agentId="claude_code" />
            </h3>
            {claudeCodeProjectHomeLoadError ? (
              <span className="project-home-agent-meta">{tRenderer('common.labels.issue')}</span>
            ) : claudeUnavailableReason ? (
              <span className="project-home-agent-meta">{tRenderer('common.labels.unavailable')}</span>
            ) : null}
          </div>

          <div className="project-home-card-grid">
            <button
              className="project-home-card project-home-card-new project-home-card-shell"
              onClick={onCreateClaudeCode}
              disabled={isCreateClaudeDisabled}
              aria-label={
                isCreatingClaudeCode
                  ? tRenderer('projectHome.creatingClaudeCode')
                  : tRenderer('projectHome.createClaudeCode')
              }
            >
              <AgentBrandWatermark agentId="claude_code" className="project-home-card-watermark" />
              <span aria-hidden="true" className="project-home-card-plus">
                +
              </span>
            </button>

            {visibleClaudeHistoryCards.map((card) => (
              <button
                key={card.id}
                className="project-home-card project-home-card-history"
                onClick={() => onResumeClaudeCode(card.sessionId)}
                disabled={
                  claudeUnavailableReason !== null || resumingClaudeCodeSessionId === card.sessionId
                }
              >
                <span className="project-home-card-title">{card.title}</span>
                <span className="project-home-card-subtitle">
                  {resumingClaudeCodeSessionId === card.sessionId
                    ? tRenderer('common.actions.resuming')
                    : card.subtitle}
                </span>
              </button>
            ))}
          </div>

          {hasMoreClaudeHistory ? (
            <button
              className="project-home-more-button"
              onClick={() => {
                setVisibleClaudeHistoryCount(
                  (currentCount) => currentCount + MORE_HISTORY_COUNT_STEP,
                );
              }}
            >
              {tRenderer('common.actions.more')}
            </button>
          ) : null}

          {claudeStateNote ? (
            <p
              className={`project-home-session-note ${claudeStateNote.tone === 'error' ? 'project-home-session-note-error' : ''}`}
            >
              {claudeStateNote.text}
            </p>
          ) : null}
        </div>

        <div className="project-home-agent-block">
          <div className="project-home-agent-header">
            <h3 className="project-home-agent-title">
              <AgentBrandLabel agentId="shell" />
            </h3>
          </div>

          <div className="project-home-card-grid project-home-card-grid-single">
            <button
              className="project-home-card project-home-card-new project-home-card-shell"
              onClick={onCreateShell}
              disabled={isCreatingShell}
              aria-label={
                isCreatingShell
                  ? tRenderer('projectHome.creatingShell')
                  : tRenderer('projectHome.createShell')
              }
            >
              <AgentBrandWatermark agentId="shell" className="project-home-card-watermark" />
              <span aria-hidden="true" className="project-home-card-plus">
                +
              </span>
            </button>
          </div>
        </div>
      </section>

      <section className="project-home-section">
        <button
          className="project-home-settings-toggle"
          aria-expanded={isProjectSettingsExpanded}
          onClick={() => {
            setIsProjectSettingsExpanded((currentValue) => !currentValue);
          }}
        >
          <span
            className={`hub-tree-chevron project-home-settings-toggle-chevron ${isProjectSettingsExpanded ? 'hub-tree-chevron-expanded' : ''}`}
          />
          <div className="project-home-settings-toggle-copy">
            <h2 className="project-home-section-title">{tRenderer('projectHome.projectSettings')}</h2>
          </div>
        </button>

        {isProjectSettingsExpanded ? (
          <div className="project-home-settings-body">
            <ProjectAgentSettingsSection
              appConfig={appConfig}
              projectConfig={projectConfig}
              projectSkillsData={projectSkillsData}
              globalDefaultAgent={globalDefaultAgent}
              claudeUnavailableReason={claudeUnavailableReason}
              codexUnavailableReason={codexUnavailableReason}
              openCodeUnavailableReason={openCodeUnavailableReason}
              isProjectSkillsLoading={isProjectSkillsLoading}
              projectSkillsLoadError={projectSkillsLoadError}
              onUpdateProjectConfig={onUpdateProjectConfig}
            />
          </div>
        ) : null}
      </section>
    </section>
  );
}
