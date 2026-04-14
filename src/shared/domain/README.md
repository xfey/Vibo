# shared/domain 索引

职责：

* 定义不依赖 Electron 运行时的核心领域模型

当前目录文件：

* `README.md`
  * 当前目录索引
* `agent.ts`
  * 定义 agent 标识与默认 agent
  * 核心导出：`AGENT_IDS`、`AgentId`、`DEFAULT_AGENT_ID`
* `project.ts`
  * 定义 `ProjectRef`
  * 核心导出：`ProjectRef`
* `recent-project.ts`
  * 定义最近项目记录模型
  * 核心导出：`RecentProjectRecord`
* `file.ts`
  * 定义项目内文件引用
  * 核心导出：`FileRef`
* `launch.ts`
  * 定义统一启动链路中的 `LaunchTarget / LaunchSpec`
  * 核心导出：`LaunchTarget`、`LaunchSpec`
* `terminal.ts`
  * 定义 terminal session 的最小记录模型，以及 agent session 的 activity 信号协议
  * 核心导出：`TerminalSessionRecord`、`TerminalSessionStatus`、`TerminalSessionActivity`
* `session.ts`
  * 定义最近会话与 Project Home 卡片模型
  * 核心导出：`RecentSessionRecord`、`ProjectHomeSessionCard`
* `config.ts`
  * 定义全局配置、项目配置与项目 UI 状态；当前 `AppConfig` 已包含 `locale` 与全局 agent settings，供项目级 overrides 继承
  * `ProjectUiState` 当前承载 Hub 侧边栏宽度与 Git 区域高度等项目窗口布局偏好
  * `appearance.theme` 当前保存选中的主题 id；`appearance.themes` 支持在配置文件内定义可继承的自定义主题 token；`appearance.codeFont / codeFontSize` 当前共同驱动 editor / terminal 的 monospace 外观
  * 核心导出：`AppLocale`、`AppConfig`、`ProjectConfig`、`ProjectUiState`
* `git.ts`
  * 定义 Git 提交记录、commit 文件状态与文件记录模型
  * 核心导出：`GitCommitRecord`、`GitCommitFileStatus`、`GitCommitFileRecord`
* `draft.ts`
  * 定义项目草稿本的固定 tab / 路径常量与相对路径判断 helper
  * 核心导出：`PROJECT_DRAFT_TAB_ID`、`PROJECT_DRAFT_RELATIVE_PATH`、`isProjectDraftRelativePath`
* `skill.ts`
  * 定义全局与项目级只读 skills 记录模型
  * 核心导出：`SkillAgentId`、`GlobalSkillRecord`、`ProjectSkillRecord`
