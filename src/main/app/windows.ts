import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { app, BrowserWindow, nativeTheme } from 'electron';

import { ipcChannels } from '@main/ipc/channels';
import type { ProjectBootstrapData } from '@shared/contracts/project';
import type { WindowContext } from '@shared/contracts/window';
import type { AppConfig, ProjectConfig, ProjectUiState } from '@shared/domain/config';
import { getProjectWindowTitle } from '@shared/domain/project';
import { getThemePresetDescriptor } from '@renderer/theme/theme-preset-registry';
import { tMain } from './i18n';

interface WindowRecord {
  browserWindow: BrowserWindow;
  context: WindowContext;
  projectBootstrap?: ProjectBootstrapData;
}

const windowRecords = new Map<number, WindowRecord>();

function buildPreloadPath(): string {
  return fileURLToPath(new URL('../preload/index.mjs', import.meta.url));
}

async function loadRenderer(browserWindow: BrowserWindow): Promise<void> {
  const rendererDevUrl = process.env.ELECTRON_RENDERER_URL;

  if (rendererDevUrl) {
    await browserWindow.loadURL(rendererDevUrl);
    return;
  }

  const rendererHtmlPath = fileURLToPath(new URL('../renderer/index.html', import.meta.url));
  await browserWindow.loadFile(rendererHtmlPath);
}

function trackWindow(record: WindowRecord): void {
  const id = record.browserWindow.webContents.id;

  windowRecords.set(id, record);
  record.browserWindow.on('unresponsive', () => {
    console.error('[window] browser window became unresponsive', {
      id,
      title: record.browserWindow.getTitle(),
      context: record.context.kind,
    });
  });
  record.browserWindow.on('responsive', () => {
    console.info('[window] browser window responsive again', {
      id,
      title: record.browserWindow.getTitle(),
      context: record.context.kind,
    });
  });
  record.browserWindow.webContents.on('render-process-gone', (_event, details) => {
    console.error('[window] render process gone', {
      id,
      title: record.browserWindow.getTitle(),
      context: record.context.kind,
      reason: details.reason,
      exitCode: details.exitCode,
    });
  });
  record.browserWindow.on('closed', () => {
    windowRecords.delete(id);
  });
}

function focusBrowserWindow(browserWindow: BrowserWindow): void {
  if (browserWindow.isDestroyed()) {
    return;
  }

  if (process.platform === 'darwin' && app.isHidden()) {
    app.show();
  }

  if (browserWindow.isMinimized()) {
    browserWindow.restore();
  }

  browserWindow.show();
  browserWindow.focus();

  if (process.platform === 'darwin') {
    app.focus({
      steal: true,
    });
  }
}

function findWindowRecordByKind(kind: WindowContext['kind']): WindowRecord | null {
  for (const [id, record] of windowRecords) {
    if (record.browserWindow.isDestroyed()) {
      windowRecords.delete(id);
      continue;
    }

    if (record.context.kind === kind) {
      return record;
    }
  }

  return null;
}

function getWindowBackgroundColor(appConfig: AppConfig): string {
  const themeDescriptor = getThemePresetDescriptor(
    appConfig.appearance.theme,
    appConfig.appearance.themes,
    nativeTheme.shouldUseDarkColors ? 'dark' : 'light',
  );

  return themeDescriptor.tokens['surface-page'] ?? '#f5f6f8';
}

export async function createLauncherWindow(appConfig: AppConfig): Promise<BrowserWindow> {
  const browserWindow = new BrowserWindow({
    width: 844,
    height: 500,
    minWidth: 784,
    minHeight: 440,
    backgroundColor: getWindowBackgroundColor(appConfig),
    title: tMain('app.name'),
    titleBarStyle: process.platform === 'darwin' ? 'hidden' : undefined,
    trafficLightPosition: process.platform === 'darwin' ? { x: 14, y: 13 } : undefined,
    webPreferences: {
      preload: buildPreloadPath(),
      sandbox: false,
    },
  });

  trackWindow({
    browserWindow,
    context: {
      kind: 'launcher',
    },
  });

  await loadRenderer(browserWindow);

  return browserWindow;
}

export async function createSettingsWindow(appConfig: AppConfig): Promise<BrowserWindow> {
  const existingRecord = findWindowRecordByKind('settings');

  if (existingRecord) {
    existingRecord.browserWindow.setBackgroundColor(getWindowBackgroundColor(appConfig));
    focusBrowserWindow(existingRecord.browserWindow);
    return existingRecord.browserWindow;
  }

  const browserWindow = new BrowserWindow({
    width: 1180,
    height: 780,
    minWidth: 980,
    minHeight: 680,
    backgroundColor: getWindowBackgroundColor(appConfig),
    title: tMain('app.settings.windowTitle'),
    titleBarStyle: process.platform === 'darwin' ? 'hidden' : undefined,
    trafficLightPosition: process.platform === 'darwin' ? { x: 14, y: 13 } : undefined,
    webPreferences: {
      preload: buildPreloadPath(),
      sandbox: false,
    },
  });

  trackWindow({
    browserWindow,
    context: {
      kind: 'settings',
    },
  });

  await loadRenderer(browserWindow);

  return browserWindow;
}

export async function createProjectWindow(projectBootstrap: ProjectBootstrapData): Promise<BrowserWindow> {
  const browserWindow = new BrowserWindow({
    width: 1400,
    height: 920,
    minWidth: 1100,
    minHeight: 720,
    backgroundColor: getWindowBackgroundColor(projectBootstrap.appConfig),
    title: getProjectWindowTitle(projectBootstrap.project),
    titleBarStyle: process.platform === 'darwin' ? 'hidden' : undefined,
    trafficLightPosition: process.platform === 'darwin' ? { x: 14, y: 13 } : undefined,
    webPreferences: {
      preload: buildPreloadPath(),
      sandbox: false,
    },
  });

  trackWindow({
    browserWindow,
    context: {
      kind: 'project',
      project: projectBootstrap.project,
    },
    projectBootstrap,
  });

  await loadRenderer(browserWindow);

  return browserWindow;
}

export function getWindowContext(webContentsId: number): WindowContext | null {
  return windowRecords.get(webContentsId)?.context ?? null;
}

export function getProjectBootstrap(webContentsId: number): ProjectBootstrapData | null {
  return windowRecords.get(webContentsId)?.projectBootstrap ?? null;
}

export function focusWindowByWebContentsId(webContentsId: number): BrowserWindow | null {
  const record = windowRecords.get(webContentsId);

  if (!record) {
    return null;
  }

  const { browserWindow } = record;

  if (browserWindow.isDestroyed()) {
    windowRecords.delete(webContentsId);
    return null;
  }

  focusBrowserWindow(browserWindow);

  return browserWindow;
}

export function updateProjectWindowsAppConfig(nextAppConfig: AppConfig): void {
  const backgroundColor = getWindowBackgroundColor(nextAppConfig);

  for (const [id, record] of windowRecords) {
    record.browserWindow.setBackgroundColor(backgroundColor);

    if (!record.projectBootstrap) {
      continue;
    }

    windowRecords.set(id, {
      ...record,
      projectBootstrap: {
        ...record.projectBootstrap,
        appConfig: nextAppConfig,
      },
    });
  }
}

export function broadcastAppConfigUpdated(nextAppConfig: AppConfig): void {
  for (const [id, record] of windowRecords) {
    if (record.browserWindow.isDestroyed()) {
      windowRecords.delete(id);
      continue;
    }

    record.browserWindow.webContents.send(ipcChannels.appConfigUpdated, nextAppConfig);
  }
}

export function broadcastGlobalSkillsUpdated(): void {
  for (const [id, record] of windowRecords) {
    if (record.browserWindow.isDestroyed()) {
      windowRecords.delete(id);
      continue;
    }

    record.browserWindow.webContents.send(ipcChannels.globalSkillsUpdated);
  }
}

export function updateProjectWindowProjectConfig(
  webContentsId: number,
  nextProjectConfig: ProjectConfig,
): ProjectBootstrapData | null {
  const record = windowRecords.get(webContentsId);

  if (!record?.projectBootstrap) {
    return null;
  }

  const nextBootstrap: ProjectBootstrapData = {
    ...record.projectBootstrap,
    projectConfig: nextProjectConfig,
  };

  windowRecords.set(webContentsId, {
    ...record,
    projectBootstrap: nextBootstrap,
  });

  return nextBootstrap;
}

export function updateProjectWindowProjectUiState(
  webContentsId: number,
  nextProjectUiState: ProjectUiState,
): ProjectBootstrapData | null {
  const record = windowRecords.get(webContentsId);

  if (!record?.projectBootstrap) {
    return null;
  }

  const nextBootstrap: ProjectBootstrapData = {
    ...record.projectBootstrap,
    projectUiState: nextProjectUiState,
  };

  windowRecords.set(webContentsId, {
    ...record,
    projectBootstrap: nextBootstrap,
  });

  return nextBootstrap;
}
