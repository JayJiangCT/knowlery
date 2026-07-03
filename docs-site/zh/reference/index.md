# 参考

本页列出 Knowlery 使用的文件、命令、skills 和安全边界。

## 插件元数据

| 字段 | 当前值 |
| --- | --- |
| Plugin ID | `knowlery` |
| Minimum Obsidian app version | `1.7.2` |
| Desktop-only manifest flag | `true` |
| Main bundle | `main.js` |
| Stylesheet | `styles.css` |

## Dashboard 和 Settings Surfaces

| Surface | 用途 |
| --- | --- |
| Dashboard home | Today's move、Suggested moves、Knowledge health、This note、Recent activity、This week 和 Bundles |
| Share knowledge bundle | Seed 选择、graph-closure review、risk scan 和 bundle 导出 |
| Install knowledge bundle | Manifest 和 conformance 预览、安装和已安装 bundle 列表 |
| Move drill-ins | 完整 suggested-move 列表和单个 move prompt |
| Activity drill-in | 完整 recent activity 列表 |
| Freshness Review | request 准备、result 导入、suggestion decisions、apply 和 undo |
| Settings: Diagnostics | Vault health、content stats、configuration integrity 和 diagnosis |
| Settings: Rules & schema | Agent rules、schema shortcuts 和 config maintenance |
| Settings: Skills | Built-in、registry、custom 和 disabled skill 管理 |

## 创建的文件和文件夹

| 路径 | Setup 创建 | 说明 |
| --- | --- | --- |
| `KNOWLEDGE.md` | 是 | Vault 操作指南 |
| `SCHEMA.md` | 是 | 知识分类与页面约定 |
| `INDEX.base` | 是 | Bases index |
| `entities/` | 是 | Agent-maintained entity pages |
| `concepts/` | 是 | Agent-maintained concept pages |
| `comparisons/` | 是 | Agent-maintained comparison pages |
| `queries/` | 是 | Agent-maintained research threads |
| `.knowlery/manifest.json` | 是 | Setup state |
| `.agents/skills/` | 是 | Canonical skills |
| `.agents/rules/` | OpenCode path | OpenCode rules |
| `.claude/skills/` | 是 | 为 Claude Code 镜像的内置 skills |
| `.claude/CLAUDE.md` | Claude Code path | Claude instructions |
| `.claude/rules/` | Claude Code path | Claude Code rules |
| `opencode.json` | OpenCode path | OpenCode config |
| `skills-lock.json` | 是 | Skill lock state |
| `.knowlery/activity/` | Activity logging | 私有 activity receipts |
| `.knowlery/reports/` | Weekly summary | 本地 HTML report 输出 |
| `.knowlery/requests/` | Daily polish | Daily review requests |
| `.knowlery/reviews/` | Daily polish | Daily review results |
| `.knowlery/freshness/` | Freshness Review | Request、result、log、queue 和 sidecar 文件 |
| `.knowlery/exports/` | Share knowledge bundle | 编译后的 bundle 输出（可选打成 zip） |
| `.knowlery/export-scope.json` | Share knowledge bundle | 按主题保存的 review scope |
| `Library/<bundle-id>/` | Install knowledge bundle | 已安装 bundle 的内容 |
| `.knowlery/bundles.json` | Install knowledge bundle | 已安装 bundle 的注册表 |

## Built-In Skills

| Name | Kind | 用途 |
| --- | --- | --- |
| `cook` | knowledge | 将笔记整理成知识页面并同步 `SCHEMA.md` taxonomy |
| `ask` | knowledge | 从 vault 内容回答问题 |
| `explore` | knowledge | 追踪想法时间线和连接 |
| `challenge` | knowledge | 压力测试信念和 drift |
| `ideas` | knowledge | 从 vault 内容生成想法 |
| `audit` | knowledge | 扫描 agent 维护目录中的结构健康问题 |
| `organize` | knowledge | 建议结构改进 |
| `obsidian-cli` | tooling | 使用 Obsidian CLI patterns |
| `obsidian-markdown` | tooling | 编写 Obsidian markdown |
| `obsidian-bases` | tooling | 处理 Bases files |
| `json-canvas` | tooling | 处理 JSON Canvas |
| `defuddle` | tooling | 从网页提取干净 markdown |
| `vault-conventions` | tooling | 执行 vault naming conventions |

## Settings Sections

| Section | 控制内容 |
| --- | --- |
| General | 知识库名称和 Node.js 路径 |
| Platform | Claude Code / OpenCode 切换 |
| Activity | Activity logging 和 activity ledger rule |
| Maintenance | 重新生成 agent config 和重新初始化 vault |

## 默认 Rule Templates

Knowlery 包含这些默认 rule templates：

| Rule | 用途 |
| --- | --- |
| Citation required | 要求 vault 回答使用 wikilink citations |
| Language preference | 匹配用户语言 |
| Domain context | 描述 vault 的领域 |

## Obsidian 中注册的命令

Knowlery 会注册 command palette actions，用于打开 dashboard、初始化 vault、运行诊断、添加 reflection、分享 knowledge bundle、安装 knowledge bundle 和切换平台。

具体 label 可能随 UI 演进，但命令面主要围绕 review、setup、diagnosis 和 platform migration。

## Activity Ledger

Activity receipts 存在于 `.knowlery/activity/YYYY-MM-DD.jsonl`。

它们是私有摘要，不是普通 knowledge pages。settings 中的 activity toggle 可以通过写入 `.knowlery/activity-disabled` 来关闭记录。

## Weekly Summary and Daily Review

Weekly summary 会把 HTML 输出写到：

- `.knowlery/reports/latest.html`
- `.knowlery/reports/weekly/<week-label>.html`

Daily review polish 使用：

- `.knowlery/requests/daily-review-YYYY-MM-DD.json`
- `.knowlery/reviews/daily-review-YYYY-MM-DD.json`

## Freshness Review Files

Freshness Review 使用：

- `.knowlery/freshness/requests/freshness-review-<timestamp>.json`
- `.knowlery/freshness/results/freshness-review-<timestamp>.json`
- `.knowlery/freshness/logs/freshness-review-<timestamp>.jsonl`
- `.knowlery/freshness/queue.json`
- `.knowlery/freshness/notes/*.json`

Candidate pages 会从 `entities/`、`concepts/`、`comparisons/` 和 `queries/` 收集，并受当前 candidate limit 限制。Suggestions 只能 patch 这些知识页面上的 scalar freshness frontmatter。

## Network Use

Knowlery 不收集 telemetry。

当你显式使用 skill registry 功能时，Knowlery 可能通过 `npx skills ...` 访问网络。这个命令可能连接外部 skills tooling 使用的服务。Freshness Review 不会调用 model API；它只准备本地 request files，并导入你单独运行的 agent 写出的 result files。

## Local Command Use

当你显式使用 CLI 相关功能或可选 setup preparation 时，Knowlery 可以运行本地命令。

示例包括：

- `claude`
- `opencode`
- `node`
- `npx`
- `skills`

这些命令会在你的电脑上以你的用户权限运行。

## 升级行为

当插件版本变化时，Knowlery 会刷新 `.agents/skills/` 和 `.claude/skills/` 里的 bundled skills，通过插入缺失的 anchor sections 来迁移 `SCHEMA.md`，并在有已安装 bundles 时刷新 `KNOWLEDGE.md` 中的 installed-bundles 指引块。

在 v0.5.0 中，knowledge bundle 的分享与安装上线：dashboard 的 Bundles 区块、`Library/` 文件夹和 `.knowlery/bundles.json` 是新增的表面。在 v0.4.0 中，dashboard maintenance 已移到 Obsidian settings：diagnostics、rules/schema shortcuts 和 Skills library 不再是单独的 dashboard tabs。

custom 和 forked skills 会被保留。被禁用的 built-in skills 会继续保持禁用状态，即使磁盘上的 bundled copy 已刷新。

## 删除行为

当你在 UI 中使用 delete 或 disable actions 时，Knowlery 可能删除 skill 或 rule 文件。

Setup 不应该删除普通用户笔记。不过，对于重要 vault，仍然建议先测试，并使用版本控制或备份。
