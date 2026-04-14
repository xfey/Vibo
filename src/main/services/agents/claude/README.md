# main/services/agents/claude 索引

职责：

* 管理 `Claude Code CLI` 的命令解析与新建会话启动参数拼装

当前目录文件：

* `README.md`
  * 当前目录索引
* `claude-code-agent-adapter.ts`
  * 负责解析 `claude` 命令路径、探测 CLI 可用性，并基于 app/project 级 Claude 设置构建 `New / Resume Claude Code` 的 `LaunchSpec`
  * 核心导出：`ClaudeCodeAgentAdapter`
