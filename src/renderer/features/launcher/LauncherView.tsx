import type { FormEvent, MouseEvent, ReactElement } from 'react';
import { useEffect, useRef, useState } from 'react';

import type {
  BrowseRemoteDirectoriesResponse,
  SshHostOption,
} from '@shared/contracts/project';
import { getProjectLocationLabel, isLocalProject } from '@shared/domain/project';
import type { RecentProjectRecord } from '@shared/domain/recent-project';
import { formatRecentOpenedAt } from '@shared/i18n';

import { AppFeedbackBanner, type AppFeedback } from '@renderer/app/AppFeedbackBanner';
import { getRendererLocale, setRendererLocale, tRenderer } from '@renderer/app/i18n';
import viboAppIconUrl from '@renderer/icons/assets/brands/vibo/vibo-app-icon.png';
import launcherSplashArtworkUrl from '@renderer/icons/assets/brands/vibo/vibo-launcher-splash.jpg';
import { useDocumentAppearance } from '@renderer/theme/appearance';

import { RecentProjectsContextMenu } from './RecentProjectsContextMenu';

interface RecentProjectContextMenuState {
  x: number;
  y: number;
  record: RecentProjectRecord;
}

type RemoteProjectDialogStep = 'host' | 'path';

function normalizeRemotePathRequest(value: string): string {
  return value.trim();
}

function formatSshHostOptionMeta(option: SshHostOption): string | null {
  const segments = [
    option.user ? `${option.user}@` : '',
    option.hostname ?? '',
    option.port ? `:${option.port}` : '',
  ].join('');

  return segments.trim().length > 0 ? segments : null;
}

function OpenFolderActionIcon(): ReactElement {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path
        d="M3.5 7.5C3.5 6.94772 3.94772 6.5 4.5 6.5H9.2L11.1 8.4H19.5C20.0523 8.4 20.5 8.84772 20.5 9.4V17.5C20.5 18.0523 20.0523 18.5 19.5 18.5H4.5C3.94772 18.5 3.5 18.0523 3.5 17.5V7.5Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path d="M3.8 10.2H20.2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function RemoteProjectActionIcon(): ReactElement {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path
        d="M5.5 8.5C5.5 7.94772 5.94772 7.5 6.5 7.5H17.5C18.0523 7.5 18.5 7.94772 18.5 8.5V15.5C18.5 16.0523 18.0523 16.5 17.5 16.5H6.5C5.94772 16.5 5.5 16.0523 5.5 15.5V8.5Z"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path d="M8.5 12H15.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M12 9V15" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M9 19H15" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function SettingsGearIcon(): ReactElement {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path
        d="M12 8.75C10.2051 8.75 8.75 10.2051 8.75 12C8.75 13.7949 10.2051 15.25 12 15.25C13.7949 15.25 15.25 13.7949 15.25 12C15.25 10.2051 13.7949 8.75 12 8.75Z"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path
        d="M19 12C19 11.5172 18.9634 11.043 18.8929 10.5796L20.5 9.36217L18.6378 6.13782L16.7422 6.94434C16.0064 6.32685 15.1402 5.86174 14.1914 5.60371L13.9556 3.5625H10.0444L9.80859 5.60371C8.8598 5.86174 7.99365 6.32685 7.25781 6.94434L5.36217 6.13782L3.5 9.36217L5.10715 10.5796C5.03656 11.043 5 11.5172 5 12C5 12.4828 5.03656 12.957 5.10715 13.4204L3.5 14.6378L5.36217 17.8622L7.25781 17.0557C7.99365 17.6732 8.8598 18.1383 9.80859 18.3963L10.0444 20.4375H13.9556L14.1914 18.3963C15.1402 18.1383 16.0064 17.6732 16.7422 17.0557L18.6378 17.8622L20.5 14.6378L18.8929 13.4204C18.9634 12.957 19 12.4828 19 12Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function LauncherView(): ReactElement {
  const [appConfig, setAppConfig] = useState<Awaited<ReturnType<typeof window.viboApp.getAppConfig>> | null>(null);
  const [recentProjects, setRecentProjects] = useState<RecentProjectRecord[]>([]);
  const [isLoadingRecents, setIsLoadingRecents] = useState(true);
  const [isOpening, setIsOpening] = useState(false);
  const [isOpeningRemote, setIsOpeningRemote] = useState(false);
  const [isRemoteProjectDialogOpen, setIsRemoteProjectDialogOpen] = useState(false);
  const [remoteDialogStep, setRemoteDialogStep] = useState<RemoteProjectDialogStep>('host');
  const [remoteHost, setRemoteHost] = useState('');
  const [remoteConnectedHost, setRemoteConnectedHost] = useState<string | null>(null);
  const [remotePath, setRemotePath] = useState('');
  const [remoteBrowseData, setRemoteBrowseData] = useState<BrowseRemoteDirectoriesResponse | null>(null);
  const [remoteResolvedRequest, setRemoteResolvedRequest] = useState<string | null>(null);
  const [sshHostOptions, setSshHostOptions] = useState<SshHostOption[]>([]);
  const [isLoadingSshHosts, setIsLoadingSshHosts] = useState(false);
  const [isProbingSshHost, setIsProbingSshHost] = useState(false);
  const [isBrowsingRemotePath, setIsBrowsingRemotePath] = useState(false);
  const [remoteDialogError, setRemoteDialogError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<AppFeedback | null>(null);
  const [contextMenu, setContextMenu] = useState<RecentProjectContextMenuState | null>(null);
  const isRemoteDialogBusyRef = useRef(false);
  const remoteBrowseRequestSequenceRef = useRef(0);

  const settingsDisabled = appConfig === null;

  useDocumentAppearance(appConfig?.appearance);

  useEffect(() => {
    isRemoteDialogBusyRef.current = isOpeningRemote || isProbingSshHost;
  }, [isOpeningRemote, isProbingSshHost]);

  useEffect(() => {
    let cancelled = false;

    async function hydrateLauncher(): Promise<void> {
      try {
        const [nextAppConfig, recentProjectsResponse] = await Promise.all([
          window.viboApp.getAppConfig(),
          window.viboApp.listRecentProjects(),
        ]);

        if (!cancelled) {
          setRendererLocale(nextAppConfig.locale);
          setAppConfig(nextAppConfig);
          setRecentProjects(recentProjectsResponse.items);
        }
      } catch (error) {
        if (!cancelled) {
          setFeedback({
            tone: 'error',
            message: error instanceof Error ? error.message : tRenderer('launcher.loadFailed'),
          });
        }
      } finally {
        if (!cancelled) {
          setIsLoadingRecents(false);
        }
      }
    }

    void hydrateLauncher();

    const unsubscribeAppConfigUpdated = window.viboApp.onAppConfigUpdated((nextAppConfig) => {
      setRendererLocale(nextAppConfig.locale);
      setAppConfig(nextAppConfig);
    });

    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        setContextMenu(null);
        closeRemoteProjectDialog();
      }
    }

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      cancelled = true;
      unsubscribeAppConfigUpdated();
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  useEffect(() => {
    if (!isRemoteProjectDialogOpen) {
      return;
    }

    let cancelled = false;

    async function loadSshHosts(): Promise<void> {
      try {
        setIsLoadingSshHosts(true);
        const response = await window.viboApp.listSshHosts();

        if (!cancelled) {
          setSshHostOptions(response.items);
        }
      } catch (error) {
        if (!cancelled) {
          setRemoteDialogError(
            error instanceof Error ? error.message : tRenderer('launcher.remote.loadHostsFailed'),
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoadingSshHosts(false);
        }
      }
    }

    void loadSshHosts();

    return () => {
      cancelled = true;
    };
  }, [isRemoteProjectDialogOpen]);

  useEffect(() => {
    if (
      !isRemoteProjectDialogOpen ||
      remoteDialogStep !== 'path' ||
      remoteConnectedHost === null
    ) {
      return;
    }

    const normalizedRequest = normalizeRemotePathRequest(remotePath);

    if (normalizedRequest.length === 0) {
      setRemoteResolvedRequest(null);
      setIsBrowsingRemotePath(false);
      return;
    }

    const requestSequence = remoteBrowseRequestSequenceRef.current + 1;
    remoteBrowseRequestSequenceRef.current = requestSequence;
    setIsBrowsingRemotePath(true);

    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const response = await window.viboApp.browseRemoteDirectories({
            host: remoteConnectedHost,
            path: normalizedRequest,
          });

          if (remoteBrowseRequestSequenceRef.current !== requestSequence) {
            return;
          }

          setRemoteBrowseData(response);
          setRemoteResolvedRequest(normalizedRequest);
          setRemoteDialogError(null);
        } catch (error) {
          if (remoteBrowseRequestSequenceRef.current !== requestSequence) {
            return;
          }

          setRemoteResolvedRequest(null);
          setRemoteDialogError(
            error instanceof Error ? error.message : tRenderer('launcher.remote.browseFailed'),
          );
        } finally {
          if (remoteBrowseRequestSequenceRef.current === requestSequence) {
            setIsBrowsingRemotePath(false);
          }
        }
      })();
    }, 280);

    return () => {
      window.clearTimeout(timer);
    };
  }, [isRemoteProjectDialogOpen, remoteConnectedHost, remoteDialogStep, remotePath]);

  async function handleOpenFolder(): Promise<void> {
    try {
      setIsOpening(true);

      const result = await window.viboApp.openProjectFolder();

      if (result.canceled) {
        return;
      }
    } catch (error) {
      setFeedback({
        tone: 'error',
        message: error instanceof Error ? error.message : tRenderer('launcher.openProjectFailed'),
      });
    } finally {
      setIsOpening(false);
    }
  }

  async function handleOpenRecentProject(projectFingerprint: string): Promise<void> {
    try {
      setIsOpening(true);
      const result = await window.viboApp.openRecentProject({
        projectFingerprint,
      });

      if (result.canceled) {
        return;
      }
    } catch (error) {
      setFeedback({
        tone: 'error',
        message: error instanceof Error ? error.message : tRenderer('launcher.openRecentFailed'),
      });
    } finally {
      setIsOpening(false);
    }
  }

  async function handleOpenRemoteProject(): Promise<void> {
    try {
      setIsOpeningRemote(true);
      setRemoteDialogError(null);
      const result = await window.viboApp.openRemoteProject({
        host: (remoteConnectedHost ?? remoteHost).trim(),
        remotePath: remoteBrowseData?.resolvedPath ?? remotePath,
      });

      if (result.canceled) {
        return;
      }

      closeRemoteProjectDialog();
      setFeedback(null);
    } catch (error) {
      setRemoteDialogError(error instanceof Error ? error.message : tRenderer('launcher.remote.openFailed'));
    } finally {
      setIsOpeningRemote(false);
    }
  }

  async function handleRemoveRecentProject(record: RecentProjectRecord): Promise<void> {
    try {
      const response = await window.viboApp.removeRecentProject({
        projectFingerprint: record.project.fingerprint,
      });
      setRecentProjects(response.items);
      setContextMenu(null);
    } catch (error) {
      setFeedback({
        tone: 'error',
        message: error instanceof Error ? error.message : tRenderer('launcher.removeRecentFailed'),
      });
    }
  }

  async function handleRevealRecentProject(record: RecentProjectRecord): Promise<void> {
    try {
      await window.viboApp.revealRecentProject({
        projectFingerprint: record.project.fingerprint,
      });
      setContextMenu(null);
    } catch (error) {
      setFeedback({
        tone: 'error',
        message: error instanceof Error ? error.message : tRenderer('launcher.revealRecentFailed'),
      });
    }
  }

  function stopRemoteDialogClickEvent(event: MouseEvent<HTMLElement>): void {
    event.stopPropagation();
  }

  function stopRemoteDialogContextMenuEvent(event: MouseEvent<HTMLElement>): void {
    event.preventDefault();
    event.stopPropagation();
  }

  function resetRemoteProjectDialogState(): void {
    remoteBrowseRequestSequenceRef.current += 1;
    setRemoteDialogStep('host');
    setRemoteHost('');
    setRemoteConnectedHost(null);
    setRemotePath('');
    setRemoteBrowseData(null);
    setRemoteResolvedRequest(null);
    setSshHostOptions([]);
    setIsLoadingSshHosts(false);
    setIsProbingSshHost(false);
    setIsBrowsingRemotePath(false);
    setRemoteDialogError(null);
  }

  function closeRemoteProjectDialog(): void {
    if (isRemoteDialogBusyRef.current) {
      return;
    }

    setIsRemoteProjectDialogOpen(false);
    resetRemoteProjectDialogState();
  }

  async function handleOpenSettingsWindow(): Promise<void> {
    try {
      await window.viboApp.openSettingsWindow();
    } catch (error) {
      setFeedback({
        tone: 'error',
        message: error instanceof Error ? error.message : tRenderer('launcher.openSettingsFailed'),
      });
    }
  }

  function openRemoteProjectDialog(): void {
    resetRemoteProjectDialogState();
    setIsRemoteProjectDialogOpen(true);
  }

  async function handleConnectRemoteHost(): Promise<void> {
    try {
      const normalizedHost = remoteHost.trim();

      if (normalizedHost.length === 0) {
        return;
      }

      setIsProbingSshHost(true);
      setRemoteDialogError(null);
      const response = await window.viboApp.probeSshHost({
        host: normalizedHost,
      });

      setRemoteConnectedHost(normalizedHost);
      setRemoteDialogStep('path');
      setRemotePath(response.homePath);
      setRemoteBrowseData(null);
      setRemoteResolvedRequest(null);
    } catch (error) {
      setRemoteDialogError(error instanceof Error ? error.message : tRenderer('launcher.remote.connectFailed'));
    } finally {
      setIsProbingSshHost(false);
    }
  }

  function handleSubmitRemoteProjectForm(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();

    if (remoteDialogStep === 'host') {
      void handleConnectRemoteHost();
      return;
    }

    void handleOpenRemoteProject();
  }

  const normalizedRemotePathRequest = normalizeRemotePathRequest(remotePath);
  const isRemotePathReady =
    remoteDialogStep === 'path' &&
    remoteConnectedHost !== null &&
    remoteBrowseData !== null &&
    remoteDialogError === null &&
    !isBrowsingRemotePath &&
    remoteResolvedRequest === normalizedRemotePathRequest;
  const launcherRecentProjects = [...recentProjects].sort(
    (left, right) =>
      new Date(String(right.lastOpenedAt)).getTime() - new Date(String(left.lastOpenedAt)).getTime(),
  );

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

      <main className="launcher-app-shell">
        <section className="launcher-compact-shell">
          <section className="launcher-brand-panel">
            <div className="launcher-splash-frame" aria-hidden="true">
              <img
                src={launcherSplashArtworkUrl}
                alt=""
                className="launcher-splash-art"
                draggable={false}
              />
            </div>

            <div className="launcher-brand-content">
              <div className="launcher-brand-lockup">
                <h1 className="launcher-brand-title">
                  <span className="launcher-brand-mark-shell" aria-hidden="true">
                    <img src={viboAppIconUrl} alt="" className="launcher-brand-mark" />
                  </span>
                  <span>Vibo</span>
                </h1>
              </div>

              <button
                className="launcher-settings-trigger"
                onClick={() => {
                  void handleOpenSettingsWindow();
                }}
                disabled={settingsDisabled}
                aria-label={tRenderer('launcher.openSettings')}
                title={tRenderer('launcher.settings')}
              >
                <SettingsGearIcon />
              </button>
            </div>
          </section>

          <aside className="launcher-history-panel">
            <section className="launcher-recents-panel">
              {isLoadingRecents ? (
                <div className="launcher-empty-state">{tRenderer('launcher.loadingRecents')}</div>
              ) : launcherRecentProjects.length === 0 ? (
                <div className="launcher-empty-state">{tRenderer('launcher.emptyRecents')}</div>
              ) : (
                <div className="launcher-recents-list">
                  {launcherRecentProjects.map((record) => (
                    <button
                      key={record.project.fingerprint}
                      className="launcher-recent-row"
                      onClick={() => {
                        void handleOpenRecentProject(record.project.fingerprint);
                      }}
                      onContextMenu={(event) => {
                        event.preventDefault();
                        setContextMenu({
                          x: event.clientX,
                          y: event.clientY,
                          record,
                        });
                      }}
                      disabled={isOpening}
                    >
                      <div className="launcher-recent-row-head">
                        <div className="launcher-recent-row-title-group">
                          <span
                            className={`launcher-recent-kind-pill ${
                              isLocalProject(record.project)
                                ? 'launcher-recent-kind-pill-local'
                                : 'launcher-recent-kind-pill-remote'
                            }`}
                          >
                            {isLocalProject(record.project)
                              ? tRenderer('common.kind.local')
                              : tRenderer('common.kind.remote')}
                          </span>
                          <span className="launcher-recent-row-title">{record.project.displayName}</span>
                        </div>
                        <span className="launcher-recent-row-time">
                          {formatRecentOpenedAt(getRendererLocale(), record.lastOpenedAt)}
                        </span>
                      </div>
                      <span className="launcher-recent-row-path">{getProjectLocationLabel(record.project)}</span>
                    </button>
                  ))}
                </div>
              )}
            </section>

            <div
              className="launcher-history-actions"
              aria-label={tRenderer('launcher.projectActions')}
            >
              <button
                className="launcher-history-action"
                onClick={handleOpenFolder}
                disabled={isOpening}
              >
                <span className="launcher-history-action-icon" aria-hidden="true">
                  <OpenFolderActionIcon />
                </span>
                <span>
                  {isOpening ? tRenderer('launcher.opening') : tRenderer('common.actions.openProject')}
                </span>
              </button>

              <button
                className="launcher-history-action"
                onClick={openRemoteProjectDialog}
                disabled={isOpening || isOpeningRemote}
              >
                <span className="launcher-history-action-icon" aria-hidden="true">
                  <RemoteProjectActionIcon />
                </span>
                <span>
                  {isOpeningRemote
                    ? tRenderer('launcher.connecting')
                    : tRenderer('common.actions.openRemote')}
                </span>
              </button>
            </div>
          </aside>
        </section>
      </main>

      {contextMenu ? (
        <RecentProjectsContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          canReveal={isLocalProject(contextMenu.record.project)}
          onReveal={() => {
            void handleRevealRecentProject(contextMenu.record);
          }}
          onRemove={() => {
            void handleRemoveRecentProject(contextMenu.record);
          }}
          onClose={() => {
            setContextMenu(null);
          }}
        />
      ) : null}

      {isRemoteProjectDialogOpen ? (
        <div
          className="launcher-remote-modal-backdrop"
          onClick={() => {
            closeRemoteProjectDialog();
          }}
        >
          <section
            className="launcher-remote-modal panel"
            onClick={stopRemoteDialogClickEvent}
            onContextMenu={stopRemoteDialogContextMenuEvent}
          >
            <div className="launcher-remote-modal-header">
              <h2 className="settings-section-title">{tRenderer('launcher.remote.title')}</h2>
              <p className="body-copy">
                {remoteDialogStep === 'host'
                  ? tRenderer('launcher.remote.stepHostCopy')
                  : tRenderer('launcher.remote.stepPathCopy', {
                      host: remoteConnectedHost ?? remoteHost,
                    })}
              </p>
            </div>

            <form className="launcher-remote-modal-form" onSubmit={handleSubmitRemoteProjectForm}>
              {remoteDialogStep === 'host' ? (
                <label className="launcher-remote-modal-field">
                  <span className="eyebrow-copy">{tRenderer('launcher.remote.sshHost')}</span>
                  <input
                    className="settings-text-input"
                    value={remoteHost}
                    onChange={(event) => {
                      setRemoteHost(event.target.value);
                      setRemoteDialogError(null);
                    }}
                    placeholder={tRenderer('launcher.remote.hostPlaceholder')}
                    list="launcher-ssh-host-options"
                    autoFocus
                  />
                  <datalist id="launcher-ssh-host-options">
                    {sshHostOptions.map((option) => (
                      <option key={option.alias} value={option.alias}>
                        {formatSshHostOptionMeta(option) ?? option.alias}
                      </option>
                    ))}
                  </datalist>
                  <p className="launcher-remote-inline-note">
                    {isLoadingSshHosts
                      ? tRenderer('launcher.remote.readingSshConfig')
                      : sshHostOptions.length > 0
                        ? tRenderer('launcher.remote.foundAliases', {
                            count: sshHostOptions.length,
                          })
                        : tRenderer('launcher.remote.noAliases')}
                  </p>
                </label>
              ) : (
                <>
                  <div className="launcher-remote-browser-toolbar">
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => {
                        if (remoteBrowseData?.parentPath) {
                          setRemotePath(remoteBrowseData.parentPath);
                        }
                      }}
                      disabled={isOpeningRemote || isBrowsingRemotePath || !remoteBrowseData?.parentPath}
                    >
                      {tRenderer('launcher.remote.backToParent')}
                    </button>
                  </div>

                  <label className="launcher-remote-modal-field">
                    <span className="eyebrow-copy">{tRenderer('launcher.remote.remotePath')}</span>
                    <input
                      className="settings-text-input"
                      value={remotePath}
                      onChange={(event) => {
                        setRemotePath(event.target.value);
                        setRemoteDialogError(null);
                      }}
                      placeholder={tRenderer('launcher.remote.pathPlaceholder')}
                      autoFocus
                    />
                    <p className="launcher-remote-inline-note">
                      {isBrowsingRemotePath
                        ? tRenderer('launcher.remote.readingDirectory')
                        : remoteBrowseData
                          ? remoteBrowseData.resolvedPath
                          : tRenderer('launcher.remote.enterPathHint')}
                    </p>
                  </label>

                  <section className="launcher-remote-directory-panel">
                    <div className="launcher-remote-directory-list">
                      {remoteBrowseData && remoteBrowseData.directories.length > 0 ? (
                        remoteBrowseData.directories.map((directory) => (
                          <button
                            key={directory.path}
                            type="button"
                            className="launcher-remote-directory-item"
                            onClick={() => {
                              setRemotePath(directory.path);
                            }}
                            disabled={isOpeningRemote}
                            title={directory.path}
                          >
                            <span className="launcher-remote-directory-item-name">
                              {directory.name}
                            </span>
                          </button>
                        ))
                      ) : (
                        <p className="launcher-remote-empty-note">
                          {isBrowsingRemotePath
                            ? tRenderer('launcher.remote.loadingDirectories')
                            : remoteBrowseData
                              ? tRenderer('launcher.remote.emptyDirectories')
                              : tRenderer('launcher.remote.directoriesWillAppear')}
                        </p>
                      )}
                    </div>
                  </section>
                </>
              )}

              {remoteDialogError ? (
                <p className="launcher-remote-error-note">{remoteDialogError}</p>
              ) : null}

              <div className="launcher-remote-modal-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={closeRemoteProjectDialog}
                  disabled={isOpeningRemote || isProbingSshHost}
                >
                  {tRenderer('common.actions.cancel')}
                </button>
                {remoteDialogStep === 'host' ? (
                  <button
                    type="submit"
                    className="primary-button"
                    disabled={isProbingSshHost || remoteHost.trim().length === 0}
                  >
                    {isProbingSshHost
                      ? tRenderer('launcher.connecting')
                      : tRenderer('common.actions.connect')}
                  </button>
                ) : (
                  <button
                    type="submit"
                    className="primary-button"
                    disabled={isOpeningRemote || !isRemotePathReady}
                  >
                    {isOpeningRemote
                      ? tRenderer('launcher.opening')
                      : tRenderer('common.actions.openThisDirectory')}
                  </button>
                )}
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </>
  );
}
