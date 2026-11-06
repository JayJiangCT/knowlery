# CLI-002 topic status

Topic session: the Knowlery repo main session that ran Round 1 orchestration. It authored benchmark v2, so it must not author v3 questions, act as an annotator, or act as an independent grader.

## Earlier material (kept where it is)

| Round | What | Where |
|---|---|---|
| 1 | G0 baseline | G0 experiment folder (private store) |
| 1 | Benchmark v2, v2 errata | benchmark folder (private store) |
| 1 | G1 compile | G1 experiment folder (private store) |
| 1 | Runs, scores, findings, E-1 | G1 eval results folder (private store) |
| 1 | Status summary | `docs/2.0/VALIDATION.md` |

## Round 2

- **Plan:** [PLAN.md](PLAN.md) (Revision 2).
- **Owner approvals:** Gate NOW (T0 and T1) only, approved on 2026-11-04. T1-W approved as a deviation on 2026-11-05.
- **Gate NOW summary:** [ROUND-2-SUMMARY.md](ROUND-2-SUMMARY.md), ready for Owner review 2026-11-05, then for the Cloud Agent. Gates PILOT, v3, B, C and A need separate Owner approval and are not started.
- **Private root:** `PRIVATE_ROOT` is the approved folder outside the repo. Full task briefs live there, because they name private paths and hashes. No private content goes into this folder.
- **Deviation from plan:** public outputs go in `reports/<id>/` in this folder, not in `evals/experiments/cli-002-round2/`, following this repo's topic layout.

| Id | Task | State | Session | Branch | Report |
|---|---|---|---|---|---|
| T0 | Archive and privacy preflight | done, verified 2026-11-04: 10 of 11 checks PASS; Round 1 tool traces NEEDS-EVIDENCE (no prior manifest). The new private trace baseline only detects changes after 2026-11-05; it does not prove integrity since Round 1. *(Corrected 2026-11-05 after Cloud review Minor 1; the earlier text said "11 artifacts VERIFIED".)* | r2-t0-preflight | none (this checkout) | `reports/T0/REPORT.md` |
| T1 | D metric contract, annotation protocol and packets | done, verified 2026-11-04: self-test 24/24 deterministic, 17 unit tests OK, 10 packets, privacy grep clean | r2-t1-metrics | none (this checkout) | `reports/T1/REPORT.md` |
| T1-A1 | D annotator 1 (fresh, independent) | done 2026-11-05: validates, 10 records; isolation checked from transcript | r2-d-annotator-1 | | private |
| T1-A2 | D annotator 2 (fresh, independent) | done 2026-11-05: validates, 10 records; isolation checked from transcript | r2-d-annotator-2 | | private |
| T1-R | Disagreement review (Owner spot-check) | done 2026-11-05: packet hashes 30/30; aggregate deterministic; 12 disagreements in 2 of 10 packets decided by Owner (5 rulings); consensus file validates and is frozen; Round 1 join done (private); protocol revised to v1.1 (rules A–C, v1.0 kept) | | | |
| T1-W | Wrong-current-claim judging check: build blinded materials (Owner-approved deviation 2026-11-05, outside Gate NOW) | done, verified 2026-11-05: 8 packets (4 positives, no shortfall), leaked-word scan 1 allowed hit (answer's own wording), manifest 18/18 OK with key excluded, 5 context lists non-empty | t1-w-build-wcc-judging-m | none (writes only to the private store) | private; stub `tasks/T1-W/BRIEF.md` |
| T1-W-J | T1-W judges A1, A2 (packet only), B1, B2 (packet + context list), fresh and blind | done 2026-11-05: 4 x 8 verdicts; isolation checked; each condition 8/8 internally consistent; verdict follows the reference given (results private) | r2-w-judge-a1, r2-w-judge-a2, r2-w-judge-b1, r2-w-judge-b2 | | private |
| GN-FOLLOWUP | Cloud review follow-up: response, metric contract clarifications, v1.1 targeted regression (Owner authorized docs + regression 2026-11-05) | done 2026-11-05, committed with Owner approval (`220095d`, not pushed): response, clarifications (PROPOSED), regression INCONCLUSIVE (rules A, C PASS; B 2/3 items, 1 split); 17 unit tests OK, self-test 24/24, privacy grep clean on new files; contract files unchanged vs `d48acce` | gn-followup topic session | none (this checkout) | `reports/T1/CLOUD-REVIEW-RESPONSE.md`, `reports/T1/METRIC-CONTRACT-CLARIFICATIONS.md`, `reports/T1/REGRESSION-SUMMARY.md`; brief stub `tasks/GN-FOLLOWUP/BRIEF.md` |
| D-V12 | Metric D v1.2 candidate contract (CLI002-R2-D-V12-CONTRACT-01): P0/P1 comparison, decision tables, versioned candidate schema/aggregator + synthetic tests, regression preregistration plan (not started), Owner decision packet. Owner authorized preparation + deterministic tests 2026-11-05; Cloud inputs stored as `reviews/GN-FOLLOWUP-CLOUD-REVIEW-2026-11-05.md`, `reviews/OWNER-ALIGNMENT-REVIEW-2026-11-05.md`, `reviews/D-V12-TASK-BRIEF-2026-11-05.md` | done 2026-11-05 (stopped at Owner checkpoint): CONDITIONAL GO on contract readiness only; recommends keeping P0 as Gate B primary with P1 as secondary (Owner decides); open decisions O-1..O-8; regression planned, not started. Topic session re-ran: freeze manifest 36/36 OK; v1 self-test 24/24, 17 unit tests, 16 fixtures valid; v1.2 self-test 30/30 twice byte-identical, 43 unit tests, 25 records valid; privacy grep clean; changes only in topic folder | r2-d-v12 | none (this checkout) | `reports/T1/V12-*.md`, `reports/T1/v1.2/`; brief stub `tasks/D-V12/BRIEF.md` |
| GN-REG-A3 | v1.1 regression annotator 3 (fresh, outside the repo; 2 packets) | done 2026-11-05: validates (2 records, 0 errors); isolation checked from transcript | r2-d-annotator-3 | none (private store only) | private |
| GN-REG-A4 | v1.1 regression annotator 4 (fresh, outside the repo; 2 packets) | done 2026-11-05: validates (2 records, 0 errors); isolation checked from transcript | r2-d-annotator-4 | none (private store only) | private |
