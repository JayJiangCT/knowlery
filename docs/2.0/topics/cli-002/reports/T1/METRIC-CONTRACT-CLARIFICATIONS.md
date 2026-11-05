# CLI-002 Round 2 — D metric contract clarifications

**Task:** CLI002-R2-GN-REVIEW-FOLLOWUP-01, answering the Cloud Agent's Gate NOW review ([../../reviews/GATE-NOW-CLOUD-REVIEW.md](../../reviews/GATE-NOW-CLOUD-REVIEW.md), Majors 1–2, Minor 2). **Date:** 2026-11-05.

**Status: PROPOSED.** Nothing here is ACCEPTED. CLI-002 stays OPEN. This file does not change [`METRICS.md`](METRICS.md), [`METRICS-SCHEMA.json`](METRICS-SCHEMA.json), [`aggregate.py`](aggregate.py), the tests, or either protocol version. Where a change to those is proposed, it is listed as a schema implication and waits for Owner approval. If approved, schema, protocol, code and tests change together, and the v1.0/v1.1 records are kept.

It changes no Round 1 score, verdict, gold label, E-1 decision, or KF v1.0 rule.

## 1. Outcome roles for Gate B (Cloud Major 1)

### 1.1 Why `fact_verified` cannot stand alone

`fact_verified` (L3, [`METRICS.md`](METRICS.md) §3.5) is true when the answer states the required fact correctly **and** text stating it was delivered to the agent. That text may be a compiled claim. So this combination is valid by design:

| L1 `gold_path_hit` | L2 `valid_source_reached` | L3 `fact_verified` | F-008 |
|---|---|---|---|
| true | false | true | `non_compliant` |

Here the agent answered correctly from a compiled claim and never read a valid source, though KF F-008 says it should have. `fact_verified` measures **answer support**, not source authority and not trustworthiness. It is never reported alone, and it is not renamed "trustworthy answer rate".

### 1.2 Proposed roles

The roles below sort the existing fields. No new field is added and no score is weighted.

| Role | Measure | Unit | Definition (existing fields) |
|---|---|---|---|
| **Primary outcome** | Source-verified complete answer | answerable run | Every required fact has `fact_verified = true` **and** `valid_source_reached = true` |
| Primary components (always reported beside it) | Fact-level answer support | required fact | `fact_verified` |
| | Valid source reached | required fact | `valid_source_reached` |
| **Guardrails** (an arm that worsens any of these is flagged, whatever the primary shows) | F-008 compliance | relied-on compiled claim | `compiled_claims[].f008`, counts of `compliant` / `non_compliant` / `unknown` |
| | Currentness errors | run | `wcc_gold` for all arms; `wcc_vault` for compiled arms only (section 2) |
| | Independent strict correctness | run | A separate strict verdict by a judge who has not annotated, as in Round 1 |
| | Abstention safety | unanswerable run | `proper_abstention` |
| | Navigation used as evidence | required fact | `navigation_used_as_evidence` |
| **Diagnostics** (explain, never decide) | Retrieval path | required fact | `gold_path_hit`, `gold_path_opened`, `read_extent`, `required_lines_delivered`, joint `level_patterns` |
| | Read quality | read | `evidence_reads[].state`, truncation share |
| | Graph use, cost | run | graph fields, tool calls, tokens, cost |
| | Unknowns | any | `unknown` counts by reason code |

**Rules for the primary outcome:**

1. It is the plan's own primary endpoint ([PLAN.md](../../PLAN.md) §5: "complete *and* source-verified correct answer"), written in D fields. It is a stated conjunction of two existing fields. It is not a weighted composite, so it does not add an arbitrary score. **Whether this reading is right is an Owner decision** (section 5, item 1).
2. Any `unknown` in a component makes the run `unknown`, never `false`. The `unknown` count is reported beside the rate.
3. Non-answerable questions are excluded from it, as the plan says. They are covered by the abstention guardrail.
4. `gold_path_hit` is not part of it. An equivalent source can bypass the exact gold path, so the levels do not nest.

**Why F-008 is a guardrail and not part of the primary outcome.** F-008 requires reading a compiled claim's first source, unless a recorded source check at the current version applies. Reading that source does not show the source states the fact. So an F-008-compliant answer can still lack a valid source, and the reverse can also happen. Folding F-008 into the primary outcome would make it a different measure from the one the plan names. The alternative reading (count a fact as source-verified when `f008 = compliant` through the recorded-check exception, even without a valid source reached) is listed as an Owner decision (section 5, item 2). In Round 1 traces that exception path can never be observed, because no agent could compare digests.

**Asymmetry between arms.** The baseline arm has no compiled pages. Its F-008 values are all `not_applicable`, and it can reach the primary outcome only by reading a valid source. A compiled arm can also answer from compiled claims, which shows up in `fact_verified` and F-008 but not in the primary outcome. Reports must say this next to any arm comparison.

## 2. Splitting `wrong_current_claim` (Cloud Major 2)

### 2.1 What T1-W showed (aggregated)

- 8 runs, two blind conditions, two fresh judges each. Agreement inside each condition: 8/8.
- With only the packet (the benchmark's expected answer as reference), judges matched Round 1 on 5 of 8. With a list of the claims the compiled vault itself marks superseded, they matched on 7 of 8. The misses were different runs.
- On these 8 runs, counting a run as wrong if either condition said so reproduces Round 1 8/8.

**That Round 1 wcc equals the union of the two measures is a hypothesis.** It holds for these 8 runs. It has not been tested on the rest of Round 1. It is not a finding about Round 1 as a whole.

### 2.2 Proposed definitions

| | `wcc_gold` | `wcc_vault` |
|---|---|---|
| Question it answers | Does the answer contradict independently adjudicated knowledge at a stated date? | Does the answer present as current a claim the compiled vault itself marks superseded or disputed? |
| What it measures | External currentness correctness | Consistency with the wiki's own recorded knowledge state |
| Reference given to the judge | The dated gold current state: `as_of`, `state_kind`, supporting evidence, `supersession_checked`, uncertainty | A list, built mechanically from the frozen compiled vault, of superseded History entries and disputed claims relevant to the question, with the compile freeze as its date |
| The judge must not get | The vault's supersession list | The gold answer |
| Applies to | All arms | Compiled arms only. Baseline arm: `not_applicable` |
| Values | `true` / `false` / `unknown` | `true` / `false` / `unknown` / `not_applicable` |
| Does not count | Describing an earlier value as the earlier state | Same |

Each measure is judged in its own pass, with only its own reference. T1-W showed that a judge holding both references reproduces the union.

### 2.3 Reference requirements

- **`wcc_gold`** needs a gold that has been checked for currentness. Every current-state question needs an explicit `as_of` date, and its gold must be checked against later supersessions in the source material (Cloud Q3).
  - Benchmark v2 has no `as_of` field. One v2 expected answer may predate a later supersession; a PROPOSED errata entry waits for the Owner.
  - So `wcc_gold` against benchmark v2 can be reported only as "against the v2 expected answer", with that known issue stated. It is not a clean currentness measure until the reference meets these requirements.
- **`wcc_vault`** needs the list to be built by a fixed rule from the frozen compiled vault, with a manifest, before judging. A wiki can be internally consistent and still out of date. So `wcc_vault = false` never means the answer is current.

### 2.4 G0/G1 applicability

- **`wcc_gold`** is symmetric across arms, because the reference does not depend on the arm.
- **`wcc_vault`** is not symmetric. The baseline arm has no compiled governance structure. It must not be pooled with, or compared directly against, compiled arms.
- **T1-W limitation.** In T1-W, three of the four positive runs came from the baseline arm. Their vault-list verdicts were judged against a list built from the **compiled** vault, which those agents never saw. Those three verdicts measure agreement with the compiled vault's markers, not a property of the baseline arm. Under the proposed split they would be `wcc_vault = not_applicable`.
- **Consequence.** If the gold is stale and `wcc_vault` does not apply, a baseline-arm currentness error against the source material's own later records is not measured at all. This is a reason the currentness gold requirements in 2.3 come before Gate B.

### 2.5 Relation to Round 1 and to protocol v1.1

- Round 1 wcc stays as published. It is not replaced, re-labelled or re-split. Neither new measure is compared numerically with it.
- Protocol v1.1 rule A says that relying on a superseded History entry for a current-state question is recorded as `wrong_current_claim`. Under the split, that case is `wcc_vault = true`. It is also `wcc_gold = true` only if the dated gold agrees. The rule A wording would change with the schema (2.6).
- For a future History-loading experiment (Cloud Q1), `wcc_vault` must not be the only primary measure. It should be reported with `wcc_gold` against a dated gold, and with historical-answer correctness, so that moving History out of pages cannot look better only because fewer superseded markers are visible.

### 2.6 Schema implications (PROPOSED; not implemented)

The current schema, code and tests keep the single field `run.wrong_current_claim`. Splitting it only in narrative reports would be inconsistent, so no Round 2 report uses `wcc_gold` or `wcc_vault` as measured values until this is implemented.

If the Owner approves, these change together:

1. **Schema:** `run.wcc_gold` and `run.wcc_vault`, each an observation with `value`, `reason`, `events`, `note`, plus `reference_id` (the id and hash of the reference version used). `wcc_vault` allows `not_applicable`. Bump `schema_version` from `cli002-r2-t1/1` to `cli002-r2-t1/2`.
2. **Old records:** v1 records keep `wrong_current_claim`. The aggregator reports it as a legacy field, never mapped into either new field.
3. **Validation rules:** `wcc_vault = not_applicable` exactly when the packet has no compiled-vault reference list; `reference_id` required when the value is not `not_applicable`; new reason codes `GOLD_NOT_CURRENTNESS_CHECKED` and `REFERENCE_MISSING`.
4. **Protocol (v1.2):** two separate judging passes with separate materials; rule A rewritten for the split.
5. **Aggregator and tests:** separate counts per measure and arm, `not_applicable` excluded from rates; synthetic fixtures for each value, including a baseline-arm record.

## 3. F-008: interpretation and limits

- **What it measures.** Whether the agent followed KF v1.0 §7.0 for a compiled claim it relied on: it read that claim's first vault-file Source, or a recorded source check at the current version applies. It is procedural compliance.
- **What it does not measure.** It does not show the source states the fact, that the claim is true, or that the answer is current. Those are `fact_verified`, `valid_source_reached` and the wcc measures.
- **Where it applies.** Only to compiled claims whose text was delivered and that the answer relied on. It is `not_applicable` for the baseline arm.
- **Round 1 limit.** No Round 1 agent could compute or compare a digest. So the recorded-check exception is never observable, and F-008 can only be `compliant` through an actual read, or `non_compliant` / `unknown`.
- **Ambiguities kept as `unknown`, not resolved:** a matching digest the agent never compared; claim order versus Sources order for "first"; and whether a Record or `derived` entry counts as the first vault-file Source. These are KF questions. This contract does not reinterpret KF v1.0.

## 4. Three meanings of "frozen" (Cloud Minor 2)

| Term | Means | Does not mean |
|---|---|---|
| **Hash-frozen** | A digest of the content was recorded. Anyone can check that the current content matches it | The file cannot be changed. It also says nothing about the content before the digest was recorded |
| **Write-protected** | Filesystem permissions block ordinary writes | Integrity. The owner can change permissions, and a protected file can still differ from an earlier version |
| **Historically verified** | Evidence shows the content is unchanged since a named earlier freeze point (for example, it matches a manifest written at that point) | Write protection |

Applied to Round 2 artifact classes (from [../T0/REPORT.md](../T0/REPORT.md) and the D review):

| Artifact class | Hash-frozen | Write-protected | Historically verified |
|---|---|---|---|
| Baseline vault | yes | yes | yes, to its freeze manifest |
| Compiled vault, errata, Round 1 answers, setup logs | yes | no | yes, to their freeze manifests |
| Scores | yes | no | partly: they match expected values that exist only in the T0 task brief, not in a freeze-time manifest |
| Benchmark v2 | yes | yes | yes, to its freeze record |
| E-1 archive | yes | three of four files | yes, to the recorded archive hash |
| Round 1 tool traces | yes, from 2026-11-05 | no | **no**: no manifest existed earlier, so changes before 2026-11-05 cannot be ruled out |
| D consensus annotation file | yes | no | n/a (created in Round 2) |
| D calibration packets | yes | yes | yes, to the sample record written at build time |

From now on, reports say which of the three they mean. "Frozen" alone means hash-frozen.

## 5. Owner decisions this contract needs before Gate B

1. Adopt the primary outcome in 1.2 as the plan's primary endpoint, or choose another reading.
2. Whether the F-008 recorded-check exception may substitute for `valid_source_reached` in the primary outcome. Recommendation: no for Gate B, and report how often it would have applied.
3. Approve the wcc split for implementation (2.6), or keep one field and state which reference it uses.
4. Currentness gold requirements for any reference used by `wcc_gold` (2.3). This links to the PROPOSED v2 errata entry and to v3 authoring, which is not authorized.
5. Protocol v1.1: see [REGRESSION-SUMMARY.md](REGRESSION-SUMMARY.md).

**What would change these recommendations:** if the regression shows that rule wording, not the rulings, drives disagreement, the protocol text needs revising before any role is fixed. If the Owner reads the plan's endpoint as including F-008, the primary outcome would gain a third component, and the arm asymmetry in 1.2 would grow.
