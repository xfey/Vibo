# main 索引

职责：

* 承担 Electron 主进程入口、系统能力与核心业务服务

当前目录文件：

* `README.md`
  * 当前目录索引
* `index.ts`
  * Electron 主进程入口
  * 核心导出：无，负责调用 `bootstrapApplication`

当前子目录：

* `app/`
  * 应用启动与窗口管理
* `ipc/`
  * IPC channel 和 handler 注册
* `services/`
  * 业务服务层
