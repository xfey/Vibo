# shared/theme-presets 索引

职责：

* 存放统一主题目录中的主题配置文件
* 为后续主题导入、主题包落盘与外部主题解析提供对齐格式

当前目录文件：

* `README.md`
  * 当前目录索引
* `vibo-light.json`
  * `Vibo Light` 内建主题定义
* `vibo-dark.json`
  * `Vibo Dark` 内建主题定义
* `registry.ts`
  * 自动发现当前目录下的主题 JSON，并按 `type` 区分 `built-in / custom`

格式约定：

* 每个主题文件都遵循 `AppThemePresetFileDefinition` 结构
* 至少包含：
  * `type`
  * `id`
  * `label`
  * `resolvedTheme`
  * `tokens`
* 可选包含：
  * `description`
  * `paletteLabel`
  * `iconTheme`
  * `extends`

发现规则：

* 当前目录下的 `*.json` 会被自动发现
* `type: "built-in"` 的主题会作为内建主题显示
* `type: "custom"` 的主题会作为自定义主题显示
