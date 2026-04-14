# preload 索引

职责：

* 在 `main` 与 `renderer` 之间提供最小、安全的桥接 API

当前目录文件：

* `README.md`
  * 当前目录索引
* `api.ts`
  * 定义 renderer 可调用的 API 形状
  * 核心导出：`ViboApi`、`createViboApi`
* `index.ts`
  * 使用 `contextBridge` 暴露 `window.viboApp`
  * 核心导出：无

当前扩展：

* 已暴露 app config、project config 与项目 bootstrap 查询 / 更新能力
* 已暴露主进程顶部菜单下发到 renderer 的 menu command 订阅能力
* 已暴露 project ui state 更新能力，用于持久化项目窗口布局
* 已暴露最近项目列表、pin、移除、Reveal 与 recent reopen 能力
* 已暴露 terminal session 的查询、创建、snapshot 读取、输入、resize、关闭、重命名和事件订阅能力
* 已暴露 Claude Code / Codex / OpenCode Project Home 数据查询、`New Claude Code`、`Resume Claude Code`、`New Codex`、`Resume Codex`、`New OpenCode` 与 `Resume OpenCode` 能力
* 已暴露项目级 Git 提交历史、单次 commit 文件列表与文件 diff 预览读取能力
* 已暴露全局原始 skills 扫描能力
* 已暴露项目级 skills 聚合数据读取能力
* 已暴露 Workspace 目录读取、文件 preview 读取、文本写回、文件新建、重命名、删除、Reveal 与终端路径解析能力
