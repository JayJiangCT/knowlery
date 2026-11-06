# CLI-002 Round 2 — Metric D v1.2 contract proposal

**Task:** CLI002-R2-D-V12-CONTRACT-01 ([Cloud task brief](../../reviews/D-V12-TASK-BRIEF-2026-11-05.md)). **Date:** 2026-11-05. **Baseline:** `develop/2.0` at `b40bb91`.

**Status: PROPOSED.** This is a candidate for the Owner to decide. It is not ACCEPTED, it does not freeze Metric D, and it does not authorize Gate B. The Owner–Cloud alignment of 2026-11-05 is a **principle-level** agreement ([alignment review](../../reviews/OWNER-ALIGNMENT-REVIEW-2026-11-05.md) §1.3); it is not acceptance of any endpoint below. No existing contract file, Round 1 result, KF v1.0 rule or historical score is changed.

**Companion files:** [`V12-DECISION-TABLES.md`](V12-DECISION-TABLES.md) (exact rules), [`V12-OWNER-DECISION-PACKET.md`](V12-OWNER-DECISION-PACKET.md) (decisions), [`V12-REGRESSION-PLAN.md`](V12-REGRESSION-PLAN.md) (not started), [`v1.2/`](v1.2/) (candidate schema, protocol draft, code, synthetic tests).

## 1. Recommendation

**Recommend option (a):** keep **P0** as Gate B's preregistered primary endpoint, and pre-register **P1** as a separately reported secondary measure of compiled-verification reuse. Preserve all P0 diagnostics. Do not amend the Gate B primary to P1 now.

**Why, in causal order:**

1. P1 can be `true` through the compiled path only when three things are observed: a `source-checked` event at the listed Source version, a digest comparison the agent actually performed at query time, and currentness established as of a date by an approved basis ([tables §3.2](V12-DECISION-TABLES.md)).
2. No existing trace shows a digest comparison. Round 1 agents had no tool for it ([METRICS.md](METRICS.md) §4). So on every existing trace, P1 equals P0 wherever P0 is `true`, and is `unknown` (not `true`) where an answer rested on a compiled claim. The synthetic tests prove this mechanically (`Legacy.test_v1_compiled_support_gives_p1_unknown_not_true`).
3. Gate B's harness has not been specified to expose a digest step, and no admissible "currentness basis" has been approved (O-2). Until both exist, P1 would be mostly `unknown` in the compiled arms. A primary endpoint that is mostly `unknown` cannot answer the Gate B question.
4. P0 is computable today from existing fields, has calibration evidence, and treats arms the same way.
5. The product principle (Wiki-first reuse) is still measured: P1 sits beside P0, and the `P1_minus_P0_runs` table shows exactly where reuse would have changed the outcome.

**What would change this recommendation to (b):** (i) the Owner approves a currentness basis (O-2); (ii) the Gate B harness is shown, on a calibration run, to expose the digest step in the trace; and (iii) a blind-scoring procedure for the compiled path exists that does not reveal the arm beyond what traces already reveal. If all three hold before Gate B is frozen, an amendment making P1 primary becomes feasible and should be considered.

**Stop-condition check (brief §8, "P1 would make B arms non-comparable without a defensible remedy").** Under (a), the primary (P0) is arm-symmetric, so the stop condition is not triggered. Under (b), P1 is asymmetric by construction (section 3); the remedy is to compare compiled arms with each other on P1 and to compare against the baseline only on P0. That remedy is stated, but whether it is "defensible" for the Gate B hypothesis is the Owner's call (O-1).

## 2. Candidate endpoints side by side (Cloud brief §5A)

| | **P0 — direct-source verified** | **P1 — evidence-validated complete answer (candidate)** | P-L3 — answer supported (reference only, not proposed) |
|---|---|---|---|
| Definition per required fact | `fact_verified` ∧ `valid_source_reached` | `fact_verified` ∧ (`valid_source_reached` ∨ `compiled_reuse`) | `fact_verified` |
| Grain | Required fact, then answerable run (∧ over facts) | Same | Same |
| Run passes when | every required fact passes | every required fact passes | every required fact passes |
| Denominator | Answerable runs; reported twice: answerable total and determinate only ([tables §1.4](V12-DECISION-TABLES.md)) | Same | Same |
| `unknown` policy | Three-valued: any `false` ⇒ `false`; else any `unknown` ⇒ `unknown`; never imputed | Same, plus `compiled_reuse` is `unknown` whenever a condition is unobserved | Same |
| Unanswerable questions | Excluded; abstention endpoint separate | Same | Same |
| Zero required facts on an answerable item | Invalid record | Same | Same |
| Arm comparability | Symmetric: every arm passes only by reaching a valid source | **Asymmetric**: baseline has no compiled path, so its P1 equals its P0; compiled arms can gain through reuse | Symmetric, but rewards unverifiable compiled answers |
| Judge / annotator access | Trace, packet, gold, pre-adjudicated equivalents (existing protocol) | P0's access, plus the claim's page History and Sources, the trace's digest step, and the approved currentness reference with its `as_of` | Existing protocol |
| Minimum evidence for `true` | Delivered gold quote or a pre-adjudicated equivalent's stated location, and the answer asserts the fact on all six criteria | P0's, **or** delivered compiled claim + `source-checked` event at listed version + observed matching digest comparison + established currentness + claim position valid for the time scope | Delivered text from any vault file stating the fact |
| Computable on existing traces | Yes | Only where it equals P0; otherwise `unknown` | Yes |
| What it measures | The agent received a valid source for every required fact, and the answer states each fact with delivered support | The answer is correct and each fact has an auditable, currently valid evidence path | The answer is supported by something it read |
| What it does not measure | Valid reuse of verified compiled knowledge (it penalizes it) | External truth; it depends on the approved currentness basis | Source authority or trustworthiness ([clarifications §1.1](METRIC-CONTRACT-CLARIFICATIONS.md)) |
| Main risk | Under-credits the Wiki-first product goal | Mostly `unknown` until the harness and currentness basis exist; extra trust criteria need Owner definition | Rewards answers that rely on unchecked compiled claims |

Strict correctness (the independent judge's verdict), currentness (`wcc_gold`, `wcc_vault`) and cost (tokens, latency, tool calls) are reported **separately** for every option. None of them is folded into P0 or P1, and no threshold is set.

**Why P1 is not `fact_verified ∧ (valid_source_reached ∨ f008 = compliant)`.** F-008 is procedural: reading a claim's first Source does not show the Source states the fact, and a recorded source check with a matching digest does not show that no newer document superseded the claim. The candidate code does not read `f008` when deriving `compiled_reuse`, and a test proves an F-008-compliant answer does not become P1 `true` (`Endpoints.test_f008_compliant_alone_does_not_make_p1_true`).

## 3. Preregistration implications

| Topic | Under (a) — recommended | Under (b) |
|---|---|---|
| Plan §5 primary endpoint wording | Unchanged in meaning: P0 is the operational form of "complete and source-verified correct answer" | Needs an explicit amendment to [PLAN.md](../../PLAN.md) §5, approved by the Owner before any Gate B data exist |
| "under appropriate F-008 checks" | F-008 is a guardrail beside P0 (O-6) | Same; F-008 still not a P1 input |
| Hypothesis G1 vs G0 | Tested on P0 | Must be restated: on P1, G0 ≡ P0 by construction, so a G1 advantage on P1 partly reflects the definition, not only retrieval. Arm contrasts G1-A vs G1-B are unaffected |
| Harness requirements | None new for the primary. Exposing a digest step is optional, and only enables P1 | A digest step must be observable in traces; validated in calibration before freeze |
| Gold / references | Dated gold needed for `wcc_gold` (O-4); not for P0 | Also needed as a currentness basis for P1 (O-2) |
| Blind scoring | Unchanged | The compiled-path components reveal that a run is a compiled arm. Traces already reveal this in practice; P1 adds a currentness reference that must be judged in its own pass, separate from `wcc_gold` |
| Sample size / power | Unchanged | P1's `unknown` share must be estimated in calibration before the sample is frozen |
| Reporting | P0 primary; P1 and `P1_minus_P0_runs` secondary; all P0 diagnostics | P1 primary; P0 kept as a co-primary diagnostic |

## 4. How the earlier review and the alignment review differ

The Owner asked for an explicit record. Rule applied: where the two reviews conflict on goals or recommendations, the later alignment governs; technical facts follow the repository and verifiable records. Agreements are listed too, so the differences are not overstated.

| # | Topic | Earlier review ([GN follow-up](../../reviews/GN-FOLLOWUP-CLOUD-REVIEW-2026-11-05.md)) | Alignment review ([2026-11-05](../../reviews/OWNER-ALIGNMENT-REVIEW-2026-11-05.md)) | Kind | What this proposal does |
|---|---|---|---|---|---|
| 1 | Primary outcome | §3.1: per-fact L2∧L3 is "in principle usable" as the primary; CONDITIONAL GO | D1, §3: L2∧L3 stays a useful direct-source measure but "cannot be assumed to be the sole general success measure"; a compiled-reuse path should be proposed | **Divergence** (goal) | Alignment governs: P1 is defined and pre-registered beside P0. Technical facts (no digest step observable) lead to recommending P0 as primary for Gate B; the Owner decides (O-1) |
| 2 | Three-valued conjunction | §3.1: `false` wins over `unknown` | §3 item 1: same | Agreement | Implemented and tested |
| 3 | F-008 role | §3.2: should not substitute for L2; recommended a mandatory decision guardrail | D1/D2: F-008 cannot stand in for evidence validity; exact F-008 compatibility is still OPEN; KF governance needed for any change | Partial divergence (the earlier review leaned to "blocking"; the alignment leaves the role open) | Options G-a/G-b/G-c laid out; recommendation G-b or G-c; Owner decides (O-6) |
| 4 | WCC split | §3.3: GO FOR PROPOSAL; fix `not_applicable` vs `unknown` | D3: support the split; `wcc_vault` not a cross-arm primary; empty-but-complete ≠ unavailable | Agreement, with added emphasis on not using `wcc_vault` across arms | Implemented as candidate; `not_applicable` applied from the manifest |
| 5 | Rejected equivalent candidate | §3.4 item 2: rejected ⇒ `false` when no other live candidate | D5: close the ambiguity | Agreement | Rule `E1`; ambiguity 2c |
| 6 | Partial support | §3.4 item 1: `no` when record complete; `unknown` only if unobservable | D5: close the ambiguity | Agreement | Ambiguity 1 |
| 7 | Scope of next step | §6: stop expanding scope; finish D-01…D-05 | D4: lifecycle and logical archive are a separate topic; D5: bounded v1.2 first | Agreement; the alignment adds an explicit future topic | Lifecycle work is out of scope here |
| 8 | Product framing of trusted answers | Implicit: trusted ≈ source reached this run | D1: Wiki-first; a raw-file read per query is not the general definition of a trusted answer | **Divergence** (framing) | Recorded; it motivates P1 but does not by itself change the Gate B endpoint |
| 9 | Status of agreements | Recommendations, not ACCEPTED | Principle-level ALIGNED / PROPOSED; not ACCEPTED | Agreement | Every rule here is PROPOSED |

## 5. What is implemented as candidate, and what is not

| Item | Candidate file | State |
|---|---|---|
| Three-valued logic, P0, P1, denominators | `v1.2/aggregate_v12.py` | Implemented; synthetic tests pass |
| WCC split, references, applicability | `v1.2/METRICS-SCHEMA-v1.2.json`, `aggregate_v12.py` | Implemented; synthetic tests pass |
| `compiled_reuse` (P1 path) | same | Implemented as a candidate shape; the admissible currentness basis is a free-text placeholder pending O-2 |
| History rows for F-008 | same | Implemented as `unknown` · `F008_HISTORY_ENTRY_SCOPE_OPEN` pending KF governance |
| Protocol wording (ambiguities 1–7) | `v1.2/ADJUDICATION-PROTOCOL-v1.2-DRAFT.md` | Draft; not regressed |
| v1 records | read by the v1.2 dispatcher with the v1 schema and rules | All 16 synthetic v1 records still validate |

Owner authorization covered contract-revision preparation and deterministic tests. Per the topic session's instruction, the candidate code was written as **new, versioned files** only; nothing in the existing contract was edited. Whether this candidate becomes the contract is the Owner checkpoint (Cloud brief §6 step 3), where this task stops.
