import type { ReactElement } from 'react';
import { useEffect, useState } from 'react';

import type { ProjectBootstrapData } from '@shared/contracts/project';
import type { WindowContext } from '@shared/contracts/window';

import { LauncherView } from '@renderer/features/launcher/LauncherView';
import { ProjectHomeView } from '@renderer/features/project-home/ProjectHomeView';
import { SettingsWindowView } from '@renderer/features/settings/SettingsWindowView';
import { tRenderer } from './i18n';

type BootstrapState =
  | {
      status: 'loading';
    }
  | {
      status: 'error';
      message: string;
    }
  | {
      status: 'ready';
      context: WindowContext;
      projectBootstrap: ProjectBootstrapData | null;
    };

export function AppRoot(): ReactElement {
  const [state, setState] = useState<BootstrapState>({
    status: 'loading',
  });

  useEffect(() => {
    let cancelled = false;

    async function bootstrapRenderer(): Promise<void> {
      try {
        const context = await window.viboApp.getWindowContext();

        if (!context) {
          throw new Error('Window context was not found.');
        }

        if (context.kind !== 'project') {
          if (!cancelled) {
            setState({
              status: 'ready',
              context,
              projectBootstrap: null,
            });
          }

          return;
        }

        const projectBootstrap = await window.viboApp.getProjectBootstrap();

        if (!projectBootstrap) {
          throw new Error('Project bootstrap data was not found.');
        }

        if (!cancelled) {
          setState({
            status: 'ready',
            context,
            projectBootstrap,
          });
        }
      } catch (error) {
        if (!cancelled) {
          setState({
            status: 'error',
            message: error instanceof Error ? error.message : 'Unknown bootstrap error.',
          });
        }
      }
    }

    void bootstrapRenderer();

    return () => {
      cancelled = true;
    };
  }, []);

  if (state.status === 'loading') {
    return (
      <main className="page-shell">
        <section className="panel panel-centered">
          <p className="eyebrow">Vibo</p>
          <h1 className="page-title">{tRenderer('app.bootstrap.loadingTitle')}</h1>
          <p className="body-copy muted-copy">{tRenderer('app.bootstrap.loadingDetail')}</p>
        </section>
      </main>
    );
  }

  if (state.status === 'error') {
    return (
      <main className="page-shell">
        <section className="panel panel-centered panel-danger">
          <p className="eyebrow">{tRenderer('app.bootstrap.errorEyebrow')}</p>
          <h1 className="page-title">{tRenderer('app.bootstrap.errorTitle')}</h1>
          <p className="body-copy">{state.message}</p>
        </section>
      </main>
    );
  }

  if (state.context.kind === 'launcher') {
    return <LauncherView />;
  }

  if (state.context.kind === 'settings') {
    return <SettingsWindowView />;
  }

  return <ProjectHomeView projectBootstrap={state.projectBootstrap!} />;
}
