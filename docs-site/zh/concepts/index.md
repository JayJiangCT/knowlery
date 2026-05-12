# 核心概念

理解 Knowlery 最容易的方式，是把它看作一个 vault 的小厨房。你的笔记是食材。Skills 是菜谱。Rules 是厨房习惯。Agent 会把这些原料烹饪成结构化知识页面，并保持共享的 taxonomy 指南仍然是人类可读的 markdown。

## 知识烹饪

知识烹饪指的是：把原始笔记转化为可维护、结构化的知识。

Knowlery 不会取代你的个人笔记。它会创建一个独立的 compiled layer，让 agent 可以维护这个层，同时保留“人写的自由笔记”和“agent 维护的知识页面”之间的边界。

## 编译后的知识层

Setup wizard 会创建四个顶层知识目录：

| 目录 | 类型 | 用途 |
| --- | --- | --- |
| `entities/` | `entity` | 人、工具、组织、项目、产品、系统 |
| `concepts/` | `concept` | 想法、框架、理论、心智模型 |
| `comparisons/` | `comparison` | 相关对象之间的并排分析 |
| `queries/` | `query` | 保存的问题、调查和研究线索 |

这些页面既应该方便人阅读，也应该方便 agent 稳定处理。具体结构由 `SCHEMA.md` 指导。

## `KNOWLEDGE.md`

`KNOWLEDGE.md` 是 vault 的操作指南。它说明：

- 哪些目录属于 agent 工作区。
- 哪些目录属于用户自由笔记。
- Agent 应该如何检索知识。
- 当前有哪些 skills。
- 如何用 wikilinks 引用 vault 来源。

Agent 在进入这个 vault 工作时，应该尽早阅读它。

## `SCHEMA.md`

`SCHEMA.md` 是编译后的知识层所使用的活文档 convention 文件。

当前模板把内容分成这些部分：

- Knowledge Domains
- Tag Taxonomy
- Domain Taxonomy
- Agent Page Conventions
- Frontmatter Schema
- Page Thresholds
- Custom Fields

模板会鼓励使用 `title`、`date`、`created`、`updated`、`type`、`tags`、`sources` 等字段，并允许 `status`、`domain`、`description`、`references`、`author` 这类可选字段。

Health diagnostics 仍然只检查知识页面的最小必需字段：

| 类型 | 最小字段 |
| --- | --- |
| Entity | `type`、`created` |
| Concept | `type`、`created` |
| Comparison | `type`、`items`、`created` |
| Query | `type`、`status`、`created` |

`SCHEMA.md` 是给人和 agent 共同使用的指南；Health tab 只负责确认页面至少已经可识别。

## `INDEX.base`

`INDEX.base` 是覆盖 compiled knowledge layer 的 Obsidian Bases 索引。

它会对知识页面进行分组和排序，展示有用属性，并在 agent 读取单个文件前提供一个稳定地图。

## Skills

Skills 是安装在 `.agents/skills/<name>/SKILL.md` 的 markdown prompt packages。

Knowlery 当前内置这些 skills：

| Skill | 用途 |
| --- | --- |
| `cook` | 将笔记整理成知识页面并同步 `SCHEMA.md` taxonomy |
| `ask` | 基于 vault 内容回答问题 |
| `explore` | 追踪时间线并发现连接 |
| `challenge` | 压力测试信念并检测 drift |
| `ideas` | 从 vault 内容生成可行动想法 |
| `audit` | 扫描 agent 维护目录中的结构健康问题 |
| `organize` | 建议 vault 结构调整 |
| `obsidian-cli` | 使用 Obsidian CLI patterns |
| `obsidian-markdown` | 编写 Obsidian-flavored markdown |
| `obsidian-bases` | 处理 Obsidian Bases 文件 |
| `json-canvas` | 创建和编辑 JSON Canvas |
| `defuddle` | 从网页中提取干净 markdown |
| `vault-conventions` | 记录并执行 vault 命名约定 |

## Rules

Rules 是约束 agent 行为的 markdown instructions。Knowlery 会安装默认 rule templates，并允许你在 Config tab 中新增、编辑、查看或删除 rules。

Claude Code rules 位于 `.claude/rules/`。OpenCode rules 位于 `.agents/rules/`。

## Platform Adapters

Knowlery 支持两个 agent 平台：

| 平台 | 配置文件 | Rules 目录 |
| --- | --- | --- |
| Claude Code | `.claude/CLAUDE.md` | `.claude/rules/` |
| OpenCode | `opencode.json` | `.agents/rules/` |

切换平台时，Knowlery 会重新生成目标平台配置，并可以迁移之前平台目录中的 rules。

## Vault Health

Health tab 检查两类内容：

- **内容结构：** notes 数量、wikilinks 数量、知识页面数量、孤立笔记、损坏 wikilinks、缺失 frontmatter。
- **配置完整性：** 预期文件、目录、rules、内置 skills、agent CLI detection 和平台配置。
