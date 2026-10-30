# Knowlery 2.0 — Repository & Migration Plan

> 状态：本轮 Bootstrap 执行计划。目录只表示未来边界；不要把占位目录视为已经拆分完成的 packages。

## 为什么沿用现有 Repo

现有仓库不仅有 Obsidian Plugin，还包含 CLI、MCP、Skills、测试和发布流程。2.0 应复用值得保留的资产，同时允许完全替换原架构。Git 历史、既有用户升级与回滚路径保留；并不承诺每个 1.x API 继续存在。

## 本轮已选择的非破坏性组织方式

~~~text
knowlery/
├── docs/2.0/                   # Goals / Architecture / Decisions / Migration / Validation
├── format/                     # Knowledge Format 草案、未来示例与符合性契约
├── skills/                     # 未来独立分发的 Agent Skills 入口（非现有工作流副本）
├── packages/
│   ├── cli/                    # 未来确定性 CLI 边界
│   ├── adapters/               # Obsidian CLI / Headless 等可替换访问方式
│   └── obsidian/               # 未来 Obsidian Plugin UI / 集成
├── tests/conformance/          # 未来格式与关键行为一致性测试
├── src/                        # 1.x 现有代码，暂不搬动
├── plugin/                     # 1.x Agent plugin / Skills，暂不搬动
├── manifest.json               # 1.x Obsidian 插件标识和版本，暂不更改
└── .github/workflows/          # 1.x CI / Release，暂不更改
~~~

Git 不记录空目录，所以新区域目前通过 README 保留，**无可执行 2.0 实现**。

## 分阶段实施

| 阶段 | 目标 | 退出条件 |
| --- | --- | --- |
| P0 — Bootstrap（本次） | 独立分支、目录骨架、共识文档和待决问题 | 仅文档新增，原构建和发布路径未改动 |
| P1 — Design & Baseline | 检视 1.x 依赖、分类复用/弃用代码，冻结 Pilot 对照样本；拟定 Format v0 | 有可复现基线、经过评审的最小契约 |
| P2 — Vertical Slice | 完成 `ask / cook / update` 的最小 Headless 工作流与确定性写入保护 | 无 Obsidian 端到端正确，数据保全可验证 |
| P3 — Integration | 改造 Skills、CLI/Adapter、MCP，按需迁入 Obsidian UI | 新旧数据迁移与工具兼容验收 |
| P4 — Release | 版本策略、迁移/回滚说明、CI、npm 与插件发布验证 | 满足升级安全与跨平台验收，再考虑并入 main |

## 复用审计规则

将现有模块逐项判定为 **KEEP**（可直接复用）、**ADAPT**（需隔离平台依赖）、**REPLACE**（职责与目标冲突）、**RETIRE**（无保留价值），并给出测试覆盖和数据迁移影响。现在不预设 `src/core` 整体搬迁，也不立即复制或删除旧 `plugin/skills`。

## 发布隔离（重要）

`main` 维持 1.x 发布；`develop/2.0` 不创建正式 2.0 Tag、不更改 `manifest.id`、不触发 npm 发布。现有 Release Workflow 按版本 Tag 触发；仅分支提交不能当作正式发布。

## 禁止事项

- 不破坏或替换 `main`，不强推。
- 不在 Bootstrap 阶段修改当前 `src/`、`plugin/`、`package.json`、`manifest.json` 或发布脚本。
- 不把未批准的 Format 字段或新路径写入 1.x 用户的真实 Vault。
- 不把 Pilot 的只读测试直接变成写入原始 Vault 的实验。
