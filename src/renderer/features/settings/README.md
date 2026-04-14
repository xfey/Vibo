# renderer/features/settings 索引

职责：

* 承载独立 `App Settings` 窗口及其首版分节组件

当前目录文件：

* `README.md`
  * 当前目录索引
* `SettingsOverlay.tsx`
  * `App Settings` 主体布局，负责 `General / Appearance / Agents / Skills` 左侧分页切换骨架；既可作为独立设置窗口内容使用，也保留可选 close button 的容器能力
  * 当前 `Appearance > Theme / Code Font / Code Font Size` 已会真实驱动窗口主题、mono font、mono 字号与主题派生的文件图标主题
  * `Theme` 当前采用主题预设卡片直接切换，并在卡片中同时展示文件 icon 与色系预览；`Code Font` 仍采用输入字符串后 `Apply`
  * 核心导出：`SettingsOverlay`
* `SettingsWindowView.tsx`
  * `App Settings` 独立窗口入口，负责读取 / 保存 `AppConfig`、反馈横幅与全局 skills 刷新广播
  * 核心导出：`SettingsWindowView`
* `AgentSettingsSection.tsx`
  * `App Settings > Agents` 的全局 agent 设置分节，按 `Codex / OpenCode / Claude Code` 展示可折叠的设置区块，并作为项目页 overrides 的默认基线
  * 核心导出：`AgentSettingsSection`
* `SkillsSettingsSection.tsx`
  * `App Settings > Skills` 的只读 discovery 视图，负责扫描并展示 `Codex / OpenCode / Claude Code` 的全局原始 skills 列表
  * 核心导出：`SkillsSettingsSection`

依赖说明：

* `SettingsOverlay` 只负责 UI 与表单交互，真实配置持久化由上层传入 `onUpdateAppConfig`
* `SettingsWindowView` 会通过主进程广播 `AppConfig` 与全局 skills 刷新结果，让 `Launcher / Project window` 同步更新
* `Project Home` 下半部分的项目级设置不放在本目录，避免混淆 app-level 与 project-level 边界
