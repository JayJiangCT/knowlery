# Level 0 Experiment — Protocol

**Status:** approved to run (independent review of v0.3.1, 2026-10-30). This file is the frozen protocol; results go in `RESULTS.md` beside it and a decision record under `docs/2.0/decisions/`.

## Frozen inputs

| Input | Value |
|---|---|
| Pilot vault | `JayJiangCT/Knowlery-Pilot` @ `cf9e378` |
| Format | `format/KNOWLEDGE-FORMAT-v0.3.md` as of `2976e62`: v0.3.1 (`a9a5485`), the §1 figure correction in the commit that adds this file, and the Record evidence-scope fix (§7.2/§8; scope ends at `## Sources`) found while building the kit. No further Format edits until the run ends |
| Kit | This directory at git tag `level0-frozen-1`; every `scores.csv` row records the tag. Runs on any earlier commit (the 2026-10-30 T01 smoke test) are pre-freeze and not scored |
| Scope | 10–15 compiled pages from the 1P Drone Delivery thread, listed in `pages.txt` once chosen; their cited Sources and Records come along unchanged |
| Model and harness | Recorded in each harness's `results/<harness>/REPORT.md` (with the exact command line) before the first run; identical for both arms |
| Token budget | No cap; both arms run with the harness defaults; tokens recorded per run |

## Arms

| Arm | Material | Agent instructions |
|---|---|---|
| Control | The scoped pages in their 1.x form | The Pilot's `AGENTS.md` / `.claude/CLAUDE.md` made headless by `tools/build.py`: the Pilot's read-only banner (which also suspended the page-writing rules) replaced by an experiment header that keeps the Agent-Maintained Pages rules in force; Obsidian CLI rules, the Pilot skills and the `.knowlery/bin` query engine removed, and rules that point at removed skills rewritten for file tools; Activity Ledger off (`.knowlery/activity-disabled`) |
| Test | The same pages migrated by hand to v0.3.1 | `CONVENTIONS.md` written from spec §13 |

Before any run, a human checks each migrated page against its 1.x original for semantic equivalence: no claim added, none dropped, none sharpened. A log of migration ambiguities is kept; each entry is a potential Format revision.

The check is a gate: it is recorded in the sign-off table below, one row per page in `pages.txt`, and no scored run starts while a row is open. `tools/validate.py` checks structure only and does not count.

| Page | Reviewer | Date | Result |
|---|---|---|---|
| (all 14 pages in `pages.txt`) | — | — | **open** |

Both arms run headless with file tools only (no Knowlery runtime: `.knowlery/bin` is removed in both). Nothing about atomic writes, concurrent edits, or enforcement of `protected` is tested here.

## Tasks

Each task runs in both arms, with the same prompt, same budget, and at least three repetitions where the harness allows.

| # | Task | Tests | Pass condition |
|---|---|---|---|
| T1 | Current-knowledge Q&A: three G1 questions from `pilot/questions-agent.md` (one with a known superseded answer, e.g. G1-26) | Tier 1–3 reading | Correct current answer with correct citation |
| T2 | "Which of these two conclusions is historical?" | Claim status | Identifies the superseded one and the successor |
| T3 | "Show the evidence for claim X" | `## Sources`, `(src:)` | Resolves to the right source and version |
| T4 | A cited Source changes (new body, new digest); "update what is affected" | Change detection, move-to-History | Only the affected claim changes; old claim lands in History with anchor intact; `log.md` line written |
| T5 | Two conflicting sources on one claim | `#disputed` | Conflict surfaced, not silently resolved |
| T6 | Owner edited a published Record's body | Logical immutability | `revised` line added; citing pages flagged; no silent overwrite |
| T7 | Cited version not recoverable (no `blob:`) | Honest reporting | Reported as not recoverable, never as recovered |
| T8 | Frontmatter-only change on a Source (`tags`, `aliases`) | Scope | Not reported as an evidence change |
| T9 | Record history in git, body blob not stored | Recovery path | Recovery goes through whole-file `blob:`; a digest alone is not claimed as recovered |
| T10 | Unrelated claim edited on a page cited as `derived` | Claim fingerprint | Dependent claim not flagged |
| **T11** | Upstream claim text unchanged but marked `#disputed` (fingerprint identical) | Status propagation along `derived` | Agent notices the status change on the dependency when answering or updating downstream; if it cannot, record as a Format gap (candidate: status propagation mechanism) |
| **T12** | Source body unchanged, Source frontmatter changes meaning (e.g. `decision_status: approved → withdrawn`) | Evidence scope boundary | Agent does not keep relying on the withdrawn decision; if it does, record as a Format gap (candidate: distinguish administrative from semantic frontmatter on Sources) |

T01 Q1, T02 and T05 all turn on the same Pilot defect (the payload-slide Source says 252 mm is the envelope; the compiled pages hold 254 mm). They are analysed as one finding cluster, not three independent results. T01 does not score Source-level detection: CONVENTIONS §3 tells the Test arm to stop at tier 3 when evidence is not requested, so that criterion would measure the instruction text; T02 and T05 ask for evidence and carry the probe.

T11 and T12 were added at the reviewer's request; they probe the v0.3.1 evidence scope. A failure there is a finding, not a reason to redesign before the run.

Granularity sub-experiment (**deferred**, not in this kit): 3–4 Test-arm pages prepared at coarse / working / fine claim granularity; T4 and T5 run on each.

## Metrics

| Metric | Definition |
|---|---|
| Pass rate | Per task, per arm |
| Unnecessary Rewrite Rate | Changed content the new input did not justify ÷ all changed content |
| Unsupported Current Claim Rate | Claims in `## Current` after a run without adequate `(src:)` support ÷ all current claims |
| Protocol overhead ratio | Tokens spent on `CONVENTIONS.md` / `AGENTS.md` and metadata ÷ total tokens read |
| Tokens per correct answer | Total input tokens ÷ correct answers |
| Migration cost | Human minutes per page; count of ambiguities logged |

Correctness and history preservation are reported first; token and maintenance cost second. With three runs per arm, rates are descriptive: no difference is claimed from them alone (3/3 vs 0/3 is Fisher's exact p ≈ 0.10); the decision record rests on case findings.

## Outputs

1. `results/<harness>/REPORT.md` per harness (RUNBOOK §4), and `RESULTS.md` beside this file combining them: per task, per arm, per repetition: pass/fail, the metric values, and the transcript path.
2. The migration ambiguity log.
3. A decision record under `docs/2.0/decisions/` that classifies every v0.3.1 Hypothesis and Conformance item as **pass**, **fail**, **insufficient evidence**, or **revise clause §N**. A single successful run approves nothing.

## Non-goals

No Format edits during the run. No stable-v1 claim from this experiment. No Connector, Obsidian, or MCP involvement.

## Kit (added 2026-10-30)

| Path | What |
|---|---|
| `pages.txt` | the 14 scoped pages |
| `test/` | the migrated v0.3.1 pages, `CONVENTIONS.md`, with `@pin` placeholders resolved at build |
| `MIGRATION-GUIDE.md`, `migration-log.md` | how the pages were migrated and every ambiguity met (several are Format findings already) |
| `tools/build.py` | builds `work/<arm>/<task>/` from the Pilot checkout: overlays, version pinning, fixtures |
| `tools/digest.py`, `tools/srcline.py`, `tools/validate.py`, `tools/collect.sh` | digest per evidence scope; source-line helper; conformance validator; result collection |
| `tasks/T01..T12.md` | verbatim prompts, fixtures, pass criteria, what to record |
| `RUNBOOK.md` | how to run on any harness; scoring; reporting |
| `results/` | one directory per harness; `scores-template.csv` |

Fixture changes from the protocol table above, decided while building: T04's "changed source" is an addendum to the Medium Bag Slack note (clean supersession of one claim), and T05 needs no fabricated conflict because the Pilot already contains a real one (the payload-slide Source note says 252 mm is the envelope and 254 mm a rounded label, while the compiled pages hold 254 mm as current). T09 reuses the T04 fixture.
