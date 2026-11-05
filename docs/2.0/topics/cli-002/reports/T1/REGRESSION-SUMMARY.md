# CLI-002 Round 2 — protocol v1.1 targeted regression

**Task:** CLI002-R2-GN-REVIEW-FOLLOWUP-01, answering Cloud review Major 3. **Date:** 2026-11-05. **Owner authorization:** "Docs and regression" (chat, 2026-11-05). No paid runs. Two fresh local annotator sessions.

**Result: INCONCLUSIVE.** Rule A PASS, rule C PASS, rule B INCONCLUSIVE (2 of 3 items matched, 1 split); 6 of 7 items matched overall. Under the pre-registered criteria this is not a FAIL, and not a PASS.

This file holds only aggregated, de-identified results. Case-level records, the plan, the expected outcomes and the comparison are in the approved private store.

## 1. Question

Do protocol v1.1 rules A, B and C, **as written**, lead annotators who never saw the Owner rulings to the outcomes those rulings decided? Agreement reached under v1.0 plus rulings does not show this.

## 2. Design

- **Packets:** the 2 calibration packets that held all 12 v1.0 disagreements. Byte-identical copies, file hashes checked against the sample record (6/6).
- **Protocol:** a snapshot of the public v1.1 files at commit `d48acce`.
- **Annotators:** 2 fresh sessions, started outside the repository. Each received only the packets, the v1.1 protocol files, an annotation template and a workspace README. Neither received the rulings, the disagreement review, the consensus file, earlier annotations, the sample record, Round 1 results, the plan or the expected outcomes.
- **Pre-registration:** the plan, the pass criteria and the expected outcome for each item were written and hashed before either annotator started. The comparison script was hashed afterwards, still before either started. A dry run gave PASS on the frozen consensus and 7 of 7 splits on the v1.0 annotators, which shows the script reproduces the known cases.
- **Scored items:** 7 fields that the three rules decide. Rule A: support kind when a superseded History entry carries an earlier-state fact (2 items). Rule B: equivalence judged from delivered text only (2 items), and partial support not filled in from undelivered text (1 item). Rule C: an answer that only restates the question's framing (2 items).
- **Outcome per item:** MATCH (both annotators gave the expected value, with the deciding event cited where required), SPLIT (one did), MISS (neither did), NOT-EXERCISED (the rule's object was not recorded). A rule PASSes only if all its items MATCH, FAILs on any MISS, and is otherwise INCONCLUSIVE. Overall: PASS only if all three rules PASS.
- **Risks recorded in advance:** medium for the two rule A items (the question asks how something evolved, which the rule's wording does not clearly cover) and for the rule B partial-support item (partly a case ruling, not only the rule text).

## 3. Preconditions

| Check | Result |
|---|---|
| Both annotation files validate (`aggregate.py --validate`): 2 records, 0 errors, protocol 1.1 | PASS (re-run by the topic session) |
| Workspace inputs unchanged after annotation | PASS (12/12 hashes) |
| Pre-registration files unchanged | PASS (3/3 hashes) |
| v1.0 consensus file unchanged | PASS |
| Isolation, checked from both transcripts | PASS. One start message each; file access limited to the workspace, their own scratch folder and the read-only vault; no messaging tool. One annotator noticed the other's folder appear in a directory listing and did not open it. Limitation, as in the v1.0 round: the app injected the titles of linked sessions (titles only, no content) into both contexts |

## 4. Results

| Rule | Items | MATCH | SPLIT | MISS | Rule verdict |
|---|---|---|---|---|---|
| A — superseded History entry as earlier-state support | 2 | 2 | 0 | 0 | PASS |
| B — delivered text only | 3 | 2 | 1 | 0 | INCONCLUSIVE |
| C — restating the question asserts nothing | 2 | 2 | 0 | 0 | PASS |
| **All** | **7** | **6** | **1** | **0** | **INCONCLUSIVE** |

- **The split item:** for a fact with three elements, of which the delivered text states one, one annotator recorded support as not delivered (as expected). The other recorded it as `unknown`. Neither recorded it as delivered. This item was flagged as medium risk before the run.
- **Contrast with v1.0** (same 7 items, the two original annotators): 0 MATCH, 7 SPLIT. Two annotators and two packets cannot estimate a rate. The contrast shows only that the v1.1 text removed most of the specific disagreements it was written for.
- **Not covered:** rule A's other branch (relying on a superseded entry for a current-state question) is not tested, because both packets ask a history question.

## 5. Observations outside the scored items (post hoc, not pre-registered)

These came out of the no-regression comparison with the v1.0 consensus. They are reported, not scored.

1. **The protocol's step 3 wording disagrees with the metric definition.** When an annotator proposes a candidate source and **rejects** it, both new annotators recorded `valid_source_reached = unknown`. They followed the protocol's step 3, which says "unknown" for any proposed candidate. [`METRICS.md`](METRICS.md) §3.4 says "unknown" only when the annotator would accept it. The consensus for that case was `false`. One wording fix, either text, would settle this. It is a contract wording change and needs Owner approval.
2. **F-008 rows for History entries.** Both annotators listed the superseded History entry used as support as a compiled-claim row for F-008. The consensus lists none. Rule A says the entry counts as support but not whether it gets an F-008 row. Both reported this as a protocol gap.
3. **Candidate proposals are not uniform.** One annotator proposed an extra candidate source for a dated-meeting fact in both packets, which turns `false` into `unknown` for that fact.
4. **Stable fields.** Across 14 required facts, all three (both new annotators and the consensus) were equal on `gold_path_hit`, `gold_path_opened`, read extent, `required_lines_delivered`, `answer_asserts`, `navigation_used_as_evidence` and `fact_verified` (14/14 each). `valid_source_reached` was 11/14, support delivered and support kind 13/14. Trace status and `wrong_current_claim` were equal for both runs.
5. **Protocol gaps reported** by both annotators, besides 1 and 2: whether a `## Sources` wikilink counts as a navigation edge; compiled record pages without claim anchors; a `version_check` conflict between METRICS §3.9 and protocol step 7; and how to judge the date criterion when the date is a separate required fact.

## 6. What this means

- **Verified:** rules A (earlier-state branch) and C reproduce the rulings on these cases, for two fresh annotators. All rule B equivalence items reproduced the ruling.
- **Not established:** that rule B's wording settles partial support. That rule A's current-state branch works. Any agreement rate.
- **Interpretation (labelled):** the remaining v1.1 ambiguity is in how partial and unproposed support are recorded, not in the three rules' core cases. A v1.2 wording revision covering observations 1–2 and the split item is a candidate. It would need Owner approval and its own small regression.
- v1.0 annotations, the Owner rulings and the consensus file are unchanged.
