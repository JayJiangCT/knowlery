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

## Dashboard Surfaces

| Surface | 用途 |
| --- | --- |
| Today | 当前活动摘要和下一步 |
| This note | 当前笔记 review 和 prompt 准备 |
| Weekly Review | Atlas 生成和 daily review polish |
| Review Menu | 推荐动作和 source skills |
| System | 诊断和配置维护 |

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
| `.knowlery/reports/` | Weekly Review | 本地 Knowledge Atlas 输出 |
| `.knowlery/requests/` | Daily polish | Daily review requests |
| `.knowlery/reviews/` | Daily polish | Daily review results |

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

Knowlery 会注册 command palette actions，用于打开 dashboard、初始化 vault、运行诊断、添加 reflection 和切换平台。

具体 label 可能随 UI 演进，但命令面主要围绕 review、setup、diagnosis 和 platform migration。

## Activity Ledger

Activity receipts 存在于 `.knowlery/activity/YYYY-MM-DD.jsonl`。

它们是私有摘要，不是普通 knowledge pages。settings 中的 activity toggle 可以通过写入 `.knowlery/activity-disabled` 来关闭记录。

## Weekly Atlas and Daily Review

Weekly Review 会把 HTML 输出写到：

- `.knowlery/reports/latest.html`
- `.knowlery/reports/weekly/<week-label>.html`

Daily review polish 使用：

- `.knowlery/requests/daily-review-YYYY-MM-DD.json`
- `.knowlery/reviews/daily-review-YYYY-MM-DD.json`

## Network Use

Knowlery 不收集 telemetry。

当你显式使用 skill registry 功能时，Knowlery 可能通过 `npx skills ...` 访问网络。这个命令可能连接外部 skills tooling 使用的服务。

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

当插件版本变化时，Knowlery 会刷新 `.agents/skills/` 和 `.claude/skills/` 里的 bundled skills，并通过插入缺失的 anchor sections 来迁移 `SCHEMA.md`。

custom 和 forked skills 会被保留。被禁用的 built-in skills 会继续保持禁用状态，即使磁盘上的 bundled copy 已刷新。

## 删除行为

当你在 UI 中使用 delete 或 disable actions 时，Knowlery 可能删除 skill 或 rule 文件。

Setup 不应该删除普通用户笔记。不过，对于重要 vault，仍然建议先测试，并使用版本控制或备份。
