# main/services/workspace 索引

职责：

* 承载 `WorkspaceService` 的 local / ssh 实现与 project-aware 路由

当前目录文件：

* `README.md`
  * 当前目录索引
* `local-workspace-service.ts`
  * 本地 workspace 实现，负责 `listDirectory / createEntry / readFileContent / writeFileContent / renameEntry / deleteEntry / revealEntry / resolveTerminalLink`
  * `readFileContent` 当前会统一分类为 `text / image / unsupported`，并补齐图片 preview 元数据与 unsupported issue 信息
  * 核心导出：`LocalWorkspaceService`
* `ssh-workspace-service.ts`
  * SSH workspace 实现，基于本地 `ssh` 客户端完成远程目录树、文本文件读写、新建、重命名、删除与 terminal link 解析
  * 当前远程图片预览仍未接入，会统一返回 unsupported
  * 核心导出：`SshWorkspaceService`
* `workspace-router-service.ts`
  * 按 `ProjectRef.kind` 在 local / ssh workspace 实现间路由
  * 核心导出：`WorkspaceRouterService`
* `workspace-service.ts`
  * `WorkspaceService` 接口定义
* `workspace-utils.ts`
  * workspace 共享工具：排序、命名校验、unsupported 内容构造、terminal link 解析等
