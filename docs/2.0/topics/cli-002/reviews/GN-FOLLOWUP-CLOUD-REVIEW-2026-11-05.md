# CLI-002 Round 2 — Gate NOW Follow-up 独立裁定报告

> **Status: REVIEWED · CONDITIONAL GO（研究成果） / NOT READY（Gate B 评分契约冻结）**  
> **Date:** 2026-11-05  
> **Reviewer:** Cloud Agent  
> **Repository:** `JayJiangCT/knowlery` (`PUBLIC`)  
> **Reviewed branch / commit:** `develop/2.0` / `b40bb91b94ab8775c6b16a0d06b6fc0275a64719`  
> **Task:** `CLI002-R2-GN-REVIEW-FOLLOWUP-01`  
> **Decision authority:** Project Owner；本文是独立评审意见，不是 Owner 的 ACCEPTED 决策或后续任务授权。

## Executive Summary

**结论：本次 Follow-up 的交付完整性通过；指标方向可以提交 Owner 逐项决策；Metric D 尚不具备作为 Gate B 正式冻结评分契约的条件。** 应保留现有 T0/T1 资产和全部原始标注，不重跑 Round 1，不扩大实验范围。优先完成一个有界的 v1.2 指标／协议修订与小型回归。

- **已取得的进展：** Local Agent 已逐条处置前次 3 项 Major、2 项 Minor；提出主结果与护栏分类、WCC 双参考拆分方案，并记录 v1.1 定向回归的 `INCONCLUSIVE`，没有将其包装为 PASS。
- **当前阻断点：** （1）主结果对 `false` 与 `unknown` 的合取规则不正确；（2）`wcc_vault` 把“参考清单缺失”与“不适用”混为一谈；（3）Rule B 的部分支持、Rule A 的当前态分支及其他协议边界尚未完成回归。
- **建议下一步：** Owner 分别决定主结果定义、F-008 的角色、WCC 拆分、当前性 Gold 要求以及 v1.2 小回归授权。**任何建议均不自动升级为 ACCEPTED**；T2/T3/B/C/A 继续分别审批。

## 1. 范围、材料与证据等级

### 1.1 已独立核查（VERIFIED / STATIC）

本轮通过 GitHub 连接器读取了提交对象及以下文件：

- [`CLOUD-REVIEW-RESPONSE.md`](https://github.com/JayJiangCT/knowlery/blob/b40bb91b94ab8775c6b16a0d06b6fc0275a64719/docs/2.0/topics/cli-002/reports/T1/CLOUD-REVIEW-RESPONSE.md)
- [`METRIC-CONTRACT-CLARIFICATIONS.md`](https://github.com/JayJiangCT/knowlery/blob/b40bb91b94ab8775c6b16a0d06b6fc0275a64719/docs/2.0/topics/cli-002/reports/T1/METRIC-CONTRACT-CLARIFICATIONS.md)
- [`REGRESSION-SUMMARY.md`](https://github.com/JayJiangCT/knowlery/blob/b40bb91b94ab8775c6b16a0d06b6fc0275a64719/docs/2.0/topics/cli-002/reports/T1/REGRESSION-SUMMARY.md)
- [`STATUS.md`](https://github.com/JayJiangCT/knowlery/blob/b40bb91b94ab8775c6b16a0d06b6fc0275a64719/docs/2.0/topics/cli-002/STATUS.md)、[`ROUND-2-SUMMARY.md`](https://github.com/JayJiangCT/knowlery/blob/b40bb91b94ab8775c6b16a0d06b6fc0275a64719/docs/2.0/topics/cli-002/ROUND-2-SUMMARY.md)
- 对照：[`PLAN.md`](https://github.com/JayJiangCT/knowlery/blob/b40bb91b94ab8775c6b16a0d06b6fc0275a64719/docs/2.0/topics/cli-002/PLAN.md) §5、[`METRICS.md`](https://github.com/JayJiangCT/knowlery/blob/b40bb91b94ab8775c6b16a0d06b6fc0275a64719/docs/2.0/topics/cli-002/reports/T1/METRICS.md) §3、[`KNOWLEDGE-FORMAT-v1.0.md`](https://github.com/JayJiangCT/knowlery/blob/b40bb91b94ab8775c6b16a0d06b6fc0275a64719/format/KNOWLEDGE-FORMAT-v1.0.md) §7.0（F-008）。

GitHub 比较 `d48acce…b40bb91` 返回 **2 commits、7 个变更文件**；检查时远端 `develop/2.0` 与 `b40bb91` 为 `identical`。原 T1 的 Schema、聚合器及 v1.0/v1.1 协议未在 Follow-up 中被修改；`wcc_gold` / `wcc_vault` 仍仅为 **PROPOSED**。

### 1.2 仅由 Local Agent 报告（REPORTED / NOT INDEPENDENTLY VERIFIED）

- 单元测试 17 项通过、自测 24/24、合成标注记录验证 16 条。
- 私有回归：2 名新标注者、2 个 Packet、7 项规则核对，其中 6 MATCH、1 SPLIT；输入与预注册文件的哈希、会话隔离检查。
- T0 私有归档哈希与 T1-W 私有评审结果。

Cloud Agent **未访问原始私有 Gold、轨迹、标签、标注者完整输出和日志，也未重跑私有检查**。因此，本报告认可其披露方式与内部逻辑，不将上述执行结果表述为本轮独立复验事实。

## 2. 正式裁定

| 审查对象 | 裁定 | 说明 |
|---|---|---|
| GN-FOLLOWUP-01 交付完整性 | **GO** | 已形成逐项回应、拟议契约、回归报告及状态更正；GO 仅指交付内容符合本轮复核范围 |
| T0 状态修订与冻结术语 | **GO** | 采用 **10 PASS / 1 NEEDS-EVIDENCE**；区分 hash-frozen、write-protected、historically verified |
| D 主要结果／护栏方案 | **CONDITIONAL GO** | 支持指标分层与 L2∧L3 思路；需修正三值逻辑及 F-008 门槛语义 |
| WCC 双参考拆分 | **GO FOR PROPOSAL** | 建议 Owner 授权形成 v1.2 实施版本；参考缺失、适用范围及旧数据兼容规则须修正 |
| v1.1 定向回归 | **INCONCLUSIVE** | 接受按预注册标准报告的结果；不能据此宣称 v1.1 已充分验证 |
| D 作为 Gate B 冻结评分契约 | **NOT READY** | 待 Owner 裁决和有界的 v1.2 回归通过后再提交冻结审批 |
| T2 / T3 / B / C / A | **NOT AUTHORIZED** | 本报告不构成任何后续 Gate、付费测试或产品 CLI 实施授权 |

## 3. 关键裁定与必要修订

### 3.1 主结果：保留逐事实 L2∧L3，修正三值合取（Major）

Local Agent 提议：一个可回答 Run，**每个必需事实**都具有 `fact_verified = true` 且 `valid_source_reached = true`，则该 Run 的主要结果为通过。我认为这一可操作化定义**原则上可用**，且不是任意加权评分。

但 Clarifications §1.2 写到“任何组件出现 unknown 即整题 unknown”，这对合取不成立。建议统一采用：

| 同一答卷内的事实级结果 | 整题结果 |
|---|---|
| 全部 `true` | `true` |
| 至少一个 `false`（不论其他项是否 `unknown`） | **`false`** |
| 无 `false`、至少一个 `unknown` | **`unknown`** |

实现要求：以 **fact-level `fact_verified AND valid_source_reached`** 先求每个事实，再以同一规则汇总答卷；可回答题至少有一个必需事实；`unknown` 独立计数并公开分母口径，不得隐去或视为通过。增加 `false + unknown`、`true + unknown`、全 `unknown` 的合成测试。

这一结果准确表述为**“有效来源已到达，且答案中的全部必需事实有已交付文本支持”**。它尚不能证明 Agent 主动核验了该来源，也不能证明来源本身在现实世界中绝对真实。L2 与 L3 在同一必需事实上同时成立，不必然代表支持最终答案的文字就是该份预裁定来源；此局限需明列于 Gate B 报告。

### 3.2 F-008：建议作为强制决策护栏，不自动替代 L2（Major）

原 `PLAN.md` §5 将结果描述为完整、来源核验正确，并附带 *appropriate F-008 checks*。Local Agent 将 F-008 置于 Guardrail 的方向可以接受，但必须解决：**Guardrail 只展示，还是能阻断 Gate B 的 GO？**

建议：

- **不允许** F-008 的 `source-checked`／digest 例外直接替代本轮 `valid_source_reached`。前者判断程序条件，后者判断本轮是否收到被认可的来源内容。
- **保持** F-008 独立于主结果的事实合取，但在 Gate B 决策中把明确违规列为必须报告、预注册处置的风险；`unknown` 不得当成 `compliant`。
- **不虚构**未观测到的 digest 检查；F-008 关于“first vault-file Source”等存在的 KF 歧义继续标记 `unknown`，不可由本轮研究擅自改写 Accepted KF v1.0。

是否设定零容忍或非劣阈值，以及阈值应按 claim、run 还是 arm 计算，仍是 **Owner 待决事项**；本报告没有批准具体阈值。

### 3.3 WCC：支持拆分，但修正 `not_applicable` 条件（Major）

建议继续将以下两个指标 **PROPOSED**，经 Owner 批准后同步修改 Schema、v1.2 协议、聚合器和测试：

- `wcc_gold`：回答是否与指定 `as_of` 时间点经过独立审定的当前状态冲突；对全部实验组适用。
- `wcc_vault`：回答是否将编译 Wiki 已标为 superseded / disputed 的 Claim 当作当前有效内容；仅对具有相应治理结构的编译组适用。

需要修正 Clarifications §2.6 中“没有 compiled-vault reference list 就是 `not_applicable`”的规定：

| 场景 | 建议判定 |
|---|---|
| G0 不具备对应编译治理结构 | `not_applicable` |
| G1 的相关参考已**完整、按版本**构建，查无 supersession/dispute；答案无违规 | `false` |
| G1 本应有参考但清单缺失、版本不符或构建不完整 | **`unknown`**，附原因 |
| G1 相关参考完整且确认回答误用过期或有争议的 Claim | `true` |

实施应有不暴露实验组身份的评审流程，以及聚合侧对 **arm applicability / reference completeness / reference version** 的校验。`wcc_vault=false` 不能被解释为事实当前性正确；它只是对编译库自身治理状态的一致性结果。

Round 1 原 WCC 必须保留，不得自动转换为新指标。T1-W 八条样本的并集关系仅是局部观察，不能推广至整体。

### 3.4 v1.1 回归：接受 INCONCLUSIVE，修 v1.2 后小回归（Major）

Local Agent 的私有回归报告称：Rule A 为 2/2 MATCH、Rule B 为 2/3 MATCH（1 SPLIT）、Rule C 为 2/2 MATCH，总计 6/7；受测对象仅两个旧争议 Packet。此结果不支持整体一致率估计，也未测试 **Rule A 将旧 History 当作当前态依据** 的另一分支。

建议 v1.2 只修明确歧义：

1. **Partial support**：已交付文本只包含必需事实的部分要素，且记录完整时，完整支持应为 `no`；仅在无法观察或语义不可判定时为 `unknown`，不要让“部分事实”充当完整证据。
2. **Candidate equivalence**：被拒绝的候选不能自动造成 `unknown`。若无其他未裁决、可能有效候选，应为 `false`；若存在可能有效但尚未裁决的候选，保留 `unknown`。
3. **History／F-008 范围**：说明历史 Claim 是否需要 F-008 行，尤其在回答历史态问题时；如触及 KF 解释权限，先交 Owner 决定。
4. **剩余协议冲突**：`## Sources` 链接是否计导航边、无 Claim Anchor 的 Record Page、`version_check` 与日期另列为必需事实时的等价判断。

之后按**预注册、独立评审、小样本**方法验证上述边界及 Rule A 当前态分支。不重跑全部 Round 1，不为追求统计显著性额外增加样本。若需付费或超出现有授权，先停止并提交 Owner。

### 3.5 其他事项（Minor）

- T0 状态采用 **10/11 PASS，Round 1 Tool Traces NEEDS-EVIDENCE**，新建基线只保证未来可检变动，不能追溯证明旧轨迹无变化。
- 文件“frozen”须写明 hash-frozen、write-protected、historically verified 的实际含义；仅有哈希不意味着无法写入。
- v3 当前态 Gold 必须候选要求 `as_of`、状态种类、原始支持证据、supersession 检查与不确定性；v2 可疑过期 Gold 仍为 PROPOSED Errata，不修改冻结 v2 分数。

## 4. Owner Decision Register — 五项待决（全部 PROPOSED）

| ID | 问题 | Cloud Agent 建议 | 所需明确批准 |
|---|---|---|---|
| **D-01** | 是否采用“每个必需事实 L2∧L3”的主要结果 | 原则支持；修正 `false` 优先的三值逻辑，报告未知率及共同来源使用局限 | 批准主结果定义及分母口径 |
| **D-02** | F-008 例外是否可替代 L2；F-008 是否为阻断性护栏 | **不替代 L2**；建议设为强制决策护栏，阈值需另议 | 批准其与主结果的关系及 GO/NO-GO 判定原则 |
| **D-03** | 是否实施 WCC 拆分 | **建议批准方向**，但修正 `not_applicable` / `unknown`，提供参考完整性校验 | 授权同步更新 Schema、协议、聚合器、测试 |
| **D-04** | `wcc_gold` 的当前性 Gold 要求 | **建议批准**明确 `as_of`、证据状态、supersession 检查 | 批准 v3 金标规范；v2 Errata 另行裁决 |
| **D-05** | v1.1 INCONCLUSIVE 后怎么办 | **修 v1.2，再做一次有界回归** | 授权限定的文字／实现改动与回归范围；额外付费另批 |

**注意：** 表中“建议批准”是 Cloud Agent 的裁定建议，不是 Owner 审批结果；不得在 Decision Register 中将任何项标记为 ACCEPTED。

## 5. D 合约冻结的退出条件

仅当下列条件全部满足，才建议把 D 的最终契约**提交 Owner 冻结审批**，仍不得自动生效：

1. **Primary**：逐事实与逐 Run 的 true/false/unknown 算法、空事实集处理、分母及不确定性报告均文档化并通过合成测试。
2. **Guardrails**：F-008 的适用范围、已知歧义、违规与未知结果的 GO/NO-GO 影响已预注册；不将合规误述为事实真实。
3. **WCC**：新字段、参考版本、G0/G1 适用性、空清单与缺失清单、兼容旧记录的规则在 Schema／协议／代码／测试中一致。
4. **Regression**：对 Rule B 部分支持、候选拒绝、Rule A 当前态分支及其他本次新增边界通过定向检验；无法裁决者仍保留 `unknown` 和显式例外。
5. **Gold & privacy**：v3 当前性参考的最低要求、私有保存、公开汇总和潜在信息泄露检查均有明确契约。
6. **Audit & decision**：保留不可变的 v1.0/v1.1 原始标注及原裁决，提交测试命令、真实执行结果、未核验事项和 Owner 决定清单。

**不要求：** 重新冻结 Round 1、付费重新跑 benchmark、构建生产级 CLI，或为定向规则修订追求总体统计显著性。

## 6. 最终边界与建议

- **Round 1：** `Completed — Core Hypothesis Inconclusive`，不改变。
- **CLI-002：** `OPEN`，不改变。
- **GN-FOLLOWUP-01：** `GO` 作为交付与研究准备成果，不等于 D 合约获批。
- **Metric D（用于 Gate B）：** `NOT READY`，等待上述小范围收口和 Owner 决定。
- **WCC split / v1.2：** `PROPOSED`；尚未实施，更未 ACCEPTED。
- **T2 / T3 / B / C / A：** 本报告均**不授权**，继续分阶段审批。
- **Safety：** 私有证据不进入公开仓库；不接触或修改冻结资产。本文未提交或推送 GitHub。

**Recommendation:** 停止扩大研究范围，优先完成 D-01 至 D-05 的 Owner 决策与有界 v1.2 契约收口；通过后再请求 Gate B 的独立冻结审批。

---

**Suggested repository destination (not committed):** `docs/2.0/topics/cli-002/reviews/GN-FOLLOWUP-CLOUD-REVIEW-2026-11-05.md`  
**Provenance:** 本文基于上述公开提交与既有评审意见独立形成；私有运行结果仅按 Local Agent 的脱敏报告引用。
