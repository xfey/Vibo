# main/services/recents 索引

职责：

* 管理 recent projects 与 recent sessions

当前目录文件：

* `README.md`
  * 当前目录索引
* `claude-recent-session-provider.ts`
  * 读取本地或远端 `~/.claude/projects/*/*.jsonl` 并归一化为 Claude Code 最近会话
  * 核心导出：`ClaudeRecentSessionProvider`
* `codex-recent-session-provider.ts`
  * 读取本地或远端 `~/.codex/state_5.sqlite + history.jsonl` 并归一化为最近会话
  * 核心导出：`CodexRecentSessionProvider`
* `opencode-recent-session-provider.ts`
  * 通过 `opencode session list --format json` 读取当前项目的本地或远端 OpenCode 最近会话
  * 核心导出：`OpenCodeRecentSessionProvider`
* `remote-session-utils.ts`
  * 远端 recent session 读取辅助：remote file download、size probe、目录文件列举
  * 核心导出：`readRemoteFile`、`getRemoteFileSize`、`listRemoteFiles`
* `recent-sessions-service.ts`
  * 按当前项目过滤、排序并生成 Claude Code / Codex / OpenCode 的 Project Home 卡片；支持 local / ssh project 路由；统一生成“最近更新”时间副文案，返回完整历史列表，首屏数量与 `More` 展开由 renderer 控制
  * 核心导出：`RecentSessionsService`
* `recent-projects-service.ts`
  * 管理最近项目的持久化、排序、pin、移除与 reveal
  * 核心导出：`RecentProjectsService`

当前状态：

* 最近项目已切换为 `recent-projects-service.ts` 实现
