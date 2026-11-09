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
| I-001 | MCP Connector 术语边界 | **ACCEPTED · 2026-11-02** | Connector 特指 **MCP Connector**（MCP 能力接入）；它不是 CLI/MCP/Adapter 的总容器。Agent Skills 管工作流，Agent Plugin 管平台集成与分发；MCP 如何调用底层操作仍待设计。见[决策记录](./decisions/2026-11-02-cli-first-and-mcp-connector.md) |
| I-002 | CLI 优先设计 | **ACCEPTED · 2026-11-02** | 下一轮先重新设计 Knowlery CLI 的确定性操作能力，再讨论 Agent Skills、MCP Connector、Agent Plugin。这是**设计讨论优先级**，非已批准的实施依赖图或发布顺序。见[决策记录](./decisions/2026-11-02-cli-first-and-mcp-connector.md) |
| P-001 | 设计决定入库 | **ACCEPTED · 2026-11-02** | Owner 要求：后续讨论明确确认的 2.0 决定及时提交到 `develop/2.0` 的本索引与 `docs/2.0/decisions/` 对应记录；未确认建议仍为 OPEN / PROPOSED，不视为实施授权。见[决策记录](./decisions/2026-11-02-cli-first-and-mcp-connector.md) |
| CLI-001 | CLI 的适用范围、KF 权威及安全保证 | **ACCEPTED · 2026-11-02** | 有文件工具时 CLI 可选；仅能通过 Knowlery MCP 访问 Vault 时 CLI 支撑的 MCP 是唯一通路。CLI 实现而不定义 KF；强制写入保障仅适用于经 CLI 的操作，外部写入只能有条件检测；MCP 进程可常驻但不持有权威状态，`.knowlery/` 派生缓存可重建。Level 1 尚待实现与验收。见[决策记录](./decisions/2026-11-02-cli-execution-contract.md) |
| SK-001 | Obsidian Skills 默认依赖策略 | **ACCEPTED · 2026-11-02** | 2.0 默认不再分发/依赖 `obsidian-markdown`、`obsidian-cli` 两个第三方 Skills；必要语法及 KF 规则由 Knowlery 自己的 Skills 承载。Agent 优先使用 **Knowlery CLI**（非 Obsidian CLI）；无 CLI 且有文件工具时允许 Level 0，MCP-only 按 CLI-001。Obsidian CLI 仍可作为内部可选 Adapter；暂不移除 1.x 文件，其他第三方 Skills 的取舍待议。见[决策记录](./decisions/2026-11-02-skill-dependency-policy.md) |
| GR-001 | Graph Retrieval 关系类别 | **ACCEPTED · 2026-11-03** | 区分 KF 语义关系（证据、derived、演进）和普通 Wikilinks/Backlinks 等探索关系；两者可参与检索，探索链接不能自动作为证据。缺乏链接的 Raw Notes 仍须可发现；隐式关联发现、图扩展、上下文预算和 CLI-002 接口尚待设计与验证。见[决策记录](./decisions/2026-11-03-graph-retrieval-relation-classes.md) |
| GR-002 | 未链接知识的潜在关联 | **ACCEPTED · 2026-11-03** | Agent 可在检索中发现无显式链接的 Raw Notes 等内容之间的潜在语义关联，但只作为**临时检索候选**，不得凭推断自动写回或宣称为 KF 证据。经后续独立知识更新流程验证后才可按 KF 规则持久化；发现算法、图扩展与上下文预算仍待设计。见[决策记录](./decisions/2026-11-03-implicit-relation-candidates.md) |
| GR-003 | 意图驱动的选择性图扩展 | **ACCEPTED · 2026-11-03** | Graph Retrieval 区分发现（少量关联元数据）与展开（按需读取正文）；根据问题意图与证据需求决定扩展方向，不因关键词结果满 K 就阻止关系探索，也不按固定跳数无差别展开。停止条件、Token 预算、CLI 接口及实现仍待设计。见[决策记录](./decisions/2026-11-03-intent-guided-graph-expansion.md) |
| GR-004 | 证据充分性导向停止与技术边界 | **ACCEPTED · 2026-11-03** | Agent 根据证据判断是否继续探索，但不能把主观充分性等同证明；CLI 在自身受控调用内提供检查/截断状态及确定性资源限制，不能保证 LLM 全部上下文或跨独立调用预算。预算耗尽与证据充分必须区分；KF F-008 来源核查仍强制遵守。会话预算、Token 估算及效果均待测试。见[决策记录](./decisions/2026-11-03-evidence-guided-stopping-feasibility.md) |
| GR-005 | 检索预算作用域 | **ACCEPTED · 2026-11-03** | 第一版 CLI 在自身受控的单次调用内实施可验证的结果/输出/时间等硬限制；任务累计预算由 Agent/Skills 作为软约束管理，不承诺跨调用或整个 LLM 上下文的强制上限。超限/截断与证据充分严格区分；数值、输出契约及实现尚待设计。见[决策记录](./decisions/2026-11-03-retrieval-budget-enforcement-scope.md) |
| GR-006 | 单次输出预算与完整证据单元 | **ACCEPTED · 2026-11-03** | CLI 单次调用按结果数、输出字节与执行时间施加组合式硬约束，Token 仅作估算；优先返回完整定位的 Claim/Source 证据单元，放不下时明确报告部分性并提供续读定位，不能把截断内容当完整证据。具体预算、分页及 JSON 契约待设计与验收。见[决策记录](./decisions/2026-11-03-retrieval-output-budget-and-atomic-evidence.md) |
| GR-007 | 无状态证据续读与版本检查 | **ACCEPTED · 2026-11-03** | 第一版按路径/Claim anchor/来源定位与预期版本重新读取证据，不依赖持久检索会话；版本变更或定位失效须报告并重新核对，不静默拼接旧新内容。单证据版本校验不保证全 Vault 快照一致性，搜索分页稳定性、并发与具体契约待设计测试。见[决策记录](./decisions/2026-11-03-stateless-evidence-continuation.md) |
| GR-008 | 分层 Evidence Pack | **ACCEPTED · 2026-11-03** | 默认先返回精简知识入口与关联/证据索引，不批量注入关联笔记全文；Agent 按需展开指定 Claim、Record 与 Source，保留关系类别、来源定位、版本/未验证/截断状态，遵守 KF F-008。JSON、命令、排序和实现仍待设计验证。见[决策记录](./decisions/2026-11-03-layered-evidence-pack.md) |
| GR-009 | Agent 规划、CLI 确定性执行 | **ACCEPTED · 2026-11-03** | Agent/Skills 负责理解问题、规划查询与扩展并判断证据充分性；Knowlery CLI 负责确定性检索、关系解析、证据定位/读取及可机械校验的状态与预算。允许可复现的批处理，不让 CLI 内置开放式语义推理；CLI-002 命令、协议和技术原型仍待设计测试。见[决策记录](./decisions/2026-11-03-agent-retrieval-planning-cli-execution.md) |
| GR-010 | CLI-002 最小三操作实验范围 | **ACCEPTED FOR PILOT · 2026-11-03** | 首轮 Graph Retrieval 原型仅覆盖暂定的 `search`（知识入口）、`explore`（关系发现）、`inspect`（证据读取/核验），由 Agent/Skills 编排；暂不加入高级 `retrieve`。通过真实问答、来源核查、预算和 Obsidian/Headless 对照实验评估后再决定正式接口与实现。见[决策记录](./decisions/2026-11-03-cli-002-three-command-pilot-scope.md) |
| CLI-003 | Knowledge Model / Serialization 分离与派生结构化索引 | **ACCEPTED · 2026-11-08** | Markdown 仍是编译知识的权威序列化；CLI 内部只有一套忠实于 KF v1.0 的对象模型，解析器与索引生成器是可替换的输入/输出层；`.knowlery/` 下的规范化 JSONL 索引为派生数据，每次调用懒检测（mtime→digest）失效，与 WS-001 的按文件 digest manifest 共用一份；Level 0 不依赖索引。不做 Markdown vs JSONL 对照实验；JSONL 权威存储（方案 B）保留为 OPEN，重开条件见记录 §5；双权威（方案 C）REJECTED。KF v1.0 不变。见[决策记录](./decisions/2026-11-08-knowledge-model-serialization-and-derived-index.md) |
| R-001 | GitHub 组织 | **ACCEPTED FOR BOOTSTRAP** | 继续同一仓库；`develop/2.0` 独立开发；暂保留 1.x 代码与发布配置 |
| F-001 | Wiki 结构 | **ACCEPTED · 2026-11-02** | 三种页面角色（Knowledge / Record / Source）、`## Current` 置顶的固定段落契约、主张级状态；Level 0 实验 T04 显示局部更新率 0.00 vs 1.x 0.77/0.70（RESULTS F2） |
| F-002 | Frontmatter 字段 | **ACCEPTED · 2026-11-02** | 扁平 frontmatter；必填 `type/title/description/tags/status/updated/updated_by`；可选 `verified*/stale_after/aliases/related/supersedes/superseded_by/protected`；Record 加 `date/kind/followed_by`。移除 `freshness_status/retrieval_priority/domain`。见 Format §5–6 |
| F-003 | Note 身份 | **ACCEPTED · 2026-11-02** | 受管理页按 slug 链接，Source 按路径链接；主张锚点 `^cN` 行尾、页内唯一、随行移动；不注入 UUID。T04/T09 验证锚点在移动后可解析 |
| F-004 | 来源版本 | **ACCEPTED · 2026-11-02** | 两个值：`version`（证据范围的 sha256，负责变化检测）+ 可选 `blob:`（整文件 git 对象，负责恢复）；范围按角色定义（Source 正文 / Record 到 `## Sources` 止 / Claim 指纹）。T07–T10 验证：8/8 诚实恢复或不恢复，8/8 无误判 |
| F-005 | Governance 持久化 | **PARTIAL** | Format 侧：`protected`、`## History`、`log.md`、Source frontmatter 治理信号已定（Format §10–11、§8）；跨设备权威存储与冲突语义由 Level 1 确定性操作能力承担，CLI 经 MCP 可供无文件工具的 Agent 使用；未验证。见 CLI-001 |
| F-006 | 知识关系 | **ACCEPTED · 2026-11-02** | 依赖规则：Knowledge 引用 Record/Source 为证据；`derived` 引用另一页的单条主张，证据权重为零，争议沿其传播（§9.2，T11 验证 2/2 到达） |
| F-007 | 写入安全 | **PARTIAL** | 约定层已定（移入 History、不删除、追加式 Sources/History、`log.md`）并在 T04–T06 两 harness 下成立；Level 1 CLI/确定性操作能力需实现原子写、并发及 `protected` 强制，**仅对经过受控写入的操作强制**；外部写入只能有条件检测。见 CLI-001 |
| F-008 | 读取规则 | **ACCEPTED · 2026-11-02** | 渐进式披露分层；**新增**：作为答案给出的主张需读其首个 vault 内 Source，除非 History 有 `source-checked` 事件**且 Source 当前 digest 仍等于所记版本**（审查 2026-11-02 指出仅凭事件会复用过期验证；RESULTS F1：Test 臂 3 次中 2 次漏检编译期错误）。T13 回归（kit `2ba5db3`）两臂各 1 格通过，Test 臂仅凭 digest 比对即发现漂移、未读 Source 正文 |
| E-001 | 对照实验 | **DONE (run 1)** | 1.x vs v0.3.1，12 任务 × 2 臂 × 2 harness（同一模型），47/48 通过；见 `format/experiments/level0/RESULTS.md`。Owner 于 2026-11-02 接受单模型范围 |
| E-002 | 无 Obsidian 测试 | **DONE (run 1)** | 两臂均 headless、仅文件工具；Level 0 成立。Connector 相关保证未测 |

**Knowledge Format v1.0 接受记录（2026-11-02）：** Owner 在对话中授权独立审查通过后由 Agent 代为登记。审核已确认 F-008 当前 Source digest 校验及 T13 回归证据，因此正式接受 F-001、F-002、F-003、F-004、F-006、F-008，依据见 [决策记录](./decisions/2026-11-02-knowledge-format-v1.0.md)。这是 Owner 授权后的代记录，不表示 Owner 亲自编辑了文件。F-005、F-007 仍为 **PARTIAL**；接受 Format v1.0 不表示 Level 1 CLI/确定性操作层的受控写入保障已完成（MCP Connector 仅是可选调用入口，参见 CLI-001）。

## 状态规则

- **对新设计决定的记录纪律**：仅在 Owner 明确确认或已存在有效授权且必要审核条件满足后，才写为 ACCEPTED；在 `develop/2.0` 维护索引和对应历史记录。CLI/MCP 的命令形状、包结构、调用路径在明确决定前均为 OPEN。

- **BASELINE**：Owner 已确认的高层方向，原则可以直接约束设计；具体实现仍需评审。
- **ACCEPTED FOR BOOTSTRAP**：仅适用于本次分支搭建的工程决定，不是永久的多包/发布策略。
- **RESEARCH / OPEN**：不应被代码或文档暗中固化成强制规范。
- **PLANNED**：计划而非已经完成的实验。
- **PROPOSED → v1.0-rc**：候选设计已形成、尚待 Owner 接受（若出现此状态，不能视作正式批准）。
- **ACCEPTED · YYYY-MM-DD**：Owner 授权后正式接受的 Format 设计决定；证据、备选方案、风险及升级路径以关联决策记录为准。
- **PARTIAL**：Format 侧已定，Connector 侧未验证。
- **DONE (run 1)**：实验已执行一轮；结论为案例发现，未达统计显著。

要将 OPEN / RESEARCH 改为 Accepted，至少补上实验或证据、替代方案、风险与升级路径、Owner 决定及日期。历史争议可追溯至 [SOURCES.md](./SOURCES.md) 的研究材料；不可仅依据本表推断旧 ADR 已获批准。
