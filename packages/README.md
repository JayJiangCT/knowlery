# Knowlery 2.0 — Implementation Boundaries (planned)

**本目录是候选模块边界，并非已批准的 npm workspaces / monorepo 或完成的代码迁移。**

- [cli/](./cli/)：薄 CLI 与确定性知识操作。
- [adapters/](./adapters/)：对 Obsidian CLI、Headless 文件/搜索等现有工具的可替换访问。
- [obsidian/](./obsidian/)：Obsidian 插件 UI、可视化、配置和人工控制。

2.0 的重要约束是：Knowledge Format 不属于某一实现包，CLI 不演化成新的完整 Runtime。代码何时搬迁由依赖审计、测试与兼容策略决定。已有产品代码继续留在 `src/`。
