# shared/contracts 索引

职责：

* 定义 `main -> preload -> renderer` 之间共享的数据契约

当前目录文件：

* `README.md`
  * 当前目录索引
* `window.ts`
  * 定义窗口上下文，当前包含 `launcher / settings / project`
  * 核心导出：`WindowContext`
* `menu.ts`
  * 定义主进程菜单下发给 renderer 的菜单命令契约
  * 核心导出：`MenuCommand`、`WorkspaceEditorMenuCommand`、`isWorkspaceEditorMenuCommand`
* `project.ts`
  * 定义项目打开结果、`.vibo` 路径集合与项目 bootstrap 数据契约
  * 核心导出：`ProjectBootstrapData`、`OpenProjectResult`
* `config.ts`
  * 定义 App Config、Project Config 与 Project UI State 的更新契约
  * 核心导出：`UpdateAppConfigRequest`、`UpdateProjectConfigRequest`、`UpdateProjectUiStateRequest`
* `git.ts`
  * 定义项目级 Git 历史数据契约
  * 核心导出：`GetProjectGitDataRequest`、`GetProjectGitCommitFilesRequest`、`GetProjectGitFileDiffRequest`、`ProjectGitData`、`ProjectGitCommitFilesData`、`ProjectGitDiffPreview`
* `codex.ts`
  * 定义 Codex Project Home 数据与 resume IPC 契约
  * 核心导出：`CodexProjectHomeData`、`CodexAvailability`、`ResumeCodexSessionRequest`
* `claude.ts`
  * 定义 Claude Code Project Home 数据与 resume IPC 契约
  * 核心导出：`ClaudeCodeProjectHomeData`、`ClaudeCodeAvailability`、`ResumeClaudeCodeSessionRequest`
* `opencode.ts`
  * 定义 OpenCode Project Home 数据与 resume IPC 契约
  * 核心导出：`OpenCodeProjectHomeData`、`OpenCodeAvailability`、`ResumeOpenCodeSessionRequest`
* `recents.ts`
  * 定义最近项目列表与其交互动作的 IPC 契约
  * 核心导出：`OpenRecentProjectRequest`、`SetRecentProjectPinnedRequest`、`RemoveRecentProjectRequest`、`RevealRecentProjectRequest`、`RecentProjectsResponse`
* `workspace.ts`
  * 定义 Workspace 文件树、文件新建、文件 preview union（`text / image / unsupported`）、文本写回、重命名、删除、Reveal 与终端路径解析的 IPC 契约
  * 核心导出：`WorkspaceTreeEntry`、`WorkspaceEntryKind`、`WorkspaceFileContent`、`ListWorkspaceDirectoryRequest`、`CreateWorkspaceEntryRequest`、`ReadWorkspaceFileRequest`、`WriteWorkspaceFileRequest`、`RenameWorkspaceEntryRequest`、`DeleteWorkspaceEntryRequest`、`RevealWorkspaceEntryRequest`、`ResolveTerminalWorkspaceLinkRequest`、`ResolvedTerminalWorkspaceLink`
* `terminal.ts`
  * 定义 terminal IPC 契约、增量输出事件与 session snapshot 契约
  * 核心导出：`TerminalEvent`、`WriteTerminalInputRequest`、`ResizeTerminalRequest`、`RenameTerminalSessionRequest`、`GetTerminalSessionSnapshotRequest`、`TerminalSessionSnapshot`
* `skills.ts`
  * 定义全局原始 skills 扫描结果与项目级 skills 聚合数据的 IPC 契约
  * 核心导出：`GlobalSkillsResponse`、`ProjectSkillsData`
