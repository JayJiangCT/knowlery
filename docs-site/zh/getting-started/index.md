# 快速开始

本页介绍如何安装 Knowlery、初始化 vault，以及初始化后会发生什么。

## 使用要求

Knowlery 面向 Obsidian desktop，并需要启用 community plugins。

如果你想让 agent 真正基于 vault 工作，还需要 Claude Code 或 OpenCode。外部 skill registry 浏览和可选工具准备需要 Node.js 与 npm。

::: tip 桌面行为
Knowlery 会使用本地命令行工具和 Electron desktop API 来支持 agent 相关功能。当前插件 manifest 标记为 desktop-only。
:::

## 使用 BRAT 安装

BRAT 是 Obsidian 的 Beta Reviewers Auto-update Tool。Knowlery 尚未从 community plugin directory 安装时，可以用 BRAT 安装 beta 版本。

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
| Claude Code | `.claude/CLAUDE.md` 和 `.claude/rules/` |
| OpenCode | `opencode.json` 和 `.agents/rules/` |

如果你是从旧版本升级，v0.3.5 会在插件第一次加载时自动同步 bundled skills，并就地迁移 `SCHEMA.md`。custom 和 forked skills 不会被覆盖。

## Setup 会创建什么

Knowlery 会在 vault 中创建知识工作区和 agent 配置：

| 路径 | 用途 |
| --- | --- |
| `KNOWLEDGE.md` | 给人和 agent 看的 vault 操作指南 |
| `SCHEMA.md` | 知识分类与页面约定 |
| `INDEX.base` | 编译知识页面的 Obsidian Bases 索引 |
| `entities/` | 人、工具、组织、项目等命名对象 |
| `concepts/` | 想法、框架、理论、心智模型 |
| `comparisons/` | 并排比较分析 |
| `queries/` | 保存的问题和研究线索 |
| `.knowlery/manifest.json` | Knowlery setup 元数据 |
| `.agents/skills/` | skills 的 canonical 存放位置 |
| `.agents/rules/` | OpenCode rules 和共享 agent rules |
| `.claude/skills/` | 为 Claude Code 镜像的内置 skills |
| `.claude/CLAUDE.md` | Claude Code vault instructions |
| `.claude/rules/` | Claude Code rules |
| `opencode.json` | OpenCode 配置 |
| `skills-lock.json` | skill 来源、版本、禁用状态 |

## 可选工具准备

Setup wizard 可以检测 Claude Code、OpenCode、Node.js、Claudian 和 skills tooling。

缺失的可选工具会显示为可选择的安装或准备步骤。已安装工具会显示为只读状态行。这些动作都是 opt-in，并且会以你的本机用户权限运行。

## 打开 Dashboard

Setup 完成后，打开 Knowlery dashboard。它有三个主要 tab：

| Tab | 用途 |
| --- | --- |
| Skills | 浏览、查看、fork、启用、禁用、编辑和删除 skills |
| Config | 打开 `KNOWLEDGE.md`、打开 `SCHEMA.md`、管理 rules |
| Health | 查看 vault stats、运行结构诊断、检查设置完整性 |

## 推荐的第一次使用方式

1. 先在一个干净 test vault 中初始化。
2. 阅读生成的 `KNOWLEDGE.md`。
3. 打开 Skills tab，查看 `cook`、`ask` 和 `audit`。
4. 往 vault 中加入一两篇真实笔记。
5. 让 agent 执行一次知识工作流，然后 review 生成的知识页面。
