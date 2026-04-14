# main/services/skills 索引

职责：

* 扫描原始 skills 目录，并聚合全局与项目级只读 skills 视图

当前目录文件：

* `README.md`
  * 当前目录索引
* `skill-frontmatter.ts`
  * 解析 `SKILL.md` frontmatter
  * 核心导出：`parseSkillFrontmatter`
* `skill-source-utils.ts`
  * 抽取 `SKILL.md` 目录元信息、路径规范化与稳定 ID 辅助工具，供 skills discovery 共用
  * 核心导出：`readSkillDirectoryMetadata`、`normalizePath`、`createShortHash`
* `skills-library-service.ts`
  * 扫描当前机器上的全局原始 skills 目录，并返回只读 `global skills` 视图；现已包含 OpenCode 兼容目录
  * 核心导出：`SkillsLibraryService`
* `project-skills-service.ts`
  * 扫描当前项目的 repo skills，并与全局原始 skills 聚合成项目页只读数据；现已包含 `.opencode/*` 与 OpenCode 兼容目录
  * 核心导出：`ProjectSkillsService`
