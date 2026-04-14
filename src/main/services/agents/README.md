# main/services/agents 索引

职责：

* 承载 agent 启动适配层与 launch builder

当前目录文件：

* `README.md`
  * 当前目录索引
* `agent-activity.ts`
  * 生成 `Claude Code / Codex` 的 session 级 activity hook 配置，并为 Codex 本地会话准备临时 `CODEX_HOME` overlay
  * 核心导出：`buildClaudeCodeSettingsOverride`、`createLocalCodexHookRuntime`、`buildRemoteCodexHookSetupCommand`
* `local-command-env.ts`
  * 读取登录 shell 的 `PATH`，并为本地 agent 启动补齐 Finder 启动应用时缺失的命令环境
  * 核心导出：`resolveLoginShellPathValue`、`buildLocalAgentEnvironment`

当前子目录：

* `claude/`
  * `ClaudeCodeAgentAdapter`
* `codex/`
  * `CodexAgentAdapter`
* `opencode/`
  * `OpenCodeAgentAdapter`
* `shell/`
  * `ShellLaunchBuilder`
