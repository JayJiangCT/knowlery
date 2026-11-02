# Knowlery 2.0 — Decision Register

> 用于区分已确认方向、候选设计与需要评测的事项。仅记录本轮已有依据；不自动把研究提案转换为 Accepted。

| ID | 议题 | 状态 | 决定或待决内容 |
| --- | --- | --- | --- |
| A-001 | 产品定位 | **BASELINE** | Agent-native，Agent 负责日常知识管理；人保留最终控制权与必要升级 |
| A-002 | 架构中心 | **BASELINE** | Format-first + Markdown-first；Knowledge Format 是长期契约 |
| A-003 | Runtime | **BASELINE** | 不以自研完整 Core Runtime / Obsidian 替代品为目标 |
| A-004 | 技术分工 | **BASELINE** | Skills 管智能行为；CLI/Adapter 管确定性操作；MCP 可选；Obsidian Plugin 专注 UI |
| A-005 | 资产可靠性 | **BASELINE** | 重要证据、人工决定、当前与历史知识不能因替换客户端而丢失 |
| A-006 | 自治治理 | **BASELINE** | Agent 默认自主，重要证据冲突或高风险不可逆变更触发人工升级 |
| R-001 | GitHub 组织 | **ACCEPTED FOR BOOTSTRAP** | 继续同一仓库；`develop/2.0` 独立开发；暂保留 1.x 代码与发布配置 |
| F-001 | Wiki 结构 | **PROPOSED → v1.0-rc** | 三种页面角色（Knowledge / Record / Source）、`## Current` 置顶的固定段落契约、主张级状态；Level 0 实验 T04 显示局部更新率 0.00 vs 1.x 0.77/0.70（RESULTS F2）。待 Owner 标 Accepted |
| F-002 | Frontmatter 字段 | **PROPOSED → v1.0-rc** | 扁平 frontmatter；必填 `type/title/description/tags/status/updated/updated_by`；可选 `verified*/stale_after/aliases/related/supersedes/superseded_by/protected`；Record 加 `date/kind/followed_by`。移除 `freshness_status/retrieval_priority/domain`。见 Format §5–6 |
| F-003 | Note 身份 | **PROPOSED → v1.0-rc** | 受管理页按 slug 链接，Source 按路径链接；主张锚点 `^cN` 行尾、页内唯一、随行移动；不注入 UUID。T04/T09 验证锚点在移动后可解析 |
| F-004 | 来源版本 | **PROPOSED → v1.0-rc** | 两个值：`version`（证据范围的 sha256，负责变化检测）+ 可选 `blob:`（整文件 git 对象，负责恢复）；范围按角色定义（Source 正文 / Record 到 `## Sources` 止 / Claim 指纹）。T07–T10 验证：8/8 诚实恢复或不恢复，8/8 无误判 |
| F-005 | Governance 持久化 | **PARTIAL** | Format 侧：`protected`、`## History`、`log.md`、Source frontmatter 治理信号已定（Format §10–11、§8）；跨设备权威存储与冲突语义属 Connector（Level 1），未验证 |
| F-006 | 知识关系 | **PROPOSED → v1.0-rc** | 依赖规则：Knowledge 引用 Record/Source 为证据；`derived` 引用另一页的单条主张，证据权重为零，争议沿其传播（§9.2，T11 验证 2/2 到达） |
| F-007 | 写入安全 | **PARTIAL** | 约定层已定（移入 History、不删除、追加式 Sources/History、`log.md`）并在 T04–T06 两 harness 下成立；确定性保证（原子写、并发、`protected` 强制）留给 Connector |
| F-008 | 读取规则 | **PROPOSED → v1.0-rc** | 渐进式披露分层；**新增**：作为答案给出的主张需读其首个 vault 内 Source，除非 History 有 `source-checked` 事件**且 Source 当前 digest 仍等于所记版本**（审查 2026-11-02 指出仅凭事件会复用过期验证；RESULTS F1：Test 臂 3 次中 2 次漏检编译期错误）。T13 回归（kit `2ba5db3`）两臂各 1 格通过，Test 臂仅凭 digest 比对即发现漂移、未读 Source 正文 |
| E-001 | 对照实验 | **DONE (run 1)** | 1.x vs v0.3.1，12 任务 × 2 臂 × 2 harness（同一模型），47/48 通过；见 `format/experiments/level0/RESULTS.md`。Owner 于 2026-11-02 接受单模型范围 |
| E-002 | 无 Obsidian 测试 | **DONE (run 1)** | 两臂均 headless、仅文件工具；Level 0 成立。Connector 相关保证未测 |

## 状态规则

- **BASELINE**：Owner 已确认的高层方向，原则可以直接约束设计；具体实现仍需评审。
- **ACCEPTED FOR BOOTSTRAP**：仅适用于本次分支搭建的工程决定，不是永久的多包/发布策略。
- **RESEARCH / OPEN**：不应被代码或文档暗中固化成强制规范。
- **PLANNED**：计划而非已经完成的实验。
- **PROPOSED → v1.0-rc**：设计已在 Format v1.0-rc 中固定并经 Level 0 实验验证；等待 Owner 标记 Accepted（日期、备选方案与风险见 Format §15/§18 与 RESULTS.md）。
- **PARTIAL**：Format 侧已定，Connector 侧未验证。
- **DONE (run 1)**：实验已执行一轮；结论为案例发现，未达统计显著。

要将 OPEN / RESEARCH 改为 Accepted，至少补上实验或证据、替代方案、风险与升级路径、Owner 决定及日期。历史争议可追溯至 [SOURCES.md](./SOURCES.md) 的研究材料；不可仅依据本表推断旧 ADR 已获批准。
