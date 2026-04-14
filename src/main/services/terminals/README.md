# main/services/terminals 索引

职责：

* 承载 terminal session orchestrator、本地 PTY executor 与 bounded output backlog

当前目录文件：

* `README.md`
  * 当前目录索引
* `terminal-manager.ts`
  * 管理 terminal session 生命周期，并保留增量输出序号与 session snapshot 元信息
  * 核心导出：`TerminalManager`
* `local-pty-executor.ts`
  * 负责基于 `node-pty` 启动本地 PTY，并将 PTY terminal name 与 `TERM` 对齐以兼容 shell line editor / autosuggestion
  * 核心导出：`LocalPtyExecutor`
* `output-backlog.ts`
  * 负责按有界字符窗口保存 session 最近输出，供 renderer runtime hydrate 使用
  * 核心导出：`TerminalOutputBacklog`
