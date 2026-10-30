# Knowlery 2.0 — 设计入口

> 状态：2.0 开发分支的文档基线（2026-10-29），不是 2.0 已实现或已发布的声明。
> 分支：`develop/2.0`。建立时从 `main` 提交 `0e53802c0c332ab23445b83651f15999e1ac89b8`（1.6.2）派生。

Knowlery 2.0 的方向是 **Agent-native、Markdown-first、Format-first**：人提供信息与方向；Agent 自主编译、组织、更新和使用持续演进的 LLM Wiki；人在重大不确定性时介入。Obsidian 是可选的人机界面，而不是运行知识库的必要条件。

## 阅读顺序

| 文档 | 作用 | 当前状态 |
| --- | --- | --- |
| [GOALS.md](./GOALS.md) | 产品愿景、目标、非目标和成功标准 | 目标基线 |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | 高层组件关系和职责边界 | 已确认方向；实现待设计 |
| [DECISIONS.md](./DECISIONS.md) | 确认事项、候选方案和开放问题 | 持续维护 |
| [Knowledge Format v0.2](../../format/KNOWLEDGE-FORMAT-v0.2.md) | 知识组织、表达、来源和治理契约（当前提案，待 Level 0 实验验证） | **Draft，非批准 Schema** |
| [Knowledge Format v0](../../format/KNOWLEDGE-FORMAT-v0.md) | 早期问题框架与评测场景 | 历史草案 |
| [REPOSITORY-PLAN.md](./REPOSITORY-PLAN.md) | 目录边界、旧代码处置和分阶段迁移 | 执行计划 |
| [VALIDATION.md](./VALIDATION.md) | 跨 Agent、无 Obsidian 和更新安全性验收 | 待执行 |
| [SOURCES.md](./SOURCES.md) | 共识来源与文档重建说明 | 溯源记录 |

## 目录导航

- [format/](../../format/)：长期 Knowledge Format 及未来兼容性样例。
- [skills/](../../skills/)：未来可独立分发的 Agent Skills。
- [packages/](../../packages/)：拟议的 CLI、Adapter 和 Obsidian UI 实现边界。
- [tests/conformance/](../../tests/conformance/)：格式和关键操作一致性测试的入口。

**注意**：以上目录目前是文档骨架，**不是已完成的迁移**。原有 `src/`、`plugin/`、`tests/`、构建链路和发布流程暂时保持不变。

## 决策纪律

- Architecture Baseline 表示“方向已确认”，不表示具体 Format 字段、ID 方案、目录规则或实现已经批准。
- 格式草案中的示例不得当作正式兼容性承诺。
- 只有经实验验证并明确记录的决定，才能由 Proposed / Open 更新为 Accepted。
- 设计中的目标和测试计划不等于当前产品能力。
