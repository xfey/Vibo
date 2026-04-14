# main/services/ssh 索引

职责：

* 承载 SSH transport、远程命令执行与 remote project 启动拼装

当前目录文件：

* `README.md`
  * 当前目录索引
* `ssh-command-runner.ts`
  * 封装本地 `ssh` 客户端解析、非交互远程命令执行与远程项目目录解析
  * 核心导出：`SshCommandRunner`、`quotePosixShell`、`joinPosixCommand`、`buildRemoteLoginShellCommand`
* `ssh-config-service.ts`
  * 读取本机 `~/.ssh/config` 及 `Include` 文件，提取可直接选择的具体 host alias
  * 核心导出：`SshConfigService`
* `ssh-directory-browser-service.ts`
  * 提供远程 host 探测与目录浏览能力，服务于 Launcher 的远程路径选择流程
  * 核心导出：`SshDirectoryBrowserService`
* `ssh-launch-builder.ts`
  * 基于 `ssh` 构建 remote `Shell / Codex / OpenCode / Claude Code` 的 `LaunchSpec`
  * 核心导出：`SshLaunchBuilder`
