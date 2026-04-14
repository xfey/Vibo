import type { ReactElement } from 'react';
import { useEffect, useState } from 'react';

import { AppFeedbackBanner, type AppFeedback } from '@renderer/app/AppFeedbackBanner';
import { setRendererLocale, tRenderer } from '@renderer/app/i18n';
import { useDocumentAppearance } from '@renderer/theme/appearance';

import { SettingsOverlay } from './SettingsOverlay';

export function SettingsWindowView(): ReactElement {
  const [appConfig, setAppConfig] = useState<Awaited<ReturnType<typeof window.viboApp.getAppConfig>> | null>(null);
  const [feedback, setFeedback] = useState<AppFeedback | null>(null);

  useDocumentAppearance(appConfig?.appearance);

  useEffect(() => {
    let cancelled = false;

    void window.viboApp.getAppConfig().then(
      (nextAppConfig) => {
        if (!cancelled) {
          setRendererLocale(nextAppConfig.locale);
          setAppConfig(nextAppConfig);
        }
      },
      (error) => {
        if (!cancelled) {
          setFeedback({
            tone: 'error',
            message: error instanceof Error ? error.message : tRenderer('app.settings.loadFailed'),
          });
        }
      },
    );

    const unsubscribeAppConfigUpdated = window.viboApp.onAppConfigUpdated((nextAppConfig) => {
      setRendererLocale(nextAppConfig.locale);
      setAppConfig(nextAppConfig);
    });

    return () => {
      cancelled = true;
      unsubscribeAppConfigUpdated();
    };
  }, []);

  async function handleUpdateAppConfig(nextAppConfig: NonNullable<typeof appConfig>): Promise<void> {
    try {
      const normalizedConfig = await window.viboApp.updateAppConfig({
        appConfig: nextAppConfig,
      });
      setAppConfig(normalizedConfig);
      setFeedback(null);
    } catch (error) {
      const nextMessage = error instanceof Error ? error.message : tRenderer('app.settings.saveFailed');
      setFeedback({
        tone: 'error',
        message: nextMessage,
      });
      throw error;
    }
  }

  return (
    <>
      {feedback ? (
        <AppFeedbackBanner
          tone={feedback.tone}
          message={feedback.message}
          onDismiss={() => {
            setFeedback(null);
          }}
        />
      ) : null}

      {appConfig ? (
        <SettingsOverlay
          appConfig={appConfig}
          onUpdateAppConfig={handleUpdateAppConfig}
          onShowFeedback={setFeedback}
          onSkillsChanged={() => {
            void window.viboApp.notifyGlobalSkillsUpdated();
          }}
          showCloseButton={false}
        />
      ) : null}
    </>
  );
}
