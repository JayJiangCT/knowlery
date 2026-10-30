# Knowlery 2.0 — Agent Skills (planned)

**目录状态：占位，尚未迁移 Skills。**

2.0 中，Skills 负责 `ask`、`cook`、`challenge`、增量更新与自主治理的智能工作流。确定性读取、写入防护、版本检查与关系校验交给兼容工具，不能只依赖 Prompt。

现有 1.x Skills 仍在 [plugin/skills/](../plugin/skills/)；此处**不是另一份正在同步的权威副本**。后续审查已有 15 个 Skills，明确哪些保留、改造或淘汰；先完成最小工作流和跨 Harness 测试，再讨论公开发布渠道。

约束见 [Architecture](../docs/2.0/ARCHITECTURE.md)、[Validation](../docs/2.0/VALIDATION.md)。
