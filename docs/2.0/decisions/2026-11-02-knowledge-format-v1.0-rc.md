# Decision record — Knowledge Format v1.0-rc

**Date:** 2026-11-02 · **Owner:** Jay (Knowlery 2.0) · **Status:** PROPOSED → awaiting Owner `Accepted`
**Decides:** F-001, F-002, F-003, F-004, F-006, F-008 (fixed in Format); F-005, F-007 partial (Format side fixed, Connector side open)
**Artifacts:** `format/KNOWLEDGE-FORMAT-v1.0-rc.md`, `format/CONVENTIONS.md`, `format/experiments/level0/RESULTS.md`

## Decision

Adopt the v0.3.1 Knowledge Format, with the three amendments the Level 0 experiment required, as the Knowlery 2.0 Knowledge Format release candidate. Field names, page roles, body contract, source-version model and status model are frozen; further change requires a new Hypothesis and an experiment.

## Evidence

- Three independent reviews (v0.2 → v0.3 → v0.3.1), all findings closed in text.
- Level 0 controlled experiment: 1.x Control vs v0.3.1 Test, 12 tasks × 2 arms × 2 harnesses (`claude-sandbox`, `claude-code-local`), same model, 47/48 cells pass. Human equivalence gate on all 96 fixture items plus a blind agent re-review (36 disagreements adjudicated by Owner).
- Key quantitative result: Unnecessary Rewrite Rate on the supersession task 0.77 / 0.70 (1.x) vs 0.00 / 0.00 (Format).
- Owner accepted single-model scope on 2026-11-02 ("单模型不会太大的问题").

## Amendments carried into v1.0-rc

| Finding | Amendment |
|---|---|
| F1 — tier-3 reading repeated a compiled claim its Source contradicts (2/3 Test runs) | §7.0: source-check before a claim is given as an answer, skipped when a `source-checked` History event exists at the current Source version |
| F3a — dispute reached a `derived` dependent through the link but the dependent carried no mark | §9.2: propagate `#disputed` to `derived` citers with a History line; never auto-supersede them |
| F3b — Source frontmatter withdrawal is outside the evidence scope; agents compensated by judgment | §8: status-type frontmatter changes are governance signals → `#disputed` + Open item, never supersession |

## Alternatives considered

- Keep v0.3.1 unchanged and defer F1/F3 to Connector tooling — rejected: F1 is a reading rule, not a tool guarantee, and would stay wrong in headless vaults.
- Widen the Source evidence scope to include frontmatter — rejected: makes every property edit look like an evidence change (T08 shows the cost); the governance-signal rule targets the keys that matter.
- Fix claim counts per page (5–10) — retired as a number; functional definition kept.

## Risks and open items

- Single model, one repetition per cell: results are case findings, not statistics. Mitigation: repeat with a second model when one is usable locally; the kit is frozen and rebuildable.
- Token/overhead hypothesis unmeasured (harnesses disagree on direction). Needs an instruction-token split.
- Connector guarantees (atomic writes, concurrency, `protected` enforcement, automatic propagation) untested at Level 0 — Level 1 scope.
- `queries/` → `records/` rename in a live vault needs a link-rewrite pass (3,109 links in the Pilot).

## Escalation path

If a Level 1 experiment or a second-model run falsifies a Decision above, open a new row in DECISIONS.md, do not edit this record.
