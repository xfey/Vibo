# renderer/app 索引

职责：

* 管理 renderer 顶层装配与窗口上下文驱动

当前目录文件：

* `README.md`
  * 当前目录索引
* `AppRoot.tsx`
  * 根据窗口上下文装配 `Launcher` 或 `Project Home`，并在收到最新 `AppConfig.locale` 后驱动 renderer 侧文案切换
  * 核心导出：`AppRoot`
* `AppFeedbackBanner.tsx`
  * 应用级顶部反馈横幅，统一承载错误与成功提示
  * 核心导出：`AppFeedbackBanner`
* `i18n.tsx`
  * renderer 侧 locale runtime 与轻量翻译入口；当前提供全局 `tRenderer`、locale setter，以及可选的 `I18nProvider`
  * 核心导出：`setRendererLocale`、`getRendererLocale`、`tRenderer`、`I18nProvider`、`useI18n`

依赖说明：

* `AppRoot` 只做窗口级入口分流，不承载 feature 级业务状态
* 顶部反馈横幅由各 feature 本地控制展示时机，但共享同一组件语法
* renderer 侧当前不引入重型 i18n 库，统一复用 `src/shared/i18n` 字典与格式化 helper
