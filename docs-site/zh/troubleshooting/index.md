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

## Claude Code Config 缺失

对于 Claude Code，Knowlery 预期存在：

- `.claude/CLAUDE.md`
- `.claude/rules/`
- `.agents/skills/`

可以在 settings 中重新生成 agent config。如果你曾从 OpenCode 切换过来，请确认当前 active platform 是 Claude Code。

## OpenCode Config 缺失

对于 OpenCode，Knowlery 预期存在：

- `opencode.json`
- `.agents/rules/`
- `.agents/skills/`

可以在 settings 中重新生成 agent config。如果你曾从 Claude Code 切换过来，请确认当前 active platform 是 OpenCode。

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
