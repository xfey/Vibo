import { app, BrowserWindow } from 'electron';

import { registerIpcHandlers } from '@main/ipc/register-ipc';
import { ClaudeCodeAgentAdapter } from '@main/services/agents/claude/claude-code-agent-adapter';
import { CodexAgentAdapter } from '@main/services/agents/codex/codex-agent-adapter';
import { OpenCodeAgentAdapter } from '@main/services/agents/opencode/opencode-agent-adapter';
import { ShellLaunchBuilder } from '@main/services/agents/shell/shell-launch-builder';
import { ConfigStore } from '@main/services/config/config-store';
import { ProjectService } from '@main/services/projects/project-service';
import { ClaudeRecentSessionProvider } from '@main/services/recents/claude-recent-session-provider';
import { CodexRecentSessionProvider } from '@main/services/recents/codex-recent-session-provider';
import { OpenCodeRecentSessionProvider } from '@main/services/recents/opencode-recent-session-provider';
import { RecentProjectsService } from '@main/services/recents/recent-projects-service';
import { RecentSessionsService } from '@main/services/recents/recent-sessions-service';
import { ProjectGitService } from '@main/services/git/project-git-service';
import { ProjectSkillsService } from '@main/services/skills/project-skills-service';
import { SkillsLibraryService } from '@main/services/skills/skills-library-service';
import { LocalPtyExecutor } from '@main/services/terminals/local-pty-executor';
import { TerminalManager } from '@main/services/terminals/terminal-manager';
import { LocalWorkspaceService } from '@main/services/workspace/local-workspace-service';
import { SshConfigService } from '@main/services/ssh/ssh-config-service';
import { SshWorkspaceService } from '@main/services/workspace/ssh-workspace-service';
import type { WorkspaceService } from '@main/services/workspace/workspace-service';
import { WorkspaceRouterService } from '@main/services/workspace/workspace-router-service';
import { SshCommandRunner } from '@main/services/ssh/ssh-command-runner';
import { SshDirectoryBrowserService } from '@main/services/ssh/ssh-directory-browser-service';
import { SshLaunchBuilder } from '@main/services/ssh/ssh-launch-builder';

import { createLauncherWindow } from './windows';
import { setMainLocale } from './i18n';
import { installApplicationMenu } from './application-menu';

export interface AppServices {
  configStore: ConfigStore;
  sshCommandRunner: SshCommandRunner;
  sshConfigService: SshConfigService;
  sshDirectoryBrowserService: SshDirectoryBrowserService;
  projectService: ProjectService;
  claudeCodeAgentAdapter: ClaudeCodeAgentAdapter;
  codexAgentAdapter: CodexAgentAdapter;
  opencodeAgentAdapter: OpenCodeAgentAdapter;
  shellLaunchBuilder: ShellLaunchBuilder;
  recentProjectsService: RecentProjectsService;
  recentSessionsService: RecentSessionsService;
  projectGitService: ProjectGitService;
  skillsLibraryService: SkillsLibraryService;
  projectSkillsService: ProjectSkillsService;
  terminalManager: TerminalManager;
  workspaceService: WorkspaceService;
}

let services: AppServices | null = null;

export function getAppServices(): AppServices {
  if (!services) {
    throw new Error('App services are not initialized yet.');
  }

  return services;
}

export async function bootstrapApplication(): Promise<void> {
  app.setName('Vibo');

  await app.whenReady();

  const configStore = new ConfigStore();
  await configStore.ensureGlobalFiles();
  const initialAppConfig = await configStore.readAppConfig();
  setMainLocale(initialAppConfig.locale);
  const sshCommandRunner = new SshCommandRunner();
  const sshConfigService = new SshConfigService();
  const sshDirectoryBrowserService = new SshDirectoryBrowserService(sshCommandRunner);
  const sshLaunchBuilder = new SshLaunchBuilder(sshCommandRunner);
  const localWorkspaceService = new LocalWorkspaceService();
  const sshWorkspaceService = new SshWorkspaceService(sshCommandRunner);
  const claudeRecentSessionProvider = new ClaudeRecentSessionProvider(sshCommandRunner);
  const codexRecentSessionProvider = new CodexRecentSessionProvider(sshCommandRunner);
  const openCodeRecentSessionProvider = new OpenCodeRecentSessionProvider(sshCommandRunner);
  const skillsLibraryService = new SkillsLibraryService();
  const recentSessionsService = new RecentSessionsService(
    codexRecentSessionProvider,
    claudeRecentSessionProvider,
    openCodeRecentSessionProvider,
  );

  services = {
    configStore,
    sshCommandRunner,
    sshConfigService,
    sshDirectoryBrowserService,
    projectService: new ProjectService(configStore, sshCommandRunner),
    claudeCodeAgentAdapter: new ClaudeCodeAgentAdapter(sshCommandRunner, sshLaunchBuilder),
    codexAgentAdapter: new CodexAgentAdapter(sshCommandRunner, sshLaunchBuilder),
    opencodeAgentAdapter: new OpenCodeAgentAdapter(sshCommandRunner, sshLaunchBuilder),
    shellLaunchBuilder: new ShellLaunchBuilder(sshLaunchBuilder),
    recentProjectsService: new RecentProjectsService(configStore),
    recentSessionsService,
    projectGitService: new ProjectGitService(),
    skillsLibraryService,
    projectSkillsService: new ProjectSkillsService(skillsLibraryService),
    terminalManager: new TerminalManager(new LocalPtyExecutor(), recentSessionsService),
    workspaceService: new WorkspaceRouterService(localWorkspaceService, sshWorkspaceService),
  };

  registerIpcHandlers(getAppServices());
  installApplicationMenu(getAppServices());
  await createLauncherWindow(initialAppConfig);

  app.on('child-process-gone', (_event, details) => {
    console.warn('[electron] child process gone', {
      type: details.type,
      reason: details.reason,
      exitCode: details.exitCode,
      serviceName: details.serviceName ?? null,
      name: details.name ?? null,
    });
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void services?.projectService.readAppConfig().then((appConfig) => createLauncherWindow(appConfig));
    }
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
}
