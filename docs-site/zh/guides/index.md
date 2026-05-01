# 使用指南

这些指南覆盖 Knowlery 的日常工作流。

## 初始化 Vault

1. 打开 command palette。
2. 运行 **Knowlery: Initialize vault**。
3. 选择 Claude Code 或 OpenCode。
4. Review Knowlery 将创建的文件、skills 和配置。
5. 可选地选择缺失工具的准备步骤。
6. 运行 setup。
7. Setup 完成后打开 dashboard。

如果你还在评估 Knowlery，建议先使用 test vault。Setup 会写入多个顶层文件和文件夹。

## 管理 Skills

打开 Skills tab 可以查看已安装 skills。

Built-in skills 可以被禁用或 fork。Fork 会创建一个可编辑的 custom variant，不会直接修改内置 copy。Custom skills 可以编辑或删除。

当 Node.js 和外部 skills tooling 可用时，可以通过 skill browser 发现 registry skills。

### 推荐 Skill 使用流

| 目标 | Skill |
| --- | --- |
| 处理原始笔记 | `cook` |
| 询问 vault 已经知道什么 | `ask` |
| 寻找主题之间的桥梁 | `explore` |
| 审查假设 | `challenge` |
| 生成综合想法 | `ideas` |
| 检查结构问题 | `audit` |
| 清理组织结构 | `organize` |

## 添加或编辑 Rules

Rules 用来指导 agent 在这个 vault 中如何行动。

1. 打开 Config tab。
2. 使用 **Add rule** 创建新 rule。
3. 给 rule 一个聚焦的 filename 和 title。
4. 用普通 markdown 编写指令。
5. 保存并确认它出现在 rules list 中。

好的 rule 应该短而可执行。相比一篇泛泛的写作风格说明，`Always cite source notes using wikilinks` 这样的指令更有效。

## 切换平台

可以在 settings tab 中切换 Claude Code 和 OpenCode。

Knowlery 会：

- 创建目标 rules directory。
- 将旧平台目录中的 markdown rules 复制到新目录。
- 重新生成平台配置文件。
- 可选地清理旧平台配置。

切换平台后建议 review 生成的 config，尤其是你有 custom rules 的时候。

## 运行健康诊断

打开 Health tab 并点击 **Run diagnosis**。

Knowlery 会检查：

- 没有 incoming wikilinks 的孤立笔记。
- 无法解析到现有文件的损坏 wikilinks。
- `entities/`、`concepts/`、`comparisons/`、`queries/` 中缺失的 frontmatter。

Health output 是建议性质。对真实 vault 做结构调整前，请先 review 诊断结果。

## 重新生成 Agent Config

如果 agent instructions 漂移，或者 config file 被误改，可以在 settings tab 中重新生成平台配置。

这在修改 knowledge base name、切换平台、修复部分初始化失败的 vault 时很有用。

## 安全地和 Agents 一起工作

让 agent 在 Knowlery vault 中工作时，建议：

- 要求 agent 先阅读 `KNOWLEDGE.md`。
- 将 source notes 与 compiled knowledge pages 分开。
- 要求回答时使用 `[[wikilinks]]` 引用来源。
- 在依赖生成内容前 review 知识页面。
- 在大规模导入、迁移或 agent-generated changes 后运行 Health。
