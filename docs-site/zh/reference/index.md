# 参考

本页列出 Knowlery 使用的文件、命令、skills 和安全边界。

## 插件元数据

| 字段 | 当前值 |
| --- | --- |
| Plugin ID | `knowlery` |
| Minimum Obsidian app version | `1.12.2` |
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
| Knowledge health drill-in | 过期页面、从未编译的笔记、悬空来源和 re-cook prompt；可选的 Jev 对未编译笔记排序 |
| Settings: Diagnostics | Vault health、content stats、configuration integrity、diagnosis，以及 Indexing 区块里被跳过的目录列表（附原因） |
| Settings: Rules & schema | Agent rules、schema shortcuts、config maintenance，以及参考目录 / 忽略目录两份列表 |
| Settings: Skills | Built-in、registry、custom 和 disabled skill 管理 |

## 创建的文件和文件夹

| 路径 | Setup 创建 | 说明 |
| --- | --- | --- |
| `KNOWLEDGE.md` | 是 | 你对知识库的描述；由你维护 |
| `SCHEMA.md` | 是 | 知识分类与页面约定 |
| `INDEX.base` | 是 | Bases index |
| `entities/` | 是 | Agent-maintained entity pages |
| `concepts/` | 是 | Agent-maintained concept pages |
| `comparisons/` | 是 | Agent-maintained comparison pages |
| `queries/` | 是 | Agent-maintained research threads |
| `.knowlery/manifest.json` | 是 | Setup state |
| `.agents/skills/` | 是 | Canonical skills |
| `.agents/rules/` | 是 | 所有平台共用的 rules（内联进 AGENTS.md，.claude/CLAUDE.md 逐个 import） |
| `.claude/skills/` | 是 | 为 Claude Code 镜像的内置 skills |
| `AGENTS.md` | 是 | Codex、OpenCode、Cursor 等的入口文件：KNOWLEDGE.md + Knowlery 操作规则 + rules 复制进受管区块 |
| `.claude/CLAUDE.md` | 是 | Claude Code 的入口文件：`@../KNOWLEDGE.md`、操作规则、每个 rule 一行 `@` import（受管区块） |
| `skills-lock.json` | 是 | Skill lock state |
| `.knowlery/activity/` | Activity logging | 私有 activity receipts |
| `.knowlery/reports/` | Weekly summary | 本地 HTML report 输出 |
| `.knowlery/requests/` | Daily polish | Daily review requests |
| `.knowlery/reviews/` | Daily polish | Daily review results |
| `.knowlery/exports/` | Share knowledge bundle | 编译后的 bundle 输出（可选打成 zip） |
| `.knowlery/export-scope.json` | Share knowledge bundle | 按主题保存的 review scope |
| `Library/<bundle-id>/` | Install knowledge bundle | 已安装 bundle 的内容 |
| `.knowlery/bundles.json` | Install knowledge bundle | 已安装 bundle 的注册表 |
| `.knowlery/bin/query.mjs` | 是，sync 时刷新 | 离线检索与过期报告脚本（`node .knowlery/bin/query.mjs`） |
| `.knowlery/config.json` | 参考 / 忽略目录 | `referenceDirs`（可检索、永不列为未编译）与 `ignoreDirs`（永不扫描）；schemaVersion 1 |
| `.knowlery/triage.json` | Jev cook 分诊 | 每条未编译笔记的 Jev 评分（路径、分数、建议目标页、mtime）；绝不含密钥或笔记正文 |

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
| `knowlery-cli` | tooling | 用独立的 `knowlery` CLI 操作知识库 |
| `knowlery-mcp` | tooling | 通过 Knowlery MCP tools 操作知识库 |

## Settings Sections

| Section | 控制内容 |
| --- | --- |
| General | 知识库名称、显示语言（跟随 Obsidian / English / 中文）、Node.js 路径和 KB 注册开关 |
| Platform | Claude Code / OpenCode 切换 |
| Activity | Activity logging 和 activity ledger rule |
| Knowledge bundle defaults | 导出 bundle 的创建者名称、URL 和默认许可协议 |
| Jev cook 分诊（可选） | TypeSafe AI API 密钥；开启 Knowledge health 中的 Jev 排序和可选的后台评分开关（默认关闭）。评分保存在 `.knowlery/triage.json`；`knowlery stale`、`knowlery triage` 与 MCP `stale` 会从这里（或 `TYPESAFE_API_KEY`）读取密钥并自行评分。默认为空，其他功能不依赖它 |
| Maintenance | 重新生成 agent config 和重新初始化 vault |
| Advanced | 诊断、规则与结构、技能库 |

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

## Network Use

Knowlery 不收集 telemetry。

当你显式使用 skill registry 功能时，Knowlery 可能通过 `npx skills ...` 访问网络。这个命令可能连接外部 skills tooling 使用的服务。

Jev cook 分诊（可选，在你于插件设置里填入 TypeSafe AI API 密钥之前一直关闭）会在给未编译笔记评分时调用 `api.typesafe.ai`：Rank 按钮、`knowlery triage`、`knowlery stale` / MCP `stale` 内部有上限的补评，或你主动打开的后台评分开关。每次请求携带一条笔记的路径、标题、frontmatter 和前 15 个非空行，以及最多五个候选编译页面的标题与描述——绝不发送完整正文。密钥只保存在 vault 配置目录下插件的 `data.json` 里（或从 shell 的 `TYPESAFE_API_KEY` 读取），永远不会写进 vault、`.knowlery/triage.json` 或注册表。检索从不调用 Jev。

知识包的 install、publish、update 与 check-updates 会连接你指定的 URL 和 GitHub 仓库；私有访问走你自己的 `gh` 登录。

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

当插件版本变化时，Knowlery 会刷新 `.agents/skills/` 和 `.claude/skills/` 里的 bundled skills，通过插入缺失的 anchor sections 来迁移 `SCHEMA.md`，并在有已安装 bundles 时刷新 `KNOWLEDGE.md` 中的 installed-bundles 指引块。1.6.0 起，生成的 `.knowlery/bin/query.mjs` 还会在每次插件加载时按内容重新同步，所以同版本重载（例如原地替换一个 beta 构建）不会留下过期脚本；skills 仍然只在版本变化或 `knowlery sync` 时刷新。

在 v0.5.0 中，knowledge bundle 的分享与安装上线：dashboard 的 Bundles 区块、`Library/` 文件夹和 `.knowlery/bundles.json` 是新增的表面。在 v0.4.0 中，dashboard maintenance 已移到 Obsidian settings：diagnostics、rules/schema shortcuts 和 Skills library 不再是单独的 dashboard tabs。

custom 和 forked skills 会被保留。被禁用的 built-in skills 会继续保持禁用状态，即使磁盘上的 bundled copy 已刷新。

## 删除行为

当你在 UI 中使用 delete 或 disable actions 时，Knowlery 可能删除 skill 或 rule 文件。

Setup 不应该删除普通用户笔记。不过，对于重要 vault，仍然建议先测试，并使用版本控制或备份。
