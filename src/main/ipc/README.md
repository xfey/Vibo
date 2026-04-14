# main/ipc 索引

职责：

* 管理 IPC channel 命名与 handler 注册

当前目录文件：

* `README.md`
  * 当前目录索引
* `channels.ts`
  * 定义 preload 与 main 之间的 IPC channel
  * 核心导出：`ipcChannels`
* `register-ipc.ts`
  * 注册所有 IPC handler
  * 核心导出：`registerIpcHandlers`

当前扩展：

* 已包含项目打开相关 channel
* 已包含主进程顶部菜单下发给 renderer 的 menu command 事件 channel
* 已包含 app config、project config 与 project ui state 的读取 / 更新 channel
* 已包含最近项目的查询、pin、移除、Reveal 与从 recent 重新打开 channel
* 已包含 terminal session 的创建、snapshot 读取、输入、resize、关闭、重命名和事件推送 channel
* 已包含 Claude Code / Codex / OpenCode Project Home 数据查询、`New Claude Code`、`Resume Claude Code`、`New Codex`、`Resume Codex`、`New OpenCode` 与 `Resume OpenCode` channel
* 已包含项目级 Git 提交历史、单次 commit 文件列表与文件 diff 预览读取 channel
* 已包含全局原始 skills 扫描 channel
* 已包含项目级 skills 聚合数据读取 channel
* 已包含 Workspace 文件树读取、文件 preview 读取、文本写回、文件新建、重命名、删除到废纸篓、Reveal 与终端路径解析 channel
