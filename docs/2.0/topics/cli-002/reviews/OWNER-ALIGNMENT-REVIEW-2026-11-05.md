# CLI-002 Round 2 — Owner Alignment Review

> **Document type:** Cloud Agent review addendum / Owner–Cloud alignment record  
> **Status:** REVIEWED — PRINCIPLE-LEVEL ALIGNED; METRIC D CONTRACT **NOT FROZEN**  
> **Date:** 2026-11-05  
> **Owner:** Project Owner  
> **Reviewer:** Cloud Agent  
> **Evidence baseline:** `JayJiangCT/knowlery`, `develop/2.0`, commit [`b40bb91b94ab8775c6b16a0d06b6fc0275a64719`](https://github.com/JayJiangCT/knowlery/commit/b40bb91b94ab8775c6b16a0d06b6fc0275a64719)  
> **Related review:** `CLI002-R2-GN-FOLLOWUP-CLOUD-REVIEW-REPORT-2026-11-05.md` (earlier generated independent review report; confirm the filename chosen in the local repository)  
> **Scope:** The five Gate NOW follow-up decisions, subsequent Owner–Cloud discussion, and their effect on Metric D v1.2 planning.

## 中文摘要与裁定

**本轮裁定：原则性对齐（ALIGNED / PROPOSED）；Metric D v1.2 允许进入有界方案修订与验证准备；Gate B 评分契约尚不能冻结（NOT READY）。**

双方已确认五项产品方向：①日常回答以 LLM Wiki 为主要入口，可在证据、版本和当前性条件可核验时复用编译结果，不要求每次读取 Raw File；②用户纠错、模型记忆冲突、当前会话冲突和来源变化都可以触发 Agent 自主核查，但不能自动覆盖既有事实；③把知识维护失败、Agent 使用知识失败与最终回答错误区分开，并支持 `wcc_gold` / `wcc_vault` 拆分；④新文档需要与已有知识及时协调、评估下游影响，低活跃文档可以蒸馏并**逻辑归档**，Raw File 不迁移、不删除；⑤先修订、验证 Metric D v1.2，之后由 Owner 决定是否冻结 Gate B。

**关键纠偏：**既有 `fact_verified ∧ valid_source_reached` 可以保留为“本次有效原始来源到达”的观测指标，但不宜未经论证就当作 Wiki-first 产品唯一的可信回答标准。复用编译结果的资格需要独立的证据有效性定义，不能简单用 `f008=compliant` 代替。知识来源的 digest 不变，也不能排除另有新文档推翻旧结论。

**状态边界：**此次用户与 Cloud Agent 的讨论是原则共识，不是对 KF v1.0、Metric D 主结果、Schema 或 Gate B 的正式 ACCEPTED。私有回归与测试均是 Local Agent 报告，未独立复算。Knowledge Lifecycle / Autonomous Evolution 另立研究主题，不并入本轮 CLI-002 评分实验。

## Executive conclusion

**Owner and Cloud Agent reached principle-level alignment on knowledge consumption, autonomous verification, knowledge evolution, error attribution, and bounded evaluation-contract revision.** These agreements sharpen Knowlery's product goals but **do not themselves approve a new Knowledge Format, change F-008, freeze Metric D, or authorize Gate B**.

The key correction to the earlier review is: **“every answer must read a Raw File” is not an appropriate general definition of trusted Knowlery answers**. Compiled LLM Wiki exists to provide agents with sufficiently good, compact, traceable knowledge at lower token cost and latency. Whether previously verified compiled knowledge can be trusted depends on the validity of its evidence, current knowledge state, and observable changes—not merely whether a Raw File was opened during this query.

**Next gate:** owner-aligned direction to prepare a *bounded* Metric D v1.2 revision and targeted validation. Any formal metric freeze, paid benchmarking, changes to ACCEPTED KF v1.0, historical score rewrite, destructive changes, or additional Gate execution requires separate approval.

## 1. Evidence and decision integrity

### 1.1 Independently checked in the prior review

The earlier Cloud review read the public `b40bb91` commit, the follow-up response, metric-contract clarifications, regression summary, status and Round 2 summary, and compared them with the Round 2 plan and KF v1.0 §7.0. At that snapshot, the WCC split was **PROPOSED**, and the T1 schema/aggregator and v1.0/v1.1 protocols were not revised in the follow-up.

Primary public references:

- [Round 2 Plan — §5, Gate B primary endpoint](https://github.com/JayJiangCT/knowlery/blob/b40bb91b94ab8775c6b16a0d06b6fc0275a64719/docs/2.0/topics/cli-002/PLAN.md)
- [Cloud review response](https://github.com/JayJiangCT/knowlery/blob/b40bb91b94ab8775c6b16a0d06b6fc0275a64719/docs/2.0/topics/cli-002/reports/T1/CLOUD-REVIEW-RESPONSE.md)
- [Metric-contract clarifications — PROPOSED](https://github.com/JayJiangCT/knowlery/blob/b40bb91b94ab8775c6b16a0d06b6fc0275a64719/docs/2.0/topics/cli-002/reports/T1/METRIC-CONTRACT-CLARIFICATIONS.md)
- [Targeted regression summary](https://github.com/JayJiangCT/knowlery/blob/b40bb91b94ab8775c6b16a0d06b6fc0275a64719/docs/2.0/topics/cli-002/reports/T1/REGRESSION-SUMMARY.md)
- [Knowledge Format v1.0 — F-008](https://github.com/JayJiangCT/knowlery/blob/b40bb91b94ab8775c6b16a0d06b6fc0275a64719/format/KNOWLEDGE-FORMAT-v1.0.md)

This document does **not** claim a fresh branch-head inspection beyond that reviewed snapshot. Its new findings primarily reflect Owner–Cloud design discussion, not new benchmark observations.

### 1.2 Locally reported, not independently reverified

Local Agent's reported 17 unit tests, 24/24 self-tests, privacy checks, independent annotator isolation, and private v1.1 regression (A 2/2, B 2/3, C 2/2; overall **INCONCLUSIVE**) remain local reports. The Cloud Agent did not independently examine private packets, Gold, transcripts, raw traces, or rerun those tests. The small regression cannot estimate general agreement or answer accuracy.

### 1.3 Decision terminology

- **ALIGNED / PROPOSED:** Owner and Cloud Agent agree with a high-level product principle; no executable contract or architecture baseline is thereby accepted.
- **ACCEPTED:** Reserved for an explicitly approved, versioned decision / specification recorded in the project decision system.
- **OPEN:** A concrete metric definition, authorization or technical question still unresolved.

## 2. Five decisions — alignment and remaining boundaries

| # | Topic | Principle-level alignment | Not yet settled |
|---|---|---|---|
| D1 | Trusted answers / primary outcome | Prefer LLM Wiki; reuse verifiably valid compiled knowledge; do not require per-query raw-file reads | Evidence-validity definition; correct Gate B endpoint; tri-state aggregation |
| D2 | Verification / F-008 | Agent judges when to verify; user correction, memory, current chat and source change are investigation signals; humans resolve high-risk/uncertain decisions | Exact F-008 compatibility; authorization and safety boundaries |
| D3 | WCC and error attribution | Separate external currentness, wiki-consistency and failure origin; support `wcc_gold` / `wcc_vault` split | Schema semantics and versioned reference requirements |
| D4 | Knowledge currentness / lifecycle | Reconcile new cold-start sources; timely downstream review; distill low-attention history; logical archive without moving files | Lifecycle format and algorithms; timeliness and preservation targets |
| D5 | v1.2 research path | First revise a bounded D contract and run small preregistered regression; only then consider Gate B freeze | Final contract, regression pass, explicit freeze approval |

### D1 — What makes an answer successful?

- The LLM Wiki is intended to be the **primary everyday knowledge-consumption surface**: compact, Agent-friendly, source-traceable, token- and latency-efficient.
- A prior compilation verification can potentially be reused without reading Raw Files again **if** relevant source versions and knowledge currentness remain supportable. This does not grant unconditional trust to compiled claims.
- The existing `fact_verified ∧ valid_source_reached` formulation is still a useful *observable direct-source* measure, but **cannot be assumed to be the sole general success measure**. It can penalize sound answers relying on a valid compiled verification record.
- **Open metric design:** distinguish (a) answer correctness/completeness; (b) evidence provenance / verification condition; (c) knowledge currentness; (d) token, latency and tool cost. Propose at least one auditable **compiled-verification reuse** path, with `unknown` if it cannot be established from frozen traces. Do not fabricate evidence that historical traces lack.
- If the v1.2 primary endpoint differs materially from Plan §5's earlier operationalization, surface the change as an explicit **Owner decision and preregistration revision**, not as a silent reinterpretation.

### D2 — Autonomous verification and knowledge maintenance

- Triggers for Agent investigation: (1) user explicitly reports an error; (2) Agent memory contradicts Wiki; (3) current conversation contradicts Wiki; (4) a Raw File changes, new material arrives or a potential supersession is detected.
- Such signals initiate **investigation**, not automatic truth replacement. Memory and current-chat statements are not intrinsically authoritative; check source, timestamp, scope and decision state.
- Agent should be allowed to take low-risk, evidence-backed maintenance steps autonomously within approved permissions. Escalate unresolved conflicts, insufficient evidence, high-impact changes or permission-sensitive operations.
- Acknowledged boundary: KF v1.0 F-008 imposes specific current-source digest and first-vault-source conditions. A new product principle cannot waive those rules. Formal change requires separate KF governance.

### D3 — Error attribution and propagation

- A Wiki node that is demonstrably stale, and is accurately reflected by an Agent, is **primarily a knowledge-maintenance failure**. The final answer can simultaneously be incorrect; these measurements should not be collapsed into one causal label.
- Distinguish: *answer correctness*, *Agent's use/interpretation of Wiki*, *Wiki currentness*, and *downstream propagation of knowledge changes*.
- Support the **proposed** split: `wcc_gold` (dated external reference / all arms) versus `wcc_vault` (compiled-Wiki supersession/dispute consistency / compiled arms). Avoid `wcc_vault` as a cross-arm standalone primary measure.
- Rule must distinguish compiled-arm reference set **empty but completely checked** (`false` can be justified) from **unavailable or incomplete** (`unknown`); `not_applicable` is for arms truly outside the metric, not for missing evidence.

### D4 — Cold-start reconciliation and logical archival

- Raw knowledge enters through (1) user-authored notes, (2) externally sourced documents, and (3) Agent-authored documentation following discussion. The first two commonly lack generation context; the third can be more interpretable but remains fallible.
- New information should be compared with existing claims for scope, time, status and evidence; it may supplement, correct, conflict with or supersede existing knowledge. The Agent must **not** treat a newer date alone as proof of supersession.
- Detect potential invalidation **promptly** and separately from completing a fully verified repair; otherwise errors may propagate through downstream dependent knowledge. Link existence alone is not proof of dependency.
- For rarely accessed raw material, **distill useful lasting knowledge** and **logically archive** without moving or deleting the original Markdown. Lower default everyday retrieval priority, retain historical exploration, traceability, change detection and reactivation. `archived` is not synonymous with `superseded`, `obsolete` or `unverified`.
- This is a **separate Knowledge Lifecycle & Autonomous Evolution research topic**, not an automatic new dependency for CLI-002 Gate B.

### D5 — v1.2 before Gate B

- Owner agreed to the **direction** of a bounded Metric D v1.2 revision and targeted checks before asking to freeze Gate B.
- Retain v1.0/v1.1 protocol, Round 1 artifacts, original answers, labels, scores and E-1; preserve prior regressions and any historical WCC field unchanged.
- Close known ambiguity in partial-support, rejected equivalents, Rule A current-state branch, History/F-008 cases, `version_check`, `## Sources` navigation, and missing claim anchors as relevant to the scoring contract.
- Do not authorize Gate B, paid model runs, T2/T3/C/A, KF amendments, or broad implementation through this review.

## 3. Assessment of change from the earlier Cloud review

The prior independent review gave **CONDITIONAL GO** to an operational primary outcome requiring fact-level L2∧L3 (`valid_source_reached` and `fact_verified`). The Owner–Cloud discussion has identified a **product-goal mismatch** if that becomes the only definition of a trustworthy Knowlery answer. This is a reason to **revise the candidate measurement contract**, not evidence that the original T1 annotations are wrong. Keep the L2/L3 fields and their historical results for diagnosis and control comparisons.

The earlier identified deterministic bugs/ambiguities remain:

1. **Three-valued conjunction:** if any required fact is conclusively false, the complete-run result is false even when another is unknown; unknown only when no false exists and at least one component is unknown.
2. **WCC applicability:** compiled reference completely checked and empty ≠ reference unavailable ≠ no compiled-Wiki arm.
3. **Protocol regression:** reported A/C PASS in tested cases, B INCONCLUSIVE; A's current-state branch was not tested.

Any new compiled-verification reuse metric requires **new evidence conditions and reference authority**, not a permissive OR flag attached to the old endpoint. Source digest equality alone establishes the original source file's version, **not** that no subsequent document superseded the claim. Agent-run evidence and external Gold should be kept distinct.

## 4. Verdict and decision gate

| Item | Reviewer verdict |
|---|---|
| Earlier GN-FOLLOWUP-01 response | **GO** on bounded deliverable completeness; private testing stays locally reported |
| D1–D5 product principles | **ALIGNED / PROPOSED**; suitable to record for future design |
| WCC split design direction | **GO FOR PROPOSAL**, subject to schema and reference semantics |
| Metric D v1.2 revision | **CONDITIONAL GO** for bounded drafting and validation planning; actual execution subject to available authorization and stops |
| Current Metric D as frozen B contract | **NOT READY** |
| Gate B / paid runs / other gates | **NOT AUTHORIZED** |

**Owner decision still needed before a formal D freeze:** authorize an explicit candidate for primary-outcome semantics and F-008 treatment, approve WCC implementation contract, approve dated Gold reference rules, and evaluate targeted v1.2 regression results. No `ACCEPTED` label may be inferred from conversational alignment.

## 5. Recommended separation of work

- **Now, CLI-002:** one focused v1.2 measurement-contract proposal, consistent schema/protocol/code/tests if separately authorized, bounded regression, and Owner freeze decision packet. Avoid new data collection merely to settle textual rule ambiguity.
- **Later, separate topic:** Knowledge Lifecycle & Autonomous Evolution — cold-start reconciliation, incremental invalidation, downstream updates, usage-aware distillation, logical archive and reactivation. The future research should establish correctness, preservation, intervention cost and token benefits with frozen real-vault scenarios before introducing new persistent state machinery.

## 6. Integrity and handling

This report contains only public repository references and user/agent design discussion; it does not reproduce private benchmark cases, Gold or trace text. Public-repo safety review is still required before any commit/push. **No repo modification, Owner approval beyond what was said in discussion, or Local Agent delivery is claimed.**
