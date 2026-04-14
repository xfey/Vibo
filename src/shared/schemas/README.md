# shared/schemas 索引

职责：

* 使用 `zod` 约束共享配置结构，并提供默认值工厂

当前目录文件：

* `README.md`
  * 当前目录索引
* `config.ts`
  * 全局配置、项目配置、项目 UI 状态的 schema 和默认值；当前项目 UI 状态包含 Hub 侧边栏宽度与 Git 区域高度
  * `theme` 当前采用非空字符串 schema，并带 `vibo-light` fallback default；`appearance.themes` 当前支持配置文件中的自定义主题定义与 token 覆盖；`codeFontSize` 当前按整数像素值约束
  * 核心导出：`appConfigSchema`、`projectConfigSchema`、`projectUiStateSchema`
* `theme.ts`
  * 主题定义与 token 结构的 schema
  * 核心导出：`appThemeDefinitionSchema`、`appThemePresetFileDefinitionSchema`、`themeTokensSchema`、`parseAppThemeDefinition`、`parseAppThemePresetFileDefinition`
* `recents.ts`
  * 最近项目列表的 schema 与默认值
  * 核心导出：`recentProjectRecordSchema`、`recentProjectsSchema`、`createDefaultRecentProjects`
* `skills.ts`
  * 全局与项目级只读 skills 记录的 schema
  * 核心导出：`globalSkillRecordSchema`、`projectSkillRecordSchema`、`parseGlobalSkillRecord`、`parseProjectSkillRecord`
