import type { ReactElement } from 'react';
import { useEffect, useMemo, useState } from 'react';

import {
  DEFAULT_CODE_FONT_LIST,
  DEFAULT_CODE_FONT_SIZE,
  MAX_CODE_FONT_SIZE,
  MIN_CODE_FONT_SIZE,
  type AppLocale,
  type AppConfig,
  type ResolvedTheme,
} from '@shared/domain/config';
import {
  getLanguageDisplayLabel,
  translate,
} from '@shared/i18n';
import type { AppFeedback } from '@renderer/app/AppFeedbackBanner';
import { tRenderer } from '@renderer/app/i18n';
import { AgentBrandLabel, AgentBrandWatermark } from '@renderer/icons/agent-branding';
import { FileIconThemePreview } from '@renderer/icons/file-icons';
import {
  listThemePresetDescriptors,
  resolveThemePresetId,
} from '@renderer/theme/theme-preset-registry';

import type { AgentId } from '@shared/domain/agent';

import { AgentSettingsSection } from './AgentSettingsSection';
import { SkillsSettingsSection } from './SkillsSettingsSection';

type SettingsSectionId = 'general' | 'appearance' | 'agents' | 'skills';

interface SettingsOverlayProps {
  appConfig: AppConfig;
  isOpen?: boolean;
  onClose?: () => void;
  onUpdateAppConfig: (nextAppConfig: AppConfig) => Promise<void>;
  onShowFeedback: (feedback: AppFeedback) => void;
  onSkillsChanged: () => void;
  showCloseButton?: boolean;
}

function readSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return 'light';
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function ThemePalettePreview({
  paletteLabel,
  paletteSwatches,
}: {
  paletteLabel: string;
  paletteSwatches: [string, string, string];
}): ReactElement {
  return (
    <span className="theme-palette-preview" aria-hidden="true">
      <span className="theme-palette-preview-icon">
        {paletteSwatches.map((swatch, index) => (
          <span
            key={`${paletteLabel}:${index}`}
            className="theme-palette-preview-dot"
            style={{ backgroundColor: swatch }}
          />
        ))}
      </span>
      <span className="theme-palette-preview-label">{paletteLabel}</span>
    </span>
  );
}

function normalizeCodeFontSizeInput(rawValue: string): number {
  const parsedValue = Number.parseInt(rawValue, 10);

  if (!Number.isFinite(parsedValue)) {
    return DEFAULT_CODE_FONT_SIZE;
  }

  return Math.min(MAX_CODE_FONT_SIZE, Math.max(MIN_CODE_FONT_SIZE, parsedValue));
}

export function SettingsOverlay({
  appConfig,
  isOpen = true,
  onClose,
  onUpdateAppConfig,
  onShowFeedback,
  onSkillsChanged,
  showCloseButton = true,
}: SettingsOverlayProps): ReactElement | null {
  const [fontDraft, setFontDraft] = useState(appConfig.appearance.codeFont);
  const [fontSizeDraft, setFontSizeDraft] = useState(String(appConfig.appearance.codeFontSize));
  const [activeSection, setActiveSection] = useState<SettingsSectionId>('general');
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const appAgentOptions: Array<{
    value: AgentId;
    description: string;
  }> = [
    {
      value: 'codex',
      description: tRenderer('projectSettings.defaultAgent.codex'),
    },
    {
      value: 'claude_code',
      description: tRenderer('projectSettings.defaultAgent.claude'),
    },
    {
      value: 'opencode',
      description: tRenderer('projectSettings.defaultAgent.opencode'),
    },
    {
      value: 'shell',
      description: tRenderer('projectSettings.defaultAgent.shell'),
    },
  ];
  const languageOptions: AppLocale[] = ['zh-CN', 'en'];
  const settingsNavigationItems: Array<{
    id: SettingsSectionId;
    label: string;
  }> = [
    {
      id: 'general',
      label: tRenderer('settings.navigation.general'),
    },
    {
      id: 'appearance',
      label: tRenderer('settings.navigation.appearance'),
    },
    {
      id: 'agents',
      label: tRenderer('settings.navigation.agents'),
    },
    {
      id: 'skills',
      label: tRenderer('settings.navigation.skills'),
    },
  ];
  const systemTheme = readSystemTheme();
  const themeOptions = useMemo(
    () => listThemePresetDescriptors(appConfig.appearance.themes, appConfig.locale),
    [appConfig.appearance.themes, appConfig.locale],
  );
  const resolvedThemePresetId = resolveThemePresetId(
    appConfig.appearance.theme,
    appConfig.appearance.themes,
    systemTheme,
  );

  useEffect(() => {
    setFontDraft(appConfig.appearance.codeFont);
  }, [appConfig.appearance.codeFont]);

  useEffect(() => {
    setFontSizeDraft(String(appConfig.appearance.codeFontSize));
  }, [appConfig.appearance.codeFontSize]);

  useEffect(() => {
    if (!isOpen || !onClose) {
      return;
    }

    const closeHandler = onClose;

    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        closeHandler();
      }
    }

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  async function commitAppConfig(nextAppConfig: AppConfig, key: string): Promise<void> {
    try {
      setSavingKey(key);
      await onUpdateAppConfig(nextAppConfig);
    } finally {
      setSavingKey((currentKey) => (currentKey === key ? null : currentKey));
    }
  }

  function renderActiveSection(): ReactElement {
    switch (activeSection) {
      case 'general':
        return (
          <section id="settings-general" className="settings-section-block">
            <header className="settings-section-header">
              <div>
                <h2 className="settings-section-title">{tRenderer('settings.general.title')}</h2>
              </div>
            </header>

            <article className="settings-card">
              <div className="settings-card-copy">
                <h3 className="settings-subsection-title">{tRenderer('settings.general.language')}</h3>
                <p className="body-copy">{tRenderer('settings.general.languageDescription')}</p>
              </div>

              <div className="settings-choice-grid">
                {languageOptions.map((option) => (
                  <button
                    key={option}
                    className={`settings-choice-card ${appConfig.locale === option ? 'settings-choice-card-active' : ''}`}
                    onClick={() => {
                      if (appConfig.locale === option) {
                        return;
                      }

                      void commitAppConfig(
                        {
                          ...appConfig,
                          locale: option,
                        },
                        `locale:${option}`,
                      ).then(() => {
                        window.alert(translate(option, 'app.restart.notice'));
                      });
                    }}
                    disabled={savingKey !== null}
                  >
                    <span className="settings-choice-title">
                      {getLanguageDisplayLabel(appConfig.locale, option)}
                    </span>
                  </button>
                ))}
              </div>
            </article>

            <article className="settings-card">
              <div className="settings-card-copy">
                <h3 className="settings-subsection-title">{tRenderer('settings.general.defaultAgent')}</h3>
                <p className="body-copy">{tRenderer('settings.general.defaultAgentDescription')}</p>
              </div>

              <div className="settings-choice-grid">
                {appAgentOptions.map((option) => (
                  <button
                    key={option.value}
                    className={`settings-choice-card ${appConfig.defaultAgent === option.value ? 'settings-choice-card-active' : ''}`}
                    onClick={() => {
                      void commitAppConfig(
                        {
                          ...appConfig,
                          defaultAgent: option.value,
                        },
                        `default-agent:${option.value}`,
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
                ))}
              </div>
            </article>
          </section>
        );
      case 'appearance':
        return (
          <section id="settings-appearance" className="settings-section-block">
            <header className="settings-section-header">
              <div>
                <h2 className="settings-section-title">{tRenderer('settings.appearance.title')}</h2>
              </div>
            </header>

            <article className="settings-card">
              <div className="settings-card-copy">
                <h3 className="settings-subsection-title">{tRenderer('settings.appearance.theme')}</h3>
                <p className="body-copy">{tRenderer('settings.appearance.themeDescription')}</p>
              </div>

              <div className="settings-choice-grid settings-theme-choice-grid">
                {themeOptions.map((option) => (
                  <button
                    key={option.id}
                    className={`settings-choice-card settings-theme-choice-card ${resolvedThemePresetId === option.id ? 'settings-choice-card-active' : ''}`}
                    onClick={() => {
                      void commitAppConfig(
                        {
                          ...appConfig,
                          appearance: {
                            ...appConfig.appearance,
                            theme: option.id,
                          },
                        },
                        `theme:${option.id}`,
                      );
                    }}
                    disabled={savingKey !== null}
                  >
                    <span className="settings-choice-title-row">
                      <span className="settings-choice-title">{option.label}</span>
                      <span className="settings-choice-supporting">
                        {option.source === 'built-in'
                          ? tRenderer('common.labels.builtIn')
                          : tRenderer('common.labels.custom')}
                      </span>
                    </span>
                    <span className="settings-theme-preview-row">
                      <FileIconThemePreview iconTheme={option.iconTheme} />
                      <ThemePalettePreview
                        paletteLabel={option.paletteLabel}
                        paletteSwatches={option.paletteSwatches}
                      />
                    </span>
                    <span className="settings-choice-description">{option.description}</span>
                  </button>
                ))}
              </div>
            </article>

            <article className="settings-card">
              <div className="settings-card-copy">
                <h3 className="settings-subsection-title">{tRenderer('settings.appearance.codeFont')}</h3>
                <p className="body-copy">{tRenderer('settings.appearance.codeFontDescription')}</p>
              </div>

              <div className="settings-inline-form">
                <input
                  className="settings-text-input"
                  value={fontDraft}
                  onChange={(event) => {
                    setFontDraft(event.target.value);
                  }}
                  placeholder="SF Mono, Monaco, Consolas, monospace"
                />
                <button
                  className="secondary-button"
                  onClick={() => {
                    void commitAppConfig(
                      {
                        ...appConfig,
                        appearance: {
                          ...appConfig.appearance,
                          codeFont:
                            fontDraft.trim().length > 0
                              ? fontDraft.trim()
                              : DEFAULT_CODE_FONT_LIST,
                        },
                      },
                      'code-font',
                    );
                  }}
                  disabled={savingKey !== null}
                >
                  {tRenderer('common.actions.apply')}
                </button>
              </div>
            </article>

            <article className="settings-card">
              <div className="settings-card-copy">
                <h3 className="settings-subsection-title">{tRenderer('settings.appearance.codeFontSize')}</h3>
                <p className="body-copy">{tRenderer('settings.appearance.codeFontSizeDescription')}</p>
              </div>

              <div className="settings-inline-form">
                <input
                  className="settings-text-input settings-number-input"
                  type="number"
                  inputMode="numeric"
                  min={MIN_CODE_FONT_SIZE}
                  max={MAX_CODE_FONT_SIZE}
                  step={1}
                  value={fontSizeDraft}
                  onChange={(event) => {
                    setFontSizeDraft(event.target.value);
                  }}
                  placeholder={String(DEFAULT_CODE_FONT_SIZE)}
                />
                <button
                  className="secondary-button"
                  onClick={() => {
                    const nextCodeFontSize = normalizeCodeFontSizeInput(fontSizeDraft);

                    setFontSizeDraft(String(nextCodeFontSize));
                    void commitAppConfig(
                      {
                        ...appConfig,
                        appearance: {
                          ...appConfig.appearance,
                          codeFontSize: nextCodeFontSize,
                        },
                      },
                      'code-font-size',
                    );
                  }}
                  disabled={savingKey !== null}
                >
                  {tRenderer('common.actions.apply')}
                </button>
              </div>
            </article>
          </section>
        );
      case 'agents':
        return (
          <AgentSettingsSection
            appConfig={appConfig}
            onUpdateAppConfig={onUpdateAppConfig}
          />
        );
      case 'skills':
        return (
          <SkillsSettingsSection onShowFeedback={onShowFeedback} onSkillsChanged={onSkillsChanged} />
        );
      default:
        return (
          <section id="settings-general" className="settings-section-block">
            <header className="settings-section-header">
                <div>
                  <h2 className="settings-section-title">{tRenderer('settings.general.title')}</h2>
                </div>
              </header>
            </section>
        );
    }
  }

  return (
    <div className="settings-overlay-shell">
      <section className="settings-overlay-body settings-layout-body">
        <aside className="settings-sidebar settings-layout-sidebar">
          <div className="settings-layout-primary">
            <nav
              className="settings-outline settings-outline-sidebar"
              aria-label={tRenderer('settings.navigation.general')}
            >
              {settingsNavigationItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`settings-outline-link ${activeSection === item.id ? 'settings-outline-link-active' : ''}`}
                  aria-pressed={activeSection === item.id}
                  onClick={() => {
                    setActiveSection(item.id);
                  }}
                >
                  {item.label}
                </button>
              ))}
            </nav>
          </div>

          {showCloseButton && onClose ? (
            <>
              <div className="settings-layout-spacer" />

              <button className="secondary-button settings-close-button" onClick={onClose}>
                {tRenderer('common.actions.close')}
              </button>
            </>
          ) : null}
        </aside>

        <section className="settings-main settings-layout-main">
          <section className="settings-content-shell">
            <div className="settings-content">
              {renderActiveSection()}
            </div>
          </section>
        </section>
      </section>
    </div>
  );
}
