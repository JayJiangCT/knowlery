# CLI-002 Round 2 — protocol v1.2 targeted regression: preregistration design

> **Change note, 2026-11-06 (task CLI002-R2-D-V12-CLOSURE-01). Status: PRE-REGISTERED, ANNOTATORS NOT YET STARTED.**
>
> - **Authorization.** The Owner approved O8 on 2026-11-06: at most 2 fresh isolated annotators, at most 3 packets, one round, no paid services ([approval](../../reviews/OWNER-APPROVAL-2026-11-06.md)). The rule decisions it depends on (O2–O7) were approved in scope the same day. The "NOT STARTED" banner below is the 2026-11-05 state.
> - **Frozen before any start.** The case list, the expected outcome per item, the comparison script, the verdict criteria and the input hashes were written and hashed in the approved private store. PREREG time: **2026-11-06T08:10:44Z**. Writing these did not involve any annotator.
> - **Packets (3).** The two calibration packets from the v1.1 regression, byte-identical, and **one invented synthetic packet for R-A3**. A read-only search of the ten calibration packets found no case where an answer relied on a superseded History entry for a current-state fact. The synthetic packet is built so that Rule A's current-state branch flips the support judgement.
> - **Items (11), by rule:**
>   - B: partial support (1).
>   - E: rejected-only candidate, and when to propose (3).
>   - A: earlier-state branch (2) and current-state branch (2).
>   - H: History entries as F-008 rows (2).
>   - D: date judged only under its own fact (1).
> - **Verdict.** Per item, rule and overall, as in section 4. MISS or SPLIT in rules A or H is flagged critical. Per the stop rule, a critical error that could reverse a main conclusion gets one explicitly scoped fix and **no second round**. Everything else is recorded as a limitation.
> - **Dry run.** Before the freeze, the comparison script reproduced the known v1.1 outcomes on the two calibration packets.
> - **R-A3 gap (§3).** Resolved by option (ii), an invented synthetic packet.

> **NOT STARTED.** No annotator, judge or other session has been started for this regression. Starting it needs a separate Owner approval of new private annotator sessions (Owner decision O-8). This file is the design only; the case list and expected outcomes are drafted in the approved private store and are **not yet hashed or frozen**.

**Task:** CLI002-R2-D-V12-CONTRACT-01, Cloud brief §6 step 5. **Date:** 2026-11-05. **Status:** PROPOSED.

## 1. Question

Do the v1.2 draft rules, **as written**, lead fresh annotators who never saw the Owner rulings or this design to the outcomes the rules intend, on the cases the v1.1 regression left open or never exercised?

It is not a rate estimate. A PASS shows that the text settles these cases for these annotators; nothing more.

## 2. Preconditions before any start

1. The Owner has decided every "changes pass/fail" row that a case depends on (packet O-1…O-7). A case whose rule is undecided is dropped or run against the option the Owner names; it is never graded against an assumed decision.
2. The v1.2 protocol text is final for the run and snapshotted with hashes.
3. The case list, the expected outcome per item and the comparison script are written and hashed **before** the first annotator starts. Expected outcomes are written by the topic session from the rules and Owner rulings; they are never written by an annotator.
4. The Owner approves the sessions (O-8).

## 3. Coverage (by rule and branch)

| Item | Rule / branch | Source of the case | Status of a usable case |
|---|---|---|---|
| R-B1 | Partial support, trace complete ⇒ `no` | The v1.1 split item, re-run under v1.2 text | Exists |
| R-B2 | Partial support, deciding text not readable ⇒ `unknown` | Needs a case with a persisted-output or paginated result | **Gap**: none identified; synthetic packet or omit |
| R-E1 | Rejected-only proposed candidate ⇒ L2 `false` | The post-hoc case from the v1.1 regression | Exists |
| R-E2 | When to propose a candidate (delivered text must state the value) | The dated-meeting fact where one annotator proposed an extra candidate | Exists |
| R-A1 | Rule A earlier-state branch inside an "how did it evolve" question | v1.1 items, re-run for no-regression | Exists |
| R-A3 | **Rule A current-state branch** | Needs a current-state question where a compiled-arm answer relied on a superseded History entry | **Gap**: neither v1.1 packet exercises it (both ask a history question). Owner choice below |
| R-H1 | History entry recorded as an F-008 row with `F008_HISTORY_ENTRY_SCOPE_OPEN` | The v1.1 packets (both annotators listed such a row) | Exists; depends on O-5 |
| R-D1 | Date judged only under its own required fact | The dated-meeting fact | Exists; depends on O-7 |
| R-W | `wcc_vault` complete-empty ⇒ `false`; incomplete ⇒ `unknown`; baseline ⇒ manifest `not_applicable` | Mechanical; already covered by synthetic tests | No annotator item. A judging pass is not part of this regression unless the Owner asks |

**Owner choice for the R-A3 gap (O-8):** (i) the topic session searches the other calibration packets for a usable case (read-only private access, no new run); (ii) build one invented synthetic packet with a trace in the Round 1 harness format; (iii) leave it untested and record it as a residual risk at freeze. Recommendation: (i), then (ii) if nothing qualifies. A synthetic packet tests the rule text as well as a real one, but not the real-trace reading difficulty.

## 4. Item outcome and verdict (same structure as v1.1, pre-registered)

- Per annotator per item: **MATCH** (expected value, and the deciding event cited where the item requires it), **MISMATCH**, **NOT-EXERCISED** (the rule's object was not recorded).
- Per item: both MATCH ⇒ MATCH; one MATCH, one MISMATCH ⇒ SPLIT; both MISMATCH ⇒ MISS; NOT-EXERCISED without MISMATCH ⇒ NOT-EXERCISED; NOT-EXERCISED with MISMATCH ⇒ SPLIT.
- Per rule: all items MATCH ⇒ PASS; any MISS ⇒ FAIL; otherwise INCONCLUSIVE.
- Overall: all rules PASS ⇒ PASS; any FAIL ⇒ FAIL; otherwise INCONCLUSIVE.
- **No-regression check (reported, not scored):** every field not targeted by a v1.2 change is compared with the frozen consensus. Fields that v1.2 intends to change (L2 on a rejected-only candidate, History F-008 rows) are compared with the v1.2 expectation instead, and listed.
- **Validity preconditions** (any failure ⇒ overall INCONCLUSIVE, run invalid): both files pass `aggregate_v12.py --validate`; inputs unchanged after annotation (hash check); pre-registration files unchanged; isolation holds from both transcripts.

## 5. Isolation

- Two fresh annotator sessions, working folder outside the repository, with no CLAUDE.md, memory folder or notes above it.
- They receive only: the packets, the v1.2 protocol snapshot, the v1.2 schema and validator, an annotation template and a workspace README.
- They never receive: Owner rulings, the disagreement review, the consensus, any earlier annotator file, the sample record, Round 1 results, this plan's private case list, the expected outcomes, the briefs.
- **Excluded as annotators:** this v1.2 contract session, the topic session, every earlier annotator and judge, and any session that has read private adjudication material (see the private contamination log).
- Known limitation carried over: the app may inject titles of linked sessions into a new session's context. Titles only; recorded as before.

## 6. Size and cost

At most two annotator sessions, at most three packets (two existing, plus one synthetic only if O-8 chooses it). No paid benchmark runs, no Round 1 rerun, no new model answers.

## 7. Outputs (when, and only when, it runs)

Private: plan freeze, hashes, case-level comparison, logs. Public: an aggregated, de-identified summary like [`REGRESSION-SUMMARY.md`](REGRESSION-SUMMARY.md), with the verdict PASS / FAIL / INCONCLUSIVE under this preregistration, labelled as Local Agent-reported and not independently verified by the Cloud Agent.
