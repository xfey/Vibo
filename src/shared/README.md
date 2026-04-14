# shared 索引

职责：

* 放置 `main` 与 `renderer` 都需要理解的共享模型和契约

当前目录文件：

* `README.md`
  * 当前目录索引

当前子目录：

* `contracts/`
  * preload IPC 暴露给 renderer 的数据契约
* `domain/`
  * 核心领域模型
* `i18n/`
  * 应用级 locale、轻量翻译字典与共享格式化 helper
* `schemas/`
  * `zod` schema 与默认值工厂
* `theme-presets/`
  * 内建主题的独立配置文件
* `utils/`
  * 共享工具函数的预留目录

当前扩展：

* 已包含原始 skills discovery 与项目级 skills 聚合的共享领域模型、schema 与 IPC 契约
* 已包含项目级 Git 提交历史的共享领域模型与 IPC 契约
* 已包含中英文 locale、共享翻译字典与日期格式化 helper
