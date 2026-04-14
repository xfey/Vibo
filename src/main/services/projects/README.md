# main/services/projects 索引

职责：

* 管理项目目录选择、路径规范化和 `.vibo` bootstrap

当前目录文件：

* `README.md`
  * 当前目录索引
* `project-ref.ts`
  * 统一根据项目根路径生成 `ProjectRef`
  * 核心导出：`toProjectRef`
* `project-service.ts`
  * 项目服务实现，负责目录选择、路径规范化、项目 bootstrap，以及 app/project config 与 project ui state 写回
  * 核心导出：`ProjectService`
