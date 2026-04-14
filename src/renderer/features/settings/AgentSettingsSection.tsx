import type { ChangeEvent, ReactElement } from 'react';
import { useEffect, useMemo, useState } from 'react';

import type {
  AppConfig,
  ClaudeCodeAgentSettings,
  CodexAgentSettings,
  OpenCodeAgentSettings,
} from '@shared/domain/config';
import { tRenderer } from '@renderer/app/i18n';
import { AgentBrandLabel } from '@renderer/icons/agent-branding';

interface AgentSettingsSectionProps {
  appConfig: AppConfig;
  onUpdateAppConfig: (nextAppConfig: AppConfig) => Promise<void>;
}

type AgentSectionId = 'codex' | 'claude_code' | 'opencode';

const codexReasoningOptions = ['minimal', 'low', 'medium', 'high', 'xhigh'] as const;
const codexSandboxOptions = ['read-only', 'workspace-write', 'danger-full-access'] as const;
const codexWebSearchOptions = ['disabled', 'cached', 'live'] as const;
const claudeEffortOptions = ['low', 'medium', 'high', 'max', 'auto'] as const;
const claudePermissionOptions = [
  'default',
  'acceptEdits',
  'auto',
  'plan',
  'dontAsk',
  'bypassPermissions',
] as const;
const AGENT_SECTION_IDS: AgentSectionId[] = ['codex', 'claude_code', 'opencode'];

function getOrderedAgentSections(defaultAgent: AppConfig['defaultAgent']): AgentSectionId[] {
  return AGENT_SECTION_IDS.includes(defaultAgent as AgentSectionId)
    ? [
        defaultAgent as AgentSectionId,
        ...AGENT_SECTION_IDS.filter((sectionId) => sectionId !== defaultAgent),
      ]
    : AGENT_SECTION_IDS;
}

function countVisibleCodexSettings(values: CodexAgentSettings): number {
  return [
    values.model,
    values.modelReasoningEffort,
    values.sandboxMode,
    values.webSearch,
  ].filter((value) => value !== undefined && value !== '').length;
}

function countVisibleClaudeSettings(values: ClaudeCodeAgentSettings): number {
  return [values.model, values.effort, values.permission].filter(
    (value) => value !== undefined && value !== '',
  ).length;
}

function countVisibleOpenCodeSettings(values: OpenCodeAgentSettings): number {
  return [values.model, values.primaryAgent].filter(
    (value) => value !== undefined && value !== '',
  ).length;
}

function formatCountLabel(count: number, singular: string, plural = `${singular}s`): string {
  if (singular === 'setting') {
    return tRenderer('count.setting', {
      count,
    });
  }

  return `${count} ${count === 1 ? singular : plural}`;
}

function updateCodexSettings(
  appConfig: AppConfig,
  updates: Partial<CodexAgentSettings>,
): AppConfig {
  return {
    ...appConfig,
    agentSettings: {
      ...appConfig.agentSettings,
      codex: {
        ...appConfig.agentSettings.codex,
        ...updates,
      },
    },
  };
}

function updateClaudeSettings(
  appConfig: AppConfig,
  updates: Partial<ClaudeCodeAgentSettings>,
): AppConfig {
  return {
    ...appConfig,
    agentSettings: {
      ...appConfig.agentSettings,
      claudeCode: {
        ...appConfig.agentSettings.claudeCode,
        ...updates,
      },
    },
  };
}

function updateOpenCodeSettings(
  appConfig: AppConfig,
  updates: Partial<OpenCodeAgentSettings>,
): AppConfig {
  return {
    ...appConfig,
    agentSettings: {
      ...appConfig.agentSettings,
      opencode: {
        ...appConfig.agentSettings.opencode,
        ...updates,
      },
    },
  };
}

function resolveStringValue(value: string): string | undefined {
  const normalizedValue = value.trim();
  return normalizedValue.length > 0 ? normalizedValue : undefined;
}

export function AgentSettingsSection({
  appConfig,
  onUpdateAppConfig,
}: AgentSettingsSectionProps): ReactElement {
  const [expandedSection, setExpandedSection] = useState<AgentSectionId | null>(null);
  const [codexModelDraft, setCodexModelDraft] = useState(appConfig.agentSettings.codex.model ?? '');
  const [claudeModelDraft, setClaudeModelDraft] = useState(
    appConfig.agentSettings.claudeCode.model ?? '',
  );
  const [openCodeModelDraft, setOpenCodeModelDraft] = useState(
    appConfig.agentSettings.opencode.model ?? '',
  );
  const [openCodePrimaryAgentDraft, setOpenCodePrimaryAgentDraft] = useState(
    appConfig.agentSettings.opencode.primaryAgent ?? '',
  );
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const orderedSections = useMemo(
    () => getOrderedAgentSections(appConfig.defaultAgent),
    [appConfig.defaultAgent],
  );

  useEffect(() => {
    setCodexModelDraft(appConfig.agentSettings.codex.model ?? '');
  }, [appConfig.agentSettings.codex.model]);

  useEffect(() => {
    setClaudeModelDraft(appConfig.agentSettings.claudeCode.model ?? '');
  }, [appConfig.agentSettings.claudeCode.model]);

  useEffect(() => {
    setOpenCodeModelDraft(appConfig.agentSettings.opencode.model ?? '');
  }, [appConfig.agentSettings.opencode.model]);

  useEffect(() => {
    setOpenCodePrimaryAgentDraft(appConfig.agentSettings.opencode.primaryAgent ?? '');
  }, [appConfig.agentSettings.opencode.primaryAgent]);

  async function commitAppConfig(nextAppConfig: AppConfig, key: string): Promise<void> {
    try {
      setSavingKey(key);
      setErrorMessage(null);
      await onUpdateAppConfig(nextAppConfig);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : tRenderer('settings.agents.writeFailed'),
      );
    } finally {
      setSavingKey((currentKey) => (currentKey === key ? null : currentKey));
    }
  }

  function toggleSection(sectionId: AgentSectionId): void {
    setExpandedSection((currentSection) => (currentSection === sectionId ? null : sectionId));
  }

  function renderRadioPills<T extends string | boolean>(
    currentValue: T | undefined,
    options: Array<{
      label: string;
      value: T;
    }>,
    onSelect: (nextValue: T) => void,
    keyPrefix: string,
  ): ReactElement {
    return (
      <div className="project-agent-pill-row">
        {options.map((option, index) => {
          const isActive = currentValue === option.value;

          return (
            <button
              key={`${keyPrefix}:${option.label}:${index}`}
              className={`project-agent-pill ${isActive ? 'project-agent-pill-active' : ''}`}
              onClick={() => onSelect(option.value)}
              disabled={savingKey !== null}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    );
  }

  function handleCodexModelDraftChange(event: ChangeEvent<HTMLInputElement>): void {
    setCodexModelDraft(event.target.value);
  }

  function handleClaudeModelDraftChange(event: ChangeEvent<HTMLInputElement>): void {
    setClaudeModelDraft(event.target.value);
  }

  function handleOpenCodeModelDraftChange(event: ChangeEvent<HTMLInputElement>): void {
    setOpenCodeModelDraft(event.target.value);
  }

  function handleOpenCodePrimaryAgentDraftChange(event: ChangeEvent<HTMLInputElement>): void {
    setOpenCodePrimaryAgentDraft(event.target.value);
  }

  return (
    <section id="settings-agents" className="settings-section-block">
      <header className="settings-section-header">
        <div>
          <h2 className="settings-section-title">{tRenderer('settings.agents.title')}</h2>
        </div>
      </header>

      <article className="settings-card">
        <div className="settings-card-copy">
          <h3 className="settings-subsection-title">{tRenderer('settings.agents.globalDefaults')}</h3>
          <p className="body-copy">{tRenderer('settings.agents.globalDefaultsDescription')}</p>
        </div>
      </article>

      {errorMessage ? <p className="project-agent-error">{errorMessage}</p> : null}

      {orderedSections.map((sectionId) => {
        const isExpanded = expandedSection === sectionId;
        const settingsCount =
          sectionId === 'codex'
            ? countVisibleCodexSettings(appConfig.agentSettings.codex)
            : sectionId === 'claude_code'
              ? countVisibleClaudeSettings(appConfig.agentSettings.claudeCode)
              : countVisibleOpenCodeSettings(appConfig.agentSettings.opencode);

        return (
          <article key={sectionId} className="project-home-settings-card">
            <button
              className="project-agent-section-toggle"
              aria-expanded={isExpanded}
              onClick={() => toggleSection(sectionId)}
            >
              <span className={`project-agent-section-chevron ${isExpanded ? 'project-agent-section-chevron-expanded' : ''}`} />
              <div className="project-agent-section-copy">
                <h3
                  className="settings-subsection-title"
                >
                  <AgentBrandLabel agentId={sectionId} size="sm" />
                </h3>
                <p className="project-agent-section-meta">{formatCountLabel(settingsCount, 'setting')}</p>
              </div>
            </button>

            {isExpanded ? (
              <div className="project-agent-section-body">
                {sectionId === 'codex' ? (
                  <>
                    <div className="project-agent-field">
                      <label className="project-agent-field-label">model</label>
                      <div className="project-agent-inline-form">
                        <input
                          className="settings-text-input"
                          value={codexModelDraft}
                          onChange={handleCodexModelDraftChange}
                          placeholder="gpt-5.4"
                        />
                        <button
                          className="secondary-button"
                          onClick={() => {
                            void commitAppConfig(
                              updateCodexSettings(appConfig, {
                                model: resolveStringValue(codexModelDraft),
                              }),
                              'app-codex:model',
                            );
                          }}
                          disabled={savingKey !== null}
                        >
                          {tRenderer('common.actions.apply')}
                        </button>
                      </div>
                    </div>

                    <div className="project-agent-field">
                      <label className="project-agent-field-label">model_reasoning_effort</label>
                      {renderRadioPills(
                        appConfig.agentSettings.codex.modelReasoningEffort,
                        codexReasoningOptions.map((value) => ({ label: value, value })),
                        (nextValue) => {
                          void commitAppConfig(
                            updateCodexSettings(appConfig, {
                              modelReasoningEffort:
                                appConfig.agentSettings.codex.modelReasoningEffort === nextValue
                                  ? undefined
                                  : nextValue,
                            }),
                            `app-codex:model-reasoning-effort:${String(nextValue)}`,
                          );
                        },
                        'app-codex:model-reasoning-effort',
                      )}
                    </div>

                    <div className="project-agent-field">
                      <label className="project-agent-field-label">sandbox_mode</label>
                      {renderRadioPills(
                        appConfig.agentSettings.codex.sandboxMode,
                        codexSandboxOptions.map((value) => ({ label: value, value })),
                        (nextValue) => {
                          void commitAppConfig(
                            updateCodexSettings(appConfig, {
                              sandboxMode:
                                appConfig.agentSettings.codex.sandboxMode === nextValue
                                  ? undefined
                                  : nextValue,
                            }),
                            `app-codex:sandbox-mode:${String(nextValue)}`,
                          );
                        },
                        'app-codex:sandbox-mode',
                      )}
                    </div>

                    <div className="project-agent-field">
                      <label className="project-agent-field-label">web_search</label>
                      {renderRadioPills(
                        appConfig.agentSettings.codex.webSearch,
                        codexWebSearchOptions.map((value) => ({ label: value, value })),
                        (nextValue) => {
                          void commitAppConfig(
                            updateCodexSettings(appConfig, {
                              webSearch:
                                appConfig.agentSettings.codex.webSearch === nextValue
                                  ? undefined
                                  : nextValue,
                            }),
                            `app-codex:web-search:${String(nextValue)}`,
                          );
                        },
                        'app-codex:web-search',
                      )}
                    </div>
                  </>
                ) : sectionId === 'claude_code' ? (
                  <>
                    <p className="caption-copy">{tRenderer('projectSettings.supportsClaude')}</p>
                    <div className="project-agent-field">
                      <label className="project-agent-field-label">model</label>
                      <div className="project-agent-inline-form">
                        <input
                          className="settings-text-input"
                          value={claudeModelDraft}
                          onChange={handleClaudeModelDraftChange}
                          placeholder="sonnet"
                        />
                        <button
                          className="secondary-button"
                          onClick={() => {
                            void commitAppConfig(
                              updateClaudeSettings(appConfig, {
                                model: resolveStringValue(claudeModelDraft),
                              }),
                              'app-claude:model',
                            );
                          }}
                          disabled={savingKey !== null}
                        >
                          {tRenderer('common.actions.apply')}
                        </button>
                      </div>
                    </div>

                    <div className="project-agent-field">
                      <label className="project-agent-field-label">effort</label>
                      {renderRadioPills(
                        appConfig.agentSettings.claudeCode.effort,
                        claudeEffortOptions.map((value) => ({ label: value, value })),
                        (nextValue) => {
                          void commitAppConfig(
                            updateClaudeSettings(appConfig, {
                              effort:
                                appConfig.agentSettings.claudeCode.effort === nextValue
                                  ? undefined
                                  : nextValue,
                            }),
                            `app-claude:effort:${String(nextValue)}`,
                          );
                        },
                        'app-claude:effort',
                      )}
                    </div>

                    <div className="project-agent-field">
                      <label className="project-agent-field-label">permission</label>
                      {renderRadioPills(
                        appConfig.agentSettings.claudeCode.permission,
                        claudePermissionOptions.map((value) => ({ label: value, value })),
                        (nextValue) => {
                          void commitAppConfig(
                            updateClaudeSettings(appConfig, {
                              permission:
                                appConfig.agentSettings.claudeCode.permission === nextValue
                                  ? undefined
                                  : nextValue,
                            }),
                            `app-claude:permission:${String(nextValue)}`,
                          );
                        },
                        'app-claude:permission',
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <p className="caption-copy">{tRenderer('projectSettings.supportsOpenCode')}</p>

                    <div className="project-agent-field">
                      <label className="project-agent-field-label">model</label>
                      <div className="project-agent-inline-form">
                        <input
                          className="settings-text-input"
                          value={openCodeModelDraft}
                          onChange={handleOpenCodeModelDraftChange}
                          placeholder="openai/gpt-5"
                        />
                        <button
                          className="secondary-button"
                          onClick={() => {
                            void commitAppConfig(
                              updateOpenCodeSettings(appConfig, {
                                model: resolveStringValue(openCodeModelDraft),
                              }),
                              'app-opencode:model',
                            );
                          }}
                          disabled={savingKey !== null}
                        >
                          {tRenderer('common.actions.apply')}
                        </button>
                      </div>
                    </div>

                    <div className="project-agent-field">
                      <label className="project-agent-field-label">agent</label>
                      <div className="project-agent-inline-form">
                        <input
                          className="settings-text-input"
                          value={openCodePrimaryAgentDraft}
                          onChange={handleOpenCodePrimaryAgentDraftChange}
                          placeholder="build / plan"
                        />
                        <button
                          className="secondary-button"
                          onClick={() => {
                            void commitAppConfig(
                              updateOpenCodeSettings(appConfig, {
                                primaryAgent: resolveStringValue(openCodePrimaryAgentDraft),
                              }),
                              'app-opencode:primary-agent',
                            );
                          }}
                          disabled={savingKey !== null}
                        >
                          {tRenderer('common.actions.apply')}
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ) : null}
          </article>
        );
      })}
    </section>
  );
}
