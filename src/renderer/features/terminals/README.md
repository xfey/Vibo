# renderer/features/terminals 索引

职责：

* 承载 workspace 顶部 tabs、terminal pane 与 file tabs / Hub 的统一编排

当前目录文件：

* `README.md`
  * 当前目录索引
* `TerminalWorkspaceView.tsx`
  * workspace 顶层编排组件，统一管理 `Hub / Notes 固定入口 / file tabs / terminals` 的选中状态与交互，并在 Hub 激活或 skills 刷新时拉取 Project Home / project skills 数据
  * 同时维护 `Codex / OpenCode / Claude Code Project Home` 与 project skills 的显式 loading/error 状态，避免把数据拉取失败伪装成 agent unavailable
  * 同时负责按项目级 `preferred agent` 创建 `Codex / OpenCode / Claude Code / Shell` 新会话，并支持恢复 `Codex / OpenCode / Claude Code` 历史会话
  * 同时负责把 terminal 输出事件路由到长期存活的 renderer terminal runtime，并把 `Cmd+Click` 路径打开请求解析为 Hub file tab / 草稿本固定 tab 打开动作
  * 同时在 appearance signature 变化时触发全部 terminal runtime 刷新 theme / font，并把当前主题预设派生出的 `icon theme` 分发给 tabs / Hub
  * 核心导出：`TerminalWorkspaceView`
* `TerminalTabs.tsx`
  * 顶部 `Hub + Notes 分段入口 + file tabs + terminals + create menu` 标签，支持 file preview 斜体态、dirty file 小点提示、active terminal 状态文字、滚轮横向滚动与 terminal 重命名
  * `+` 当前在 hover / focus 时会横向展开为四个图标入口，顺序跟随当前 `primary agent`；`Cmd+N` 与直接点击仍走默认 primary agent 创建
  * 文件名过长的 file tab 当前按“前 16 + ... + 后 16”做中间截断显示
  * 当前 `Codex / OpenCode / Claude Code` terminal tab 已支持区分 `Working / Waiting` 的状态灯
  * 当前支持按住 `Cmd` 显示 `1-9 / N` 提示层，并通过 `Cmd+1..9`、`Cmd+Shift+[`、`Cmd+Shift+]` 切换 tab，`Cmd+N` 触发 `+` 号创建动作
  * 当前已接入文件图标主题与 `Codex / OpenCode / Claude Code / Shell` 品牌角标
  * 核心导出：`TerminalTabs`
* `TerminalPane.tsx`
  * terminal 视口容器，只负责挂接长期存活的 `xterm.js` runtime
  * 当前不再额外渲染 terminal 顶部状态 / 标题区，相关信息收敛到顶部标签
  * 核心导出：`TerminalPane`
* `useWorkspaceTabShortcuts.ts`
  * 管理 workspace tabs 的快捷键与提示层状态，当前支持按住 `Cmd` 显示 `1-9 / N`，以及 `Cmd+1..9`、`Cmd+Shift+[`、`Cmd+Shift+]` / `Cmd+N`
  * 核心导出：`useWorkspaceTabShortcuts`
* `terminal-runtime.ts`
  * 定义 session 级长期存活的 `xterm.js` runtime、bounded snapshot hydrate、runtime store，以及 Vibo 私有 agent activity OSC 信号解析
  * 当前会直接从 renderer theme CSS variables 读取 terminal palette、mono font 与 mono font size
  * 核心导出：`TerminalSessionRuntime`、`TerminalRuntimeStore`
* `workspace-tabs.ts`
  * 定义 workspace 顶部标签的 renderer 侧模型，包括 `FileTabState`、`WorkspaceTabDescriptor` 与相关 helper；当前也承载 file dirty 状态给顶部 tab 消费
  * 核心导出：`HUB_TAB_ID`、`FileTabState`、`WorkspaceTabDescriptor`、`getFileTabLabel`、`isFileTabDirty`
