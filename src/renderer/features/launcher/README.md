# renderer/features/launcher 索引

职责：

* 承载启动页、最近项目与 `Open Folder` / `Settings` 入口

当前目录文件：

* `README.md`
  * 当前目录索引
* `LauncherView.tsx`
  * Launcher 顶层视图，负责小尺寸欢迎页、`Open Folder / Open Remote Project`、最近项目列表、最近项目右键动作与独立 `App Settings` 窗口打开逻辑
  * 同时会把 `AppConfig.appearance` 通过 shared appearance helper 应用到当前窗口
  * 核心导出：`LauncherView`
* `RecentProjectsContextMenu.tsx`
  * 最近项目右键菜单，承载 `Pin / Reveal in Finder / Remove from Recents`
  * 核心导出：`RecentProjectsContextMenu`

依赖说明：

* 最近项目数据与动作全部经由 `window.viboApp` 调主进程，不在 renderer 侧直接读写磁盘
* `LauncherView` 只维护界面级 loading / error / dialog 状态，不持有全局持久化逻辑
