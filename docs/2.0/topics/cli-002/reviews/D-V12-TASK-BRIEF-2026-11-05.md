# CLI-002 Round 2 — Metric D v1.2 Suggestions & Local Agent Task Brief

> **Document type:** Cloud Agent recommendations / independently executable task handoff  
> **Status:** PROPOSED — implementation and protocol freeze require explicit Owner authorization  
> **Date:** 2026-11-05  
> **Task ID:** `CLI002-R2-D-V12-CONTRACT-01`  
> **Title:** Metric D v1.2 Contract Revision & Targeted Validation  
> **Target repo:** `JayJiangCT/knowlery`, `develop/2.0`  
> **Evidence baseline:** [`b40bb91b94ab8775c6b16a0d06b6fc0275a64719`](https://github.com/JayJiangCT/knowlery/commit/b40bb91b94ab8775c6b16a0d06b6fc0275a64719) (verify current branch/commit before starting)  
> **Parent documents:** the Gate NOW follow-up review and `CLI002-R2-OWNER-ALIGNMENT-REVIEW-2026-11-05.md`.

## 中文执行摘要

**建议：先产生可供 Owner 决策的 Metric D v1.2 候选契约，再按授权修订 Schema／协议／代码／测试，并完成小型预注册回归；Gate B 暂不启动。**

Local Agent 首先必须比较两种主要结果：`P0`（本轮事实得到支持、且有效来源实际到达）与 `P1`（事实正确完整，且本轮直接来源或此前可信编译核验的证据路径可审计）。**不能因为我们支持“Wiki-first、按需核验”，就自动把 P1 作为已批准主结果。** P1 所需的证据有效性、当前性、版本和适用范围仍是开放问题；历史轨迹未观测的条件不得推断为通过。

本任务还需解决三值合取（已有 `false` 时不能被其他 `unknown` 掩盖）、WCC 空清单／缺失清单／不适用的区别、F-008 与 History 的边界以及 v1.1 Rule B 部分支持等歧义。保留所有 Round 1 历史产物和 v1.0/v1.1 协议。Local Agent 应按本文任务契约交付方案、测试证据和 Owner Decision Packet；**不得未经授权执行付费测试、Gate B、重大语义变更或任何原始文件迁移。**

## 1. Recommendation and decision boundary

**Recommendation:** revise Metric D using the smallest possible versioned contract, preserve the original L1/L2/L3 measurements, and validate the known rule ambiguities before seeking Owner approval to freeze Gate B.

**Important change since the earlier review:** Owner and Cloud Agent aligned that Knowlery's normal use case is **LLM Wiki-first**, with evidence-based reuse of previously validated compilation; requiring a Raw File read in every query would undercut the product's efficiency goal. This is a *product principle*, **not yet a validated Gate B outcome metric**. The Local Agent must expose metric alternatives and their observability, not quietly rewrite the study's preregistered hypothesis.

The Owner expressed agreement to proceed with bounded v1.2 preparation and verification. That is **not** approval for paid runs, new broad private annotation sessions, Gate B execution, changing ACCEPTED KF v1.0, committing private material or declaring a new metric ACCEPTED. If the task requires broader permissions, stop and request a targeted approval.

## 2. Background / problem

At `b40bb91`:

- The follow-up's `METRIC-CONTRACT-CLARIFICATIONS.md` is PROPOSED, and original T1 schema/aggregator/protocol remain unchanged.
- The original proposed primary outcome was: for every required fact, `fact_verified=true ∧ valid_source_reached=true`; this measures delivered valid source and fact support, **not every form of valid compiled knowledge reuse**.
- `unknown` aggregation and `wcc_vault` reference applicability each have a specific semantic bug.
- The locally reported v1.1 targeted regression is **INCONCLUSIVE**: 6/7 MATCH, 1 Rule B SPLIT; the current-state branch of Rule A was not exercised. Results and isolation claims are reported by Local Agent, not independently reproduced by Cloud Agent.
- Some protocol wording conflicts remain: rejected equivalent source candidates, partial support, F-008 and History, `## Sources` navigation, `version_check`, claim-anchor absence, dates and fact granularity.

The research objective remains **a trustworthy, measurable D contract**, not a new full knowledge lifecycle runtime.

## 3. Objective

Deliver a coherent, explicitly versioned **candidate** evaluation contract and small deterministic tests that allow the Owner to choose the primary endpoint, approve the WCC split if appropriate, and later judge whether Gate B may be frozen.

**Decision question:** How can Gate B separately measure answer correctness, original-source delivery, valid compiled-verification reuse, F-008 procedural compliance, and current knowledge accuracy **without rewarding unverifiable answers or changing frozen historical results**?

## 4. Scope and authorized work distinction

### In scope for bounded proposal work

1. Compare alternative primary endpoints and select a **recommended candidate** with explicit evidence prerequisites and limitations.
2. Draft versioned protocol v1.2 and schema deltas, including WCC dual references, tri-state semantics and F-008/History clarifications.
3. Build synthetic / non-private unit fixtures and deterministic test expectations; preserve earlier schema support.
4. Prepare and, **only within existing Owner-approved local/private permissions**, run a minimal pre-registered regression against targeted historical disagreements; record any new approval required.
5. Reconcile all public documents and produce an Owner decision packet, clearly separating proposal, self-reported run evidence and independent reviewer findings.

### Out of scope

- No Gate B, T2, T3, C, A, Round 1 rerun, paid benchmark execution or broad reannotation.
- No change to KF v1.0, source-check semantics in production, Obsidian UI, CLI runtime architecture, or Knowledge Lifecycle implementation.
- No rewriting any frozen Gold, v2 question, Round 1 verdict, answer, trace, E-1 archive, v1.0/v1.1 protocol or existing annotation.
- No moving/deleting/archiving user's actual Raw Files. Logical archive is a future research topic, not this task.
- No promotion to ACCEPTED or public exposure of private source contents, paths, private identifiers, hashes or transcripts.

## 5. Candidate contract design — issues to resolve

### A. Primary endpoint: do not silently turn product alignment into a new score

Produce a side-by-side analysis of **at least** these definitions:

| Candidate | Definition | Strength | Risk / prerequisite |
|---|---|---|---|
| **P0 — Direct-source verified** | Per required fact: `fact_verified ∧ valid_source_reached`, all facts true | Existing T1 fields; comparable with reported calibration | Penalizes valid compiled-verification reuse; *not* a complete product-success metric |
| **P1 — Evidence-validated complete answer (proposed)** | All required facts correct/complete **and** each has an auditable eligible evidence path: valid direct source, **or** compiled claim with independently established verification/version/currentness conditions | Closer to LLM Wiki-first product objective | Cannot be scored from historical traces unless verification and currentness states were observed; extra trust criteria need explicit definition |

**Do not** define P1 as `fact_verified AND (valid_source_reached OR f008=compliant)` without further proof. F-008 is procedural; reading a Source, comparing a digest, or observing a source-checked event does not alone prove the claim is correct or current. P1 should require a separately justified **evidence-validity predicate**, reference identity, temporal scope and uncertainty. A source's unchanged digest does not show that another newer source has not superseded it.

The proposal must choose and justify one of: (a) keep P0 as Gate B's preregistered primary and treat P1 as a separately tested future/product metric; (b) submit an explicit amendment to the Gate B measurement plan for Owner consideration, with feasibility and blind scoring consequences. **Do not automatically choose (b).** Preserve P0 diagnostics whichever outcome the Owner selects.

For each endpoint specify grain, denominator, `unknown` policy, unanswerable handling, arm comparability, judge access and minimum source evidence. Strict correctness, currentness and token/latency/cost must be reported separately. Set **no invented numerical thresholds**.

### B. Tri-state conjunction and missing data

- For a required fact: conjunction = `false` if any required component is `false`; `true` if all `true`; otherwise `unknown`.
- For a run: `false` if any required fact fails; `true` if all pass; otherwise `unknown`.
- Define policy for zero required facts (invalid for answerable packets unless an approved exception exists) and for missing/invalid records (validation error ≠ observed `false`).
- Output counts of pass/fail/unknown and both total-answerable and determinate-only denominators as separate clearly labeled quantities; do not drop unknown runs silently.
- Tests: F+U ⇒ F, T+U ⇒ U, all T ⇒ T, all U ⇒ U, record missing ⇒ validation failure.

### C. WCC split (v1.2 candidate)

- `wcc_gold`: independently adjudicated external temporal reference, applies to all arms; requires explicit `as_of`, `state_kind`, evidence and supersession check. Version/reference ID must be retained.
- `wcc_vault`: conflict with frozen compiled-vault superseded/disputed state, **compiled arms only**; not proof of factual truth.
- Distinguish `not_applicable` (arm outside scope), `unknown` (reference absent, incomplete or unauditable), and `false` (eligible complete reference checked; no violating claim found).
- If the compiled reference list is empty after a complete recorded check, **that alone is not `not_applicable`**. Verification must be versioned and captured before judging. Judge passes should not share each other's reference material.
- Keep historical `wrong_current_claim` as legacy without backfilling; do not assert universal `legacy = wcc_gold OR wcc_vault` from eight T1-W runs.
- Implement schema/protocol/aggregator/tests together **only after Owner confirms this change**; consider `cli002-r2-t1/2` and protocol `v1.2`, not an in-place alteration of v1.0/v1.1.

### D. F-008 and History

- Respect current KF v1.0 §7.0: read first vault-file Source before answering from compiled claim unless a `source-checked` event at referenced source version **and** a current-digest match satisfy its exception.
- Define the operational difference between `f008=compliant`, `valid_source_reached`, verified compiled claim and current knowledge state. **Do not** let one silently substitute for another.
- Clarify whether a History entry used as historical support constitutes a compiled-claim row for F-008, using approved KF semantics. If KF leaves authority ambiguous, surface it to Owner rather than altering KF by evaluation-protocol fiat.
- Explicitly specify the behavior for source-check digest checks that are not observable in old runs: `unknown` / unavailable as appropriate; never retroactively infer compliance.
- Propose whether F-008 acts as a reported guardrail or a **decision-blocking guardrail**; describe decision logic qualitatively before selecting thresholds.

### E. Adjudication ambiguity

Produce compact decision tables for:

1. partial evidence (one of multiple required elements delivered),
2. annotator-proposed equivalent sources rejected vs accepted vs unresolved,
3. Rule A historical versus current-state branches,
4. `## Sources` links used as navigation edges,
5. claim pages without anchors,
6. `version_check` conflict between METRICS §3.9 and protocol step 7,
7. dates as separate required facts versus conditions attached to others.

Record which items are **clarifying existing intent**, and which materially change what passes or fails. The latter need Owner decision before freeze.

## 6. Suggested execution order and gates

1. **Preflight (read-only):** verify actual repo branch/commit, files and historical freeze checks. Diff the new candidate against `b40bb91`; audit public/private boundaries. On mismatch, record and stop rather than assuming versions.
2. **Draft contract:** produce D1/P0/P1 choice memo, WCC reference/applicability decision table, F-008 guardrail memo and ambiguity matrix, with each change labeled PROPOSED.
3. **Owner checkpoint:** present *material semantic choices* before writing the production evaluation schema or changing scoring logic. If authorization only covers documentation, stop at draft + synthetic test plan.
4. **Deterministic implementation (if authorized):** create versioned schema, validator, aggregator compatibility handling and synthetic unit tests. Verify old v1 records still parse and historical values are unchanged.
5. **Targeted regression (if authorized):** preregister cases/expected outcomes and input hashes; cover Rule B partial support, rejected candidate, Rule A current-state branch, History/F-008 boundaries and new WCC reference states. Use new independent annotators if possible and within approved local permissions. No broad benchmark run.
6. **Audit + handoff:** reproduce synthetic tests, identify private results as Local Agent-reported, run public privacy review, list open Owner decisions; seek Cloud independent review before freezing.

## 7. Deliverables

Suggested public files (paths subject to existing repo conventions):

- `docs/2.0/topics/cli-002/reports/T1/V12-CONTRACT-PROPOSAL.md` — alternative endpoints and explicit recommendation, with preregistration implications.
- `docs/2.0/topics/cli-002/reports/T1/V12-DECISION-TABLES.md` — tri-state, WCC, F-008/History and adjudication rules.
- `docs/2.0/topics/cli-002/reports/T1/V12-REGRESSION-PLAN.md` — bounded preregistration, coverage and pass criteria; later aggregate results only if authorized.
- Versioned new protocol/schema/aggregator/test files **only after Owner approval of contract changes**; do not overwrite historical versions.
- `docs/2.0/topics/cli-002/reports/T1/V12-OWNER-DECISION-PACKET.md` — what is ready, what is unproven, options for each decision, exact freeze gate and statuses.

Private only: case-level packets, Gold, trace excerpts, annotator outputs, reference lists with sensitive source data, pre-registration scripts/hashes and raw test logs in the approved private store.

## 8. Acceptance criteria

1. The original vs proposed primary outcomes are compared, not conflated; no false assertion of externally validated compiled claim reuse.
2. Every required evidence/verification predicate has observable inputs, temporal scope and clear `unknown` behavior; non-observable old traces remain unknown.
3. Tri-state logic and denominators are precise, and deterministic synthetic tests cover failing + unknown cases.
4. WCC has independently defined references, arm applicability and `false` / `unknown` / `not_applicable` semantics.
5. Historical `wrong_current_claim`, Round 1 results, Gold and archived original contracts remain unchanged.
6. F-008 handling is compatible with currently accepted KF v1.0, or unresolved conflicts are escalated without unilateral interpretation.
7. Rule B partial support, rejected equivalents and Rule A current-state branch have explicit expected behavior and targeted regression coverage.
8. If schema/protocol/code change is authorized, versions are coherent, backward compatibility is tested and all actual test commands + exits are recorded.
9. A regression conclusion is `PASS` / `FAIL` / `INCONCLUSIVE` under a recorded preregistration; private observations are labelled local and not independently verified by Cloud Agent.
10. Public files pass privacy inspection; no private material or sensitive paths enter public checkout, Git history or sync folders.
11. The Owner packet lists all remaining material decisions and cannot mistake product-level alignment for formal acceptance.
12. No paid execution, next Gate, production implementation or file migration occurs without distinct authorization.

## 9. Safety constraints / stop conditions

**Stop and report immediately** if (a) a frozen digest/count fails; (b) sensitive private artifacts appear in a public checkout; (c) a contract change conflicts with ACCEPTED KF v1.0; (d) new source authority or Gold correctness cannot be established; (e) the requested regression requires unapproved paid work or wider private access; (f) an intended edit rewrites frozen results; or (g) the proposed evaluation amendment would make B arms non-comparable without a defensible remedy.

Keep repository modifications minimal, reviewable and scoped; avoid destructive actions, permission changes, and push before public-content approval. A documentation proposal may be shared for review without implying execution authorization.

## 10. Required Local Agent handoff

Return one concise handoff containing: repo SHA and branch; changed file list; proposed P0/P1 choice and its evidence limitations; WCC/F-008/History decisions needing Owner; tested vs untested behaviors; deterministic commands + exit statuses; regression design and outcome (if approved); privacy audit result; material risks; and a clear **GO / CONDITIONAL GO / NO-GO / INCONCLUSIVE** recommendation for *contract readiness*, never for Gate B execution by default.

**Cloud Agent's expected next action:** independently inspect the candidate files and available reproducible public synthetic tests, then provide a separate freeze-readiness review to the Owner. The Owner remains the authority for any ACCEPTED contract or Gate B authorization.

## 11. Related future topic (outside this task)

**Knowledge Lifecycle & Autonomous Evolution** may separately study timely cold-start reconciliation of user-authored and remote Raw Files, downstream invalidation, provenance-aware distillation, and *logical* archival with default retrieval demotion (no physical Raw File moves). It must not silently expand this v1.2 scope or change the CLI-002 research question.
