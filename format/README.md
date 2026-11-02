# Knowlery Knowledge Format

**状态：Working Draft。** 本目录承载 Knowlery 2.0 最重要的长期契约：Agent 和不同工具如何理解、维护与交换同一种 Living Wiki。

从 [KNOWLEDGE-FORMAT-v1.0-rc.md](./KNOWLEDGE-FORMAT-v1.0-rc.md) 开始（**v1.0-rc**，2026-11-02：Decisions 已定、经 Level 0 实验验证并据此修订三处；[v0.3.1](./KNOWLEDGE-FORMAT-v0.3.md) 保留为实验所用版本。v0.3.1 本身是经两轮独立审查后的修订：基于 Knowlery-Pilot 194 页的量化分析，扁平 frontmatter、Record 角色、主张级状态、带版本来源、渐进式披露）。[KNOWLEDGE-FORMAT-v0.md](./KNOWLEDGE-FORMAT-v0.md) 是更早的问题框架与评测场景草案，仍可参考。

v1.0-rc 固定了字段集合与语义，等待 Owner 在 DECISIONS.md 中标记 Accepted 后成为 v1.0；在此之前不宣称兼容性承诺。Level 1（Connector）负责的保证（原子写、并发、`protected` 强制）未在 Level 0 验证。未来可在此增加 `examples/`、`schemas/` 和 `conformance/`，但应先从 Agent 实际查询与增量维护任务推导这些产物，而不是反过来让 Schema 支配 Wiki 组织。
