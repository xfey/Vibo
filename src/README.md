# src 索引

职责：

* 承载 Vibo 首轮实现代码
* 按 `main / preload / renderer / shared` 四层分离原生能力、桥接层、界面层与共享模型

当前目录文件：

* `README.md`
  * 当前目录索引

当前子目录：

* `main/`
  * Electron 主进程、系统能力与业务服务
* `preload/`
  * 安全桥接层
* `renderer/`
  * React 界面层
* `shared/`
  * 双端共享的模型、schema 与契约
