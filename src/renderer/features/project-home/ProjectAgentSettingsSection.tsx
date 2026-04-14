import type { ChangeEvent, ReactElement } from 'react';
import { useEffect, useMemo, useState } from 'react';

import type { ProjectSkillsData } from '@shared/contracts/skills';
import type { AgentId } from '@shared/domain/agent';
import type {
  AppConfig,
  ClaudeCodeAgentSettings,
  CodexAgentSettings,
  OpenCodeAgentSettings,
  ProjectConfig,
} from '@shared/domain/config';
import type { GlobalSkillRecord, ProjectSkillRecord } from '@shared/domain/skill';

import { tRenderer } from '@renderer/app/i18n';
import { AgentBrandLabel, AgentBrandWatermark } from '@renderer/icons/agent-branding';

interface ProjectAgentSettingsSectionProps {
  appConfig: AppConfig;
  projectConfig: ProjectConfig;
  projectSkillsData: ProjectSkillsData;
  globalDefaultAgent: AgentId;
  claudeUnavailableReason: string | null;
  codexUnavailableReason: string | null;
  openCodeUnavailableReason: string | null;
  isProjectSkillsLoading: boolean;
  projectSkillsLoadError: string | null;
  onUpdateProjectConfig: (nextProjectConfig: ProjectConfig) => Promise<void>;
}

type AgentSectionId = 'codex' | 'claude_code' | 'opencode';

function getPreferredAgentOptions(): Array<{
  value: AgentId;
  label: string;
  description: string;
}> {
  return [
    {
      value: 'codex',
      label: 'Codex',
      description: tRenderer('projectSettings.defaultAgent.codex'),
    },
    {
      value: 'claude_code',
      label: 'Claude Code',
      description: tRenderer('projectSettings.defaultAgent.claude'),
    },
    {
      value: 'opencode',
      label: 'OpenCode',
      description: tRenderer('projectSettings.defaultAgent.opencode'),
    },
    {
      value: 'shell',
      label: 'Shell',
      description: tRenderer('projectSettings.defaultAgent.shell'),
    },
  ];
}

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

function getEffectivePreferredAgent(
  preferredAgent: AgentId | undefined,
  globalDefaultAgent: AgentId,
): AgentId {
  return preferredAgent ?? globalDefaultAgent;
}

function getOrderedAgentSections(
  preferredAgent: AgentId | undefined,
  globalDefaultAgent: AgentId,
): AgentSectionId[] {
  const focusAgent = getEffectivePreferredAgent(preferredAgent, globalDefaultAgent);

  return AGENT_SECTION_IDS.includes(focusAgent as AgentSectionId)
    ? [
        focusAgent as AgentSectionId,
        ...AGENT_SECTION_IDS.filter((sectionId) => sectionId !== focusAgent),
      ]
    : AGENT_SECTION_IDS;
}

function countVisibleCodexValues(values: CodexAgentSettings): number {
  return [
    values.model,
    values.modelReasoningEffort,
    values.sandboxMode,
    values.webSearch,
  ].filter((value) => value !== undefined && value !== '').length;
}

function countVisibleClaudeValues(values: ClaudeCodeAgentSettings): number {
  return [values.model, values.effort, values.permission].filter(
    (value) => value !== undefined && value !== '',
  ).length;
}

function countVisibleOpenCodeValues(values: OpenCodeAgentSettings): number {
  return [values.model, values.primaryAgent].filter(
    (value) => value !== undefined && value !== '',
  ).length;
}

function getOverrideCount(
  projectConfig: ProjectConfig,
  globalDefaultAgent: AgentId,
  agentId: AgentSectionId,
): number {
  const preferredAgentOverrideCount =
    projectConfig.preferredAgent === agentId && projectConfig.preferredAgent !== globalDefaultAgent ? 1 : 0;

  if (agentId === 'codex') {
    return preferredAgentOverrideCount + countVisibleCodexValues(projectConfig.agentOverrides.codex);
  }

  if (agentId === 'claude_code') {
    return (
      preferredAgentOverrideCount +
      countVisibleClaudeValues(projectConfig.agentOverrides.claudeCode)
    );
  }

  return (
    preferredAgentOverrideCount +
    countVisibleOpenCodeValues(projectConfig.agentOverrides.opencode)
  );
}

function formatCountLabel(count: number, singular: string, plural = `${singular}s`): string {
  if (singular === 'skill') {
    return tRenderer('count.skill', {
      count,
    });
  }

  if (singular === 'override') {
    return tRenderer('count.override', {
      count,
    });
  }

  return `${count} ${count === 1 ? singular : plural}`;
}

function resolveCodexSettings(
  appConfig: AppConfig,
  projectConfig: ProjectConfig,
): CodexAgentSettings {
  return {
    model: projectConfig.agentOverrides.codex.model ?? appConfig.agentSettings.codex.model,
    modelReasoningEffort:
      projectConfig.agentOverrides.codex.modelReasoningEffort ??
      appConfig.agentSettings.codex.modelReasoningEffort,
    approvalPolicy:
      projectConfig.agentOverrides.codex.approvalPolicy ?? appConfig.agentSettings.codex.approvalPolicy,
    sandboxMode: projectConfig.agentOverrides.codex.sandboxMode ?? appConfig.agentSettings.codex.sandboxMode,
    webSearch: projectConfig.agentOverrides.codex.webSearch ?? appConfig.agentSettings.codex.webSearch,
  };
}

function resolveClaudeSettings(
  appConfig: AppConfig,
  projectConfig: ProjectConfig,
): ClaudeCodeAgentSettings {
  return {
    model: projectConfig.agentOverrides.claudeCode.model ?? appConfig.agentSettings.claudeCode.model,
    effort: projectConfig.agentOverrides.claudeCode.effort ?? appConfig.agentSettings.claudeCode.effort,
    permission:
      projectConfig.agentOverrides.claudeCode.permission ?? appConfig.agentSettings.claudeCode.permission,
  };
}

function resolveOpenCodeSettings(
  appConfig: AppConfig,
  projectConfig: ProjectConfig,
): OpenCodeAgentSettings {
  return {
    model: projectConfig.agentOverrides.opencode.model ?? appConfig.agentSettings.opencode.model,
    primaryAgent:
      projectConfig.agentOverrides.opencode.primaryAgent ??
      appConfig.agentSettings.opencode.primaryAgent,
  };
}

function getSkillCount(projectSkillsData: ProjectSkillsData, agentId: AgentSectionId): number {
  const agentData = projectSkillsData.agents[agentId];
  return agentData.projectSkills.length + agentData.globalSkills.length;
}

function buildCombinedSkills(
  projectSkills: ProjectSkillRecord[],
  globalSkills: GlobalSkillRecord[],
): Array<{
  id: string;
  name: string;
  description: string;
  scopeLabel: 'Local' | 'Global';
}> {
  return [
    ...projectSkills.map((skill) => ({
      id: skill.id,
      name: skill.name,
      description: skill.description,
      scopeLabel: 'Local' as const,
    })),
    ...globalSkills.map((skill) => ({
      id: skill.id,
      name: skill.name,
      description: skill.description,
      scopeLabel: 'Global' as const,
    })),
  ];
}

function updateCodexConfig(
  projectConfig: ProjectConfig,
  updates: Partial<ProjectConfig['agentOverrides']['codex']>,
): ProjectConfig {
  return {
    ...projectConfig,
    agentOverrides: {
      ...projectConfig.agentOverrides,
      codex: {
        ...projectConfig.agentOverrides.codex,
        ...updates,
      },
    },
  };
}

function updateClaudeConfig(
  projectConfig: ProjectConfig,
  updates: Partial<ProjectConfig['agentOverrides']['claudeCode']>,
): ProjectConfig {
  return {
    ...projectConfig,
    agentOverrides: {
      ...projectConfig.agentOverrides,
      claudeCode: {
        ...projectConfig.agentOverrides.claudeCode,
        ...updates,
      },
    },
  };
}

function updateOpenCodeConfig(
  projectConfig: ProjectConfig,
  updates: Partial<ProjectConfig['agentOverrides']['opencode']>,
): ProjectConfig {
  return {
    ...projectConfig,
    agentOverrides: {
      ...projectConfig.agentOverrides,
      opencode: {
        ...projectConfig.agentOverrides.opencode,
        ...updates,
      },
    },
  };
}

function resolveStringOverride(nextValue: string, globalValue: string | undefined): string | undefined {
  const normalizedNextValue = nextValue.trim();
  const normalizedGlobalValue = globalValue?.trim() ?? '';

  if (normalizedNextValue.length === 0 || normalizedNextValue === normalizedGlobalValue) {
    return undefined;
  }

  return normalizedNextValue;
}

function resolveSelectableOverride<T extends string | boolean>(
  nextValue: T,
  currentEffectiveValue: T | undefined,
  globalValue: T | undefined,
): T | undefined {
  if (globalValue !== undefined && nextValue === globalValue) {
    return undefined;
  }

  if (globalValue === undefined && currentEffectiveValue === nextValue) {
    return undefined;
  }

  return nextValue;
}

function renderScopeTag(scopeLabel: 'Local' | 'Global'): ReactElement {
  return (
    <span className={`project-skill-scope-tag ${scopeLabel === 'Local' ? 'project-skill-scope-tag-local' : ''}`}>
      {scopeLabel === 'Local' ? tRenderer('common.scope.local') : tRenderer('common.scope.global')}
    </span>
  );
}

export function ProjectAgentSettingsSection({
  appConfig,
  projectConfig,
  projectSkillsData,
  globalDefaultAgent,
  claudeUnavailableReason,
  codexUnavailableReason,
  openCodeUnavailableReason,
  isProjectSkillsLoading,
  projectSkillsLoadError,
  onUpdateProjectConfig,
}: ProjectAgentSettingsSectionProps): ReactElement {
  const preferredAgentOptions = useMemo(() => getPreferredAgentOptions(), [appConfig.locale]);
  const [expandedSection, setExpandedSection] = useState<AgentSectionId | null>(null);
  const [codexModelDraft, setCodexModelDraft] = useState('');
  const [claudeModelDraft, setClaudeModelDraft] = useState('');
  const [openCodeModelDraft, setOpenCodeModelDraft] = useState('');
  const [openCodePrimaryAgentDraft, setOpenCodePrimaryAgentDraft] = useState('');
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const effectivePreferredAgent = getEffectivePreferredAgent(
    projectConfig.preferredAgent,
    globalDefaultAgent,
  );
  const effectiveCodexSettings = useMemo(
    () => resolveCodexSettings(appConfig, projectConfig),
    [appConfig, projectConfig],
  );
  const effectiveClaudeSettings = useMemo(
    () => resolveClaudeSettings(appConfig, projectConfig),
    [appConfig, projectConfig],
  );
  const effectiveOpenCodeSettings = useMemo(
    () => resolveOpenCodeSettings(appConfig, projectConfig),
    [appConfig, projectConfig],
  );
  const orderedSections = useMemo(
    () => getOrderedAgentSections(projectConfig.preferredAgent, globalDefaultAgent),
    [globalDefaultAgent, projectConfig.preferredAgent],
  );

  useEffect(() => {
    setCodexModelDraft(effectiveCodexSettings.model ?? '');
  }, [effectiveCodexSettings.model]);

  useEffect(() => {
    setClaudeModelDraft(effectiveClaudeSettings.model ?? '');
  }, [effectiveClaudeSettings.model]);

  useEffect(() => {
    setOpenCodeModelDraft(effectiveOpenCodeSettings.model ?? '');
  }, [effectiveOpenCodeSettings.model]);

  useEffect(() => {
    setOpenCodePrimaryAgentDraft(effectiveOpenCodeSettings.primaryAgent ?? '');
  }, [effectiveOpenCodeSettings.primaryAgent]);

  async function commitProjectConfig(nextProjectConfig: ProjectConfig, key: string): Promise<void> {
    try {
      setSavingKey(key);
      setErrorMessage(null);
      await onUpdateProjectConfig(nextProjectConfig);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : tRenderer('projectSettings.writeFailed'));
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
    <section className="project-home-agent-settings">
      <article className="project-home-settings-card">
        <div className="project-home-settings-card-copy">
          <h3 className="settings-subsection-title">{tRenderer('projectSettings.preferredAgent')}</h3>
          <p className="body-copy">{tRenderer('projectSettings.preferredAgentDescription')}</p>
        </div>

        <div className="settings-choice-grid">
          {preferredAgentOptions.map((option) => {
            const isActive = effectivePreferredAgent === option.value;

            return (
              <button
                key={option.value}
                className={`settings-choice-card ${isActive ? 'settings-choice-card-active' : ''}`}
                onClick={() => {
                  setExpandedSection(
                    option.value === 'shell' ? null : (option.value as AgentSectionId),
                  );
                  void commitProjectConfig(
                    {
                      ...projectConfig,
                      preferredAgent: option.value === globalDefaultAgent ? undefined : option.value,
                    },
                    `preferred-agent:${option.value}`,
                  );
                }}
                disabled={savingKey !== null}
              >
                <AgentBrandWatermark
                  agentId={option.value}
                  className="settings-choice-watermark"
                />
                <span className="settings-choice-title-row">
                  <AgentBrandLabel
                    agentId={option.value}
                    size="sm"
                    className="settings-choice-agent-label"
                  />
                </span>
                <span className="settings-choice-description">{option.description}</span>
              </button>
            );
          })}
        </div>
      </article>

      {errorMessage ? <p className="project-agent-error">{errorMessage}</p> : null}

      {orderedSections.map((sectionId) => {
        const isExpanded = expandedSection === sectionId;
        const overrideCount = getOverrideCount(projectConfig, globalDefaultAgent, sectionId);
        const skillCount = getSkillCount(projectSkillsData, sectionId);
        const agentSkills = projectSkillsData.agents[sectionId];
        const combinedSkills = buildCombinedSkills(agentSkills.projectSkills, agentSkills.globalSkills);

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
                <p className="project-agent-section-meta">
                  {formatCountLabel(skillCount, 'skill')}, {formatCountLabel(overrideCount, 'override')}
                </p>
              </div>
            </button>

            {isExpanded ? (
              <div className="project-agent-section-body">
                <section className="project-agent-section-group">
                  <div className="project-home-settings-card-copy">
                    <p className="project-agent-group-label">Skills</p>
                  </div>

                  {isProjectSkillsLoading ? (
                    <p className="settings-skills-empty">{tRenderer('projectSettings.skillsLoading')}</p>
                  ) : projectSkillsLoadError ? (
                    <p className="project-agent-error">{projectSkillsLoadError}</p>
                  ) : combinedSkills.length === 0 ? (
                    <p className="settings-skills-empty">{tRenderer('projectSettings.skillsEmpty')}</p>
                  ) : (
                    <div className="project-skills-card-list">
                      {combinedSkills.map((skill) => (
                        <article
                          key={skill.id}
                          className="project-skills-card-shell project-skills-card-shell-active"
                        >
                          <div className="project-skills-card">
                            <div className="project-skills-card-header">
                              <span className="project-skills-card-title">{skill.name}</span>
                              {renderScopeTag(skill.scopeLabel)}
                            </div>
                            {skill.description ? (
                              <span className="project-skills-card-description">{skill.description}</span>
                            ) : null}
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </section>

                <section className="project-agent-section-group">
                  <div className="project-home-settings-card-copy">
                    <p className="project-agent-group-label">Overrides</p>
                  </div>

                  {sectionId === 'codex' ? (
                    <>
                      {codexUnavailableReason ? (
                        <p className="caption-copy">{codexUnavailableReason}</p>
                      ) : null}

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
                              void commitProjectConfig(
                                updateCodexConfig(projectConfig, {
                                  model: resolveStringOverride(
                                    codexModelDraft,
                                    appConfig.agentSettings.codex.model,
                                  ),
                                }),
                                'codex:model',
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
                          effectiveCodexSettings.modelReasoningEffort,
                          codexReasoningOptions.map((value) => ({ label: value, value })),
                          (nextValue) => {
                            void commitProjectConfig(
                              updateCodexConfig(projectConfig, {
                                modelReasoningEffort: resolveSelectableOverride(
                                  nextValue,
                                  effectiveCodexSettings.modelReasoningEffort,
                                  appConfig.agentSettings.codex.modelReasoningEffort,
                                ),
                              }),
                              `codex:model-reasoning-effort:${String(nextValue)}`,
                            );
                          },
                          'codex:model-reasoning-effort',
                        )}
                      </div>

                      <div className="project-agent-field">
                        <label className="project-agent-field-label">sandbox_mode</label>
                        {renderRadioPills(
                          effectiveCodexSettings.sandboxMode,
                          codexSandboxOptions.map((value) => ({ label: value, value })),
                          (nextValue) => {
                            void commitProjectConfig(
                              updateCodexConfig(projectConfig, {
                                sandboxMode: resolveSelectableOverride(
                                  nextValue,
                                  effectiveCodexSettings.sandboxMode,
                                  appConfig.agentSettings.codex.sandboxMode,
                                ),
                              }),
                              `codex:sandbox-mode:${String(nextValue)}`,
                            );
                          },
                          'codex:sandbox-mode',
                        )}
                      </div>

                      <div className="project-agent-field">
                        <label className="project-agent-field-label">web_search</label>
                        {renderRadioPills(
                          effectiveCodexSettings.webSearch,
                          codexWebSearchOptions.map((value) => ({ label: value, value })),
                          (nextValue) => {
                            void commitProjectConfig(
                              updateCodexConfig(projectConfig, {
                                webSearch: resolveSelectableOverride(
                                  nextValue,
                                  effectiveCodexSettings.webSearch,
                                  appConfig.agentSettings.codex.webSearch,
                                ),
                              }),
                              `codex:web-search:${String(nextValue)}`,
                            );
                          },
                          'codex:web-search',
                        )}
                      </div>
                    </>
                  ) : sectionId === 'claude_code' ? (
                    <>
                      <p className="caption-copy">
                        {claudeUnavailableReason ?? tRenderer('projectSettings.supportsClaude')}
                      </p>

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
                              void commitProjectConfig(
                                updateClaudeConfig(projectConfig, {
                                  model: resolveStringOverride(
                                    claudeModelDraft,
                                    appConfig.agentSettings.claudeCode.model,
                                  ),
                                }),
                                'claude:model',
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
                          effectiveClaudeSettings.effort,
                          claudeEffortOptions.map((value) => ({ label: value, value })),
                          (nextValue) => {
                            void commitProjectConfig(
                              updateClaudeConfig(projectConfig, {
                                effort: resolveSelectableOverride(
                                  nextValue,
                                  effectiveClaudeSettings.effort,
                                  appConfig.agentSettings.claudeCode.effort,
                                ),
                              }),
                              `claude:effort:${String(nextValue)}`,
                            );
                          },
                          'claude:effort',
                        )}
                      </div>

                      <div className="project-agent-field">
                        <label className="project-agent-field-label">permission</label>
                        {renderRadioPills(
                          effectiveClaudeSettings.permission,
                          claudePermissionOptions.map((value) => ({ label: value, value })),
                          (nextValue) => {
                            void commitProjectConfig(
                              updateClaudeConfig(projectConfig, {
                                permission: resolveSelectableOverride(
                                  nextValue,
                                  effectiveClaudeSettings.permission,
                                  appConfig.agentSettings.claudeCode.permission,
                                ),
                              }),
                              `claude:permission:${String(nextValue)}`,
                            );
                          },
                          'claude:permission',
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="caption-copy">
                        {openCodeUnavailableReason ?? tRenderer('projectSettings.supportsOpenCode')}
                      </p>

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
                              void commitProjectConfig(
                                updateOpenCodeConfig(projectConfig, {
                                  model: resolveStringOverride(
                                    openCodeModelDraft,
                                    appConfig.agentSettings.opencode.model,
                                  ),
                                }),
                                'opencode:model',
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
                              void commitProjectConfig(
                                updateOpenCodeConfig(projectConfig, {
                                  primaryAgent: resolveStringOverride(
                                    openCodePrimaryAgentDraft,
                                    appConfig.agentSettings.opencode.primaryAgent,
                                  ),
                                }),
                                'opencode:primary-agent',
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
                </section>
              </div>
            ) : null}
          </article>
        );
      })}
    </section>
  );
}
