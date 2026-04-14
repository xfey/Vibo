# shared/i18n 索引

职责：

* 定义应用级 locale、轻量翻译字典与共享格式化 helper

当前目录文件：

* `README.md`
  * 当前目录索引
* `index.ts`
  * 定义 `AppLocale`、翻译 key、`translate` 与日期/计数格式化 helper；当前同时承载 Launcher / Project Home / Hub / Settings / main 通知与菜单等轻量文案
  * 核心导出：`APP_LOCALES`、`AppLocale`、`DEFAULT_APP_LOCALE`、`translate`、`formatRecentOpenedAt`、`formatRecentUpdateLabel`、`formatGitCommitDate`、`formatProjectHomeSessionSubtitle`、`getLanguageDisplayLabel`
