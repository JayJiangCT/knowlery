# CLI-002 Round 2 — Metric D v1.2 contract: handoff report

> **Publication note (added 2026-11-06, Cloud review m2).** This handoff describes the sub-session's working tree **before** the topic session committed it. Its "HEAD `b40bb91`" and "nothing committed" lines are that historical state. The files were published in commit `530d9e6f5d7a4b9d685bf4e1af3b5f490e2acf9f`, which the Cloud Agent reviewed. The text below is unchanged. Follow-up work: [`V12-OWNER-DECISIONS-RESOLUTION.md`](V12-OWNER-DECISIONS-RESOLUTION.md).

**Task:** CLI002-R2-D-V12-CONTRACT-01 ([Cloud task brief](../../reviews/D-V12-TASK-BRIEF-2026-11-05.md)). **Date:** 2026-11-05. **Executed by:** a local sub-session started by the CLI-002 Round 2 topic session. **Stopped at:** the Owner checkpoint (Cloud brief §6 step 3). Nothing committed.

**Verdict on contract readiness only: CONDITIONAL GO** — the candidate is complete enough for the Owner to decide on, and its deterministic parts pass. It is **not** ready to freeze. Conditions: the Owner decisions O-1, O-3, O-6, O-7 (and O-2/O-4/O-5 as they apply), the v1.2 regression (not started), and an independent Cloud review ([packet §3](V12-OWNER-DECISION-PACKET.md)). This is not a verdict on Gate B, which stays NOT AUTHORIZED.

## 1. Repository state

| Item | Value |
|---|---|
| Branch | `develop/2.0` |
| HEAD at start and at end | `b40bb91b94ab8775c6b16a0d06b6fc0275a64719` (unchanged; nothing committed) |
| Freeze manifest of existing contract files | 36/36 OK at start and at end |
| Pre-existing working-tree changes (not this task's) | `STATUS.md` modified; three review files and `tasks/D-V12/` untracked. Present before this task started; untouched |

## 2. Files

All new, all under `reports/T1/`, all **uncommitted**:

| File | Purpose |
|---|---|
| [`V12-CONTRACT-PROPOSAL.md`](V12-CONTRACT-PROPOSAL.md) | P0 vs P1 (and L3-only reference) side by side; recommendation (a); preregistration implications; divergence table between the two reviews |
| [`V12-DECISION-TABLES.md`](V12-DECISION-TABLES.md) | Tri-state and denominators; WCC; compiled reuse, F-008 and History; seven ambiguities; each row "clarifies" or "changes pass/fail" |
| [`V12-REGRESSION-PLAN.md`](V12-REGRESSION-PLAN.md) | Preregistration design, **NOT STARTED** |
| [`V12-OWNER-DECISION-PACKET.md`](V12-OWNER-DECISION-PACKET.md) | Decisions O-1…O-8, ready vs unproven, exact freeze gate |
| `V12-REPORT.md` | This file |
| [`v1.2/`](v1.2/) | `README.md`, `METRICS-SCHEMA-v1.2.json`, `build_schema_v12.py`, `ADJUDICATION-PROTOCOL-v1.2-DRAFT.md`, `aggregate_v12.py`, `test_aggregate_v12.py`, `fixtures/` (generator, 9 valid records, 13 invalid cases, manifest, expected summary) |

No existing file was edited. The candidate module imports `../aggregate.py` read-only. Private files (approved store, not in the repository): contamination log, draft regression case list, command logs.

## 3. Primary endpoint: recommendation and its limits

- **Recommendation: option (a).** P0 (`fact_verified ∧ valid_source_reached`, every required fact) stays Gate B's preregistered primary. P1 (`fact_verified ∧ (valid_source_reached ∨ compiled_reuse)`) is pre-registered as a secondary measure. The Owner decides (O-1).
- **Main reason:** P1's compiled path needs an observed digest comparison and an approved currentness basis. Neither exists in any current trace or in the specified Gate B harness, so P1 would be mostly `unknown` in the compiled arms.
- **Limits of P0, stated plainly:** it under-credits valid reuse of verified compiled knowledge, which is the Wiki-first product goal. That is why P1 is reported beside it.
- **Limits of P1:** it is asymmetric across arms (baseline P1 ≡ P0), and its currentness basis is undefined until O-2. F-008 compliance is deliberately not an input.
- **No false claim of compiled-reuse validation:** on all existing traces P1 is never `true` where P0 is not. A test proves it (`Legacy.test_v1_compiled_support_gives_p1_unknown_not_true`).

## 4. Owner decisions needed (summary)

O-1 primary endpoint; O-2 currentness basis for P1; O-3 WCC split implementation; O-4 dated gold and `wcc_gold` scope; O-5 KF questions (History rows under F-008, their first Source, Records) — routed to KF governance; O-6 F-008 guardrail role; O-7 adjudication rules that change pass/fail; O-8 regression sessions and the Rule A current-state gap. Full options in the [packet](V12-OWNER-DECISION-PACKET.md).

## 5. Tested vs untested

| Tested (synthetic, deterministic) | Not tested |
|---|---|
| F+U ⇒ F; T+U ⇒ U; all T ⇒ T; all U ⇒ U; empty conjunction ⇒ error; `not_applicable` rejected as a tri-state input | Protocol wording for ambiguities 1, 2e, 3c, 6, 7 (needs the regression) |
| Missing record ⇒ manifest error, not imputed; missing field ⇒ schema error; `--summarize` refuses on either | Rule A current-state branch with real annotators |
| Zero required facts on an answerable record ⇒ error | `answerability_unknown` path (no fixture has it) |
| WCC: `not_applicable` from manifest, judged baseline ⇒ error, compiled `not_applicable` ⇒ error, complete-empty ⇒ `false`, absent/incomplete ⇒ `unknown` with reason, version mismatch ⇒ error, unchecked gold ⇒ `unknown`, annotator placeholder validates | A real `wcc_vault` reference build rule (only its required properties are specified) |
| `compiled_reuse` derivation (10 cases) incl. F-008-compliant ⇒ not P1 `true` | Any admissible currentness basis (O-2 open) |
| History row ⇒ `f008 = unknown` (`F008_HISTORY_ENTRY_SCOPE_OPEN`) | KF answer to that question |
| Legacy `wrong_current_claim` passed through, never mapped; v1 records validate (16 synthetic); v1 answerability derivation | Independent reproduction by the Cloud Agent |
| P0/P1 run and fact values on 9 records match hand-derived expectations; both denominators; output byte-identical across runs and input order | — |
| v1.2 schema keeps every unchanged v1 definition; reason codes are a superset; schema rebuilds byte-identically from v1 | — |

**Defect found and fixed during the work:** the first version of `tri_and` accepted `not_applicable` silently; the unit test `test_not_applicable_is_not_a_tri_state_input` caught it, and inputs are now checked.

**Private compatibility check (counts only):** the frozen consensus annotation file validates under the v1.2 dispatcher: 10 records, 0 errors; its hash still matches its own freeze file. No case-level output was produced or kept.

## 6. Commands and exit codes

Run from `docs/2.0/topics/cli-002` (criterion 1) or `docs/2.0/topics/cli-002/reports/T1` (the rest). Python 3.12.8. Logs are in the approved private store.

| # | Command | Exit | Result |
|---|---|---|---|
| 1 | `shasum -a 256 -c <private freeze manifest>` | 0 | 36/36 OK |
| 2a | `python3 -I -B aggregate.py --self-test` | 0 | `SELF-TEST PASS 24/24` |
| 2b | `python3 -I -B -m unittest discover -s . -p 'test_*.py'` | 0 | `Ran 17 tests` OK (count unchanged; `v1.2/` has no `__init__.py` so it is not collected) |
| 2c | `python3 -I -B aggregate.py --validate fixtures/annotations/*.jsonl` | 0 | `VALIDATE PASS 16 records, 0 errors` |
| 3 | `python3 -I -B v1.2/aggregate_v12.py --self-test` (run twice, outputs compared with `cmp`) | 0, 0; `cmp` 0 | `SELF-TEST-V12 PASS 30/30`, byte-identical |
| 3b | `python3 -I -B -m unittest discover -s v1.2 -p 'test_*.py'` | 0 | `Ran 43 tests` OK |
| 3c | `python3 -I -B v1.2/aggregate_v12.py --validate fixtures/annotations/*.jsonl v1.2/fixtures/valid-v12.jsonl` | 0 | `VALIDATE-V12 PASS 25 records, 0 errors` (16 v1 + 9 v1.2) |
| 3d | `python3 -I -B v1.2/fixtures/generate_fixtures_v12.py`, then hash check of every new file | 0 | 0 files changed |
| 3e | `python3 -I -B v1.2/build_schema_v12.py METRICS-SCHEMA.json <tmp>` then `cmp` | 0 | identical to `v1.2/METRICS-SCHEMA-v1.2.json` |
| 3f | `python3 -I -B v1.2/aggregate_v12.py --validate <private consensus file>` | 0 | 10 records, 0 errors (counts only) |
| 4 | privacy grep (section 7) | — | 7 hits, all pre-existing |
| 5 | `git status --short` | 0 | section 8 |

**Development iterations before the final runs** (not in the table above): the first `--validate` of the generated fixtures failed (exit 1; `--summarize` exit 2) because the fixture generator gave `f008` an `events` property the schema does not allow; the generator was fixed. One unit test failed once (`test_not_applicable_is_not_a_tri_state_input`), exposing the `tri_and` defect in section 5; the code was fixed. All results in the table are from the final runs.

## 7. Privacy audit (criterion 4)

Grep over the whole topic folder for: absolute home-directory paths; 64-hex strings; question, packet, judging-packet and run id patterns; people's names and source titles known from the private material; vault slugs and claim anchors from the calibration cases; annotator ids of the regression sessions.

| Where | Hits | Disposition |
|---|---|---|
| Files written by this task (`V12-*.md`, `v1.2/`) | **0** | Clean |
| `PLAN.md` (tracked, committed earlier) | 2 question ids; 2 64-hex values (a document hash and a hash quoted in the plan's evidence note) | Pre-existing, read-only for this task; not edited. Reported to the topic session |
| `STATUS.md` (modified by the topic session before this task) | 2 annotator ids of the v1.1 regression | Pre-existing, owned by the topic session; not edited |
| `reviews/GATE-NOW-CLOUD-REVIEW.md` (tracked) | 1 absolute home-directory path | Pre-existing, read-only; not edited |

The only full commit SHA in the new files is the public baseline `b40bb91…` (40 hex). Synthetic fixtures use an invented apiary vault, `SYN` packet ids, and obviously fake reference versions (`v-fake-0001`, `g-fake-0001`). The new public files contain counts only, no private paths, hashes, ids, quotes or names. The benchmark errata entry owned by another session is neither touched nor named.

## 8. Git status (criterion 5)

Changes from this task are only under `reports/T1/`: four `V12-*.md` files, this report and the `v1.2/` folder, all untracked. The other entries (`STATUS.md` modified; three review files and `tasks/D-V12/` untracked) existed before this task started and belong to the topic session. Nothing was committed or pushed; no branch was switched.

## 9. Material risks

1. **Wording risk.** Five ambiguity rules are untested with annotators; the v1.1 regression showed that text, not rulings, drove the remaining split.
2. **Rule A current-state branch** has never been exercised by annotators; there may be no existing calibration case for it.
3. **P1 may stay unmeasurable** if the Gate B harness cannot show a digest step or no currentness basis is approved; then it is reported as `unknown`, by design.
4. **KF dependency.** History rows and Records under F-008 need KF governance; until then their F-008 value stays `unknown`, which widens the `unknown` share for compiled arms.
5. **Contamination.** This session read Owner rulings, the v1.1 case-level comparison and T1-W results; it must not annotate, judge or write grading expectations for itself in the v1.2 regression (private contamination log).
6. **Self-reported.** Every result here is Local Agent-reported; the Cloud Agent has not reproduced it. The public synthetic tests are reproducible with the commands in section 6.

## Verification

| Done criterion (brief §6) | Result |
|---|---|
| 1. Freeze manifest, 36 lines OK | **PASS** — 36/36 OK, exit 0 |
| 2. Existing suite unchanged and passing: self-test 24/24; unittest OK; validate 16 records, 0 errors | **PASS** — 24/24; 17 tests OK; 16 records 0 errors; all exit 0 |
| 3. New candidate tests pass with one documented command, exit 0, twice with identical output | **PASS** — `python3 -I -B v1.2/aggregate_v12.py --self-test`: 30/30, exit 0 twice, `cmp` identical. Unit tests: 43 OK |
| 4. Privacy grep over the whole topic folder | **PASS for this task's files** (0 hits). 7 hits in three pre-existing files, listed in section 7 with disposition; none edited |
| 5. `git status --short` shows changes only under `reports/T1/`; nothing committed | **PASS for this task's changes** (all under `reports/T1/`, untracked). Pre-existing topic-session entries listed in section 8. HEAD unchanged |

Stop conditions (brief §8): none triggered. No freeze line failed; no private material entered the public checkout from this task; no rule here changes KF v1.0 (KF questions are escalated as O-5); no check needed a new session, paid run or wider access; no frozen result was rewritten; the P1 asymmetry has a stated remedy under the recommended option (a).
