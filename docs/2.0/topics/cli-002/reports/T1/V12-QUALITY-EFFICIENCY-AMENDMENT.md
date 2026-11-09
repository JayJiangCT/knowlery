# CLI-002 Round 2 — proposed PLAN §5 amendment for O1(c): Quality-Gated Efficiency

**Task:** CLI002-R2-D-V12-CLOSURE-01. **Date:** 2026-11-06. **Input commit:** `530d9e6`.

**Status: PROPOSED TEXT.** The Owner approved O1(c) as the Gate B **evaluation objective** on 2026-11-06 ([approval](../../reviews/OWNER-APPROVAL-2026-11-06.md)). This file is the proposed wording that would put that objective into [`PLAN.md`](../../PLAN.md) §5. It takes effect only if the Owner approves this text. `PLAN.md` is not edited. Nothing here is ACCEPTED, and nothing authorizes Gate B.

It follows [Cloud closure §2.2](../../reviews/O1-O8-DECISION-CLOSURE-2026-11-06.md): no new composite score, no new model, no extra experiment series.

## 1. What changes in §5

**Current text, "Primary endpoint":** "proportion of answerable questions/runs with complete *and* source-verified correct answer under appropriate F-008 checks."

**Proposed replacement:**

> **Primary evaluation (Quality-Gated Efficiency).** Gate B compares arms on two co-primary dimensions, measured on the same tasks:
> (1) **Quality** — the independent, blind Strict Correctness verdict against the frozen gold;
> (2) **Query efficiency** — model tokens and query cost per task.
> A result supports the compiled Wiki's value only if quality improves, or stays within the pre-set acceptable quality change, **and** query cost falls. Lower quality with lower cost is a trade-off or a negative signal, never a success. If the data cannot rule out an unacceptable quality loss, the conclusion is INCONCLUSIVE.
> Latency and tool-call counts are reported as secondary efficiency measures. Abstention on unanswerable questions is reported separately.
> Metric D (P0, the exploratory P1, L1/L2/L3, graph paths) is diagnostic. F-008, `wcc_gold`, `wcc_vault`, source traceability and proper abstention are guardrails (section 6).

The rest of §5 (hypotheses, sample, cost model and cap, success/failure conditions (a)–(d), the statistician review before the sample is frozen) stays as written. The success condition "(b) independently adjudicated required facts and adequate source checks" becomes a guardrail check under section 6, not a primary outcome.

## 2. Unit of aggregation

| Item | Rule |
|---|---|
| Analysis unit | The **question**. For each question and arm, average over that arm's runs (repeats). |
| Comparison | **Paired** by question: the difference between arms on the same question (G1-A − G0; G1-B − G1-A). |
| Clustering | Questions are the independent units. Runs and required facts are never treated as independent samples. If knowledge clusters are pre-specified, report a cluster-level sensitivity analysis too. |
| Quality per run | Strict Correctness: `correct` / `incorrect` / `undetermined`. Partial credit is reported descriptively only. |
| Efficiency per run | Total model tokens: input, cache creation, cache read and output, each reported. Query cost in USD from the run record. |

## 3. Missing data

These rules must be fixed before any Gate B data exist.

| Case | Primary analysis | Reported beside it |
|---|---|---|
| Run aborted or produced no final answer | Quality: `incorrect` (the task failed). Cost: as recorded up to the abort; flagged | Count of such runs per arm. Sensitivity analysis excluding them |
| Strict verdict `undetermined` | Counted as **not correct** in the quality share | Count per arm. Sensitivity analysis with `undetermined` excluded |
| Run record lacks cost or token fields | Excluded from the efficiency analysis only; the run stays in the quality analysis | Count per arm. If missing in more than a pre-set share, efficiency is INCONCLUSIVE (the share is an Owner parameter, not set here) |
| A question has no valid run in one arm | The question drops out of that paired comparison | List of dropped questions per comparison |

`unknown` and `undetermined` are never imputed as successes.

## 4. Cost basis

- **Primary:** all tasks, meaning every run of every question in the comparison, answerable and unanswerable alike. Restricting cost to correct answers would make a less accurate arm look cheaper.
- **Descriptive only:** tokens and cost among correctly answered runs. **This subset is biased by selection** (it is conditioned on an outcome that the arms change), so it is never used for the decision.
- **Scope:** query time only. The one-off cost of compiling and maintaining the Wiki is reported separately, with its scope limits stated, and is not added to per-query cost.
- **Tokens and dollars:** dollar cost depends on pricing and caching at run time. Tokens are the primary efficiency quantity, and cost in USD is reported beside them.

## 5. Uncertainty and the acceptable quality change

- **Effect estimates:** the mean paired difference per question, with an **interval from a question-level bootstrap**. Its level is pre-registered with the sample (an Owner parameter; §5's screening rule uses 90%). Resample questions with replacement, use a fixed seed, and record the number of resamples. Report intervals, not significance verdicts.
- **Acceptable quality change `Δ_Q`:** an **Owner-set parameter**, fixed before any Gate B data exist. No value is proposed here. It is expressed as a difference in the share of correct answers per question.
- **Reading the result.** No numbers are invented here.

| Quality interval (arm − comparator) | Cost interval | Conclusion |
|---|---|---|
| Lower bound above `−Δ_Q` | Entirely below 0 | Supports efficiency value at maintained or better quality |
| Lower bound above 0 | Any | Quality improvement (report cost alongside) |
| Contains `−Δ_Q` | Any | INCONCLUSIVE on "quality maintained" |
| Upper bound below `−Δ_Q` | Any | Quality loss: negative signal or trade-off, not success |

- The plan's earlier screening rule ("10pp plus a positive 90% CI") stays a screening signal only, as §5 already says. Power and the sample size are reviewed before the sample is frozen.

## 6. Guardrails (decided by the O2–O7 rulings; they can block a GO but are not success measures)

| Guardrail | Rule |
|---|---|
| F-008 | G-c review trigger: every confirmed `non_compliant` case goes to the pre-registered adverse-case review. `unknown` is reported, never counted as compliant. A finding that could reverse the main quality conclusion, a forged source, or systematic serious evidence violations blocks a success claim |
| Currentness | `wcc_gold` (all arms, current-state questions, dated gold) and `wcc_vault` (compiled arms only). Both are counted only from a validated manifest; without one they are provisional and carry no decision weight |
| Traceability | Metric D diagnostics: P0, the exploratory P1, L1/L2/L3 |
| Abstention | `proper_abstention` on unanswerable questions, reported per arm |

## 7. Can it be computed from the expected Gate B data?

| Quantity | Source | Computable? |
|---|---|---|
| Strict Correctness | Blind judge against the frozen gold, as in Round 1 | **Yes.** Same procedure as Round 1 |
| Tokens per run | The run record's final result event carries `usage` (input, cache creation, cache read, output tokens), assuming the Gate B harness keeps the Round 1 format | **Yes, if the harness format is kept**; to be confirmed in T3 calibration |
| Query cost per run | The same event carries `total_cost_usd` | **Yes**, with the pricing caveat in section 4 |
| Latency | The same event carries `duration_ms` and `duration_api_ms` | **Yes** |
| Tool calls | Count of `tool_use` blocks in the trace | **Yes** |
| Compile cost | Separate compile logs | Reported separately; not part of the primary measure |

**Real gaps, stated plainly:**

1. **`Δ_Q` is not set.** Without it, "quality maintained" cannot be concluded. Only "improved", "INCONCLUSIVE" or "loss" can.
2. **Gold currentness.** Current-state questions need a dated gold for `wcc_gold`, and for Strict Correctness where the expected answer may predate a later change. One benchmark v2 entry has a PROPOSED errata owned by another session, and v3 dated gold is not authorized. Until that is settled, current-state questions carry a stated caveat.
3. **Harness format.** The token and cost fields are confirmed only for the Round 1 harness. T3 calibration must confirm the Gate B harness writes the same fields.
4. **P1 positive path.** It cannot be `true` until an approved dated currentness reference exists (O2). P1 is exploratory and is not used for the conclusion.
