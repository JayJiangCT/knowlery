# 从 Obsidian 开始

本页介绍如何安装 Knowlery 插件、初始化 vault，以及初始化后会发生什么。
（想从 agent 开始？见[快速开始](./index)。）

## 使用要求

Knowlery 面向 Obsidian desktop，并需要启用 community plugins。

如果你想让 agent 真正基于 vault 工作，还需要 Claude Code 或 OpenCode。可选工具准备和外部 skill browser 需要 Node.js 与 npm。

::: tip 桌面行为
Knowlery 会使用本地命令行工具和 Electron desktop API 来支持 agent 相关功能。当前插件 manifest 标记为 desktop-only。
:::

## 从 Community plugins 安装

日常使用时，请直接从 Obsidian 的 community plugin directory 安装 Knowlery。

1. 在 Obsidian 中打开 **Settings -> Community plugins**。
2. 点击 **Browse**。
3. 搜索 **Knowlery**。
4. 安装并启用插件。

## 使用 BRAT 安装 beta 版本

BRAT 是 Obsidian 的 Beta Reviewers Auto-update Tool。只有在你想测试尚未发布到 community plugin directory 的 preview builds 时，才需要使用 BRAT。

1. 在 Obsidian 中安装 BRAT。
2. 打开 BRAT 设置。
3. 添加这个 beta plugin repository：`https://github.com/JayJiangCT/knowlery`。
4. 在 **Settings -> Community plugins** 中启用 Knowlery。

## 手动安装

1. 从最新 GitHub release 下载 `main.js`、`manifest.json` 和 `styles.css`。
2. 在你的 vault 中创建 `.obsidian/plugins/knowlery/`。
3. 将这三个文件放入该目录。
4. 重新加载 Obsidian。
5. 在 **Settings -> Community plugins** 中启用 Knowlery。

## 第一次运行

启用插件后，可以从 ribbon 图标或 command palette 打开 Knowlery。

如果 vault 尚未初始化，Knowlery 会在 dashboard 和 settings tab 中显示 setup 入口。

Setup wizard 会要求你选择一个平台：

| 平台 | 生成的配置 |
| --- | --- |
| Claude Code | 检测 `claude` CLI；界面标签显示 Claude Code |
| OpenCode | 检测 `opencode` CLI；界面标签显示 OpenCode |

Agent 配置本身两者完全相同：vault 根目录的 `AGENTS.md`（跨厂商标准），内联了 `KNOWLEDGE.md` 和 `.agents/rules/` 下的 rules；再加一份 `.claude/CLAUDE.md`，只有 Claude Code 官方推荐的一行 `@../AGENTS.md` import。Claude Code、Codex、OpenCode、Cursor 每次会话开始时拿到的指令完全一致。

如果你是从旧版本升级，v0.5.0 新增了 knowledge bundle 的分享与安装：dashboard 的 Bundles 区块、**Share knowledge bundle** 和 **Install knowledge bundle** 命令、存放已安装 bundle 的 `Library/` 文件夹，以及能感知 bundle 的 `/ask` skill。v0.4.0 把 dashboard 收敛成一个行动优先的首页，并把 diagnostics、rules、schema shortcuts 和 Skills library 移到 Knowlery settings tab。Bundled skills 仍会在版本变化时自动同步，`SCHEMA.md` 缺少 anchor sections 时也会就地迁移。custom 和 forked skills 不会被覆盖。

## Setup 会创建什么

Knowlery 会在 vault 中创建知识工作区和 agent 配置：

| 路径 | 用途 |
| --- | --- |
| `KNOWLEDGE.md` | 你对知识库的描述（覆盖什么、如何组织）——由你维护 |
| `SCHEMA.md` | 知识分类与页面约定 |
| `INDEX.base` | 编译知识页面的 Obsidian Bases 索引 |
| `entities/` | 人、工具、组织、项目等命名对象 |
| `concepts/` | 想法、框架、理论、心智模型 |
| `comparisons/` | 并排比较分析 |
| `queries/` | 保存的问题和研究线索 |
| `.knowlery/manifest.json` | Knowlery setup 元数据 |
| `.agents/skills/` | skills 的 canonical 存放位置 |
| `.agents/rules/` | 所有平台共用的 rules（内联进 `AGENTS.md`） |
| `.claude/skills/` | 为 Claude Code 镜像的内置 skills |
| `AGENTS.md` | 内联 `KNOWLEDGE.md` + Knowlery 操作规则 + 你的 rules（受管区块，sync 时重新生成）；Codex、OpenCode 等直接读取 |
| `.claude/CLAUDE.md` | 供 Claude Code 使用的一行 `@../AGENTS.md` import；后面可追加 Claude 专属说明 |
| `skills-lock.json` | skill 来源、版本、禁用状态 |

正常使用过程中，Knowlery 还可能在 `.knowlery/` 下创建私有 activity receipts、weekly summary reports 和 daily review request/result 文件。

## 可选工具准备

Setup wizard 可以检测 Claude Code、OpenCode、Node.js、Claudian 和 skills tooling。

缺失的可选工具会显示为可选择的安装或准备步骤。已安装工具会显示为只读状态行。这些动作都是 opt-in，并且会以你的本机用户权限运行。

## 打开 Dashboard

Setup 完成后，打开 Knowlery dashboard。它是一个单页滚动的 review surface：

| 区块 | 用途 |
| --- | --- |
| Today's move | 从当前活动上下文开始，选择一个小的下一步 |
| Suggested moves | 使用 Process new material 或 Challenge an idea 等可复用 review prompts |
| Knowledge health | 查看过期页面与从未编译的笔记；复制 re-cook prompt |
| This note | review 当前 Markdown 笔记并准备专注的 prompt |
| Recent activity | 查看私有 activity receipts，并打开完整 activity 列表 |
| This week | 生成 weekly summary、打开上次报告，或发送给 agent review |
| Bundles | 分享 review 过的 knowledge bundle，或安装别人分享给你的 bundle |

打开 **Settings -> Knowlery** 可以进行 diagnostics、rules/schema shortcuts、Skills library、平台切换、activity logging 和 maintenance actions。其中 **Language** 设置控制 dashboard 与设置页的显示语言——`跟随 Obsidian`（默认）、`English` 或 `中文`。

## 推荐的第一次使用方式

1. 先在一个干净 test vault 中初始化。
2. 阅读生成的 `KNOWLEDGE.md` 和 `SCHEMA.md`。
3. 打开 dashboard，查看 Today's move、Suggested moves 和 This note。
4. 往 vault 中加入一两篇真实笔记。
5. 生成一次 weekly summary，然后打开 **Settings -> Knowlery** 运行诊断。
