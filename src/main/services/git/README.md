# main/services/git 索引

职责：

* 提供项目级 Git 只读信息查询

当前目录文件：

* `README.md`
  * 当前目录索引
* `project-git-service.ts`
  * 负责探测 Git 可用性、识别当前项目是否位于 Git 仓库内，并返回只读 commit history list、单次 commit 文件列表与文件 diff 预览数据
  * 核心导出：`ProjectGitService`
