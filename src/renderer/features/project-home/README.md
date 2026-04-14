# renderer/features/project-home 索引

职责：

* 承载项目进入后的首页内容、会话入口与内联项目级设置

当前目录文件：

* `README.md`
  * 当前目录索引
* `ProjectHomeView.tsx`
  * Project Home 的顶层入口，负责全局错误横幅、app/project config 与 project ui state 更新桥接，并订阅独立 `App Settings` 窗口广播的 app config / skills 刷新信号
  * 同时负责把当前项目窗口的 appearance 应用到 document，并把 appearance 变更下传给 terminal workspace
  * 核心导出：`ProjectHomeView`
* `ProjectHomeContent.tsx`
  * 渲染 `Project Home` 的会话入口、`Codex / OpenCode / Claude Code` 历史卡片 `More` 逐步展开、`Codex / OpenCode / Claude Code / Shell` 的新建入口、显式 `loading / unavailable / error` 会话状态提示，以及默认折叠的 `Project Settings`
  * 当前会话分组标题与 `New` 卡片已接入 agent brand label / watermark
  * 核心导出：`ProjectHomeContent`
* `ProjectAgentSettingsSection.tsx`
  * 渲染项目级 `preferred agent`，并按 agent 合并展示 `skills + overrides` 两段内容；overrides 会以 `App Settings > Agents` 中的全局值作为默认显示
  * 当前 `preferred agent` 卡片与各 agent section header 已接入品牌标题与水印语法
  * 核心导出：`ProjectAgentSettingsSection`

依赖说明：

* 项目级配置写回统一经由 `ProjectHomeView -> window.viboApp.updateProjectConfig`
* `ProjectHomeContent` 只消费 `CodexProjectHomeData`、`OpenCodeProjectHomeData`、`ClaudeCodeProjectHomeData`、显式 project-home loading/error 状态、`ProjectConfig` 与 `ProjectSkillsData`，不直接依赖主进程 service 细节
