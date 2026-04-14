# renderer/icons 索引

职责：

* 承载 renderer 侧可复用的文件图标主题与 agent 品牌标识

当前目录文件：

* `README.md`
  * 当前目录索引
* `agent-branding.tsx`
  * 定义 `Codex / OpenCode / Claude Code / Shell` 的徽标、角标与水印组件
  * 核心导出：`AgentBrandIcon`、`AgentBrandLabel`、`AgentBadge`、`AgentBrandWatermark`
* `draft-note.tsx`
  * 定义项目草稿本固定标签使用的 note icon
  * 核心导出：`DraftNoteIcon`
* `icon-theme-registry.ts`
  * 定义内建文件图标主题 registry 与 fallback 解析
  * 核心导出：`BUILT_IN_FILE_ICON_THEMES`、`resolveBuiltInFileIconThemeId`、`getFileIconThemeDescriptor`
* `file-icons.tsx`
  * 定义可切换的文件图标主题，并提供文件树 / file tabs 复用的文件图标组件
  * 核心导出：`FileEntryIcon`、`FileIconThemePreview`

当前资产：

* `assets/brands/`
  * 存放整理后的品牌 logo 资源，包含透明 `svg / png`

依赖说明：

* 图标主题当前内建：
  * `material`
* 文件图标主题当前不再作为独立设置直接写入 `AppConfig`；renderer 会从当前 `theme preset` 派生出对应 `icon theme`
* `material` 文件图标基于 `material-file-icons`
* `Codex / OpenCode / Claude Code` 品牌图形当前来自各自官方品牌资源或产品标识整理
