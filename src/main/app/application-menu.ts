import {
  app,
  BrowserWindow,
  dialog,
  Menu,
  type MenuItemConstructorOptions,
} from 'electron';

import { ipcChannels } from '@main/ipc/channels';
import type { MenuCommand } from '@shared/contracts/menu';
import { getProjectLocationLabel } from '@shared/domain/project';
import type { RecentProjectRecord } from '@shared/domain/recent-project';

import type { AppServices } from './bootstrap';
import { tMain } from './i18n';
import {
  createLauncherWindow,
  createProjectWindow,
  createSettingsWindow,
  getWindowContext,
} from './windows';

const MAX_RECENT_PROJECTS_IN_MENU = 10;
const ABOUT_PANEL_COPYRIGHT_OWNER = 'Xiang Fei';
const ABOUT_PANEL_EMAIL = 'xfey99@gmail.com';
const ABOUT_PANEL_GITHUB_URL = 'https://github.com/xfey/Vibo';

let menuServices: AppServices | null = null;
let menuInstallState: 'idle' | 'installed' = 'idle';
let menuRefreshSequence = 0;

function getFocusedWindowRecord(): {
  browserWindow: BrowserWindow | null;
  isProjectWindow: boolean;
} {
  const browserWindow = BrowserWindow.getFocusedWindow();

  if (!browserWindow || browserWindow.isDestroyed()) {
    return {
      browserWindow: null,
      isProjectWindow: false,
    };
  }

  const context = getWindowContext(browserWindow.webContents.id);

  return {
    browserWindow,
    isProjectWindow: context?.kind === 'project',
  };
}

async function ensureMenuTargetWindow(): Promise<BrowserWindow | null> {
  const focusedWindow = BrowserWindow.getFocusedWindow();

  if (focusedWindow && !focusedWindow.isDestroyed()) {
    return focusedWindow;
  }

  if (!menuServices) {
    return null;
  }

  const appConfig = await menuServices.projectService.readAppConfig();
  const launcherWindow = await createLauncherWindow(appConfig);
  await refreshApplicationMenu();
  return launcherWindow;
}

function sendMenuCommand(browserWindow: BrowserWindow, command: MenuCommand): void {
  if (browserWindow.isDestroyed()) {
    return;
  }

  browserWindow.webContents.send(ipcChannels.menuCommand, command);
}

async function dispatchMenuCommand(command: MenuCommand): Promise<void> {
  const browserWindow = await ensureMenuTargetWindow();

  if (!browserWindow) {
    return;
  }

  sendMenuCommand(browserWindow, command);
}

function showMenuActionError(error: unknown): void {
  const message = error instanceof Error ? error.message : tMain('app.menu.actionFailed');
  dialog.showErrorBox(tMain('app.name'), message);
}

function toMenuAction(action: () => Promise<void> | void): () => void {
  return () => {
    void Promise.resolve()
      .then(action)
      .catch((error) => {
        console.error('Menu action failed.', error);
        showMenuActionError(error);
      });
  };
}

async function openLauncherWindow(): Promise<void> {
  if (!menuServices) {
    return;
  }

  const appConfig = await menuServices.projectService.readAppConfig();
  await createLauncherWindow(appConfig);
  await refreshApplicationMenu();
}

async function openProjectWindowFromMenu(
  sourceWindow: BrowserWindow,
  bootstrap: Awaited<ReturnType<AppServices['projectService']['bootstrapProject']>>,
): Promise<void> {
  if (!menuServices) {
    return;
  }

  const sourceContext = getWindowContext(sourceWindow.webContents.id);

  await menuServices.recentProjectsService.recordProjectOpen(
    bootstrap.project,
    bootstrap.projectConfig.preferredAgent ?? bootstrap.appConfig.defaultAgent,
  );

  await createProjectWindow(bootstrap);

  if (sourceContext?.kind === 'launcher' && !sourceWindow.isDestroyed()) {
    setTimeout(() => {
      if (!sourceWindow.isDestroyed()) {
        sourceWindow.close();
      }
    }, 0);
  }

  await refreshApplicationMenu();
}

async function openProjectFolderFromMenu(): Promise<void> {
  if (!menuServices) {
    return;
  }

  const sourceWindow = await ensureMenuTargetWindow();

  if (!sourceWindow) {
    return;
  }

  const result = await menuServices.projectService.openProjectFolder(sourceWindow.webContents);

  if (result.canceled) {
    await refreshApplicationMenu();
    return;
  }

  await openProjectWindowFromMenu(sourceWindow, result.bootstrap);
}

async function openRecentProjectFromMenu(projectFingerprint: string): Promise<void> {
  if (!menuServices) {
    return;
  }

  const sourceWindow = await ensureMenuTargetWindow();

  if (!sourceWindow) {
    return;
  }

  const recentProject = await menuServices.recentProjectsService.getRecentProject(projectFingerprint);

  if (!recentProject) {
    throw new Error('Recent project was not found.');
  }

  const bootstrap = await menuServices.projectService.bootstrapProject(recentProject.project);
  await openProjectWindowFromMenu(sourceWindow, bootstrap);
}

async function openSettingsFromMenu(): Promise<void> {
  if (!menuServices) {
    return;
  }

  const appConfig = await menuServices.projectService.readAppConfig();
  await createSettingsWindow(appConfig);
}

function closeFocusedWindow(): void {
  const browserWindow = BrowserWindow.getFocusedWindow();

  if (!browserWindow || browserWindow.isDestroyed()) {
    return;
  }

  browserWindow.close();
}

function buildRecentProjectMenuLabel(record: RecentProjectRecord): string {
  if (record.project.kind === 'ssh') {
    return `${record.project.displayName} [${record.project.locator.host}]`;
  }

  return record.project.displayName;
}

function configureAboutPanel(): void {
  const currentYear = new Date().getFullYear();

  app.setAboutPanelOptions({
    applicationName: app.name,
    applicationVersion: app.getVersion(),
    copyright: `Copyright © ${currentYear} ${ABOUT_PANEL_COPYRIGHT_OWNER}`,
    credits: [
      `Created by ${ABOUT_PANEL_COPYRIGHT_OWNER}`,
      `Email: ${ABOUT_PANEL_EMAIL}`,
      `GitHub: ${ABOUT_PANEL_GITHUB_URL}`,
    ].join('\n'),
  });
}

async function buildOpenRecentSubmenu(): Promise<MenuItemConstructorOptions[]> {
  if (!menuServices) {
    return [
      {
        label: tMain('app.menu.noRecentProjects'),
        enabled: false,
      },
    ];
  }

  let records: RecentProjectRecord[];

  try {
    records = (await menuServices.recentProjectsService.listRecentProjects()).slice(
      0,
      MAX_RECENT_PROJECTS_IN_MENU,
    );
  } catch (error) {
    console.warn('Failed to build recent projects menu.', error);
    return [
      {
        label: tMain('app.menu.recentProjectsUnavailable'),
        enabled: false,
      },
    ];
  }

  if (records.length === 0) {
    return [
      {
        label: tMain('app.menu.noRecentProjects'),
        enabled: false,
      },
    ];
  }

  return records.map((record) => ({
    label: buildRecentProjectMenuLabel(record),
    sublabel: getProjectLocationLabel(record.project),
    click: toMenuAction(async () => {
      await openRecentProjectFromMenu(record.project.fingerprint);
    }),
  }));
}

function buildAppMenuSubmenu(): MenuItemConstructorOptions[] {
  return [
    {
      role: 'about',
      label: tMain('app.menu.about', {
        name: app.name,
      }),
    },
    {
      type: 'separator',
    },
    {
      label: tMain('app.menu.settings'),
      accelerator: 'CommandOrControl+,',
      click: toMenuAction(async () => {
        await openSettingsFromMenu();
      }),
    },
    {
      type: 'separator',
    },
    {
      role: 'services',
    },
    {
      type: 'separator',
    },
    {
      role: 'hide',
    },
    {
      role: 'hideOthers',
    },
    {
      role: 'unhide',
    },
    {
      type: 'separator',
    },
    {
      role: 'quit',
    },
  ];
}

function buildFileMenuSubmenu(
  recentProjectsSubmenu: MenuItemConstructorOptions[],
  isProjectWindow: boolean,
): MenuItemConstructorOptions[] {
  const submenu: MenuItemConstructorOptions[] = [
    {
      label: tMain('app.menu.newWindow'),
      accelerator: 'CommandOrControl+Shift+N',
      click: toMenuAction(async () => {
        await openLauncherWindow();
      }),
    },
    {
      label: tMain('app.menu.openFolder'),
      accelerator: 'CommandOrControl+O',
      click: toMenuAction(async () => {
        await openProjectFolderFromMenu();
      }),
    },
    {
      label: tMain('app.menu.openRecent'),
      submenu: recentProjectsSubmenu,
    },
  ];

  if (!isProjectWindow) {
    submenu.push(
      {
        type: 'separator',
      },
      {
        role: 'close',
      },
    );
    return submenu;
  }

  submenu.push(
    {
      type: 'separator',
    },
    {
      label: tMain('app.menu.newSession'),
      accelerator: 'CommandOrControl+N',
      click: toMenuAction(async () => {
        await dispatchMenuCommand('project.new-primary-session');
      }),
    },
    {
      label: tMain('app.menu.newCodexSession'),
      click: toMenuAction(async () => {
        await dispatchMenuCommand('project.new-codex-session');
      }),
    },
    {
      label: tMain('app.menu.newClaudeSession'),
      click: toMenuAction(async () => {
        await dispatchMenuCommand('project.new-claude-code-session');
      }),
    },
    {
      label: tMain('app.menu.newOpenCodeSession'),
      click: toMenuAction(async () => {
        await dispatchMenuCommand('project.new-opencode-session');
      }),
    },
    {
      label: tMain('app.menu.newShellSession'),
      click: toMenuAction(async () => {
        await dispatchMenuCommand('project.new-shell-session');
      }),
    },
    {
      type: 'separator',
    },
    {
      label: tMain('app.menu.save'),
      click: toMenuAction(async () => {
        await dispatchMenuCommand('workspace.save-active-file');
      }),
    },
    {
      type: 'separator',
    },
    {
      label: tMain('app.menu.closeTab'),
      accelerator: 'CommandOrControl+W',
      click: toMenuAction(async () => {
        await dispatchMenuCommand('workspace.close-active-tab');
      }),
    },
    {
      label: tMain('app.menu.closeWindow'),
      accelerator: 'CommandOrControl+Shift+W',
      click: closeFocusedWindow,
    },
  );

  return submenu;
}

function buildEditMenuSubmenu(isProjectWindow: boolean): MenuItemConstructorOptions[] {
  const submenu: MenuItemConstructorOptions[] = [
    {
      role: 'undo',
    },
    {
      role: 'redo',
    },
    {
      type: 'separator',
    },
    {
      role: 'cut',
    },
    {
      role: 'copy',
    },
    {
      role: 'paste',
    },
    {
      role: 'pasteAndMatchStyle',
    },
    {
      role: 'delete',
    },
    {
      role: 'selectAll',
    },
  ];

  if (!isProjectWindow) {
    return submenu;
  }

  submenu.push(
    {
      type: 'separator',
    },
    {
      label: tMain('app.menu.find'),
      click: toMenuAction(async () => {
        await dispatchMenuCommand('workspace.find');
      }),
    },
    {
      label: tMain('app.menu.findNext'),
      click: toMenuAction(async () => {
        await dispatchMenuCommand('workspace.find-next');
      }),
    },
    {
      label: tMain('app.menu.findPrevious'),
      click: toMenuAction(async () => {
        await dispatchMenuCommand('workspace.find-previous');
      }),
    },
    {
      label: tMain('app.menu.replace'),
      click: toMenuAction(async () => {
        await dispatchMenuCommand('workspace.replace');
      }),
    },
    {
      label: tMain('app.menu.gotoLine'),
      click: toMenuAction(async () => {
        await dispatchMenuCommand('workspace.go-to-line');
      }),
    },
    {
      label: tMain('app.menu.toggleComment'),
      click: toMenuAction(async () => {
        await dispatchMenuCommand('workspace.toggle-comment');
      }),
    },
  );

  return submenu;
}

function buildViewMenuSubmenu(): MenuItemConstructorOptions[] {
  return [
    {
      label: tMain('app.menu.toggleWordWrap'),
      click: toMenuAction(async () => {
        await dispatchMenuCommand('workspace.toggle-word-wrap');
      }),
    },
  ];
}

function buildWindowMenuSubmenu(): MenuItemConstructorOptions[] {
  return [
    {
      role: 'minimize',
    },
    {
      role: 'zoom',
    },
    {
      type: 'separator',
    },
    {
      role: 'front',
    },
  ];
}

async function buildMenuTemplate(): Promise<MenuItemConstructorOptions[]> {
  const { isProjectWindow } = getFocusedWindowRecord();
  const recentProjectsSubmenu = await buildOpenRecentSubmenu();
  const template: MenuItemConstructorOptions[] = [
    {
      label: app.name,
      submenu: buildAppMenuSubmenu(),
    },
    {
      label: tMain('app.menu.file'),
      submenu: buildFileMenuSubmenu(recentProjectsSubmenu, isProjectWindow),
    },
    {
      label: tMain('app.menu.edit'),
      submenu: buildEditMenuSubmenu(isProjectWindow),
    },
  ];

  if (isProjectWindow) {
    template.push({
      label: tMain('app.menu.view'),
      submenu: buildViewMenuSubmenu(),
    });
  }

  template.push({
    label: tMain('app.menu.window'),
    submenu: buildWindowMenuSubmenu(),
  });

  return template;
}

export function installApplicationMenu(services: AppServices): void {
  menuServices = services;
  configureAboutPanel();

  if (menuInstallState === 'installed') {
    void refreshApplicationMenu();
    return;
  }

  menuInstallState = 'installed';

  app.on('browser-window-focus', () => {
    void refreshApplicationMenu();
  });

  app.on('browser-window-created', () => {
    void refreshApplicationMenu();
  });

  app.on('window-all-closed', () => {
    void refreshApplicationMenu();
  });

  void refreshApplicationMenu();
}

export async function refreshApplicationMenu(): Promise<void> {
  const refreshId = menuRefreshSequence + 1;
  menuRefreshSequence = refreshId;

  const template = await buildMenuTemplate();

  if (menuRefreshSequence !== refreshId) {
    return;
  }

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
