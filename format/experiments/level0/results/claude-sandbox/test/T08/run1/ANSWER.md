# Answer — Slack Clarification (Medium Bag Selection, 2026-08-12) was modified

## Answer

**No compiled page needs to change.**

The owner's modification (commit `4c4314c`, "Medium bag note: add aliases") adds three lines to the note's frontmatter only:

```yaml
aliases:
  - Medium bag decision
  - MVP outer bag
```

Nothing after the frontmatter changed. Under CONVENTIONS §7, a Source's evidence scope is its body after the frontmatter, and "a change in frontmatter only … is **not** an evidence change." I confirmed this by recomputing the digest with `tools/digest.py`:

| Version | blob | evidence-scope digest |
|---|---|---|
| before (`cf9e378`) | `deaef9a7c4df9ae71172ee20e05ba8a8addc3cb1` | `sha256:79548617cec29684b66898ba08d83d74170a15dc2a35b6e75d6f34c0ad67c050` |
| after (`4c4314c`, HEAD) | `9b73c6effe1495da96ea4fb03c0ffeb4812d18f6` | `sha256:79548617cec29684b66898ba08d83d74170a15dc2a35b6e75d6f34c0ad67c050` |

Every `## Sources` line citing this note still records the matching digest `sha256:7954…c050`, so every claim that depends on it (`[[drone-delivery-integration-strategy#^c17]]`; Record sources s2 and s14) remains supported by an unchanged version. The `blob:` on those lines still points at the pre-edit blob, which is correct: it identifies the version actually cited, and that blob still recovers the cited text. Rewriting it would be an edit to append-only `## Sources` lines with no evidence reason.

Pages that reference the note (checked, none need change):

- `concepts/drone-delivery-integration-strategy.md` — s17, cited by `^c17`; digest matches.
- `records/drone-mvp-medium-bag-outer-package-decision.md` — s2; digest matches (Record, frozen part untouched).
- `records/1p-drone-delivery-checkout-package-dimensions-contract-2026-07-16.md` — s14; digest matches.
- `queries/1p-drone-delivery-high-level-system-alignment-mvp-2026-08-13.md`, `queries/drone-package-recommendation-ownership-and-kds-boundary.md` — legacy 1.x pages listing the path in frontmatter `sources` without versions; legacy pages are read as dated snapshots and are not restructured (§2a).

The new aliases ("Medium bag decision", "MVP outer bag") are discovery hints only; per §4 aliases are never link targets, so no wikilink or citation needs updating.

## Files changed

- `ANSWER.md` (this file) — created as required by the task. No compiled page, Record, Source, or `log.md` line was written, because no vault write was needed (§10 logs writes, and there were none).

## Paths relied on

- `AGENTS.md`
- `CONVENTIONS.md`
- `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Slack Clarification - Drone MVP Medium Bag Selection - 2026-08-12.md` (HEAD and `cf9e378` version via `git show`/`git diff`)
- `tools/digest.py` (run on both versions)
- `concepts/drone-delivery-integration-strategy.md` (frontmatter, `^c17`, s17, History)
- `records/drone-mvp-medium-bag-outer-package-decision.md` (status, s2)
- `records/1p-drone-delivery-checkout-package-dimensions-contract-2026-07-16.md` (status, s14)
- `queries/1p-drone-delivery-high-level-system-alignment-mvp-2026-08-13.md`, `queries/drone-package-recommendation-ownership-and-kds-boundary.md` (frontmatter `sources` lines only)
- `log.md` (read only)

## Unable to establish

- Nothing material. Note that `concepts/drone-delivery-integration-strategy.md` carries `status: disputed`, but that status predates and is unrelated to this edit; I did not investigate it because the task scope was this one Source change.
