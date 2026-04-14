# main/services 索引

职责：

* 承载主进程业务服务层

当前目录文件：

* `README.md`
  * 当前目录索引

当前子目录：

* `actions/`
  * action registry 预留目录
* `config/`
  * 全局配置与项目配置读写
* `projects/`
  * 项目打开与 `.vibo` bootstrap
* `workspace/`
  * 文件工作区服务
* `terminals/`
  * terminal 管理与 PTY 实现
* `agents/`
  * agent adapter 与 shell / codex / opencode launch builder
* `recents/`
  * recent projects / sessions 服务
* `git/`
  * 项目级 Git 只读提交历史服务
* `skills/`
  * 原始 skills discovery 与项目级 skills 聚合
