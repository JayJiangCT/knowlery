# 故障排查

当 setup、skills、平台配置或 vault health 看起来不正常时，可以从这里开始。

## Dashboard 显示 Vault 尚未设置

Knowlery 会检查 `.knowlery/manifest.json` 或 `KNOWLEDGE.md`。

如果这个 vault 理论上已经初始化：

1. 确认 `.knowlery/manifest.json` 或 `KNOWLEDGE.md` 存在。
2. 如果 manifest 存在，确认它是合法 JSON。
3. 重新打开 dashboard。
4. 如果文件缺失或损坏，重新运行 setup，或在 settings 中使用 maintenance actions。

## 无法检测到 Node.js

Node.js 用于 skill registry 浏览和可选 tooling preparation。

可以尝试：

1. 从 Node.js 官方网站安装 Node.js。
2. 重启 Obsidian。
3. 在 Knowlery settings 中使用 Node.js auto-detect。
4. 如果 auto-detect 失败，手动填写 Node.js 路径。

在 macOS 和 Linux 上，GUI apps 有时不会继承 terminal 中的 shell PATH。此时可能需要手动填写路径。

## Skill Browser 无法使用

Skill browser 依赖 Node.js、npm，以及通过 `npx skills` 调用的外部 skills CLI。

检查：

- Node.js 已安装并被检测到。
- npm 可用。
- 搜索词不为空。
- 网络访问可用。
- 外部 skills registry 可访问。

如果 registry 暂时不可用，built-in skills 和 custom skills 仍然可以使用。

## Built-In Skills 缺失

打开 **Settings -> Knowlery**，然后在 Diagnostics 里检查 **Skills installed**。

Built-in skills 预期位于 `.agents/skills/<name>/SKILL.md`。

如果有缺失：

1. 在 test vault 中重新运行 setup，对比预期输出。
2. 如果 skill 是被禁用的，尝试从 settings 的 Skills 区块重新启用。
3. 如果安装不完整，可以使用 maintenance actions 重新初始化或修复 vault。

## Agent Config 缺失

无论选择哪个平台，Knowlery 都预期存在：

- vault 根目录的 `AGENTS.md`
- `.claude/CLAUDE.md`
- `.agents/rules/`
- `.agents/skills/`

可以在 settings 中重新生成 agent config。

## Agent 没有遵守 vault 规则

所有 agent 都从同样三个来源出发：你的 `KNOWLEDGE.md`（这个知识库是什么）、
`.agents/rules/` 下的 rules、以及当前版本 Knowlery 的操作规则（Obsidian CLI
用法、检索流程、skills——由模板渲染，修正能到达每个 vault）。入口文件有两
个，各自带一个 `<!-- Knowlery managed:start/end -->` 区块：

- `AGENTS.md`，Codex、OpenCode、Cursor 读取。这些 harness 没有 import 语法，
  所以区块以 **Read First** 段开头，要求 agent 在做任何事之前先读
  `KNOWLEDGE.md` 和列出的每个 rule 文件，随后是操作规则。如果某次
  Codex/OpenCode 会话跳过了这一步，知识库描述就不在它的上下文里——检查会话
  最初的几次工具调用。
- `.claude/CLAUDE.md`，Claude Code 读取。区块先 `@` import `KNOWLEDGE.md`，
  再内联操作规则，然后逐个 `@` import 每个 rule 文件，因此 Claude 拿到的是
  硬注入的同一份上下文。它不再 import `AGENTS.md`。

`KNOWLEDGE.md` 不会被复制进任何一个入口文件。两个区块都会在插件加载、增删
rule 和 `knowlery sync` 时重新生成，请修改 `KNOWLEDGE.md` 或 rule 文件，不要
直接修改区块。你写在标记之外的内容都会保留。

从 1.5 之前的 vault 升级时：

- **`KNOWLEDGE.md` 仍含旧的操作规则。** 1.5 之前的模板把 `## Operating
  Rules`、`## Knowledge Retrieval`、`## Available Skills` 写进了
  `KNOWLEDGE.md`；现在这些由 Knowlery 直接写入入口文件，留在
  `KNOWLEDGE.md` 里的是过时的重复。它们存在期间 health 会显示警告。请删除这
  三节（保留标题、简介、Vault Structure 和你自己的段落——如果你把自己的内容
  嵌套在其中某一节下面，先移出来）。`KNOWLEDGE.md` 是你的文件，Knowlery 不
  会代劳。
- 如果 vault 里已有手写的 `AGENTS.md`，受管区块会放在最前面，你的内容接在
  后面。这些旧内容通常已与 `KNOWLEDGE.md` 重复；**设置 → 重新生成 Agent 配置
  → 重置 AGENTS.md** 会（确认后）丢弃区块之外的全部内容。之后再把值得保留的
  部分——比如 MCP 数据源优先级规则——补回区块下方即可。
- 原本在 `.claude/rules/` 里的 rules 会被**复制**到 `.agents/rules/`（不会
  删除）。Claude Code 也会自动加载 `.claude/rules/`，所以在你删除该目录之前
  Claude 会看到这些 rules 两遍——无害但冗余。确认 `.agents/rules/` 已齐全后
  可以删掉 `.claude/rules/`。
- `.claude/CLAUDE.md` 就地收敛：1.5 的 `@../AGENTS.md` import，以及更早的
  零散 `@../KNOWLEDGE.md` / `@rules/*.md` import，都被受管区块取代；你自己写
  的内容保留在区块之后。
- Knowlery 写入的 `opencode.json` 被退役：OpenCode V2 不再加载它的
  `instructions` 数组，`knowlery sync` 会删掉那两条 Knowlery 条目（若没有
  你自己添加的内容，会连文件一起删除）。

Codex 默认把项目指令总量限制在 32 KiB（`project_doc_max_bytes`）；生成的
区块约 6 KB。

## Broken Wikilinks

Broken wikilinks 表示 Obsidian 无法解析链接目标。

常见原因：

- 目标 note 被重命名或删除。
- link text 有拼写错误。
- note 存在于其他 folder，但标题和预期不同。

修复 link 或恢复目标 note，然后再次运行 diagnosis。

## Orphan Notes

Orphan notes 是没有 incoming wikilinks 的笔记。

这不一定是坏事。Daily notes、inbox notes 或临时 notes 可能本来就是孤立的。对于 knowledge pages 来说，orphan 通常意味着页面尚未接回知识地图。

## Missing Frontmatter

Knowlery 只检查知识目录中的 frontmatter。

如果 `entities/`、`concepts/`、`comparisons/` 或 `queries/` 中的文件缺少 frontmatter，请对照 `SCHEMA.md` 添加缺失字段。

## Optional Installs 失败

Optional installs 会在你的机器上运行本地命令。

如果安装失败：

1. 检查该项目需要 Node 时，Node.js 是否已检测到。
2. 在 terminal 中尝试等价安装命令。
3. 安装外部工具后重启 Obsidian。
4. 重新打开 setup 或 settings，再次运行 detection。

## Knowledge Bundle 无法安装

安装前会先校验 bundle，任何校验失败都不会写入内容。

常见原因：

- `.zip` 或文件夹的根目录下没有 `knowlery-bundle.json` manifest。
- Bundle id 不是路径安全的，或某个条目路径试图逃出 `Library/<bundle-id>/`。
- 相同 bundle 已经以相同或更新的版本安装——更新要求更高的 bundle 版本号。
- Bundle 存在 conformance 错误——需要在安装预览中显式确认才能继续。

如果 manifest 或路径有问题，请让分享者用当前版本的 Knowlery 重新导出。

## 已安装 Bundle 的知识没有出现在回答里

`/ask` skill 会读取 `.knowlery/bundles.json`，以及 `Library/<bundle-id>/` 下每个相关 bundle 的 `agent-index.json`。

依次检查：

1. Bundle 出现在 dashboard 的 Bundles 区块中。
2. `.knowlery/bundles.json` 里登记了这个 bundle。
3. `KNOWLEDGE.md` 中存在 installed-bundles 指引块。
4. Vault 里的 `/ask` skill 是最新的——插件版本变化时 bundled skills 会自动刷新。

## 什么时候提交 Issue

当你能在 clean test vault 中稳定复现问题时，可以提交 GitHub issue，并附上：

- Knowlery version。
- Obsidian version。
- 操作系统。
- Active platform，是 Claude Code 还是 OpenCode。
- 复现步骤。
- 相关 console errors。
