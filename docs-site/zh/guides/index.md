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

## 阅读 Dashboard

Knowlery 现在围绕五个 dashboard surface 组织：

| Surface | 作用 |
| --- | --- |
| Today | 从当前活动状态开始，选择一个小的下一步 |
| This note | review 当前 Markdown 笔记并寻找关联上下文 |
| Weekly Review | 生成本地 atlas，或发送 polish request |
| Review Menu | 浏览 source skills 和可复用的 review prompts |
| System | 运行诊断并打开底层配置文件 |

Dashboard 默认打开 Today。最近活动或 vault 变化后，可以点刷新按钮。

## 使用 Today

Today 是最直接的“现在发生了什么”视图。

1. 打开 Today tab。
2. 阅读当前 summary 和高亮的下一步。
3. 需要 agent prompt 时，使用复制或发送动作。
4. 想记录自己对工作的简短想法时，使用 Add reflection。

如果已有 activity receipts，Today 会显示活跃 thread 和建议的下一步；如果没有，它会把你引向第一个 cook 或一个小的 setup 步骤。

## Review 一篇笔记

打开一篇 Markdown 笔记，然后切换到 This note。

Knowlery 会尝试识别当前笔记，把它和最近的知识活动关联起来，并准备一个聚焦的 prompt。适合把单篇笔记连接到旧材料、comparison 或可复用结构。

## 生成 Weekly Atlas

在需要更宏观的总结时，打开 Weekly Review。

1. 使用 **Generate atlas** 在 `.knowlery/reports/latest.html` 生成本地 HTML atlas。
2. 使用 **Open latest** 在 Obsidian 外打开这个文件。
3. 使用 **Send polish request** 让 companion agent 写一版更精炼的 review summary。
4. 使用 **Check result** 刷新 request/result 状态。

atlas 还会保存一个带日期的 snapshot 到 `.knowlery/reports/weekly/`。

## 使用 Review Menu

Review Menu 用来浏览 source skills，而不是把 dashboard 变成一个巨大的原始技能列表。

这个菜单围绕两类内容组织：

| 区域 | 用途 |
| --- | --- |
| Suggested next moves | 根据最近 activity thread 推导出的简短 prompt |
| Review moves | 可复用的 prompt，例如 digest、connect、pressure-test、clean、create |

打开某个 move 后，可以复制 prompt 或发送给配置好的 agent chat。打开 Source skills 后，可以查看、创建、fork、编辑、禁用或删除底层 skills。

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

打开 System tab 并点击 **Run diagnosis**。

Knowlery 会检查：

- 没有 incoming wikilinks 的孤立笔记。
- 无法解析到现有文件的损坏 wikilinks。
- `entities/`、`concepts/`、`comparisons/`、`queries/` 中缺失的 frontmatter。

Health output 是建议性质。对真实 vault 做结构调整前，请先 review 诊断结果。

## 记录 Reflection

在 command palette 或 dashboard 中使用 **Add reflection**，可以把一次 agent 会话或人工 review 的简短总结写进 Activity Ledger。

它会进入 Activity Ledger，而不是普通 vault note。

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
