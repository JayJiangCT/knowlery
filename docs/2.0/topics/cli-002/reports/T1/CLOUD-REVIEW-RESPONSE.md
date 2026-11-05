# CLI-002 Round 2 — response to the Gate NOW Cloud review

**Task:** CLI002-R2-GN-REVIEW-FOLLOWUP-01. **Review:** [../../reviews/GATE-NOW-CLOUD-REVIEW.md](../../reviews/GATE-NOW-CLOUD-REVIEW.md) (CONDITIONAL GO, reviewed commit `d48acce`). **Date:** 2026-11-05. **Authorization:** Owner, "Docs and regression" (chat, 2026-11-05).

**Status:** nothing here is ACCEPTED. CLI-002 stays OPEN. No paid run, no next gate, and no change to Round 1 artifacts, scores, E-1, KF v1.0, the v1.0 protocol, the annotations or the Owner rulings.

## 1. Dispositions

| Finding | Disposition | What was done | Where |
|---|---|---|---|
| **Major 1** — `fact_verified` is not trustworthy-answer accuracy | **Accepted; clarified, no field change** | Measures sorted into primary outcome, guardrails and diagnostics. The primary outcome is the plan's own endpoint written in existing fields: every required fact has `fact_verified` and `valid_source_reached` true. It is a stated conjunction, not a weighted score. F-008, currentness, independent strict correctness, abstention and navigation-as-evidence are guardrails. `fact_verified` is never reported alone and is not renamed. The F-008 exception and the baseline-arm asymmetry are stated, with the open choices for the Owner | [METRIC-CONTRACT-CLARIFICATIONS.md](METRIC-CONTRACT-CLARIFICATIONS.md) §1, §5 |
| **Major 2** — split `wrong_current_claim` by reference | **Accepted as a proposal; documented, not implemented** | `wcc_gold` and `wcc_vault` defined, with reference requirements, arm applicability and reporting rules. `wcc_vault` is compiled-arms only and never the sole primary measure. The schema implications are listed. The schema, code and tests keep the single field until the Owner approves a contract revision, so no report uses the split fields as measured values. The "union" claim is restated as a hypothesis that holds on the 8 T1-W runs. The T1-W limit is recorded: three baseline-arm verdicts used the compiled vault's list | [METRIC-CONTRACT-CLARIFICATIONS.md](METRIC-CONTRACT-CLARIFICATIONS.md) §2; [../../ROUND-2-SUMMARY.md](../../ROUND-2-SUMMARY.md) |
| **Major 3** — protocol v1.1 needs targeted validation | **Done: INCONCLUSIVE** | Pre-registered regression on the 2 disagreement packets with 2 fresh annotators. Rules A and C PASS. Rule B INCONCLUSIVE (6 of 7 items matched, 1 split on partial support). Three wording issues were found outside the scored items. v1.0 records are unchanged | [REGRESSION-SUMMARY.md](REGRESSION-SUMMARY.md) |
| **Minor 1** — T0 status wording | **Fixed** | T0 row now reads 10 of 11 checks PASS, Round 1 traces NEEDS-EVIDENCE, with the new baseline only detecting later changes. Marked as a correction; the T0 report is unchanged | [../../STATUS.md](../../STATUS.md) |
| **Minor 2** — meaning of "frozen" | **Fixed** | Hash-frozen, write-protected and historically verified are defined and applied per artifact class. Loose uses in the Round 2 summary are corrected and marked | [METRIC-CONTRACT-CLARIFICATIONS.md](METRIC-CONTRACT-CLARIFICATIONS.md) §4; [../../ROUND-2-SUMMARY.md](../../ROUND-2-SUMMARY.md) |

## 2. Acceptance criteria (review §5)

| # | Criterion | Result | Evidence |
|---|---|---|---|
| 1 | Every Major finding has an explicit disposition and rationale | PASS | Section 1 |
| 2 | D outcome and guardrail definitions are internally consistent | PASS | Clarifications §1.2. Each existing field has exactly one role; the primary outcome uses only fields defined in METRICS.md |
| 3 | WCC reference rules and G0/G1 applicability are documented | PASS | Clarifications §2.2–2.4 |
| 4 | Revised code/schema has reproducible tests with recorded results | NOT APPLICABLE (no code or schema revised). Existing checks re-run: `python3 -I -B -m unittest discover -s . -p 'test_*.py'` → 17 tests OK, exit 0. `python3 -I -B aggregate.py --self-test` → 24/24, exit 0. Fixture validation → 16 records, 0 errors | Section 3 |
| 5 | Protocol v1.0 and original calibration artifacts unchanged | PASS | `git diff d48acce` is empty for every contract file and fixture. The v1.0 consensus hash verifies. The regression used copies |
| 6 | v1.1 regression has a clear PASS / FAIL / INCONCLUSIVE outcome | PASS: the outcome is INCONCLUSIVE, under criteria fixed before the run | [REGRESSION-SUMMARY.md](REGRESSION-SUMMARY.md) |
| 7 | T0 correctly reports 10 PASS / 1 NEEDS-EVIDENCE | PASS | STATUS.md T0 row; the summary already said this |
| 8 | Public-content safety check finds no private research material | PASS | Section 3 |
| 9 | No paid work or next-gate execution without authorization | PASS | Only two local annotator sessions, which the Owner authorized |
| 10 | Final handoff distinguishes verified results, reported claims and open questions | PASS | Section 4 |

## 3. Checks run

| Command (from `reports/T1/` unless noted) | Result |
|---|---|
| `python3 -I -B -m unittest discover -s . -p 'test_*.py'` | 17 tests OK, exit 0 |
| `python3 -I -B aggregate.py --self-test` | SELF-TEST PASS 24/24, exit 0 |
| `python3 -I -B aggregate.py --validate fixtures/annotations/annotator-1.jsonl fixtures/annotations/annotator-2.jsonl` | VALIDATE PASS 16 records, 0 errors |
| `git diff --quiet d48acce -- <contract files and fixtures>` | no differences |
| Regression annotation files, `aggregate.py --validate` (private) | 2 records, 0 errors, each |
| Pre-registration and input hashes (private) | 3/3 and 12/12 OK |
| Regression comparison, run twice (private) | byte-identical |
| Privacy grep over the whole topic folder: user paths, 64-hex digests, question and packet ids, private names and vault paths | no hits in any new or changed file. Pre-existing hits, all in files committed at `d48acce`, none private: the plan's own document hash, the protocol naming the sample-record file, invented fixture anchors, and the review's own sentence about paths |
| `git status --short` | changes only inside `docs/2.0/topics/cli-002/` |

### Changed public files (committed with Owner approval on 2026-11-05; see `git log` for this file)

- Modified: `docs/2.0/topics/cli-002/STATUS.md`, `docs/2.0/topics/cli-002/ROUND-2-SUMMARY.md`.
- New: `docs/2.0/topics/cli-002/reports/T1/CLOUD-REVIEW-RESPONSE.md`, `.../reports/T1/METRIC-CONTRACT-CLARIFICATIONS.md`, `.../reports/T1/REGRESSION-SUMMARY.md`.
- New, left untracked by the previous topic session: `docs/2.0/topics/cli-002/reviews/GATE-NOW-CLOUD-REVIEW.md`, `docs/2.0/topics/cli-002/tasks/GN-FOLLOWUP/BRIEF.md`.

## 4. Verified, reported, open

**Verified by this session**
- The checks in section 3.
- The regression preconditions: validation, unchanged inputs, isolation from the transcripts.
- The pre-registered comparison and its verdict.

**Reported by other sessions, not re-verified here**
- T0 archive hashes.
- T1-W judge verdicts.
- The v1.0 annotation isolation. The rows above rest on their reports and on hashes this session re-checked.
- The Cloud Agent has not independently checked any of the private material.

**Open questions and their effect on Gate B**

| Open question | Effect on Gate B |
|---|---|
| Primary outcome reading, and whether the F-008 exception may stand in for a valid source | Decides what B's primary endpoint counts |
| The wcc split: approve the implementation (schema `cli002-r2-t1/2`, protocol v1.2, tests), or keep one field with a stated reference | No currentness guardrail can be reported cleanly until this is settled |
| Currentness gold: `as_of` and supersession-checked references; the PROPOSED v2 errata entry | `wcc_gold` against v2 carries one known issue |
| Protocol v1.2 wording: rejected-candidate value (protocol step 3 vs METRICS §3.4), F-008 rows for History entries, partial support, `## Sources` links as edges, the `version_check` conflict | Rule B and these fields are not yet settled by the text alone. A small regression should follow any revision |
| Rule A's current-state branch has not been tested | Matters for the History-loading experiment (Cloud Q1) |

## 5. Recommendation

**CONDITIONAL GO** to continue Gate B preparation. **Not GO** to freeze the D contract.

- **What is ready for the Owner to consider now:**
  - the outcome roles;
  - the wcc split proposal;
  - the "frozen" terms;
  - the corrected status wording.
- **What is not ready:** the D contract as a whole. It is not ready for Owner approval as a frozen Gate B evaluation contract while the regression is INCONCLUSIVE and the wcc split exists only on paper.
- **Shortest path to ready, each step needing Owner approval:**
  1. Approve or reject the wcc split.
  2. Make the v1.2 wording and schema revision together, with tests.
  3. Run one more small pre-registered regression covering rule B's partial-support case and rule A's current-state branch.

This response does not approve anything on the Owner's behalf.
