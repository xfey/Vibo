# main/services/config 索引

职责：

* 提供全局配置与项目配置的读写能力

当前目录文件：

* `README.md`
  * 当前目录索引
* `config-store.ts`
  * 配置存储实现，并统一暴露全局 config / recents 与项目级 `.vibo` 文件路径约定
  * 核心导出：`ConfigStore`
