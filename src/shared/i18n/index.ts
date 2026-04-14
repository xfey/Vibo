export const APP_LOCALES = ['zh-CN', 'en'] as const;

export type AppLocale = (typeof APP_LOCALES)[number];

export const DEFAULT_APP_LOCALE: AppLocale = 'zh-CN';

export type TranslationParams = Record<
  string,
  string | number | boolean | null | undefined
>;

type TranslationValue =
  | string
  | ((params: TranslationParams) => string);

function pluralizeEn(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

const enMessages = {
  'app.name': 'Vibo',
  'app.bootstrap.loadingTitle': 'Preparing workspace',
  'app.bootstrap.loadingDetail': 'Bootstrapping the main process and window context.',
  'app.bootstrap.errorEyebrow': 'Bootstrap Error',
  'app.bootstrap.errorTitle': 'Window initialization failed',
  'app.feedback.dismiss': 'Dismiss banner',
  'app.restart.notice':
    'Language changes may require closing and reopening Vibo to fully apply.',
  'app.settings.windowTitle': 'Settings',
  'app.settings.loadFailed': 'Failed to load settings data.',
  'app.settings.saveFailed': 'Failed to save App Settings.',
  'app.menu.actionFailed': 'Menu action failed.',
  'app.menu.about': 'About {name}',
  'app.menu.settings': 'Settings...',
  'app.menu.file': 'File',
  'app.menu.edit': 'Edit',
  'app.menu.view': 'View',
  'app.menu.window': 'Window',
  'app.menu.noRecentProjects': 'No Recent Projects',
  'app.menu.recentProjectsUnavailable': 'Recent Projects Unavailable',
  'app.menu.newWindow': 'New Window',
  'app.menu.openFolder': 'Open Folder...',
  'app.menu.openRecent': 'Open Recent',
  'app.menu.newSession': 'New Session',
  'app.menu.newCodexSession': 'New Codex Session',
  'app.menu.newClaudeSession': 'New Claude Code Session',
  'app.menu.newOpenCodeSession': 'New OpenCode Session',
  'app.menu.newShellSession': 'New Shell Session',
  'app.menu.save': 'Save',
  'app.menu.closeTab': 'Close Tab',
  'app.menu.closeWindow': 'Close Window',
  'app.menu.find': 'Find...',
  'app.menu.findNext': 'Find Next',
  'app.menu.findPrevious': 'Find Previous',
  'app.menu.replace': 'Replace...',
  'app.menu.gotoLine': 'Go to Line...',
  'app.menu.toggleComment': 'Toggle Comment',
  'app.menu.toggleWordWrap': 'Toggle Word Wrap',
  'app.dialog.openProjectFolder.title': 'Open Project Folder',
  'app.dialog.openProjectFolder.button': 'Open Project',
  'app.notification.commandCompleted': 'Completed command: {command}',
  'app.notification.sessionCompleted': 'Session completed: {label}',
  'app.notification.commandCompletedPrefix': 'Completed command: ',
  'app.notification.commandCompletedUnknown': 'Completed the latest request.',
  'common.actions.apply': 'Apply',
  'common.actions.cancel': 'Cancel',
  'common.actions.close': 'Close',
  'common.actions.connect': 'Connect',
  'common.actions.create': 'Create',
  'common.actions.delete': 'Delete',
  'common.actions.deletePermanently': 'Delete Permanently',
  'common.actions.dismiss': 'Dismiss',
  'common.actions.more': 'More',
  'common.actions.newFile': 'New File',
  'common.actions.newFolder': 'New Folder',
  'common.actions.openProject': 'Open Project',
  'common.actions.openRemote': 'Open Remote',
  'common.actions.openThisDirectory': 'Open This Directory',
  'common.actions.pin': 'Pin',
  'common.actions.refresh': 'Refresh',
  'common.actions.rename': 'Rename',
  'common.actions.removeFromRecents': 'Remove from Recents',
  'common.actions.revealInFinder': 'Reveal in Finder',
  'common.actions.resume': 'Resume',
  'common.actions.resuming': 'Resuming…',
  'common.actions.save': 'Save',
  'common.kind.local': 'Local',
  'common.kind.remote': 'Remote',
  'common.labels.builtIn': 'Built-in',
  'common.labels.custom': 'Custom',
  'common.labels.global': 'Global',
  'common.labels.issue': 'Issue',
  'common.labels.local': 'Local',
  'common.labels.unavailable': 'Unavailable',
  'common.scope.local': 'Local',
  'common.scope.global': 'Global',
  'common.time.todayAt': 'Today {time}',
  'common.time.yesterdayAt': 'Yesterday {time}',
  'count.setting': (params) => pluralizeEn(Number(params.count ?? 0), 'setting'),
  'count.override': (params) => pluralizeEn(Number(params.count ?? 0), 'override'),
  'count.skill': (params) => pluralizeEn(Number(params.count ?? 0), 'skill'),
  'count.hostAlias': (params) => pluralizeEn(Number(params.count ?? 0), 'host alias'),
  'hub.files': 'Files',
  'hub.git': 'Git',
  'hub.gitScope': 'Scope · {path}',
  'hub.resizeGitPanel': 'Resize Git panel',
  'hub.resizeSidebar': 'Resize sidebar',
  'hub.tree.newItemInside': 'Inside {path}',
  'hub.tree.renameItem': 'Rename {path}',
  'hub.tree.projectRoot': 'project root',
  'hub.tree.readProjectFilesFailedTitle': 'Unable to read project files',
  'hub.tree.readProjectFilesFailedDetail': 'The project file tree is currently unavailable.',
  'hub.tree.loadingTitle': 'Loading project files',
  'hub.tree.loadingDetail': 'You will be able to browse or create files shortly.',
  'hub.tree.emptyTitle': 'This project is still empty',
  'hub.tree.emptyDetail': 'Right-click blank space to create a file or folder.',
  'hub.tree.readFailed': 'Unable to read project file tree.',
  'hub.tree.readDirectoryFailed': 'Unable to read directory contents.',
  'hub.tree.refreshFailed': 'Unable to refresh project file tree.',
  'hub.tree.actionFailed': 'File tree action failed.',
  'hub.tree.deleteFailed': 'Delete failed.',
  'hub.tree.revealFailed': 'Unable to reveal this file.',
  'hub.fileReadFailed.title': 'File read failed',
  'hub.fileReadFailed.message': 'File read failed.',
  'hub.fileSaveFailed': 'File save failed.',
  'hub.preview.saving': 'Saving...',
  'hub.preview.loadingTitle': 'Loading file content',
  'hub.preview.loadingDetail':
    'You will be able to continue previewing or editing in Hub shortly.',
  'hub.unsavedChangesDiscardSingle':
    'This file has unsaved changes. Discard them?',
  'hub.unsavedChangesDiscardPreview':
    'The preview file has unsaved changes. Discard them and open another file?',
  'hub.unsavedChangesDeletePermanent':
    'Permanently delete "{path}" and continue? This cannot be undone.',
  'hub.unsavedChangesDeleteSingle':
    '"{path}" has unsaved changes. {action} and discard them?',
  'hub.unsavedChangesDeleteMultiple':
    '{action} {count} open files with unsaved changes and continue?',
  'hub.deleteAction.trash': 'Move to Trash',
  'hub.deleteAction.permanent': 'Permanently delete',
  'hub.tree.targetNotRevealed': 'Unable to reveal this file.',
  'hub.tree.action.newFileScope': 'Inside {path}',
  'hub.tree.action.renameScope': 'Rename {path}',
  'hub.git.loadingTitle': 'Loading commit history',
  'hub.git.loadingCopy': 'Recent commits will appear here shortly.',
  'hub.git.loadFailedTitle': 'Failed to load Git history',
  'hub.git.state.gitUnavailableTitle': 'Git is currently unavailable',
  'hub.git.state.gitUnavailableDetail':
    'The current environment cannot resolve the `git` command.',
  'hub.git.state.notRepositoryTitle': 'This project is not a Git repository',
  'hub.git.state.notRepositoryDetail':
    'Commit history is only shown for Git repositories.',
  'hub.git.state.emptyRepositoryTitle': 'The repository has no commits yet',
  'hub.git.state.emptyRepositoryDetail':
    'Commit history will appear here after the first commit.',
  'hub.git.state.emptyScopeTitle': 'No commits under the current path',
  'hub.git.state.emptyScopeDetail': 'There are no commits to show in this repository yet.',
  'hub.git.state.scopeLimitedDetail': 'Only commits under {path} are shown.',
  'hub.git.detachedHead': 'Detached HEAD',
  'hub.git.commitFilesLoading': 'Loading files changed by this commit...',
  'hub.git.commitFilesEmpty': 'No visible file changes for this commit.',
  'hub.git.loadingMore': 'Loading older commits...',
  'hub.git.readHistoryFailed': 'Unable to read Git history.',
  'hub.git.readCommitFilesFailed': 'Unable to read files for this commit.',
  'hub.git.readDiffFailed': 'Unable to read the diff for this file.',
  'hub.diff.kicker': 'Diff Preview',
  'hub.diff.close': 'Close',
  'hub.diff.loadingTitle': 'Loading diff',
  'hub.diff.loadingDetail':
    'Changes for this file will appear here shortly.',
  'hub.diff.loadFailedTitle': 'Failed to load diff',
  'hub.diff.emptyTitle': 'No text diff available',
  'hub.diff.emptyDetail':
    'This file may not contain text changes, or Git returned content that cannot be previewed directly.',
  'hub.diff.status.added': 'Added',
  'hub.diff.status.modified': 'Modified',
  'hub.diff.status.deleted': 'Deleted',
  'hub.diff.status.renamed': 'Renamed',
  'hub.diff.status.copied': 'Copied',
  'hub.diff.status.typeChanged': 'Type Changed',
  'hub.diff.status.unmerged': 'Unmerged',
  'hub.diff.status.changed': 'Changed',
  'launcher.loadFailed': 'Failed to load launcher data.',
  'launcher.titleRecentProjects': 'Recent Projects',
  'launcher.loadingRecents': 'Organizing recent projects.',
  'launcher.emptyRecents': 'No recent projects yet.',
  'launcher.projectActions': 'Project actions',
  'launcher.openSettings': 'Open Settings',
  'launcher.settings': 'Settings',
  'launcher.opening': 'Opening…',
  'launcher.connecting': 'Connecting…',
  'launcher.openProjectFailed': 'Failed to open project.',
  'launcher.openRecentFailed': 'Failed to open recent project.',
  'launcher.removeRecentFailed': 'Failed to remove recent project.',
  'launcher.revealRecentFailed': 'Unable to reveal this project in Finder.',
  'launcher.openSettingsFailed': 'Failed to open App Settings.',
  'launcher.remote.title': 'Open Remote Project',
  'launcher.remote.stepHostCopy':
    'Choose an SSH host before selecting a remote path.',
  'launcher.remote.stepPathCopy':
    'Connected to {host}. Choose the directory to open.',
  'launcher.remote.loadHostsFailed': 'Failed to read SSH host list.',
  'launcher.remote.browseFailed': 'Failed to read remote directory.',
  'launcher.remote.openFailed': 'Failed to open remote project.',
  'launcher.remote.connectFailed': 'SSH connection failed.',
  'launcher.remote.sshHost': 'SSH Host',
  'launcher.remote.remotePath': 'Remote Path',
  'launcher.remote.hostPlaceholder': 'my-server',
  'launcher.remote.pathPlaceholder': '/srv/workspace/project',
  'launcher.remote.readingSshConfig': 'Reading ~/.ssh/config',
  'launcher.remote.foundAliases': (params) =>
    `Found ${Number(params.count ?? 0)} host alias${Number(params.count ?? 0) === 1 ? '' : 'es'}`,
  'launcher.remote.noAliases':
    'No usable aliases found. You can still enter a host manually.',
  'launcher.remote.backToParent': 'Go to parent directory',
  'launcher.remote.readingDirectory': 'Loading directory',
  'launcher.remote.enterPathHint': 'Enter an absolute path or a ~/ path',
  'launcher.remote.loadingDirectories': 'Loading folders…',
  'launcher.remote.emptyDirectories': 'No subfolders in the current directory',
  'launcher.remote.directoriesWillAppear':
    'Subfolders will appear here after connecting.',
  'projectHome.sessions': 'Sessions',
  'projectHome.loadingRecentSessions': 'Preparing recent sessions.',
  'projectHome.agentUnavailable': '{agent} is currently unavailable.',
  'projectHome.loadAgentStateFailed': 'Unable to read {agent} status right now.',
  'projectHome.createCodex': 'Create Codex session',
  'projectHome.creatingCodex': 'Creating Codex session',
  'projectHome.createOpenCode': 'Create OpenCode session',
  'projectHome.creatingOpenCode': 'Creating OpenCode session',
  'projectHome.createClaudeCode': 'Create Claude Code session',
  'projectHome.creatingClaudeCode': 'Creating Claude Code session',
  'projectHome.createShell': 'Create shell session',
  'projectHome.creatingShell': 'Creating shell session',
  'projectHome.projectAgentConfigSaveFailed':
    'Failed to save project-level Agent settings.',
  'projectHome.projectLayoutSaveFailed':
    'Failed to save project window layout.',
  'projectHome.skillsLoadFailed':
    'Failed to load project-level skills data.',
  'projectHome.recentUpdatedPrefix': 'Recently updated · {label}',
  'projectHome.projectSettings': 'Project Settings',
  'projectSettings.preferredAgent': 'Preferred Agent',
  'projectSettings.preferredAgentDescription':
    'The default Agent for this project is shown as the active choice.',
  'projectSettings.defaultAgent.codex': 'Prefer Codex.',
  'projectSettings.defaultAgent.claude': 'Prefer Claude Code.',
  'projectSettings.defaultAgent.opencode': 'Prefer OpenCode.',
  'projectSettings.defaultAgent.shell': 'Open Shell first.',
  'projectSettings.skills': 'Skills',
  'projectSettings.overrides': 'Overrides',
  'projectSettings.writeFailed': 'Failed to write project config.',
  'projectSettings.skillsLoading': 'Scanning skills.',
  'projectSettings.skillsEmpty': 'No skills found.',
  'projectSettings.supportsClaude':
    'New and resume Claude Code sessions are currently supported.',
  'projectSettings.supportsOpenCode':
    'New and resume OpenCode sessions are currently supported.',
  'search.find': 'Find',
  'search.replace': 'Replace',
  'search.previousMatch': 'Previous Match',
  'search.nextMatch': 'Next Match',
  'search.matchCase': 'Match Case',
  'search.regex': 'Use Regular Expression',
  'search.wholeWord': 'Match Whole Word',
  'search.toggleReplace': 'Toggle Replace',
  'search.closeSearch': 'Close Search',
  'search.gotoLine': 'Go to Line',
  'search.gotoLinePlaceholder': 'Go to Line...',
  'search.closeGotoLine': 'Close Go to Line',
  'settings.navigation.general': 'General',
  'settings.navigation.appearance': 'Appearance',
  'settings.navigation.agents': 'Agents',
  'settings.navigation.skills': 'Skills',
  'settings.general.title': 'General',
  'settings.general.defaultAgent': 'Default Agent',
  'settings.general.defaultAgentDescription': 'Choose the preferred coding agent.',
  'settings.general.language': 'Language',
  'settings.general.languageDescription':
    'Switch the app language between Simplified Chinese and English.',
  'settings.general.language.zh': '简体中文',
  'settings.general.language.en': 'English',
  'settings.appearance.title': 'Appearance',
  'settings.appearance.theme': 'Theme',
  'settings.appearance.themeDescription':
    'Switch the full color system, file icons, and related visual grammar. Themes discovered from the theme directory and custom themes from config will both appear here.',
  'settings.appearance.codeFont': 'Code Font',
  'settings.appearance.codeFontDescription':
    'Set the editor and terminal font.',
  'settings.appearance.codeFontSize': 'Code Font Size',
  'settings.appearance.codeFontSizeDescription':
    'Set the default editor and terminal font size.',
  'settings.agents.title': 'Agents',
  'settings.agents.globalDefaults': 'Global Defaults',
  'settings.agents.globalDefaultsDescription':
    'These settings are used as the default baseline for project-level overrides.',
  'settings.agents.writeFailed': 'Failed to save Agent settings.',
  'settings.skills.title': 'Skills',
  'settings.skills.discovery': 'Discovery',
  'settings.skills.discoveryDescription':
    'Only read raw skills on this machine. No import or project-level management.',
  'settings.skills.refreshing': 'Refreshing…',
  'settings.skills.scanFailed': 'Skills scan failed.',
  'settings.skills.scanPartialFailed': (params) =>
    `Skills scan had failures: ${params.sourceLabel}${Number(params.count ?? 0) > 1 ? ` and ${params.count} items total` : ''}.`,
  'settings.skills.agentDescription.codex':
    'Raw Codex skills discovered on this machine.',
  'settings.skills.agentDescription.claude':
    'Raw Claude Code skills discovered on this machine.',
  'settings.skills.agentDescription.opencode':
    'OpenCode-compatible skills discovered on this machine.',
  'settings.skills.agentDescription.default':
    'Raw skills discovered on this machine.',
  'settings.skills.scanning': 'Scanning.',
  'settings.skills.empty': 'No skills found.',
  'settings.theme.customDark': 'Custom Night',
  'settings.theme.customLight': 'Custom Light',
  'settings.theme.builtInDescription': '{label} preset.',
  'settings.theme.customDescription': 'Custom theme.',
  'terminal.status.idle': 'Idle',
  'terminal.status.starting': 'Starting',
  'terminal.status.failed': 'Failed',
  'terminal.status.exited': 'Exited',
  'terminal.status.working': 'Working',
  'terminal.status.waiting': 'Waiting',
  'terminal.status.running': 'Running',
  'terminal.closeTab': 'Close {label}',
  'terminal.createSession': 'Create new session',
  'terminal.newCodex': 'New Codex',
  'terminal.newClaudeCode': 'New Claude Code',
  'terminal.newOpenCode': 'New OpenCode',
  'terminal.newShell': 'New Shell',
  'terminal.workspaceViews': 'Workspace views',
  'terminal.tab.hub': 'Hub',
  'terminal.tab.notes': 'Notes',
  'terminal.tab.modifiedSuffix': 'Modified',
  'terminal.projectDraftUnsupported': 'Project notes are not supported for this project yet.',
  'terminal.createCodexFailed': 'Codex failed to start. Details were written to the log.',
  'terminal.createClaudeFailed':
    'Claude Code failed to start. Details were written to the log.',
  'terminal.createOpenCodeFailed':
    'OpenCode failed to start. Details were written to the log.',
  'terminal.createShellFailed': 'Shell failed to start. Details were written to the log.',
  'terminal.resumeClaudeFailed':
    'Failed to resume the Claude Code session. Details were written to the log.',
  'terminal.resumeCodexFailed':
    'Failed to resume the Codex session. Details were written to the log.',
  'terminal.resumeOpenCodeFailed':
    'Failed to resume the OpenCode session. Details were written to the log.',
  'terminal.confirmCloseRunning':
    'Terminal "{label}" is still running. Close it anyway?',
  'terminal.renamePromptTitle': 'Rename terminal',
  'terminal.projectDraftIntroLine1': '> This is your project notes scratchpad.',
  'terminal.projectDraftIntroLine2':
    '> Use it for quick notes, TODOs, commands, links, or any other record you want to keep nearby.',
  'workspace.notLocalProject': 'The current project is not a local project.',
  'workspace.notSshProject': 'The current project is not an SSH project.',
  'workspace.nameEmpty': 'Name cannot be empty.',
  'workspace.nameInvalid': 'Invalid name.',
  'workspace.nameContainsSeparator': 'Name cannot contain path separators.',
  'workspace.targetOutsideProject':
    'Target path is outside of the current project.',
  'workspace.notCreatableDirectory':
    'The current target is not a directory where content can be created.',
  'workspace.notPreviewableTitle': 'This item cannot be previewed',
  'workspace.notPreviewableMessage': 'Hub currently only supports previewing file contents.',
  'workspace.imageTooLargeTitle': 'Image too large',
  'workspace.imageTooLargeMessage':
    'Large image files cannot be previewed directly in Hub yet.',
  'workspace.imageDecodeFailedTitle': 'Unable to preview image',
  'workspace.imageDecodeFailedMessage':
    'This image format cannot be previewed reliably in Hub.',
  'workspace.fileTooLargeTitle': 'File too large',
  'workspace.fileTooLargeMessage':
    'Large text files cannot be previewed directly in Hub yet.',
  'workspace.binaryFileTitle': 'This file cannot be previewed yet',
  'workspace.binaryFileMessage':
    'Only text files and common images are currently supported.',
  'workspace.saveTextOnly': 'Only text files can be saved directly right now.',
  'workspace.entryAlreadyExists':
    'A file or folder with the same name already exists at this level.',
  'workspace.remotePathNotDirectory': 'The current path is not a directory.',
  'workspace.remoteTargetMissing': 'Target file was not found.',
  'workspace.remoteResponseEmpty':
    'SSH returned an empty response, so the path could not be resolved.',
  'workspace.remoteHostEmpty': 'SSH host cannot be empty.',
  'workspace.remotePathEmpty': 'Remote path cannot be empty.',
  'workspace.remotePathInvalid':
    'Remote paths currently only support absolute paths or paths starting with `~/`.',
  'workspace.sshUnavailable':
    'SSH client is not installed or the current environment cannot resolve the `ssh` command.',
  'workspace.remoteProjectResolveFailed':
    'Unable to resolve the remote project directory.',
  'availability.codexMissing':
    'Codex CLI is not installed or the current environment cannot resolve `codex`.',
  'availability.codexRemoteUnavailable':
    'Codex is temporarily unavailable on the current machine.',
  'availability.claudeMissing':
    'Claude Code CLI is not installed or the current environment cannot resolve `claude`.',
  'availability.claudeRemoteUnavailable':
    'Claude Code is temporarily unavailable on the current machine.',
  'availability.opencodeMissing':
    'OpenCode CLI is not installed or the current environment cannot resolve `opencode`.',
  'availability.opencodeRemoteUnavailable':
    'OpenCode is temporarily unavailable on the current machine.',
  'git.unavailableReason': 'Git is currently unavailable, so commit history cannot be read.',
  'git.notRepositoryReason': 'The current project is not a Git repository.',
  'git.emptyRepositoryReason': 'The current repository has no commits yet.',
  'git.commitHashRequired': 'Commit hash is required.',
  'git.remoteUnsupported': 'Git view is not available for SSH projects yet.',
  'recentProjects.notFound': 'Recent project was not found.',
  'recentProjects.remoteRevealUnsupported':
    'Remote projects cannot be revealed in Finder right now.',
  'theme.source.builtInMaterial': 'Built-in / Material Icons',
  'theme.material.description':
    'Rich file type icons for quickly scanning project structure.',
  'theme.viboLight.description':
    'Bright surfaces with cool gray layers for daytime project scanning.',
  'theme.viboDark.description':
    'Low-saturation dark surfaces and clear terminal contrast for longer sessions.',
  'theme.viboLight.paletteLabel': 'Cool Slate',
  'theme.viboDark.paletteLabel': 'Night Ink',
} as const satisfies Record<string, TranslationValue>;

type TranslationKey = keyof typeof enMessages;

const zhCnMessages: Record<TranslationKey, TranslationValue> = {
  'app.name': 'Vibo',
  'app.bootstrap.loadingTitle': '正在准备工作区',
  'app.bootstrap.loadingDetail': '主进程和窗口上下文正在装配中。',
  'app.bootstrap.errorEyebrow': 'Bootstrap Error',
  'app.bootstrap.errorTitle': '窗口初始化失败',
  'app.feedback.dismiss': '关闭横幅',
  'app.restart.notice': '语言变更可能需要关闭并重新打开 Vibo 才能完全生效。',
  'app.settings.windowTitle': '设置',
  'app.settings.loadFailed': 'Settings 数据加载失败。',
  'app.settings.saveFailed': 'App Settings 保存失败。',
  'app.menu.actionFailed': '菜单操作失败。',
  'app.menu.about': '关于 {name}',
  'app.menu.settings': '设置...',
  'app.menu.file': '文件',
  'app.menu.edit': '编辑',
  'app.menu.view': '视图',
  'app.menu.window': '窗口',
  'app.menu.noRecentProjects': '没有最近项目',
  'app.menu.recentProjectsUnavailable': '最近项目暂不可用',
  'app.menu.newWindow': '新建窗口',
  'app.menu.openFolder': '打开文件夹...',
  'app.menu.openRecent': '打开最近项目',
  'app.menu.newSession': '新建会话',
  'app.menu.newCodexSession': '新建 Codex 会话',
  'app.menu.newClaudeSession': '新建 Claude Code 会话',
  'app.menu.newOpenCodeSession': '新建 OpenCode 会话',
  'app.menu.newShellSession': '新建 Shell 会话',
  'app.menu.save': '保存',
  'app.menu.closeTab': '关闭标签',
  'app.menu.closeWindow': '关闭窗口',
  'app.menu.find': '查找...',
  'app.menu.findNext': '查找下一个',
  'app.menu.findPrevious': '查找上一个',
  'app.menu.replace': '替换...',
  'app.menu.gotoLine': '跳转到行...',
  'app.menu.toggleComment': '切换注释',
  'app.menu.toggleWordWrap': '切换自动换行',
  'app.dialog.openProjectFolder.title': '打开项目文件夹',
  'app.dialog.openProjectFolder.button': '打开项目',
  'app.notification.commandCompleted': '完成指令：{command}',
  'app.notification.sessionCompleted': '会话已完成：{label}',
  'app.notification.commandCompletedPrefix': '完成指令：',
  'app.notification.commandCompletedUnknown': '最近一次请求已完成。',
  'common.actions.apply': '应用',
  'common.actions.cancel': '取消',
  'common.actions.close': '关闭',
  'common.actions.connect': '连接',
  'common.actions.create': '创建',
  'common.actions.delete': '删除',
  'common.actions.deletePermanently': '永久删除',
  'common.actions.dismiss': '关闭',
  'common.actions.more': '更多',
  'common.actions.newFile': '新建文件',
  'common.actions.newFolder': '新建文件夹',
  'common.actions.openProject': '打开项目',
  'common.actions.openRemote': '打开远程项目',
  'common.actions.openThisDirectory': '打开这个目录',
  'common.actions.pin': '固定',
  'common.actions.refresh': '刷新',
  'common.actions.rename': '重命名',
  'common.actions.removeFromRecents': '从最近项目移除',
  'common.actions.revealInFinder': '在 Finder 中定位',
  'common.actions.resume': '恢复',
  'common.actions.resuming': '恢复中…',
  'common.actions.save': '保存',
  'common.kind.local': '本地',
  'common.kind.remote': '远程',
  'common.labels.builtIn': '内建',
  'common.labels.custom': '自定义',
  'common.labels.global': '全局',
  'common.labels.issue': '问题',
  'common.labels.local': '本地',
  'common.labels.unavailable': '不可用',
  'common.scope.local': '本地',
  'common.scope.global': '全局',
  'common.time.todayAt': '今天 {time}',
  'common.time.yesterdayAt': '昨天 {time}',
  'count.setting': (params) => `${Number(params.count ?? 0)} 项设置`,
  'count.override': (params) => `${Number(params.count ?? 0)} 项 override`,
  'count.skill': (params) => `${Number(params.count ?? 0)} 个 skill`,
  'count.hostAlias': (params) => `已发现 ${Number(params.count ?? 0)} 个 host alias`,
  'hub.files': '文件',
  'hub.git': 'Git',
  'hub.gitScope': '范围 · {path}',
  'hub.resizeGitPanel': '调整 Git 面板大小',
  'hub.resizeSidebar': '调整侧栏大小',
  'hub.tree.newItemInside': '位于 {path}',
  'hub.tree.renameItem': '重命名 {path}',
  'hub.tree.projectRoot': '项目根目录',
  'hub.tree.readProjectFilesFailedTitle': '无法读取项目文件',
  'hub.tree.readProjectFilesFailedDetail': '项目文件树暂时不可用。',
  'hub.tree.loadingTitle': '正在读取项目文件',
  'hub.tree.loadingDetail': '稍后即可开始浏览或新建文件。',
  'hub.tree.emptyTitle': '当前项目还是空的',
  'hub.tree.emptyDetail': '在空白处右键即可新建文件或文件夹。',
  'hub.tree.readFailed': '无法读取项目文件树。',
  'hub.tree.readDirectoryFailed': '无法读取目录内容。',
  'hub.tree.refreshFailed': '无法刷新项目文件树。',
  'hub.tree.actionFailed': '文件树操作失败。',
  'hub.tree.deleteFailed': '删除失败。',
  'hub.tree.revealFailed': '无法定位该文件。',
  'hub.fileReadFailed.title': '文件读取失败',
  'hub.fileReadFailed.message': '文件读取失败。',
  'hub.fileSaveFailed': '文件保存失败。',
  'hub.preview.saving': '保存中...',
  'hub.preview.loadingTitle': '正在读取文件内容',
  'hub.preview.loadingDetail': '稍后即可在 Hub 中继续预览或编辑。',
  'hub.unsavedChangesDiscardSingle': '当前文件有未保存修改，确定丢弃吗？',
  'hub.unsavedChangesDiscardPreview':
    '当前预览文件有未保存修改，确定丢弃并打开其他文件吗？',
  'hub.unsavedChangesDeletePermanent':
    '将永久删除 "{path}"，且无法恢复，确定继续吗？',
  'hub.unsavedChangesDeleteSingle':
    '"{path}" 有未保存修改，确定{action}并丢弃这些修改吗？',
  'hub.unsavedChangesDeleteMultiple':
    '将{action} {count} 个含未保存修改的已打开文件，确定继续吗？',
  'hub.deleteAction.trash': '删除到废纸篓',
  'hub.deleteAction.permanent': '永久删除',
  'hub.tree.targetNotRevealed': '无法定位该文件。',
  'hub.tree.action.newFileScope': '位于 {path}',
  'hub.tree.action.renameScope': '重命名 {path}',
  'hub.git.loadingTitle': '正在读取提交历史',
  'hub.git.loadingCopy': '稍后即可在这里查看最近 commits。',
  'hub.git.loadFailedTitle': 'Git 历史读取失败',
  'hub.git.state.gitUnavailableTitle': 'Git 暂时不可用',
  'hub.git.state.gitUnavailableDetail': '当前环境无法解析 `git` 命令。',
  'hub.git.state.notRepositoryTitle': '当前项目不是 Git 仓库',
  'hub.git.state.notRepositoryDetail': '只有 Git 仓库才会显示提交历史。',
  'hub.git.state.emptyRepositoryTitle': '仓库还没有提交记录',
  'hub.git.state.emptyRepositoryDetail': '先完成首个 commit 之后，这里才会出现历史列表。',
  'hub.git.state.emptyScopeTitle': '当前路径下还没有提交记录',
  'hub.git.state.emptyScopeDetail': '当前仓库内还没有可展示的提交。',
  'hub.git.state.scopeLimitedDetail': '当前只显示 {path} 范围内的提交。',
  'hub.git.detachedHead': 'Detached HEAD',
  'hub.git.commitFilesLoading': '正在读取本次提交涉及的文件...',
  'hub.git.commitFilesEmpty': '当前提交没有可展示的文件变更。',
  'hub.git.loadingMore': '正在继续加载更早的 commits...',
  'hub.git.readHistoryFailed': '无法读取 Git 历史。',
  'hub.git.readCommitFilesFailed': '无法读取该提交的文件列表。',
  'hub.git.readDiffFailed': '无法读取该文件的 diff。',
  'hub.diff.kicker': 'Diff 预览',
  'hub.diff.close': '关闭',
  'hub.diff.loadingTitle': '正在读取 diff',
  'hub.diff.loadingDetail': '稍后即可在这里查看本次提交对该文件的变更。',
  'hub.diff.loadFailedTitle': 'Diff 读取失败',
  'hub.diff.emptyTitle': '当前没有可显示的文本 diff',
  'hub.diff.emptyDetail':
    '这个文件可能没有文本变更，或者 Git 返回的是不可直接预览的内容。',
  'hub.diff.status.added': '新增',
  'hub.diff.status.modified': '修改',
  'hub.diff.status.deleted': '删除',
  'hub.diff.status.renamed': '重命名',
  'hub.diff.status.copied': '复制',
  'hub.diff.status.typeChanged': '类型变更',
  'hub.diff.status.unmerged': '未合并',
  'hub.diff.status.changed': '变更',
  'launcher.loadFailed': 'Launcher 数据加载失败。',
  'launcher.titleRecentProjects': '最近项目',
  'launcher.loadingRecents': '正在整理最近项目。',
  'launcher.emptyRecents': '还没有最近项目。',
  'launcher.projectActions': '项目操作',
  'launcher.openSettings': '打开设置',
  'launcher.settings': '设置',
  'launcher.opening': '打开中…',
  'launcher.connecting': '连接中…',
  'launcher.openProjectFailed': '打开项目失败。',
  'launcher.openRecentFailed': '打开最近项目失败。',
  'launcher.removeRecentFailed': '最近项目移除失败。',
  'launcher.revealRecentFailed': '无法在 Finder 中定位该项目。',
  'launcher.openSettingsFailed': '打开 App Settings 失败。',
  'launcher.remote.title': '打开远程项目',
  'launcher.remote.stepHostCopy': '先选择一个 SSH host，再进入远程路径选择。',
  'launcher.remote.stepPathCopy':
    '已连接到 {host}，选择要打开的目录。',
  'launcher.remote.loadHostsFailed': 'SSH host 列表读取失败。',
  'launcher.remote.browseFailed': '远程目录读取失败。',
  'launcher.remote.openFailed': '打开远程项目失败。',
  'launcher.remote.connectFailed': 'SSH 连接失败。',
  'launcher.remote.sshHost': 'SSH Host',
  'launcher.remote.remotePath': 'Remote Path',
  'launcher.remote.hostPlaceholder': 'my-server',
  'launcher.remote.pathPlaceholder': '/srv/workspace/project',
  'launcher.remote.readingSshConfig': '正在读取 ~/.ssh/config',
  'launcher.remote.foundAliases': (params) => `已发现 ${Number(params.count ?? 0)} 个 host alias`,
  'launcher.remote.noAliases': '未发现可用 alias，仍可手动输入 host',
  'launcher.remote.backToParent': '返回到上一级',
  'launcher.remote.readingDirectory': '正在读取目录',
  'launcher.remote.enterPathHint': '输入绝对路径或 ~/ 路径',
  'launcher.remote.loadingDirectories': '正在加载文件夹…',
  'launcher.remote.emptyDirectories': '当前目录下没有子文件夹',
  'launcher.remote.directoriesWillAppear': '连接后会在这里显示子文件夹',
  'projectHome.sessions': '会话',
  'projectHome.loadingRecentSessions': '正在整理最近会话。',
  'projectHome.agentUnavailable': '{agent} 当前不可用。',
  'projectHome.loadAgentStateFailed': '当前无法读取 {agent} 状态。',
  'projectHome.createCodex': '创建 Codex 会话',
  'projectHome.creatingCodex': '正在创建 Codex 会话',
  'projectHome.createOpenCode': '创建 OpenCode 会话',
  'projectHome.creatingOpenCode': '正在创建 OpenCode 会话',
  'projectHome.createClaudeCode': '创建 Claude Code 会话',
  'projectHome.creatingClaudeCode': '正在创建 Claude Code 会话',
  'projectHome.createShell': '创建 Shell 会话',
  'projectHome.creatingShell': '正在创建 Shell 会话',
  'projectHome.projectAgentConfigSaveFailed': '项目级 Agent 配置保存失败。',
  'projectHome.projectLayoutSaveFailed': '项目窗口布局保存失败。',
  'projectHome.skillsLoadFailed': '项目级 skills 数据加载失败。',
  'projectHome.recentUpdatedPrefix': '最近更新 · {label}',
  'projectHome.projectSettings': '项目设置',
  'projectSettings.preferredAgent': 'Preferred Agent',
  'projectSettings.preferredAgentDescription':
    '当前项目默认 Agent 会直接显示为实际生效的选项。',
  'projectSettings.defaultAgent.codex': '优先使用 Codex。',
  'projectSettings.defaultAgent.claude': '优先使用 Claude Code。',
  'projectSettings.defaultAgent.opencode': '优先使用 OpenCode。',
  'projectSettings.defaultAgent.shell': '优先进入 Shell。',
  'projectSettings.skills': 'Skills',
  'projectSettings.overrides': 'Overrides',
  'projectSettings.writeFailed': '项目配置写入失败。',
  'projectSettings.skillsLoading': '正在扫描 skills。',
  'projectSettings.skillsEmpty': '当前没有发现 skills。',
  'projectSettings.supportsClaude': '当前已支持新建与恢复 Claude Code 会话。',
  'projectSettings.supportsOpenCode': '当前已支持新建与恢复 OpenCode 会话。',
  'search.find': '查找',
  'search.replace': '替换',
  'search.previousMatch': '上一个匹配',
  'search.nextMatch': '下一个匹配',
  'search.matchCase': '区分大小写',
  'search.regex': '使用正则表达式',
  'search.wholeWord': '匹配整个单词',
  'search.toggleReplace': '切换替换',
  'search.closeSearch': '关闭查找',
  'search.gotoLine': '跳转到行',
  'search.gotoLinePlaceholder': '跳转到行...',
  'search.closeGotoLine': '关闭跳转到行',
  'settings.navigation.general': 'General',
  'settings.navigation.appearance': 'Appearance',
  'settings.navigation.agents': 'Agents',
  'settings.navigation.skills': 'Skills',
  'settings.general.title': 'General',
  'settings.general.defaultAgent': 'Default Agent',
  'settings.general.defaultAgentDescription': '设置偏好的 Coding Agent。',
  'settings.general.language': 'Language',
  'settings.general.languageDescription': '在简体中文和英文之间切换应用语言。',
  'settings.general.language.zh': '简体中文',
  'settings.general.language.en': 'English',
  'settings.appearance.title': 'Appearance',
  'settings.appearance.theme': 'Theme',
  'settings.appearance.themeDescription':
    '切换整套颜色风格、文件 icon 与相关视觉语法；主题目录里自动发现的主题与配置中的自定义主题都会出现在这里。',
  'settings.appearance.codeFont': 'Code Font',
  'settings.appearance.codeFontDescription': '设置 editor / terminal 字体。',
  'settings.appearance.codeFontSize': 'Code Font Size',
  'settings.appearance.codeFontSizeDescription': '设置 editor / terminal 的默认字号。',
  'settings.agents.title': 'Agents',
  'settings.agents.globalDefaults': 'Global Defaults',
  'settings.agents.globalDefaultsDescription':
    '这里的设置会作为项目页 overrides 的默认基线。',
  'settings.agents.writeFailed': 'Agent 设置保存失败。',
  'settings.skills.title': 'Skills',
  'settings.skills.discovery': 'Discovery',
  'settings.skills.discoveryDescription': '只读取当前机器上的原始 skills，不做导入和项目级管理。',
  'settings.skills.refreshing': '刷新中…',
  'settings.skills.scanFailed': 'Skills 扫描失败。',
  'settings.skills.scanPartialFailed': (params) =>
    `Skills 扫描存在失败项：${params.sourceLabel}${Number(params.count ?? 0) > 1 ? ` 等 ${params.count} 项` : ''}。`,
  'settings.skills.agentDescription.codex': '当前机器上可发现的 Codex 原始 skills。',
  'settings.skills.agentDescription.claude': '当前机器上可发现的 Claude Code 原始 skills。',
  'settings.skills.agentDescription.opencode': '当前机器上可发现的 OpenCode 兼容 skills。',
  'settings.skills.agentDescription.default': '当前机器上可发现的原始 skills。',
  'settings.skills.scanning': '正在扫描。',
  'settings.skills.empty': '当前没有发现 skills。',
  'settings.theme.customDark': '自定义夜色',
  'settings.theme.customLight': '自定义浅色',
  'settings.theme.builtInDescription': '{label} 预设。',
  'settings.theme.customDescription': '自定义主题。',
  'terminal.status.idle': '空闲',
  'terminal.status.starting': '启动中',
  'terminal.status.failed': '失败',
  'terminal.status.exited': '已退出',
  'terminal.status.working': '工作中',
  'terminal.status.waiting': '等待中',
  'terminal.status.running': '运行中',
  'terminal.closeTab': '关闭 {label}',
  'terminal.createSession': '创建新会话',
  'terminal.newCodex': '新建 Codex',
  'terminal.newClaudeCode': '新建 Claude Code',
  'terminal.newOpenCode': '新建 OpenCode',
  'terminal.newShell': '新建 Shell',
  'terminal.workspaceViews': '工作区视图',
  'terminal.tab.hub': 'Hub',
  'terminal.tab.notes': 'Notes',
  'terminal.tab.modifiedSuffix': 'Modified',
  'terminal.projectDraftUnsupported': '当前项目暂不支持草稿本。',
  'terminal.createCodexFailed': 'Codex 启动失败。详情已写入日志。',
  'terminal.createClaudeFailed': 'Claude Code 启动失败。详情已写入日志。',
  'terminal.createOpenCodeFailed': 'OpenCode 启动失败。详情已写入日志。',
  'terminal.createShellFailed': 'Shell 启动失败。详情已写入日志。',
  'terminal.resumeClaudeFailed': '恢复 Claude Code 会话失败。详情已写入日志。',
  'terminal.resumeCodexFailed': '恢复 Codex 会话失败。详情已写入日志。',
  'terminal.resumeOpenCodeFailed': '恢复 OpenCode 会话失败。详情已写入日志。',
  'terminal.confirmCloseRunning': 'Terminal "{label}" 仍在运行，确定关闭吗？',
  'terminal.renamePromptTitle': '重命名终端',
  'terminal.projectDraftIntroLine1': '> 这里是项目便签草稿本。',
  'terminal.projectDraftIntroLine2':
    '> 你可以在这里记录临时笔记、TODO、命令、链接，或任何希望贴近项目保存的内容。',
  'workspace.notLocalProject': '当前项目不是本地项目。',
  'workspace.notSshProject': '当前项目不是 SSH 项目。',
  'workspace.nameEmpty': '名称不能为空。',
  'workspace.nameInvalid': '名称无效。',
  'workspace.nameContainsSeparator': '名称不能包含路径分隔符。',
  'workspace.targetOutsideProject': 'Target path is outside of the current project.',
  'workspace.notCreatableDirectory': '当前目标不是可创建内容的目录。',
  'workspace.notPreviewableTitle': '当前对象不可预览',
  'workspace.notPreviewableMessage': 'Hub 当前仅支持预览文件内容。',
  'workspace.imageTooLargeTitle': '图片过大',
  'workspace.imageTooLargeMessage': '当前阶段暂不在 Hub 中直接预览过大的图片文件。',
  'workspace.imageDecodeFailedTitle': '无法预览图片',
  'workspace.imageDecodeFailedMessage': '当前图片格式无法在 Hub 中稳定预览。',
  'workspace.fileTooLargeTitle': '文件过大',
  'workspace.fileTooLargeMessage': '当前阶段暂不在 Hub 中直接预览过大的文本文件。',
  'workspace.binaryFileTitle': '当前文件暂不可预览',
  'workspace.binaryFileMessage': '当前阶段仅支持文本文件与常见图片预览。',
  'workspace.saveTextOnly': '当前仅支持直接保存文本文件。',
  'workspace.entryAlreadyExists': '同级已存在同名文件或文件夹。',
  'workspace.remotePathNotDirectory': '当前路径不是目录。',
  'workspace.remoteTargetMissing': '找不到目标文件。',
  'workspace.remoteResponseEmpty': 'SSH 响应为空，无法解析路径。',
  'workspace.remoteHostEmpty': 'SSH host 不能为空。',
  'workspace.remotePathEmpty': 'Remote path 不能为空。',
  'workspace.remotePathInvalid': '当前远程路径仅支持绝对路径或 `~/` 开头路径。',
  'workspace.sshUnavailable': 'SSH 客户端未安装或当前环境无法解析 `ssh` 命令。',
  'workspace.remoteProjectResolveFailed': '无法解析远程项目目录。',
  'availability.codexMissing': 'Codex CLI 未安装或当前环境无法解析 `codex` 命令。',
  'availability.codexRemoteUnavailable': '当前机器暂时无法直接启动 Codex。',
  'availability.claudeMissing': 'Claude Code CLI 未安装或当前环境无法解析 `claude` 命令。',
  'availability.claudeRemoteUnavailable': '当前机器暂时无法直接启动 Claude Code。',
  'availability.opencodeMissing': 'OpenCode CLI 未安装或当前环境无法解析 `opencode` 命令。',
  'availability.opencodeRemoteUnavailable': '当前机器暂时无法直接启动 OpenCode。',
  'git.unavailableReason': 'Git 当前不可用，无法读取提交历史。',
  'git.notRepositoryReason': '当前项目不是 Git 仓库。',
  'git.emptyRepositoryReason': '当前仓库还没有提交记录。',
  'git.commitHashRequired': 'Commit hash is required.',
  'git.remoteUnsupported': 'SSH 项目的 Git 视图当前尚未接入。',
  'recentProjects.notFound': 'Recent project was not found.',
  'recentProjects.remoteRevealUnsupported': '远程项目当前无法在 Finder 中定位。',
  'theme.source.builtInMaterial': '内建 / Material Icons',
  'theme.material.description': '使用丰富的文件类型图标，适合快速扫读项目结构。',
  'theme.viboLight.description': '明亮白底与冷灰层级，适合白天快速扫读项目结构。',
  'theme.viboDark.description': '深色低饱和表面与清晰终端对比，更适合长时间沉浸使用。',
  'theme.viboLight.paletteLabel': 'Cool Slate',
  'theme.viboDark.paletteLabel': 'Night Ink',
};

const messages: Record<AppLocale, Record<TranslationKey, TranslationValue>> = {
  'zh-CN': zhCnMessages,
  en: enMessages,
};

function normalizeAppLocale(locale: AppLocale | string | null | undefined): AppLocale {
  return locale === 'en' ? 'en' : 'zh-CN';
}

function interpolateTemplate(template: string, params: TranslationParams): string {
  return template.replace(/\{(\w+)\}/g, (_match, key: string) => {
    const value = params[key];
    return value === undefined || value === null ? '' : String(value);
  });
}

export function translate(
  locale: AppLocale,
  key: TranslationKey,
  params: TranslationParams = {},
): string {
  const resolvedLocale = normalizeAppLocale(locale);
  const value = messages[resolvedLocale][key] ?? messages[DEFAULT_APP_LOCALE][key];

  if (typeof value === 'function') {
    return value(params);
  }

  return interpolateTemplate(value, params);
}

export function getIntlLocale(locale: AppLocale): string {
  return normalizeAppLocale(locale) === 'en' ? 'en-US' : 'zh-CN';
}

function formatTime(locale: AppLocale, date: Date): string {
  return new Intl.DateTimeFormat(getIntlLocale(locale), {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function formatDateTime(locale: AppLocale, date: Date): string {
  const now = new Date();
  const includesYear = date.getFullYear() !== now.getFullYear();

  return new Intl.DateTimeFormat(getIntlLocale(locale), {
    year: includesYear ? 'numeric' : undefined,
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function getStartOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

export function formatRecentUpdateLabel(
  locale: AppLocale,
  unixSeconds: number,
  now = new Date(),
): string {
  const targetDate = new Date(unixSeconds * 1000);

  if (Number.isNaN(targetDate.getTime())) {
    return String(unixSeconds);
  }

  const dayDifference = Math.round(
    (getStartOfDay(now) - getStartOfDay(targetDate)) / (24 * 60 * 60 * 1000),
  );

  if (dayDifference === 0) {
    return translate(locale, 'common.time.todayAt', {
      time: formatTime(locale, targetDate),
    });
  }

  if (dayDifference === 1) {
    return translate(locale, 'common.time.yesterdayAt', {
      time: formatTime(locale, targetDate),
    });
  }

  return formatDateTime(locale, targetDate);
}

export function formatRecentOpenedAt(
  locale: AppLocale,
  value: number | string,
): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return formatDateTime(locale, date);
}

export function formatGitCommitDate(
  locale: AppLocale,
  unixSeconds: number,
): string {
  const targetDate = new Date(unixSeconds * 1000);

  if (Number.isNaN(targetDate.getTime())) {
    return String(unixSeconds);
  }

  const now = new Date();
  const includesYear = targetDate.getFullYear() !== now.getFullYear();

  return new Intl.DateTimeFormat(getIntlLocale(locale), {
    year: includesYear ? 'numeric' : undefined,
    month: '2-digit',
    day: '2-digit',
  }).format(targetDate);
}

export function formatProjectHomeSessionSubtitle(
  locale: AppLocale,
  unixSeconds: number,
): string {
  return translate(locale, 'projectHome.recentUpdatedPrefix', {
    label: formatRecentUpdateLabel(locale, unixSeconds),
  });
}

export function getLanguageDisplayLabel(
  uiLocale: AppLocale,
  targetLocale: AppLocale,
): string {
  if (targetLocale === 'en') {
    return translate(uiLocale, 'settings.general.language.en');
  }

  return translate(uiLocale, 'settings.general.language.zh');
}

export type { TranslationKey };
