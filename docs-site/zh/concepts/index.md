# 核心概念

理解 Knowlery 最容易的方式，是把它看作 vault 上的一层 review surface。你的笔记是原始材料。Skills 是可复用的 prompt。Rules 是约束。Dashboard 会把最近活动整理成一组小动作，而更深的维护工具放在 Obsidian settings 中。

## 一个核心，两个外壳

从 0.7.0 起，同一套知识库生命周期能力提供两个外壳，共享同一种 workspace 格式：

| 外壳 | 提供 | 安装 |
| --- | --- | --- |
| Obsidian 插件 | 全部能力：review space、Knowledge health 界面、应用内实时检索，以及所有生命周期操作 | 社区插件市场 |
| `knowlery` CLI | `init` / `sync` / `health` / `query` / `stale` / `bundle install\|list\|uninstall`——面向终端、agent 和无头环境 | `npm i -g knowlery` |

CLI 初始化的文件夹用 Obsidian 打开零迁移，任何 Knowlery vault 也可以直接被 CLI 操作。两个外壳共享同一份 sync 与迁移实现，workspace 会记录最后同步它的 Knowlery 版本——旧外壳会拒绝同步，而不是把新外壳升级过的内容降级回去。

## Review Space

Knowlery 不会取代你的个人笔记。它会在自由笔记和 agent 维护内容之间保留边界。

Dashboard 是一个行动优先的首页：

| 区块 | 用途 |
| --- | --- |
| Today's move | 从当前活动上下文开始，选择下一步 |
| Suggested moves | 不必浏览原始 skill 文件，也能选择可复用 review prompt |
| Knowledge health | 查看来源已变更的编译页面和从未编译的笔记，可一键复制 re-cook prompt |
| This note | review 当前 Markdown 笔记 |
| Recent activity | 查看最近的私有 activity receipts |
| This week | 生成和 review weekly summary |
| Bundles | 分享 review 过的 knowledge bundles，并管理已安装的 bundles |

Diagnostics、rules、schema shortcuts、平台切换和 Skills library 位于 **Settings -> Knowlery**。

## 编译后的知识层

Setup wizard 会创建四个顶层知识目录：

| 目录 | 类型 | 用途 |
| --- | --- | --- |
| `entities/` | `entity` | 人、工具、组织、项目、产品、系统 |
| `concepts/` | `concept` | 想法、框架、理论、心智模型 |
| `comparisons/` | `comparison` | 相关对象之间的并排分析 |
| `queries/` | `query` | 保存的问题、调查和研究线索 |

这些页面既应该方便人阅读，也应该方便 agent 稳定处理。具体结构由 `SCHEMA.md` 指导，但 Health 只会检查最小 frontmatter 核心。

## `KNOWLEDGE.md`

`KNOWLEDGE.md` 是 vault 的操作指南。它说明：

- 哪些目录属于 agent 工作区。
- 哪些目录属于用户自由笔记。
- Agent 应该如何检索知识。
- 当前有哪些 skills。
- 如何用 wikilinks 引用 vault 来源。

Agent 在进入这个 vault 工作时，应该尽早阅读它。

## `SCHEMA.md`

`SCHEMA.md` 是知识层的活文档，不只是 frontmatter 模板。

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

## `INDEX.base`

`INDEX.base` 是覆盖 compiled knowledge layer 的 Obsidian Bases 索引。

它面向在 Obsidian 中浏览的人，对知识页面进行分组、排序并展示有用属性。Agent 仍可按需通过 `obsidian base:query` 查询它，但为问题定位候选页面的工作由下面的确定性检索引擎完成。

## 确定性检索

从 0.6.0 起，为问题定位候选页面是一条确定性命令，两个通道运行同一个引擎：

| 通道 | 场景 | 命令 |
| --- | --- | --- |
| 应用内 CLI | Obsidian 运行中（1.12.2+，已启用 CLI） | `obsidian knowlery:query question="..." [k=<n>] [json]` |
| 无头脚本 | Obsidian 关闭，仅需 Node | `node .knowlery/bin/query.mjs "..." [--k <n>] [--json]` |

引擎会扫描编译页面、用户笔记和已安装的 bundles；按字段权重评分（标题/别名 > 标签 > 描述 > 正文）；匹配轻量词形变体和中文短语；当页面引用的原始笔记命中问题时，把分数传导给编译页面（跨语言提问也能找到编译后的答案）；没有可信匹配时返回明确的 `No confident matches`，而不是一堆噪音。

同一套机制还负责机械性的过期检测：

- `obsidian knowlery:stale` 或 `node .knowlery/bin/query.mjs --stale` 会列出引用来源在页面写入后发生变更的编译页面、未被任何编译页面引用的用户笔记，以及指向已不存在笔记的 `sources` 引用。
- Dashboard 的 Knowledge health 区块展示同一份报告，`/cook` 的增量模式以它为范围（`log.md` 仅保留为追加式历史）。

检索质量是可度量的：仓库内置评测基建（`evals/`），包含 golden 问题集、旧检索流程的冻结基线，CI 会在每个 pull request 上校验分数不回退。

## Skills 和 Suggested Moves

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

Dashboard 会优先展示自然语言 moves；Settings tab 中的 Skills library 会展示背后的 source skills，并提供创建、浏览、编辑、禁用或删除能力。

## Activity Ledger 和 Weekly Summary

当 activity logging 开启时，Knowlery 会把轻量的私有 activity receipts 写入 `.knowlery/activity/`。

这些 receipts 会驱动：

- Today 的线程摘要和下一步建议。
- This note 的相关上下文。
- Weekly summary 报告，位置在 `.knowlery/reports/latest.html` 和 `.knowlery/reports/weekly/<week-label>.html`。
- 可选的 daily review request 与结果文件，位置在 `.knowlery/requests/` 和 `.knowlery/reviews/`。

## Freshness Review

Freshness Review 是本地、approval-gated 的流程。Knowlery 可以从 `entities/`、`concepts/`、`comparisons/` 和 `queries/` 收集候选页面，准备 request JSON，并复制 prompt 给你单独运行的 agent。

导入 result JSON 后，Knowlery 会把合法 findings 转成 suggestions。应用 suggestion 只会 patch scalar frontmatter 字段，例如 `retrieval_priority`、`freshness_status`、`freshness_reviewed`、`superseded_by` 和 `freshness_sidecar`。证据和之前的 frontmatter snapshot 会保存在 `.knowlery/freshness/notes/` sidecars 中，因此已应用的 suggestion 可以恢复。

## Knowledge Bundles

Knowledge bundle 是一个便携的、review 过的知识切片，用 OKF 格式打包，来自某个 vault 的 compiled knowledge。

在分享侧，导出范围从一个 seed 主题及其 graph-closure 选出，每一项都要经过 approve/flag review gate 和自动 risk scan，随包的 `SCHEMA.md` 只包含这个 bundle 实际用到的 taxonomy。在接收侧，bundle 安装到 `Library/<bundle-id>/`，登记在 `.knowlery/bundles.json` 中，作为只读参考材料存在——直到你用 Fork to my knowledge 把某个页面复制进自己的知识目录。

已安装的 bundles 会参与检索：bundles 存在期间 `KNOWLEDGE.md` 会带一个指引块，`/ask` skill 会把每个相关 bundle 的 `agent-index.json` 和 vault 自己的 compiled pages 一起纳入检索。

## Platform Adapters

Knowlery 支持两个 agent 平台：

| 平台 | 配置文件 | Rules 目录 |
| --- | --- | --- |
| Claude Code | `.claude/CLAUDE.md` | `.claude/rules/` |
| OpenCode | `opencode.json` | `.agents/rules/` |

切换平台时，Knowlery 会重新生成目标平台配置，并可以迁移之前平台目录中的 rules。

## Companion Chat

Knowlery 可以把 prompt 发给 companion chat UI（如果它可用）：

- Claude Code 场景下用 Claudian。
- OpenCode 场景下用 `obsidian-agent-client`。

这样 review prompt 可以留在 vault 里，而不是被丢到另一个 app 中。

## Vault Health

Settings 中的 Diagnostics 会检查两类内容：

- **内容结构：** notes 数量、wikilinks 数量、知识页面数量、孤立笔记、损坏 wikilinks、缺失 frontmatter。
- **配置完整性：** 预期文件、目录、rules、内置 skills、agent CLI detection 和平台配置。
