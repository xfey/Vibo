# renderer/theme 索引

职责：

* 承载 renderer 全局样式、design token 和基础页面语法

当前目录文件：

* `README.md`
  * 当前目录索引
* `appearance.ts`
  * renderer 侧统一 appearance 应用层，负责解析内建 / 配置文件主题定义，并把支持逗号分隔 fallback 的 `code font` 列表、`code font size`、主题 token 与派生出的 `icon theme` 注入到 document
  * 核心导出：`useDocumentAppearance`、`buildCodeFontStack`
* `theme-preset-registry.ts`
  * 从 `src/shared/theme-presets/*.json` 自动发现主题文件，并统一处理内建 / 自定义主题、配置文件自定义主题、主题继承解析与主题卡片描述
  * 核心导出：`listThemePresetDescriptors`、`resolveThemePresetId`、`getThemePresetDescriptor`
* `global.css`
  * 全局样式、语义化 design token 与基础 CSS variable fallback
  * 核心导出：无

当前扩展：

* 已包含 `workspace tabs / terminal pane / hub panel / file preview / project home / project skills` 的基础样式
* `useDocumentAppearance` 当前会在 `Launcher` 与项目窗口内统一处理选中的主题 id，并解析出 `resolved theme + icon theme + theme tokens`
* 颜色 token 已覆盖应用 surface、文本层级、按钮、状态灯、editor、terminal 背景、cursor、selection、ANSI 16 色
* typography token 已覆盖 UI 文本基础档位、subsection title、标题档位、mono 档位与基础行高；组件应优先消费这些语义字号，而不是直接写死 `px`
* `TerminalPane`、`CodeMirror` 与普通 `code/pre` 当前都通过这里的 token 与 CSS variables 共享同一套 terminal / mono appearance
