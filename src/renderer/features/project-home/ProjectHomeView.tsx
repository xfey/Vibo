import type { ReactElement } from 'react';
import { useEffect, useRef, useState } from 'react';

import type { MenuCommand } from '@shared/contracts/menu';
import type { ProjectBootstrapData } from '@shared/contracts/project';

import { AppFeedbackBanner, type AppFeedback } from '@renderer/app/AppFeedbackBanner';
import { setRendererLocale, tRenderer } from '@renderer/app/i18n';
import { TerminalWorkspaceView } from '@renderer/features/terminals/TerminalWorkspaceView';
import { useDocumentAppearance } from '@renderer/theme/appearance';

interface ProjectHomeViewProps {
  projectBootstrap: ProjectBootstrapData;
}

export function ProjectHomeView({ projectBootstrap }: ProjectHomeViewProps): ReactElement {
  const [currentBootstrap, setCurrentBootstrap] = useState(projectBootstrap);
  const [feedback, setFeedback] = useState<AppFeedback | null>(null);
  const [skillsRevision, setSkillsRevision] = useState(0);
  const [menuCommandEvent, setMenuCommandEvent] = useState<{
    id: number;
    command: MenuCommand;
  } | null>(null);
  const nextMenuCommandIdRef = useRef(1);
  const appearance = useDocumentAppearance(currentBootstrap.appConfig.appearance);

  useEffect(() => {
    setRendererLocale(currentBootstrap.appConfig.locale);
  }, [currentBootstrap.appConfig.locale]);

  useEffect(() => {
    return window.viboApp.onMenuCommand((command) => {
      setMenuCommandEvent({
        id: nextMenuCommandIdRef.current,
        command,
      });
      nextMenuCommandIdRef.current += 1;
    });
  }, []);

  useEffect(() => {
    const unsubscribeAppConfigUpdated = window.viboApp.onAppConfigUpdated((nextAppConfig) => {
      setCurrentBootstrap((currentState) => ({
        ...currentState,
        appConfig: nextAppConfig,
      }));
    });

    const unsubscribeGlobalSkillsUpdated = window.viboApp.onGlobalSkillsUpdated(() => {
      setSkillsRevision((currentValue) => currentValue + 1);
    });

    return () => {
      unsubscribeAppConfigUpdated();
      unsubscribeGlobalSkillsUpdated();
    };
  }, []);

  async function handleUpdateProjectConfig(
    nextProjectConfig: typeof currentBootstrap.projectConfig,
  ): Promise<void> {
    try {
      const normalizedConfig = await window.viboApp.updateProjectConfig({
        projectConfig: nextProjectConfig,
      });
      setCurrentBootstrap((currentState) => ({
        ...currentState,
        projectConfig: normalizedConfig,
      }));
      setFeedback(null);
    } catch (error) {
      setFeedback({
        tone: 'error',
        message:
          error instanceof Error
            ? error.message
            : tRenderer('projectHome.projectAgentConfigSaveFailed'),
      });
      throw error;
    }
  }

  async function handleUpdateProjectUiState(
    nextProjectUiState: typeof currentBootstrap.projectUiState,
  ): Promise<void> {
    try {
      const normalizedUiState = await window.viboApp.updateProjectUiState({
        projectUiState: nextProjectUiState,
      });
      setCurrentBootstrap((currentState) => ({
        ...currentState,
        projectUiState: normalizedUiState,
      }));
    } catch (error) {
      setFeedback({
        tone: 'error',
        message:
          error instanceof Error
            ? error.message
            : tRenderer('projectHome.projectLayoutSaveFailed'),
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

      <TerminalWorkspaceView
        appearanceSignature={appearance.signature}
        iconTheme={appearance.iconTheme}
        projectBootstrap={currentBootstrap}
        skillsRevision={skillsRevision}
        menuCommandEvent={menuCommandEvent}
        areWorkspaceShortcutsEnabled
        onUpdateProjectConfig={handleUpdateProjectConfig}
        onUpdateProjectUiState={handleUpdateProjectUiState}
      />
    </>
  );
}
