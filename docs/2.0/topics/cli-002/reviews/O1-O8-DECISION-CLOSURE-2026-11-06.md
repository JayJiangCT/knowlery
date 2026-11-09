# CLI-002 Round 2 — O1–O8 Decision Closure & Independent Review Handoff

**Document type:** Cloud Agent decision recommendation, one-pass Local Agent task contract, and prior independent review (full appendix)  
**Date:** 2026-11-06  
**Owner–Cloud alignment:** O1(c) at principle level; Owner explicitly requested to stop indefinite research/review cycles  
**Status:** **O1(c): ALIGNED IN PRINCIPLE / not formal frozen contract. O2–O8: CLOUD-RECOMMENDED / PENDING OWNER RATIFICATION.**  
**Target:** `JayJiangCT/knowlery`, `develop/2.0`, reviewed SHA `530d9e6f5d7a4b9d685bf4e1af3b5f490e2acf9f`  
**Baseline:** `b40bb91b94ab8775c6b16a0d06b6fc0275a64719`  
**Previous review:** `CLI002-R2-D-V12-CLOUD-INDEPENDENT-REVIEW-530d9e6f.md`, **verbatim in Appendix A**  
**Task ID to be handed to Local Agent if approved:** `CLI002-R2-D-V12-CLOSURE-01`  

## 中文执行摘要 / Decision in one page

**结论：这轮研究应收敛，不应再进入“建议→实验→评审→改协议”的无限循环。** Gate B 要解决的问题已经由 Owner 指明：**编译 Wiki 能否在最终答案质量不发生不可接受下降的前提下，提高查询效率，或同时提升质量和效率。** 原先只强调本次 Raw File 到达的 P0 不适合作为唯一成功指标；目前证据链尚未闭合的 P1 也不宜直接升格为主指标。

**建议选 O1(c)：Quality-Gated Efficiency。** 主评估维度使用现有的 **Strict Correctness（最终回答质量）与查询 Token / 费用（效率）**，按相同任务进行成对比较；工具调用和延迟独立报告。**P0/P1 作为诊断**，F-008、WCC、证据可追溯和正确拒答作为可信度/风险约束。**不新增 P2，不构建统一加权总分，不以未验证的 P1 为前提。**

O2–O8 由本文件提供**一次性 Cloud Agent 建议**，方便 Owner 批量批准/修改。**不能因 Owner 把本文件发给 Local Agent，就推断 O2–O8 已 ACCEPTED 或批准新增私有评审会话、付费运行。** Local Agent 在没有新的明确授权前，仅可据此审阅并准备改动计划，不得执行受限操作。

本文件优先表达**最新目标及修订建议**；附录原评审仍然保留原样作为 `530d9e6f` 的历史发现。若二者就“P0 主指标”或“P1 问题是否阻止本次冻结”给出不同意见，以本文的新研究目标与条件化处理为最新建议；**事实证据应继续以仓库及可复现记录为准**。

## 1. 一次性 O1–O8 裁定建议（Status / Choice / Reason）

| ID | Cloud Agent 建议选项 | 本轮状态 | 关键取舍 |
|---|---|---|---|
| **O1** | **新增 (c) Quality-Gated Efficiency**：Strict Correctness + Query Efficiency 为共同主要评估维度，质量受约束；P0/P1 降为诊断 | **Owner 已原则认可；尚未正式冻结统计契约** | 测量 Wiki 对答案与成本的实际价值，而不是强迫重读 Raw File |
| **O2** | **选 (i)，实施从简**：若将来给 P1 compiled path 计 `true`，只接受独立、注明 `as_of` 的 Gold/currentness 审核依据；本轮依据缺失则 `unknown`，不为 P1 新造系统 | **Cloud 建议，待批准** | 禁止 digest match 或 Wiki 自我声明等于当前有效 |
| **O3** | **批准 WCC 拆分方向并修复边界**：`wcc_gold` 所有适用组，`wcc_vault` 仅 compiled arms；独立参考/盲评；完整空清单 `false`，缺失/不完整 `unknown`，不适用 `NA`；正式计分必须有受校验 manifest；计数含所有有效记录、明确范围 | **Cloud 建议，待批准** | 量化外部当前性错误与内部 Wiki 误用，不把两者混同 |
| **O4** | **选纯历史问题 WCC Gold 不适用 (1)**；当前状态问题需独立 dated Gold，含 `as_of`、状态、证据、supersession check 与不确定性；历史范围可按题目逐 Fact 判断 | **Cloud 建议，待批准** | 避免用当前状态去误判历史叙述；不在本任务编写 v3 Gold |
| **O5** | **KF 治理未决先保留**：History 被依赖时可显式记录，F-008 为 `unknown`（`F008_HISTORY_ENTRY_SCOPE_OPEN`），不由评测协议改写 KF；无 Claim anchor 的编译 Record 不得伪称 Raw Source，诊断层按 compiled support 处理，P1 不得据此自动 `true` | **Cloud 建议，待批准；正式 KF 解释仍 OPEN** | 避免为了评测任意定义知识格式 |
| **O6** | **选 G-c：Review Trigger**；F-008 `non_compliant` 进入预注册的异常案例审查，不按“一次违规自动全组失败”；若暴露重大证据/质量风险则阻止 GO；`unknown` 不当作 compliant | **Cloud 建议，待批准** | 保持风险控制，也避免非核心程序性差异造成循环重跑 |
| **O7** | **原则批准 v1.2 七类实质规则**（细项见 §3），不逐项无限讨论；仅纠正能实质改变主要结果的歧义 | **Cloud 建议，待批准** | 让评审者使用同一把可靠而有限的尺子 |
| **O8** | **建议一次性批准至多两位新的独立 annotator、至多三个 packet 的定向回归**；优先复用已有案例，补一个合成 Rule A current-state case 如确实必要；**只执行一轮**，仍有非重大歧义则记录风险并结束 | **Cloud 建议，待 Owner 明确授权才可开新会话/访问私有数据** | 在最小成本下检查关键规则文本可执行性 |

**决策优先级说明：** O1 的目标约束其他评估选择；O2 的 P1 positive-path 证明可以延后，不能因此阻止回答质量与查询效率的主要研究。O4/O5 只在本轮测量所需范围内确定，不借机扩写 Knowledge Lifecycle / KF v1.0。

## 2. O1(c)：对主要指标的可执行解释（拒绝伪精准）

### 2.1 研究问题与对照

- **G1-A vs G0：** 编译 Wiki 对最终正确性与查询成本的收益。
- **G1-B vs G1-A：** 关系检索 `explore` 的额外收益；不能把“Graph 被调用”当作“Graph 改善答案”。
- 同题、同评分 Gold、模型/预算/检索后端尽量可比；不同工具暴露和提示词带来的因果限制必须如实报告。

### 2.2 主要报告

1. **Quality：** 独立 Gold 盲评的 `Strict Correctness`，按题目/运行报告正确、错误和无法确定；按题目做配对/聚类分析，不能把多次运行或 Fact 当作完全独立样本。`proper_abstention` 在不可回答题上单列。
2. **Efficiency：** 每次任务完整的模型 Token 和查询调用费用，按**全部任务**统计，避免只挑正确回答造成选择偏差；同时提供正确回答子集的描述性效率，必须标明选择偏差。Latency、工具调用数作为补充维度。查询阶段不包含既有 Wiki 的事前编译维护费用，后者分开报告范围限制。
3. **联合解释：** “质量改善/在预先认可差异内基本保持 + 查询成本降低”才可以支持 Wiki 效率价值；“质量下降但成本下降”是取舍或负信号，不能包装成胜利。若样本不足以排除重要质量退步，结论应为 `INCONCLUSIVE`，而非声称 non-inferiority。
4. **Guardrails：** 外部当前性（有可用 Gold 时）、来源可追溯、F-008、不可回答时正确拒答。`P0`、`P1`、L1/L2/L3 及 Graph 路径为辅助诊断，不是成功的替代品。

**唯一需要在 B 数据冻结前一次性落实的统计补充：** 主要比较的汇总单位、缺失值处理、成本口径、可接受的质量变化范围（如要声称“保持”）以及效应区间/不确定性表达。**不发明新的综合分值、模型或额外试验系列。** 这些应与既有 T3 Calibration / B preregistration 一次完成；不能为了提升显著性在看到 B 结果后调阈值。

### 2.3 为什么不把现成 P1 直接升为主指标

目前 `P1 = fact_verified ∧ (valid_source_reached ∨ compiled_reuse)`，其中 compiled path 需要可观测的 source-checked、query-time digest 检查、可靠的 dated currentness。`530d9e6f` 的候选代码还不能强制核实这些信息与同一 Claim / Source / 版本的绑定。**未观测不得补猜。**

因此，推荐两种允许的实现之一，Local Agent **只需选择更简单且不改变主结论的路径**：

- **首选（短期）：** P1 持续作为探索性诊断；compiled-reuse 路径未获审批或无法观测时标记 `unknown`/不可计真，报告可测覆盖程度。不得把此类值说成已独立核验的可信回答。
- **可选（仅如本轮原型已有廉价可靠的绑定机制）：** 在有冻结、授权的 dated Gold 和事件绑定时才允许 P1 `true`；必须修复原评审 M1 中的 `claim_ref`、source/version/digest/currentness 绑定和负例测试。**不得为了使 P1 完整可测而阻塞本轮主要 Quality/Efficiency 研究。**

如以后需要独立验证复用正确性，可立新题；但**这不是当前 O1–O8 的退出条件**。

## 3. O2–O8 细化约束及最低实现要求

### O2：当前性依据的有限解释

- 只允许独立审核、带 `as_of` 与版本的参照作为 P1 的 `established_current` 正面证据；“当前 Source digest 匹配”仅说明这个文件未变，不能排除新文档取代。
- 没有这种依据，P1 compiled path 应保持 `unknown`；若明确发现已 superseded/争议，按既有规则 `false`。
- **不要求本轮引入全局 supersession scanner、动态生命周期引擎或新的在线校验 API。**

### O3：WCC 拆分及最少必要修补

- `wcc_gold`：相对于独立 Gold 的当前性错误，适用于带当前状态陈述的题目、所有 arms。
- `wcc_vault`：Agent 是否将 *frozen compiled Wiki* 已标记 superseded/disputed 的内容作为当前事实陈述，**只适用于 compiled arms**；不是外部真实性指标。
- 具有版本记录并确认完整的空列表可判 `false`；未提供/未检查完整性的参考只能判 `unknown`；无 compiled arm 为 `not_applicable`，必须由 manifest 确定。
- 修复上次独立评审 **M2（Major）**：正式 WCC 汇总无完整有效 manifest 必须拒绝或明确进入不具裁决力的 provisional mode；manifest 缺 binding、版本不一致、arm 不匹配必须拒绝。至少增加 missing/malformed manifest 与无 binding 的反例测试。
- `wrong_current_claim` 历史值保持不变，不回填、不强行映射双 WCC。公开统计不含私有 packet 明细。

### O4：Gold 与时间范围

- `wcc_gold` 的正/负判断需要已审核的 `as_of`、适用的 current state 和 supersession check；无充分资料时 `unknown`，不能冒充 `false`。
- **纯历史问题没有当前事实陈述时 `wcc_gold = not_applicable`（manifest 驱动）**；若题目同时问“过去与现在”，只评估与当前状态相关的部分。这里需要一个小而明确的 schema/protocol 变更，避免把 NA 误作不确定。
- Gold 的实际撰写、独立审查仍属后续 T3 的单独授权，不在本闭环里提前生产 v3 Gold。

### O5：History、Record 与 F-008

- **History：** 可以用于回答适用时间范围内的历史问题；用于当前状态时不能作为未过时支持。只要已依赖的 History entry 尚缺 KF 官方解释，其 F-008 值用 `unknown · F008_HISTORY_ENTRY_SCOPE_OPEN`，不按 compliant 处理，也不无依据判违规。
- **Record：** 编译产生、无 Claim anchor 的 Record 不是新到达的 Raw Source，不得算作 `valid_source_reached = true`。可以在评测诊断中归为 compiled-support（如沿用已有 `support_kind=compiled_claim` 的近似标签，必须注明 Record 的无锚点限制）；**不因此获得 P1 compiled_reuse=true**，且不虚构 Claim ID。
- 精确的 History 首个 Vault-file Source 解释、Record 在正式 KF 语义中的定位留给 **KF governance**；本轮以风险标注和保持历史兼容性作为可接受方案，不修改 KF v1.0。

### O6：F-008 采用 G-c Review Trigger

- 对 `non_compliant` 的确证案例做一轮预先定义的 adverse-case 检视，分辨是仅流程问题还是导致错误证据/最终答案重大风险。`unknown` 单独计数，绝不当 compliant。
- 若出现可能颠倒主要质量结论、来源伪证或系统性严重证据违规，**Blocker：不得宣布 Gate B 成功**。其他轻微程序差异公开报告为 guardrail，不无限扩展评测。
- 本规则仅是指标裁决，不改变已 ACCEPTED 的 KF F-008 本身。

### O7：一次性批准的候选判定规则

按 `V12-DECISION-TABLES.md` §1/§4 收敛以下变化（若 Owner 一次性同意则不再逐条反复投票）：

1. **三值：** 只允许 `true/false/unknown` 参与逻辑运算；有 `false` 即 `false`；否则含 `unknown` 即 `unknown`；答得了的问题零 required facts 是无效记录。
2. **Rule B partial support：** Trace 完整且可读、只支持 required fact 的部分要素，`support_delivered = no`，而不是泛化为 `unknown`；Trace 缺页或不可判断才 `unknown`。
3. **Rejected equivalent：** 所有 proposed equivalents 均被 reject 且没有其他候选时，L2 `false`；只有仍 pending accept/unsure 的候选才 `unknown`。提出候选须有**已交付文本明确陈述该 Fact 值**，只提主题不算。
4. **Rule A：** 历史事实允许 superseded History 支持，当前事实不能；混合演进题按每个 Fact 的时间范围分别判断。
5. **`## Sources`：** 作为检索导航边可用于 graph diagnostic；链接本身不证明被链接内容。没有打开内容就拿它当证据，依原有导航冒充证据规则计数。
6. **`version_check`：** 候选采用 v1.2 协议 Step 7（只在 claim 的 first Source read 且列出版本时判 `not_checked`），诊断性改变需在变更记录中说明，历史数据不改。
7. **Dates：** 只在对应 Gold required fact 的日期条件内判断，不因另一独立 Fact 的日期要素重复处罚。

涉及 KF 未决的 History / Record，**按 O5 的保留规则**执行，不由 O7 越权裁定。以上规则存在真实影响的实例做定向回归，其他规则不再重复构造大规模案例。

### O8：一轮、受限、不可无限追加的回归

**建议 Owner 一次性明确授权**：最多两名与此前争议资料隔离的新 annotator，最多三份私有/合成 packet，限既有已批准 private store；不付费执行任何新 benchmark answer run。覆盖 R-B1、R-E1、R-E2、R-A current-state 以及可能翻转主要评判的时间/History 情况；可从现有校准包中只读寻找 R-A3，如无现成且确实必要才造一个纯合成 packet。

- 开始前冻结规则文字、所用 packet、逐项期望值、工具版本、角色隔离与哈希；不能让参与修协议者自评分。
- **最多一轮有界回归**。结果 `PASS` / `FAIL` / `INCONCLUSIVE` 如实记录。关键规则错误且足以反转主要结论时做**一次明确限定的修正**；若仍有同级问题则提交 Owner 做暂停/风险接受裁决，而不是自动启动新回归。
- Minor 分歧即使无法解决，只要不会实质改变本轮主要 Quality/Efficiency 结论，就记录局限并结束。本次不得因为结果 `INCONCLUSIVE` 自动继续扩充样本。
- 新独立 session / 新私有数据访问**需要 Owner 明示批准**。文档交付本身不构成授权。

## 4. 结合上一份独立 Review：问题修复优先级

上一份报告的结论是 **Candidate CONDITIONAL GO；Freeze NO-GO；Gate B NOT AUTHORIZED**。本轮不会改写它，而是按新版 O1(c) 研究目的重排修复优先级。

| 发现 | 原严重度 | 本轮处理建议 | 是否阻止继续 |
|---|---|---|---|
| **M1：P1 positive-path 缺同一 Claim/Source/Version/Reference 的强绑定** | Major | **二选一**：将 P1 明确限定探索性、无法核验时不计 `true`；或补足真正的 evidence binding 与测试 | 如果 P1 未用于主要结论且不存在错误的 positive credit：**不阻止 O1(c) 的主研究**；如果声称 P1 可信且计真：**Blocker** |
| **M2：WCC manifest 可选/缺绑定仍接受结果** | Major | 强制正式 WCC 计分需要受校验 Manifest 或显式 provisional；补异常测试 | **必须修复**（若 WCC 参与质量 guardrail） |
| **M3：P0-primary 与产品目标错位** | Major (decision) | 用 **O1(c)** 取代原拟议 P0-primary，P0 保留诊断 | **通过 O1 决策闭合**，无需新实验 |
| **M4：人类规则回归未启动、R-A3 case 缺口** | Major | 仅一轮小型回归；覆盖核心语义；允许带风险的 `INCONCLUSIVE`，不得写成 PASS | **需 Owner 授权**；非关键边缘 case 不得自动阻塞后续阶段 |
| **m1：determinate-only 分母“乐观”措辞不妥** | Minor | 改为“仅在 determinate runs 条件下的成功率”；同时报告 unknown 比例 | **不阻止** |
| **m2：answerability_unknown 无 fixture；旧 Handoff SHA 仍描述子会话 HEAD** | Minor | 添加一个边界样例；在新报告解释 sub-session HEAD vs 已提交 SHA，不改历史报告 | **不阻止** |

**不可放宽的 Blocker：** 隐私/Gold 泄漏、旧历史被改写、主要结果计算或比较严重失真、正式 WCC 引用不可信、实验组不可比较、未经授权花费/访问，以及能颠倒主要结论的严重评分规则错误。除此之外不以新增研究建议为由无限拖延。

## 5. Local Agent 任务契约（独立可执行，不依赖聊天上下文）

**Task ID:** `CLI002-R2-D-V12-CLOSURE-01`  
**Title:** O1(c)-Aligned Metric D v1.2 One-Pass Closure  
**Input commit:** `530d9e6f5d7a4b9d685bf4e1af3b5f490e2acf9f` on `develop/2.0`  
**Input sources:** `docs/2.0/topics/cli-002/PLAN.md` §5; `reports/T1/V12-{CONTRACT-PROPOSAL,DECISION-TABLES,REGRESSION-PLAN,OWNER-DECISION-PACKET,REPORT}.md`; `reports/T1/v1.2/`; `reviews/` Cloud documents; this handoff; Appendix A original independent review.

### Background / Objective

目标是**一次性得到足以支持后续 T2/T3/B 决策的最小可用评测契约**，而不是实现完整 Wiki currentness verifier、Knowledge Lifecycle 或新评测引擎。研究目标以 Owner 原则性认可的 O1(c) 为准。每条重要变化须列出其已批准/尚未批准状态。

### Scope（须先通过 Owner 批准门）

1. **Preflight / read-only**：核对远端分支与 SHA、原有 v1.0/v1.1 文件和冻结产物的完整性（只读），确认私有材料没有进入 public checkout。冲突则中止并报告。
2. **Decision integration**：记录 O1(c) 的原则确认，以及 O2–O8 是否逐项得到 Owner ratification；未获明确批准者只出提案，不实施可能改变评分的语义。
3. **Minimal contract amendment**：一份简短的 `PLAN.md` §5 proposed amendment；v1.2 schema/protocol/aggregator 保持版本化；不得改原版本。主结果用现有 Strict Correctness 与查询成本资料，不新增综合 P2。
4. **Focused fixes**：解决正式 WCC manifest 执行路径（M2）与影响主结果的数据缺失/口径错误；对 P1 优先采用“未验证不计 true”的最小策略，仅当有合法 evidence links 时才计 `true`。处理 m1 文案和 m2 边界测试。
5. **Synthetic regression**：运行标准库 deterministic 检查及重要负例；保留原始命令、退出码、Commit SHA。私有回归必须单独获 Owner 同意并经过预注册隔离。
6. **Conclude**：给 Owner 一页纸冻结准备状态、关键残余风险、是否足以进入后续阶段的意见；Cloud Agent 做一次最终独立复核。

### Out of scope

- 不新建 P2 或复杂 weighted KPI；不引入新的 lifecycle/runtime/currentness engine；不把 O2 的 Gold 生成提前挪到本任务。
- 不改 `ACCEPTED` KF v1.0、Gold、Round 1 评分、旧 v1.0/v1.1 协议/fixtures/聚合器，不回填历史 wrong_current_claim。
- 不启动付费 B、T2/T3/C/A、无授权独立私有 session，不迁移/删除/归档用户真实 Raw Files。
- 不把 Owner 的产品共识写成“所有 metric 已 ACCEPTED”；不得在公开仓库提交私有题目、Gold、真实资料、trace、路径或原始运行日志。

### Deliverables（建议路径；复用原 repo 命名约定）

- `docs/2.0/topics/cli-002/reports/T1/V12-OWNER-DECISIONS-RESOLUTION.md`：O1–O8 决策状态、Owner 明示批准证据、适用范围及残余问题。
- `docs/2.0/topics/cli-002/reports/T1/V12-QUALITY-EFFICIENCY-AMENDMENT.md`：针对 PLAN §5 的简短 amendment（需批准才能生效），指标及统计报告规范。
- 现有 `reports/T1/v1.2/` 候选文件最小化版本调整、相应测试、保留兼容证据；报告 P1 是否仅 exploratory。
- `docs/2.0/topics/cli-002/reports/T1/V12-CLOSURE-REPORT.md`：命令及 exit、被动/主动检查结果、公开隐私审计、局限与 GO/NO-GO / CONDITIONAL GO。
- 若 O8 被批准：私有 preregistration/packet-level evidence 存于批准的 private store；仓库只放去标识化 aggregate regression summary。

### Acceptance criteria（完成不是以文档数量判定）

1. O1(c) 与新的 Gate B 主要研究目标一致，不以 Raw File 重读作为正确性的必要条件；Quality 与 Efficiency 分别报告。
2. 明确 O2–O8 是 Owner APPROVED 还是 Cloud PROPOSED，不冒用批准；涉及旧计划 §5 的修改有可审查的 amendment。
3. 主指标可在预期的 Gate B trace / Gold / telemetry 中计算或明确指出真实缺口；不可观测不得推断 PASS。
4. 正式 WCC reference/arm manifest 被强制校验，或该结果明确禁止作为正式 guardrail；缺失绑定和 arm/版本不符无法悄悄通过。
5. 如 P1 使用 compiled-reuse `true`，必须能核对 Claim/Source/版本/Digest/currentness 的合法证据；否则按 `unknown` 或关闭正面评分。
6. 重要三值与规则歧义有确定性测试，旧 v1 记录仍可验证；旧历史、KF v1.0 与私有 frozen artifacts 未被重写。
7. 回归如未授权则不宣称已经运行；如获授权只做一次有界、隔离、冻结预注册回归，诚实报告 PASS/FAIL/INCONCLUSIVE。
8. 所有公开产物经过隐私审查；无新付费运行/新阶段/产品级迁移。
9. 提供实际执行命令、exit、输出摘要、最终 SHA 与残余风险；不能将 Local Agent 自报当 Cloud 独立复现。
10. 明确 stop-rule：没有关键 Blocker 就结束 D，不以 Minor 问题创造追加研究循环。

### Suggested commands (execute from `docs/2.0/topics/cli-002/reports/T1/`)

```bash
python3 -I -B v1.2/aggregate_v12.py --self-test
python3 -I -B -m unittest discover -s v1.2 -p 'test_*.py'
python3 -I -B aggregate.py --self-test
```

For any new negative fixture and manifest-path change, run the relevant `--validate` / `--summarize --manifest` commands and record exit statuses. If report claims frozen archive verification, use the approved **local/private** freeze manifest only; never copy it into the public repository.

### Safety / stop conditions

出现私有资料泄露、冻结哈希失配、评分基线被改、预注册/Gold 污染、明显超越 Owner 已批准范围、需要付费或新增私有访问，**立即停止并报告**。不能以“为了完成 v1.2 合约”作为扩大权限或添加复杂基础设施的理由。

### Decision gate & stopping discipline

- **现在：** Local Agent 可以阅读、提出落实计划；**没有 Owner O2–O8 明示批准则不能自动执行有语义影响的评分修订及 O8 新会话**。
- **获得批准后：** 最多一轮受限合约收敛 + 最多一轮已批准定向回归 + 一次 Cloud 独立复核。
- **Freeze readiness：** 只有重大缺陷被处理且主比较可解释时才给 GO；否则给 NO-GO 或附明确限制的 CONDITIONAL GO。**不能自动重复第二轮**。若只剩无关主要结论的 Minor 争议，记录局限并停止追加研究。
- **后续 T2、T3、B：** 即便 Metric D freeze 通过，也必须遵守它们原有的独立授权与隐私/成本 Gate。

## 6. Owner 一次性审批栏（请在批准时明确指示 Local Agent）

> **只有 Owner 明确选择下面的选项，O2–O8 才能转为相应范围内的批准。** 发送文件、认可 O1 原则或者 Local Agent 自报完成，均不自动完成审批。

- [ ] **Approve O1(c) as the Gate B evaluation objective**（在现有原则对齐基础上正式确认；不等于 metric schema freeze）
- [ ] **Approve Cloud recommendations O2–O7 as scoped above**（仅授权有界 Metric D 候选契约收敛及确定性测试；不改 KF）
- [ ] **Approve O8 bounded private regression**（最多两名隔离 annotator / 最多三个 packet / 一轮；必须在现有已批准 private 权限与费用边界内；任何新付费服务需单独预算批准）
- [ ] **Request modifications**（逐项列明：__________）

**默认状态：所有勾选框未勾选。** 若 Owner 只批准前两项，Local Agent 应暂停 O8 的新会话执行，仅提交可复核的合约与合成测试产物。

---

# Appendix A — Previous Independent Cloud Review (verbatim)

以下完整附录为旧 Review Report 原文，未修改其技术发现与当时的裁定。**它审查的是 commit `530d9e6f`，在 O1(c) 原则确认之前，不能把其“P0-primary 的短期可辩护性”解释成 Owner 已批准 P0 为本阶段唯一主指标。**

# CLI-002 Round 2 — Metric D v1.2 Candidate Independent Review

**Reviewer:** Cloud Agent  
**Review date:** 2026-11-05 (project decision date)  
**Repository:** `JayJiangCT/knowlery`  
**Branch / reviewed commit:** `develop/2.0` / `530d9e6f5d7a4b9d685bf4e1af3b5f490e2acf9f`  
**Diff baseline:** `b40bb91b94ab8775c6b16a0d06b6fc0275a64719`  
**Task:** `CLI002-R2-D-V12-CONTRACT-01`  
**Evidence status:** Public repository independently inspected; local/private execution evidence not independently reproduced.

## Executive verdict

- **Candidate package review: CONDITIONAL GO.** The required proposal, decision tables, owner packet, draft protocol, versioned schema, candidate aggregator and synthetic fixtures are present. The P0/P1 distinction, tri-state design, WCC split and historical preservation boundaries are largely sound at the proposal level.
- **Submission for final Owner freeze approval: NO-GO at this commit.** Eight decisions (O-1–O-8) remain open, v1.2's preregistered regression has not run, and two validation-path gaps require repair before measured results could be accepted. A packet **for Owner to decide proposed design choices** may be circulated now; a packet asking Owner to **freeze Metric D** may not.
- **Gate B: NOT AUTHORIZED.** No decision was promoted to `ACCEPTED` by this review.

This review distinguishes (i) directly verified Git evidence and static code findings, (ii) Local Agent-reported deterministic/private test results, and (iii) proposed decisions. It is not a re-review of private benchmark packets.

## 1. Independently verified evidence

1. GitHub commit `530d9e6f…` resolves to the stated SHA; comparing against `b40bb91` returns **one commit ahead, 34 changed paths: 33 additions, one STATUS modification**. `develop/2.0` was identical to `530d9e6f…` when checked.
2. Public deliverables named in the handoff exist, including `V12-REPORT.md`, `V12-CONTRACT-PROPOSAL.md`, `V12-DECISION-TABLES.md`, `V12-REGRESSION-PLAN.md`, `V12-OWNER-DECISION-PACKET.md`, versioned candidate schema/protocol/aggregator/tests, and three prior Cloud documents in `reviews/`.
3. Diff inspection confirms no edits to existing v1.0/v1.1 schema, aggregator, protocol or prior fixture paths in this commit. The private freeze archive and private consensus were **not** inspected.
4. A static scan over newly added diff lines found no concrete home-directory paths, 64-character hex digests, common API-secret patterns or email addresses. This limited scan cannot prove absence of all private content or validate Local Agent's private-name list.
5. Source review was performed on `aggregate_v12.py`, `build_schema_v12.py`, `test_aggregate_v12.py`, the draft protocol, decision tables, regression plan, owner packet and representative synthetic fixtures/manifest.

**Execution limitation:** The container could not reach GitHub over DNS; the connected GitHub repository reader supplied text but not a mounted checkout. Thus the three Python commands were **not independently executed**. The reported `30/30` self-test, `43` v1.2 unit tests, `24/24` legacy self-test, `17` legacy unit tests, and `36/36` private freeze hashes remain Local Agent-reported. Static inspection of the tests does not substitute for running them. The user may provide a checkout or archive if full independent replay is needed.

## 2. Significant findings

### Major M1 — P1 `true` is not yet bound to an auditable claim-specific evidence chain

**Evidence:** `v1.2/build_schema_v12.py` lines 35–53 allows `compiled_reuse.claim_ref = null`; `aggregate_v12.py` lines 82–117 derives `true` from status strings, while lines 245–267 check derivation, non-NA components and a nonempty `currentness_basis`/`as_of`, but do **not** require a non-null claim reference for `applicable=yes`, establish that its event IDs reference actual trace events, or bind the verification event, digest comparison and currentness reference to that same claim/source/version. In particular, a supplied `currentness_basis` string is not checked against a frozen approved reference manifest.

**Implication:** The candidate works as a *synthetic logical model*, not yet as an evidence-validity validator capable of authoritatively awarding P1 `true`. This is understandable while O-2 is OPEN, but must not be overlooked at freeze.

**Required before freeze:** For positive `compiled_reuse`, require non-null `claim_ref`, event-level linkage to delivered trace material, source-version match, recorded digest observation tied to the same source, and a versioned approved currentness reference with temporal scope. Invalid/mismatched linkage must not pass. Add negative synthetic cases for null claim ref, missing event, mismatched source version, mismatched currentness reference and unsupported `as_of`. Keep F-008 procedural compliance independent. Do not implement unapproved O-2 authority rules merely to make these pass.

### Major M2 — WCC manifest assurance can be bypassed through documented entry points

**Evidence:** `aggregate_v12.py` lines 327–354 enforces arm applicability and checks a reference version only inside `_manifest_errors`. The CLI `--summarize` accepts no `--manifest` (lines 507–543); in that case WCC is still counted (lines 396–400) without arm or reference validation. Even *with* a manifest, lines 349–353 compare reference ID/version only if an expected per-packet reference entry exists. A missing expected binding therefore does not reject a record that supplies its own complete reference and determinate WCC result. `--validate` likewise has no manifest-aware mode.

**Implication:** The guarantee “WCC references are frozen before judging and G0/G1 applicability is enforced” is not guaranteed at the command boundary. Existing tests cover wrong values under a well-formed manifest but not omitted/partial/invalid manifests.

**Required before freeze:** Make a validated packet manifest mandatory for any authoritative v1.2 WCC summary (or explicitly suppress/mark WCC as provisional without it); reject missing/malformed `arm_kind`, missing required reference bindings for determinate judgments, extra/unknown packet IDs, and reference ID/version mismatches. Test both direct summary API and CLI without/with malformed manifest. Preserve private arm blinding for actual judges.

### Major M3 — P0-primary recommendation is a defensible short-term measurement choice, not a product-success conclusion

Local Agent recommends P0 as preregistered Gate B primary and P1 secondary because the existing traces and proposed harness do not establish an observable digest/currentness basis. This is **methodologically defensible as an interim evaluation contract** and is explicitly framed as O-1 for Owner choice. However P0 systematically fails to credit properly verified Wiki-first reuse; therefore a result on P0 cannot alone validate or reject Knowlery's full product value. If Owner keeps P0 primary, Gate B's conclusion must be explicitly scoped to direct-source-verification performance, with separately reported strict correctness, P1 unknowns, currentness and efficiency. Do not treat a low P0 as proof that efficient compiled Wiki answering is worse.

A later decision to make P1 primary requires an approved currentness basis, observable harness evidence and a comparable, pre-registered blind scoring procedure. O-1/O-2 are substantive design gates, not cosmetic renaming.

### Major M4 — The human-rule regression is unexecuted, and one important branch lacks a case

`V12-REGRESSION-PLAN.md` explicitly states NOT STARTED, expected outcomes have not been frozen, and R-A3 (current-state question relying on superseded History) lacks a selected case. The proposed two-session/three-packet maximum is appropriate, but this **does not satisfy the actual regression acceptance/freeze gate**. Recommend searching existing private calibration cases first; if no suitable case, request approval for one invented synthetic trace case. Neither procedure is authorized by this review.

### Minor m1 — Denominator interpretation

`V12-DECISION-TABLES.md` calls `pass_over_determinate_only` “optimistic: assumes unknown runs behave like the rest.” The number is simply **pass rate among determinate runs**, and cannot itself justify a missingness assumption; the unknown share may be selective. Retain both fractions, label the second “conditional on determinate” and avoid presenting either as a population-confidence bound.

### Minor m2 — Additional untested input and documentation edges

The `answerability_unknown` path lacks a fixture, acknowledged in `V12-REPORT.md`. Add one deterministic case. The handoff was written before the topic session committed; it describes HEAD `b40bb91` and “nothing committed.” Preserve this as the **sub-session's historical status** but add a short top-level publication note linking the actual review SHA `530d9e6f…` to prevent readers mistaking the handoff's working-tree snapshot for current repository state. No historical rewrite needed.

### Open semantics, not code defects to silently settle

- `wcc_gold` on strictly historical questions (O-4) and the time semantics of `compiled_reuse.currentness` for historical claims (O-2).
- F-008 treatment of superseded History rows and Record pages (O-5 / KF governance).
- F-008 decision-blocking versus adverse-case review (O-6).
- Material adjudication changes and their regression (O-7/O-8).

## 3. The 12 acceptance criteria, assessed individually

| # | Task brief §8 requirement | Cloud verdict | Basis / next action |
|---|---|---|---|
| 1 | Compare P0 and P1 without conflating them or claiming real compiled-reuse validation | **PASS** | Side-by-side endpoints and explicit observability limitation; P0 recommended conditionally, not promoted to ACCEPTED. |
| 2 | Every evidence predicate has observable inputs, temporal scope and unknown semantics; legacy traces remain unknown | **PARTIAL — M1** | Predicates and unknown rules are described, but the positive P1 evidence/claim/reference chain is not enforced in validation; O-2 remains OPEN. |
| 3 | Precise tri-state logic, denominators, deterministic false+unknown tests | **CONDITIONAL PASS** | Code/test cases inspected for F+U→F, zero-facts and denominators; reported runtime results not independently reproduced. Minor denominator-label correction needed. |
| 4 | Separate WCC reference, arms and false/unknown/NA semantics | **PARTIAL — M2** | Semantics sound on paper; manifest-optional CLI and missing per-packet reference checks leave an enforcement gap. O-4 scope unresolved. |
| 5 | Preserve legacy WCC, Round 1, Gold and original contracts | **CONDITIONAL PASS** | Public Git diff verifies no original contract-path changes; private artifacts and 36/36 hashes remain locally reported. |
| 6 | Keep F-008 compatible with accepted KF v1.0 or escalate open issues | **PASS, scoped** | History/Records questions expressly escalated; `f008` alone does not yield P1 true. No accepted KF change in public diff. |
| 7 | Rule B, rejected equivalents and Rule A current branch have explicit behavior and regression coverage | **PARTIAL — M4** | Candidate wording and regression slots exist; R-A3 usable case remains a gap; regression not run. |
| 8 | Versioned schema/protocol/code, compatibility and actual test commands/exits | **CONDITIONAL PASS** | Candidate files and Local Agent logs/exit codes documented; static bugs M1/M2 and lack of full independent test replay prevent unconditional acceptance. |
| 9 | Preregistered PASS/FAIL/INCONCLUSIVE regression conclusion | **DEFERRED / NOT MET FOR FREEZE** | Regression explicitly NOT STARTED; plan and authorization gate recorded. No fabricated verdict. |
| 10 | Privacy inspection on public files and history | **CONDITIONAL PASS** | Static scan of added diff lines negative for several sensitive patterns; private-name inspection and private repo boundary cannot be independently certified here. |
| 11 | Complete Owner packet; distinguish alignment from acceptance | **PASS** | O-1…O-8, options, recommendation, preconditions and freeze gate are explicit; all remain PROPOSED. |
| 12 | No unapproved paid/next-gate/production/migration actions | **PASS, public scope** | Public changes confined to candidate research files and STATUS; no visible Gate B/production/file-migration actions. Private execution remains self-reported. |

These verdicts are *review assessments*, not Owner approvals. A CONDITIONAL PASS does not imply that the requirement has been independently replayed.

## 4. Shortest path to a freeze-ready contract

1. **Owner design checkpoint (now):** decide O-1, O-3, O-6, O-7 and relevant O-4; specify whether O-2 will be resolved now or P1 will remain strictly exploratory. Route O-5 to KF governance, allowing explicit unknowns as approved. No decision becomes ACCEPTED automatically.
2. **Small deterministic repair:** enforce positive P1 provenance linkage (or explicitly disallow P1=true until O-2), enforce a validated WCC manifest for final scoring, and add adversarial unit/CLI cases for bypasses. Correct denominator labels and answerability_unknown coverage. Keep v1 history untouched.
3. **Authorize, freeze and execute a bounded v1.2 regression:** after rule choices and test inputs are frozen, use fresh isolated annotators and cover R-B1/E1/E2, R-A3 and other material altered rules. Preserve private raw records; report aggregate verdict only publicly.
4. **Independent replay:** provide Cloud Agent a mounted, privacy-reviewed public checkout/archive so the three commands and candidate adversarial cases can actually run. Keep private compatibility claims as Local Agent-reported unless separately authorized for review.
5. **Submit a new freeze-readiness packet to Owner:** show the rule approvals, updated reproducible evidence, regression status and residual limitations. Owner then separately chooses whether to freeze; Gate B still needs separate authorization.

## 5. Final boundary

**GO** to continue Owner-level decisions on the candidate **proposal**.  
**CONDITIONAL GO** for narrowly scoped candidate fixes and preregistered regression preparation, each under its authorized boundary.  
**NO-GO** to submit commit `530d9e6f…` as a ready-to-freeze Metric D contract today.  
**NOT AUTHORIZED**: Gate B, paid experiments, production Knowledge Format changes, migration or changing any previous decision to ACCEPTED.

### Public evidence links

- [Reviewed commit](https://github.com/JayJiangCT/knowlery/commit/530d9e6f5d7a4b9d685bf4e1af3b5f490e2acf9f)
- [Formal handoff](https://github.com/JayJiangCT/knowlery/blob/530d9e6f5d7a4b9d685bf4e1af3b5f490e2acf9f/docs/2.0/topics/cli-002/reports/T1/V12-REPORT.md)
- [Decision tables](https://github.com/JayJiangCT/knowlery/blob/530d9e6f5d7a4b9d685bf4e1af3b5f490e2acf9f/docs/2.0/topics/cli-002/reports/T1/V12-DECISION-TABLES.md)
- [Candidate aggregator](https://github.com/JayJiangCT/knowlery/blob/530d9e6f5d7a4b9d685bf4e1af3b5f490e2acf9f/docs/2.0/topics/cli-002/reports/T1/v1.2/aggregate_v12.py)
- [Schema builder](https://github.com/JayJiangCT/knowlery/blob/530d9e6f5d7a4b9d685bf4e1af3b5f490e2acf9f/docs/2.0/topics/cli-002/reports/T1/v1.2/build_schema_v12.py)
- [Regression plan](https://github.com/JayJiangCT/knowlery/blob/530d9e6f5d7a4b9d685bf4e1af3b5f490e2acf9f/docs/2.0/topics/cli-002/reports/T1/V12-REGRESSION-PLAN.md)
