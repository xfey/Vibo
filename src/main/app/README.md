# main/app 索引

职责：

* 管理应用启动流程、窗口创建与窗口上下文

当前目录文件：

* `README.md`
  * 当前目录索引
* `application-menu.ts`
  * 构建按 `launcher / settings / project` 窗口上下文切换的顶部菜单，并在需要时直接打开独立 `Settings` 窗口
  * 核心导出：`installApplicationMenu`、`refreshApplicationMenu`
* `bootstrap.ts`
  * 主进程启动编排，并在应用就绪后初始化 locale、Skills discovery、项目级 skills 聚合等服务
  * 核心导出：`bootstrapApplication`
* `i18n.ts`
  * main 侧 locale runtime，统一承接 `AppConfig.locale` 到菜单、通知与主进程文案翻译
  * 核心导出：`setMainLocale`、`getMainLocale`、`tMain`
* `windows.ts`
  * BrowserWindow 创建、装载、集成式标题栏配置与窗口上下文管理，并缓存项目级 bootstrap；当前也负责独立 `Settings` 窗口与全局 app/skills 广播
  * 核心导出：`createLauncherWindow`、`createSettingsWindow`、`createProjectWindow`、`getWindowContext`、`getProjectBootstrap`、`updateProjectWindowsAppConfig`、`broadcastAppConfigUpdated`、`broadcastGlobalSkillsUpdated`、`updateProjectWindowProjectConfig`、`updateProjectWindowProjectUiState`
