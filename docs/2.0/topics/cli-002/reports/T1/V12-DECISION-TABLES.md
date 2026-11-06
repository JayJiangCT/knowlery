# CLI-002 Round 2 — Metric D v1.2 decision tables (candidate)

**Task:** CLI002-R2-D-V12-CONTRACT-01. **Date:** 2026-11-05. **Baseline:** `develop/2.0` at `b40bb91`.

**Status: PROPOSED.** Every rule here is a candidate for protocol v1.2 / schema `cli002-r2-t1/2`. Nothing is ACCEPTED, nothing is in use, and no existing file is changed: [`METRICS.md`](METRICS.md), [`METRICS-SCHEMA.json`](METRICS-SCHEMA.json), [`aggregate.py`](aggregate.py), the tests, the fixtures and both protocol versions stay as they are. Round 1 results, `wrong_current_claim`, the consensus annotation and the v1.1 regression are unchanged.

**How to read the "Class" column.**

- **Clarifies** — the row writes down what an existing ACCEPTED rule, Owner ruling or METRICS text already intends. It does not move any recorded value.
- **Changes pass/fail (needs Owner)** — the row can change a value that an annotator following the current text would record, or adds a new measured quantity. It needs an Owner decision before freeze. The packet [`V12-OWNER-DECISION-PACKET.md`](V12-OWNER-DECISION-PACKET.md) lists each one.

**Code and tests.** The candidate module is [`v1.2/aggregate_v12.py`](v1.2/aggregate_v12.py); its tests are [`v1.2/test_aggregate_v12.py`](v1.2/test_aggregate_v12.py) and its `--self-test`. The "Test" column names the test class or self-test line that covers the row. "Protocol" means the row is wording only and is covered by the planned regression ([`V12-REGRESSION-PLAN.md`](V12-REGRESSION-PLAN.md)), not by code.

## 1. Three-valued conjunction and denominators (Cloud brief §5B)

### 1.1 Truth table

Inputs are `true`, `false` or `unknown`. `not_applicable` is never an input; passing it is a programming error, not a value.

| Components | Conjunction | Class | Test |
|---|---|---|---|
| all `true` | `true` | Clarifies | `TriState.test_all_true_is_true` |
| at least one `false`, others anything | **`false`** | Changes pass/fail (needs Owner): [`METRIC-CONTRACT-CLARIFICATIONS.md`](METRIC-CONTRACT-CLARIFICATIONS.md) §1.2 rule 2 said any `unknown` gives `unknown`; both Cloud reviews say `false` wins | `TriState.test_false_and_unknown_is_false`, `test_false_wins_regardless_of_position` |
| no `false`, at least one `unknown` | `unknown` | Clarifies | `TriState.test_true_and_unknown_is_unknown`, `test_all_unknown_is_unknown` |
| no components | **error** (record invalid), never `true` | Changes pass/fail (needs Owner) | `TriState.test_empty_conjunction_is_an_error_not_true` |

The same table is used twice: per required fact (combining that fact's components), then per run (combining the facts).

### 1.2 What goes into each endpoint

| Endpoint | Per required fact | Per answerable run |
|---|---|---|
| **P0** (direct-source verified) | `fact_verified` ∧ `valid_source_reached` | ∧ over required facts |
| **P1** (evidence-validated, candidate) | `fact_verified` ∧ (`valid_source_reached` ∨ `compiled_reuse`) | ∧ over required facts |

`∨` is the three-valued "or": `true` if any `true`, `false` if all `false`, else `unknown`. `compiled_reuse = not_applicable` enters the "or" as `false` (there was no compiled path). Section 3 defines `compiled_reuse`. Test: `Endpoints.test_p0_run_values`, `test_p1_run_values`.

### 1.3 Missing data and invalid records

| Situation | Result | Class | Test |
|---|---|---|---|
| Answerable record with zero required facts | Validation error `Z1`; the run is not scored | Changes pass/fail (needs Owner). An exception list would need Owner approval | self-test `zero-facts-answerable`; `Endpoints.test_zero_required_facts_on_answerable_run_is_an_error` |
| A required field is missing or malformed | Schema error; `--summarize` refuses to run (exit 2). Never counted `false` | Clarifies (v1 already refuses on schema errors) | self-test `missing-fact-field` |
| A packet in the manifest has no record for an annotator | Manifest error; `--summarize` refuses. Not imputed | Clarifies | self-test `missing record => manifest error`, `missing record not imputed` |
| Unanswerable run | Excluded from P0 and P1; counted under `unanswerable_excluded` and `proper_abstention` | Clarifies ([PLAN.md](../../PLAN.md) §5) | `Endpoints.test_unanswerable_run_is_excluded` |
| Answerability not stated (v1 record whose `proper_abstention` is `unknown`) | Counted as `answerability_unknown`, outside both denominators, shown beside them | Clarifies | — (no v1 fixture has it; untested) |
| `proper_abstention` disagrees with `answerable` (v1.2) | Validation error `Z2` | Clarifies (protocol step 8) | self-test `abstention-mismatch` |

**Answerability of v1 records.** v1 records have no `answerable` field. Protocol step 8 sets `proper_abstention = not_applicable` exactly when the question is answerable, so v1.2 reads that as the inverse. Test: `Legacy.test_v1_answerability_derived_from_proper_abstention`.

### 1.4 Denominators

Both are printed, labelled, for every endpoint. Neither drops `unknown` runs silently, and no rate or threshold is computed.

| Name in output | Counts | Meaning |
|---|---|---|
| `denominator_answerable_total` | `true + false + unknown` | Every validly annotated answerable run |
| `denominator_determinate_only` | `true + false` | Runs whose value the trace settles |
| `pass_over_answerable_total` | `true / answerable_total` | Conservative: `unknown` counts against |
| `pass_over_determinate_only` | `true / determinate_only` | Optimistic: assumes `unknown` runs behave like the rest |

The gap between the two is the uncertainty that `unknown` creates. Test: `SummaryCounts.test_p0_counts_and_both_denominators`.

## 2. WCC split (Cloud brief §5C)

### 2.1 The two measures

| | `wcc_gold` | `wcc_vault` |
|---|---|---|
| Question | Does the answer contradict the independently adjudicated current state at the reference's `as_of` date? | Does the answer present as current a claim the **frozen compiled vault** marks superseded or disputed? |
| Reference | Dated gold: `as_of`, state kind, supporting evidence, supersession check, uncertainty | List built by a fixed rule from the frozen compiled vault, with its own id and version, captured **before** judging |
| Arms | All | Compiled arms only |
| Judge gets | Only the gold reference | Only the vault list |
| What `false` means | No contradiction with the dated gold | No conflict with the vault's own markers. **Never** means the answer is current |
| Legacy `wrong_current_claim` | Not mapped. Kept as a separate legacy count | Not mapped |

Class: changes pass/fail (needs Owner) — these are new measured fields (Owner decision O-3).

**Counting scope.** The candidate summarizer counts `wcc_gold` and `wcc_vault` over every validly annotated run, answerable or not (an abstaining answer can still present a superseded claim as current). Counting answerable runs only is an Owner option under O-3.

### 2.2 Values

| Situation | `wcc_vault` | `wcc_gold` | Rule | Test |
|---|---|---|---|---|
| Arm has no compiled governance structure (baseline) | `not_applicable`, applied from the arm manifest | judged normally | `W4`, manifest check | `Wcc.test_baseline_packet_with_judged_wcc_vault_is_a_manifest_error` |
| Compiled arm, reference complete and versioned, **empty**, no violating claim | **`false`** (not `not_applicable`) | — | `W2` | `Wcc.test_complete_empty_compiled_reference_can_be_false` (fixture SYN02) |
| Compiled arm, reference complete, answer presents a listed superseded/disputed claim as current | `true` | — | `W2` | fixture SYN03, SYN07 |
| Reference should exist but is absent | `unknown` · `REFERENCE_MISSING` | `unknown` · `REFERENCE_MISSING` | `W3` | self-test `wcc-absent-reference-wrong-reason` |
| Reference built but incomplete | `unknown` · `REFERENCE_INCOMPLETE` | same | `W3` | `Wcc.test_incomplete_reference_is_unknown_not_false` |
| Reference version differs from the one frozen for this packet | `unknown` · `REFERENCE_VERSION_MISMATCH`; and a manifest error if the recorded version differs from the manifest | same | `W3`, manifest check | `Wcc.test_reference_version_differing_from_manifest_is_an_error` |
| `true`/`false` without a complete, versioned reference | Validation error | Validation error | `W2` | `Wcc.test_true_needs_complete_versioned_reference` |
| `not_applicable` on a compiled-arm packet, or with a reference attached | Error | not allowed | `W4`, manifest check | `Wcc.test_compiled_packet_with_not_applicable_is_a_manifest_error`, self-test `wcc-vault-na-with-reference` |
| Gold not checked for later supersession | — | `unknown` · `GOLD_NOT_CURRENTNESS_CHECKED` | `W5` | `Wcc.test_gold_without_currentness_check_is_unknown` |

### 2.3 Who sets `not_applicable`

Annotators and judges never see the run's arm (protocol §1). If a judge chose `not_applicable` because a packet lacked a vault list, the packet itself would reveal the arm. **Candidate rule:** the `wcc_vault` pass is run only on compiled-arm packets, so a judge in that pass never decides applicability. The topic session writes `not_applicable` into baseline-arm records from a packet manifest (`arm_kind`). `--summarize --manifest` rejects a baseline record that carries a judged `wcc_vault` and a compiled record that carries `not_applicable`. Within the compiled arms, blinding between them is unaffected. Class: changes pass/fail (needs Owner, part of O-3).

**Historical note (fact, public level).** In T1-W, the vault-reference judging condition used lists built from the compiled vault for baseline-arm runs too. Under this table those verdicts would be `not_applicable`; they stay as recorded in their own report and are not re-labelled.

### 2.4 Not settled here

- Whether `wcc_gold` applies to questions that ask only about an earlier state (no current-state component). The candidate schema gives `wcc_gold` no `not_applicable`; such a question would get `unknown` with `REFERENCE_MISSING` unless the Owner adds a scope rule (O-4).
- The minimum content of a dated gold reference (O-4). This is the v3 gold specification, which is not authorized.

## 3. Compiled-verification reuse, F-008 and History (Cloud brief §5A, §5D)

### 3.1 Four different things

| Concept | What establishes it | Unit | What it does **not** show |
|---|---|---|---|
| `valid_source_reached` (L2) | Delivered content of the gold path or a pre-adjudicated accepted equivalent that states the fact | required fact | That the agent chose to check it, or that the source is current |
| `f008` (KF v1.0 §7.0) | The agent read the claim's first vault-file Source, **or** a `source-checked` event at the listed version and a current digest match apply | relied-on compiled claim | That the Source states the fact, or that the claim is current. It is procedural compliance |
| `compiled_reuse` (P1 candidate) | All of: a `source-checked` event at the listed version; a digest comparison **observed in the trace** at query time that matched; currentness **established by an approved basis** as of a date; a claim position valid for the question's time scope | required fact | That the fact is externally true. The admissible currentness bases are an Owner decision (O-2) |
| `wcc_gold` / `wcc_vault` | Section 2 | run | — |

No one of these substitutes for another. In particular, `f008 = compliant` is **not** an input to `compiled_reuse`. Test: `Endpoints.test_f008_compliant_alone_does_not_make_p1_true` (fixture SYN06: first Source read, `f008 = compliant`, P1 `unknown`); self-test `f008-compliant-claimed-as-reuse` rejects a record that sets the P1 path from F-008 alone.

### 3.2 `compiled_reuse` derivation

Applied in order; the first matching row decides. `false` rows come before `unknown` rows, so a definite failure is never hidden by a missing observation.

| # | Condition | Value · reason |
|---|---|---|
| 1 | Answer does not rely on a compiled claim for this fact | `not_applicable` |
| 2 | Reliance unclear | `unknown` · `F008_USE_UNCLEAR` |
| 3 | Claim is `#disputed` | `false` |
| 4 | Superseded History entry, question asks the current state (Rule A) | `false` |
| 5 | No `source-checked` event, or event at another version | `false` |
| 6 | Digest comparison observed and stale | `false` |
| 7 | Currentness established as not current | `false` |
| 8 | Claim position or time scope unknown | `unknown` · `SCOPE_OR_QUALIFIER_UNCLEAR` |
| 9 | Event state not determined | `unknown` · `F008_HISTORY_NOT_DETERMINED` |
| 10 | Digest comparison not observed in the trace | `unknown` · `F008_DIGEST_STEP_NOT_OBSERVED` |
| 11 | Digest comparison state unknown | `unknown` · `EVIDENCE_PATH_NOT_OBSERVED` |
| 12 | Currentness not established | `unknown` · `CURRENTNESS_NOT_ESTABLISHED` |
| 13 | Otherwise | `true` |

Class: changes pass/fail (needs Owner) — new candidate measure (O-1, O-2). Test: class `CompiledReuse` (10 cases).

**A digest match alone never establishes currentness.** It shows the cited Source is the version the claim was checked against. It does not show that no later document superseded the claim (alignment review §3). Row 12 keeps such a fact `unknown`. Test: `CompiledReuse.test_digest_match_alone_does_not_establish_currentness`.

### 3.3 Old traces

| Trace kind | `compiled_reuse` | Why | Test |
|---|---|---|---|
| Round 1 and the existing D calibration (v1 records) | not recorded; P1 treats the compiled path as `unknown` when support involved a compiled claim, `false` when support was source-only | No agent could compute or compare a digest; the step is unobservable. Nothing is inferred | `Legacy.test_v1_compiled_support_gives_p1_unknown_not_true`, `test_v1_source_only_support_gives_p1_equal_p0` |
| A future harness without a digest tool | Rows 10–12 make it `unknown` | Same | `CompiledReuse.test_digest_match_without_observed_step_is_unknown` |

Consequence: on every existing trace, P1 is `true` exactly where P0 is `true`. P1 can differ from P0 only on traces from a harness that exposes the digest step and an approved currentness basis.

### 3.4 F-008 and `## History` entries

KF v1.0 facts that bear on this (quoted in substance, not reinterpreted):

- §7.0: the F-008 rule applies "before a claim is given as an answer"; a Query workflow stops at `## Current` (tier 3); `## History` is tier 4.
- §9.2: a superseded claim is still a claim. It lives in `## History`, keeps its anchor, and its line names the successor.
- §7.1: the History line format carries `src:` after the supersession note. KF does not say whether that `src:` is the original claim's support or the source of the supersession.

So KF leaves open (a) whether a superseded History entry relied on for an earlier-state answer is a claim "given as an answer" under F-008, and (b) if so, what its first vault-file Source is.

| Case | Candidate v1.2 handling | Class | Test |
|---|---|---|---|
| History entry used as support for an earlier-state question | Listed as a `compiled_claims` row with `claim_position = history_superseded`; `f008 = unknown` · `F008_HISTORY_ENTRY_SCOPE_OPEN` | Changes pass/fail (needs Owner): both v1.1-regression annotators recorded such a row with a decided F-008 value, the consensus recorded no row. This keeps the row visible without deciding KF | self-test `history-row-f008-decided`; fixture SYN07 |
| History entry relied on for a current-state question | Same row and `f008` value; and per Rule A it is not support, `compiled_reuse = false`, `wcc_vault = true` if the vault list has it | Clarifies (Owner ruling R1, protocol v1.1 Rule A) except the `wcc_vault` wording, which depends on O-3 | `CompiledReuse.test_rule_a_current_branch_superseded_entry_is_false` |
| `#disputed` claim in `## Current` | Normal F-008 row (it is in tier 3) | Clarifies | — |

**Escalation, not resolution.** The `F008_HISTORY_ENTRY_SCOPE_OPEN` code exists so that this protocol does not decide a KF question. Resolving it belongs to KF governance (O-5).

### 3.5 F-008 as a guardrail

The Cloud brief asks for decision logic before thresholds. Options, none chosen:

| Option | Logic | Effect |
|---|---|---|
| G-a Reported only | Counts of `compliant` / `non_compliant` / `unknown` per compiled arm, beside the primary | Cannot stop a GO |
| G-b Decision-blocking | Gate B cannot be GO for a compiled arm whose answers rely on claims recorded `non_compliant`, unless a pre-registered review of those cases accepts them | `unknown` is never treated as `compliant`; how many `non_compliant` cases block is a threshold, so not set here |
| G-c Review trigger | Any `non_compliant` case goes to a pre-registered adverse-case review; the review outcome is reported, the gate is decided on the primary | Middle ground |

Recommendation in the packet (O-6): G-b or G-c, decided before any Gate B data exist. `unknown` share is always reported.

## 4. Adjudication ambiguities (Cloud brief §5E)

| # | Ambiguity | Candidate v1.2 rule | Class | Covered by |
|---|---|---|---|---|
| 1 | **Partial evidence**: delivered text states only some elements of a multi-element required fact | Trace complete and delivered text readable: `support_delivered = no`, `support_kind = none`. `unknown` only when the deciding text was not delivered in readable form (`PERSISTED_OUTPUT_NOT_IN_TRACE`, `PAGINATED_RESULT`, `TOOL_ERROR`) or the elements cannot be judged (`SCOPE_OR_QUALIFIER_UNCLEAR`). `answer_asserts` stays a separate judgement (`partial` is allowed there) | **Changes pass/fail (needs Owner).** It writes down an existing Owner ruling, but the v1.1 regression showed that one annotator following the v1.1 text recorded `unknown` here, so the text does move an outcome | Protocol; regression items R-B1, R-B2 |
| 2a | **Pre-adjudicated** accepted / rejected equivalent | Accepted: can make L2 `true`. Rejected: never counts, never re-proposed | Clarifies (METRICS §3.4) | — |
| 2b | **Annotator-proposed** candidate decided `accept` or `unsure` | L2 `unknown` · `EQUIVALENCE_NOT_ADJUDICATED` | Clarifies (METRICS §3.4) | fixture SYN02 |
| 2c | Annotator-proposed candidate decided `reject`, and no other live candidate | L2 **`false`**, basis `none` | **Changes pass/fail (needs Owner).** METRICS §3.4 already says this; protocol v1.1 step 3 says `unknown` for any proposal, and both regression annotators followed step 3. v1.2 step 3 adopts the METRICS wording; rule `E1` enforces it | self-test `rejected-only-unknown`; fixture SYN09; regression R-E1 |
| 2d | Owner-ruled `unsure` candidates (three in the calibration set) | Stay `unsure`; L2 stays `unknown` | Clarifies (Owner ruling). Not changed by v1.2 | — |
| 2e | When to propose a candidate at all | Propose only a note whose **delivered** text states the fact's value; a note that only mentions the topic is not a candidate | **Changes pass/fail (needs Owner)**: one regression annotator proposed an extra candidate, which turned `false` into `unknown` | Protocol; regression R-E2 |
| 3a | **Rule A, earlier-state branch** | Superseded History entry counts as compiled support | Clarifies (R1; regression PASS on two items) | `CompiledReuse.test_rule_a_historical_branch_superseded_entry_can_be_true` |
| 3b | **Rule A, current-state branch** | Not support; `support_delivered` from that entry alone is `no`; P1 path `false`; `wcc_vault = true` when listed | Clarifies (R1) but **never regressed** | `CompiledReuse.test_rule_a_current_branch_superseded_entry_is_false`; regression R-A3 |
| 3c | Question asks how something evolved (both states) | Judge each required fact by the state it describes: a fact about an earlier state takes branch 3a | **Changes pass/fail (needs Owner)**: flagged as medium risk before the v1.1 regression | Protocol; regression R-A1 |
| 4 | **`## Sources` wikilinks** as navigation edges | For graph `read_from_edge`, a `## Sources` wikilink in delivered content is a link. Naming a Sources entry as support without its content delivered is `navigation_used_as_evidence = true` (GR-001) | Clarifies (METRICS §3.10 "a link in delivered content"; matches the consensus). Diagnostic fields only | Protocol |
| 5 | **Pages without claim anchors** (Records) | No `compiled_claims` row (F-008 is defined per claim). Record text used as support: `support_kind` = **open** between `source` and `compiled_claim`; it is never a valid source unless pre-adjudicated | **Changes pass/fail (needs Owner / KF).** KF names Records as evidence that Knowledge pages cite, but a compiled vault's Records are compile output. The choice moves `support_kind` and therefore the P1 path | Protocol; O-5 |
| 6 | **`version_check`** conflict: METRICS §3.9 ("a cited version exists but the trace shows no check" ⇒ `unverified`) vs protocol step 7 (`not_checked` only for a first-Source read on behalf of a claim that lists a version) | Step 7 governs: `not_checked` only when the read is a claim's first Source and the claim's Sources line lists a version; `not_applicable` otherwise | **Changes pass/fail (needs Owner)** for `read.state` (diagnostic). No effect on P0 or P1 | Protocol |
| 7 | **Dates**: a date that is its own required fact vs a date attached to another fact | Judge the date criterion of fact *Fi* only against the date in *Fi*'s own gold entry. A date that is a separate required fact *Fj* is judged only under *Fj*. Rule C still applies: restating the question's framing asserts nothing | **Changes pass/fail (needs Owner)**: can turn `partial` into `yes` on facts that share a date with another fact | Protocol; regression R-D1 |

## 5. Summary of classes

| Class | Rows |
|---|---|
| Clarifies existing intent | 1.1 rows 1 and 3; 1.3 except zero facts; 1.4; 2a; 2b; 2d; 3a; 3b (code), 4; History row for current-state question (except `wcc_vault` wording) |
| Changes pass/fail (needs Owner) | 1.1 false-wins and empty conjunction; zero-facts rule; WCC split and applicability (§2); `compiled_reuse` and P1 (§3.2); History F-008 row (§3.4); F-008 guardrail role (§3.5); ambiguities 1, 2c, 2e, 3c, 5, 6, 7 |
