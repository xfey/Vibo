import type { ReactElement } from 'react';
import { useEffect, useMemo, useState } from 'react';

import type { AppFeedback } from '@renderer/app/AppFeedbackBanner';
import { tRenderer } from '@renderer/app/i18n';
import type { SkillOperationError } from '@shared/contracts/skills';
import type { GlobalSkillRecord, SkillAgentId } from '@shared/domain/skill';

interface SkillsSettingsSectionProps {
  onShowFeedback: (feedback: AppFeedback) => void;
  onSkillsChanged: () => void;
}

interface SkillsSectionProps {
  title: string;
  agent: SkillAgentId;
  items: GlobalSkillRecord[];
  isLoading: boolean;
  loadError: string | null;
}

function sortSkills(items: GlobalSkillRecord[]): GlobalSkillRecord[] {
  return [...items].sort((left, right) =>
    left.name.localeCompare(right.name, undefined, {
      sensitivity: 'base',
    }),
  );
}

function formatOperationErrorMessage(errors: SkillOperationError[]): string {
  const firstError = errors[0];

  if (!firstError) {
    return tRenderer('settings.skills.scanFailed');
  }

  const sourceLabel = firstError.sourcePath.split('/').filter(Boolean).at(-1) ?? firstError.sourcePath;

  return tRenderer('settings.skills.scanPartialFailed', {
    sourceLabel,
    count: errors.length,
  });
}

function getAgentDescription(agent: SkillAgentId): string {
  switch (agent) {
    case 'codex':
      return tRenderer('settings.skills.agentDescription.codex');
    case 'claude_code':
      return tRenderer('settings.skills.agentDescription.claude');
    case 'opencode':
      return tRenderer('settings.skills.agentDescription.opencode');
    default:
      return tRenderer('settings.skills.agentDescription.default');
  }
}

function SkillsSection({
  title,
  agent,
  items,
  isLoading,
  loadError,
}: SkillsSectionProps): ReactElement {
  const sortedItems = useMemo(() => sortSkills(items), [items]);

  return (
    <article className="settings-card settings-skills-library-card">
      <div className="settings-card-copy">
        <h3 className="settings-subsection-title">{title}</h3>
        <p className="body-copy">{getAgentDescription(agent)}</p>
      </div>

      {isLoading ? (
        <p className="settings-skills-empty">{tRenderer('settings.skills.scanning')}</p>
      ) : loadError ? (
        <p className="settings-skills-empty">{loadError}</p>
      ) : sortedItems.length === 0 ? (
        <p className="settings-skills-empty">{tRenderer('settings.skills.empty')}</p>
      ) : (
        <div className="settings-skills-list">
          {sortedItems.map((item) => (
            <article key={item.id} className="settings-skill-card-shell">
              <div className="settings-skill-card">
                <span className="settings-skill-card-title">{item.name}</span>
                {item.description ? (
                  <span className="settings-skill-card-description">{item.description}</span>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      )}
    </article>
  );
}

export function SkillsSettingsSection({
  onShowFeedback,
  onSkillsChanged,
}: SkillsSettingsSectionProps): ReactElement {
  const [items, setItems] = useState<GlobalSkillRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const codexItems = useMemo(() => items.filter((item) => item.agent === 'codex'), [items]);
  const claudeItems = useMemo(
    () => items.filter((item) => item.agent === 'claude_code'),
    [items],
  );
  const openCodeItems = useMemo(
    () => items.filter((item) => item.agent === 'opencode'),
    [items],
  );

  async function loadSkills(showErrorFeedback: boolean): Promise<void> {
    try {
      const response = await window.viboApp.getGlobalSkillsData();

      setItems(response.items);
      setLoadError(null);
      onSkillsChanged();

      if (showErrorFeedback && response.errors.length > 0) {
        onShowFeedback({
          tone: 'error',
          message: formatOperationErrorMessage(response.errors),
        });
      }
    } catch (error) {
      const nextMessage = error instanceof Error ? error.message : tRenderer('settings.skills.scanFailed');
      setLoadError(nextMessage);

      if (showErrorFeedback) {
        onShowFeedback({
          tone: 'error',
          message: nextMessage,
        });
      }
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function hydrate(): Promise<void> {
      try {
        setIsLoading(true);
        const response = await window.viboApp.getGlobalSkillsData();

        if (cancelled) {
          return;
        }

        setItems(response.items);
        setLoadError(null);
        onSkillsChanged();

        if (response.errors.length > 0) {
          onShowFeedback({
            tone: 'error',
            message: formatOperationErrorMessage(response.errors),
          });
        }
      } catch (error) {
        const nextMessage = error instanceof Error ? error.message : tRenderer('settings.skills.scanFailed');

        if (!cancelled) {
          setLoadError(nextMessage);
          onShowFeedback({
            tone: 'error',
            message: nextMessage,
          });
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void hydrate();

    return () => {
      cancelled = true;
    };
  }, [onShowFeedback, onSkillsChanged]);

  async function handleRefresh(): Promise<void> {
    try {
      setIsRefreshing(true);
      await loadSkills(true);
    } finally {
      setIsRefreshing(false);
    }
  }

  return (
    <section id="settings-skills" className="settings-section-block">
      <header className="settings-section-header">
        <div>
          <h2 className="settings-section-title">{tRenderer('settings.skills.title')}</h2>
        </div>
      </header>

      <article className="settings-card">
        <div className="settings-card-copy">
          <h3 className="settings-subsection-title">{tRenderer('settings.skills.discovery')}</h3>
          <p className="body-copy">{tRenderer('settings.skills.discoveryDescription')}</p>
        </div>

        <div className="settings-inline-form">
          <button
            className="secondary-button settings-emphasis-button"
            onClick={() => {
              void handleRefresh();
            }}
            disabled={isLoading || isRefreshing}
          >
            {isRefreshing ? tRenderer('settings.skills.refreshing') : tRenderer('common.actions.refresh')}
          </button>
        </div>
      </article>

      <SkillsSection
        title="Codex"
        agent="codex"
        items={codexItems}
        isLoading={isLoading}
        loadError={loadError}
      />

      <SkillsSection
        title="Claude Code"
        agent="claude_code"
        items={claudeItems}
        isLoading={isLoading}
        loadError={loadError}
      />

      <SkillsSection
        title="OpenCode"
        agent="opencode"
        items={openCodeItems}
        isLoading={isLoading}
        loadError={loadError}
      />
    </section>
  );
}
