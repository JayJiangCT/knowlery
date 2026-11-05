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
| T0 | Archive and privacy preflight | done, verified 2026-11-04: 11 artifacts VERIFIED; tool traces NEEDS-EVIDENCE (no prior manifest; new private baseline recorded) | r2-t0-preflight | none (this checkout) | `reports/T0/REPORT.md` |
| T1 | D metric contract, annotation protocol and packets | done, verified 2026-11-04: self-test 24/24 deterministic, 17 unit tests OK, 10 packets, privacy grep clean | r2-t1-metrics | none (this checkout) | `reports/T1/REPORT.md` |
| T1-A1 | D annotator 1 (fresh, independent) | done 2026-11-05: validates, 10 records; isolation checked from transcript | r2-d-annotator-1 | | private |
| T1-A2 | D annotator 2 (fresh, independent) | done 2026-11-05: validates, 10 records; isolation checked from transcript | r2-d-annotator-2 | | private |
| T1-R | Disagreement review (Owner spot-check) | done 2026-11-05: packet hashes 30/30; aggregate deterministic; 12 disagreements in 2 of 10 packets decided by Owner (5 rulings); consensus file validates and is frozen; Round 1 join done (private); protocol revised to v1.1 (rules A–C, v1.0 kept) | | | |
| T1-W | Wrong-current-claim judging check: build blinded materials (Owner-approved deviation 2026-11-05, outside Gate NOW) | done, verified 2026-11-05: 8 packets (4 positives, no shortfall), leaked-word scan 1 allowed hit (answer's own wording), manifest 18/18 OK with key excluded, 5 context lists non-empty | t1-w-build-wcc-judging-m | none (writes only to the private store) | private; stub `tasks/T1-W/BRIEF.md` |
| T1-W-J | T1-W judges A1, A2 (packet only), B1, B2 (packet + context list), fresh and blind | done 2026-11-05: 4 x 8 verdicts; isolation checked; each condition 8/8 internally consistent; verdict follows the reference given (results private) | r2-w-judge-a1, r2-w-judge-a2, r2-w-judge-b1, r2-w-judge-b2 | | private |
