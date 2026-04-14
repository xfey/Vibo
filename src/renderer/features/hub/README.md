# renderer/features/hub 索引

职责：

* 承载 Hub 文件树、轻量 Git 提交列表、文件预览/编辑器与 Hub 主区域编排

当前目录文件：

* `README.md`
  * 当前目录索引
* `FileTree.tsx`
  * 递归渲染文件树项，并处理目录展开/收起、文件选中与右键菜单入口；root 级 `loading / empty / error` 状态由 `HubView` 统一承载
  * 核心导出：`FileTree`
* `FilePreviewPane.tsx`
  * 渲染 Hub 右侧统一文件面板，内部承载 `CodeMirror 6` 文本编辑、图片预览、不可预览对象占位，以及最小保存反馈
  * 当前不再额外渲染顶部文件状态 / 动作栏，信息与常用操作收敛到顶部 tab、右键与快捷键
  * 文本编辑器当前已支持 `Cmd+S`、`Cmd+F`、`Cmd+G`、`Option+Cmd+F`、`Control+G`、`Cmd+/`，并对齐 VS Code 支持 `Option+Z` 切换自动换行
  * 文本文件当前采用 full-bleed editor surface，editor / image preview 已统一消费 renderer theme token 与 mono font variables
  * 核心导出：`FilePreviewPane`
* `codemirror-search-panel.ts`
  * 自定义 CodeMirror 查找 / 替换与 Go to Line 面板，实现更接近 VS Code 的极简小条，并承接编辑器内 `Option+Cmd+F` / `Control+G`
  * 核心导出：`createHubSearchPanel`、`openHubReplacePanel`、`openHubGotoLine`
* `GitHistorySection.tsx`
  * 渲染 Hub 左侧底部的轻量 Git 提交列表，支持展开查看单次 commit 影响的文件，并以内联 state block 处理 loading / unavailable / empty / error
  * 核心导出：`GitHistorySection`
* `GitDiffPreviewPane.tsx`
  * 渲染 Hub 右侧的只读 unified diff 预览，负责 loading / error / empty diff 状态和关闭预览入口
  * 核心导出：`GitDiffPreviewPane`
* `TreeActionInput.tsx`
  * 渲染文件树内嵌命名输入条，用于新建与重命名
  * 核心导出：`TreeActionInput`
* `TreeContextMenu.tsx`
  * 渲染文件树右键菜单
  * 核心导出：`TreeContextMenu`
* `HubView.tsx`
  * Hub 的顶层双栏骨架，组合左侧 `FileTree + 树操作状态 + GitHistorySection + root 状态块`、统一文件右键菜单与右侧 `Project Home / FilePreviewPane / GitDiffPreviewPane`
  * 当前支持调整并持久化 Hub 左侧边栏宽度，以及 `Files / Git` 分区高度
  * 当前会把当前主题预设派生出的 `icon theme` 下传给文件树
  * 当前会把 `.vibo/draft.md` 保持可见于文件树，但点击会统一路由到顶部固定草稿本 tab，并避免在树菜单里直接 rename / delete / pin
  * 通过外部回调接入 workspace 级 file tab 的打开、pin、保存、关闭与 rename/delete 同步
  * 核心导出：`HubView`
