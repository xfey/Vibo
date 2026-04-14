# Contributing

感谢你对 Vibo 的兴趣。

## 提交前约定

- 当前目标平台是 macOS，请优先围绕现有平台边界提交改动。
- 大一点的功能、交互方向调整或架构改动，建议先开 issue 对齐。
- 不要把仓库重新拉向“完整 IDE”方向；请保持 `terminal-first / agent-first / project-scoped` 的产品边界。
- 公开仓库不包含内部 `docs/` 目录；如果需要补公开说明，请直接更新根目录 `README.md`、`CONTRIBUTING.md` 或相关源码目录索引。
- 当前公开仓库只保留核心源码，不以“开箱即构建发布”为目标；请不要提交签名、公证、Apple 账号相关配置。

## 代码组织

- `renderer` 不直接读写磁盘，也不直接拼 CLI 命令
- 原生能力、文件系统、PTY、配置读写放在 `main`
- `preload` 只做最小桥接
- 共享模型、schema 与契约放在 `shared`

## 目录 README

如果你新增或显著调整了源码子目录，请同步更新该目录下的 `README.md`，保持目录索引可读。
