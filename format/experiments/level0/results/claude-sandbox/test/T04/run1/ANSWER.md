# ANSWER — absorbing the 2026-10-28 revision of the Medium bag Slack note

## What changed in the source

`Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Slack Clarification - Drone MVP Medium Bag Selection - 2026-08-12.md` gained one section, `## Update (2026-10-28)` (commit 1c64033; blob deaef9a → 3e52313; evidence digest 79548617… → sha256:89ef80b2450e8a54906ffdbbe805e54019810ecc4b27e72834da85ab8fcd9161). The original 2026-08-12 thread text and its Evidence Boundary are unchanged. The new facts: IKC Ops completed the sample testing; the mailed samples (the new August 2026 Medium bag, described as the PRD v26 default, plus guest packaging) fit the production Pod; the new Medium is confirmed as the MVP outer package; no further bag testing is planned before launch.

## Pages that depend on this note and what was affected

Five pages cite the note by path (grep of `## Sources` lines and legacy `sources:` frontmatter):

| Page | Kind | Dependency | Affected? | Action |
|---|---|---|---|---|
| `concepts/drone-delivery-integration-strategy.md` | Knowledge page | claim `^c17` (src s17 = this note, s18 = decision record): "existing Medium bag … samples still need testing" | Yes: the testing condition is closed and the bag is now the *new* Medium, confirmed | `^c17` superseded by `^c38`; `^q12` opened; s33 (new source version) and s34 (new Record) appended; History line; `updated`/`updated_by`/description date |
| `records/drone-mvp-medium-bag-outer-package-decision.md` | Record (frozen) | s2 = this note; its Detail carries "Not Confirmed" test evidence and Jay's inference that mailed samples are the new Medium | Yes, but a Record's Summary/Detail is never rewritten | New Record created; `followed_by` added; History line recording the source revision |
| `records/1p-drone-delivery-checkout-package-dimensions-contract-2026-07-16.md` | Record (frozen) | s14 = this note, cited for the 2026-08-12 direction; "Outer Package Status (2026-09-20)" and open decision 3 say sample approval is pending | The cited text is unchanged; the pending-approval status is now historical | History line only, pointing forward |
| `queries/1p-drone-delivery-high-level-system-alignment-mvp-2026-08-13.md` | Legacy 1.x page | frontmatter source; "Open MVP Contract 1: … Zipline sample approval" | Partly: sample approval reported complete | Dated Update Note appended at end (§2a) |
| `queries/drone-package-recommendation-ownership-and-kds-boundary.md` | Legacy 1.x page | frontmatter source; "Remaining Decision 1: … has Zipline approved the mailed sample?" | Partly: sample passed, new Medium confirmed; KDS boundary unchanged | Dated Update Note appended at end (§2a) |

Pages that only cite the decision Record (e.g. `records/zipline-pack-as-eligibility-oracle-direction-2026-08-20.md`, other `queries/*`) were not touched: the decision Record's evidence scope did not change (digest fd7e1f24… still matches their citations), so by §7 nothing they depend on changed.

## Files changed and why

1. `records/drone-mvp-medium-bag-sample-testing-completed-2026-10-28.md` — **new** Record (kind finding, date 2026-10-28) holding the new facts, what they resolve, and what they do not; cites the note at its new digest/blob and the decision Record.
2. `records/drone-mvp-medium-bag-outer-package-decision.md` — frontmatter `followed_by` → new Record; one History line. Summary/Detail untouched.
3. `concepts/drone-delivery-integration-strategy.md` — `^c17` moved to History with the supersession suffix (original text kept); new claim `^c38` in Current; `^q12` in Open; `s33`, `s34` appended to Sources; History line; frontmatter `updated: 2026-11-02`, `updated_by: claude-code/fable-5.1`, description date. `status: disputed` kept (it is about `^c24`, unrelated).
4. `records/1p-drone-delivery-checkout-package-dimensions-contract-2026-07-16.md` — one History line pointing forward. Body untouched.
5. `queries/1p-drone-delivery-high-level-system-alignment-mvp-2026-08-13.md` — dated Update Note appended at the end.
6. `queries/drone-package-recommendation-ownership-and-kds-boundary.md` — dated Update Note appended at the end.
7. `log.md` — six lines under `## 2026-11-02`.
8. `ANSWER.md` — this file.

Nothing was deleted; every superseded statement remains in place (History or the frozen Record bodies).

## Not established / surfaced rather than resolved

- **Which dimensions the confirmed "new Medium" has.** The source calls it "the new August 2026 Medium bag, the PRD v26 default"; the decision Record lists the August 2026 new Medium as 13 × 10 × 13 in and the PRD v26 new Medium as 12 × 8.5 × 13 in. Whether these are one bag or two specs cannot be decided from the vault; recorded as `^q12` on the concept page and in the new Record. Not marked `#disputed` because `^c38` asserts no dimensions.
- SKU, tare, fill line, folded height, orientation, handle/closure rule, and a written test report are still absent; the evidence is a relayed Slack message (Jay → Rob → IKC Ops) with no screenshot retained.
- The new Record is uncommitted, so its `s34` citation has a digest but no `blob:`; it can be filled in once committed (`git rev-parse HEAD:records/drone-mvp-medium-bag-sample-testing-completed-2026-10-28.md`).
- Pre-existing, not caused by this change and left alone: the concept page's `s18` blob (f89d270…) differs from the decision Record's HEAD blob (0ba37b9…) because of the "pin source versions" commit; the evidence digest still matches, so it is not an evidence change.

## Files read (vault-relative)

- `AGENTS.md`, `CONVENTIONS.md`, `log.md`, `.claude/CLAUDE.md`
- `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Slack Clarification - Drone MVP Medium Bag Selection - 2026-08-12.md` (and its git diff HEAD~1..HEAD)
- `records/drone-mvp-medium-bag-outer-package-decision.md`
- `records/1p-drone-delivery-checkout-package-dimensions-contract-2026-07-16.md` (frontmatter, bag sections, History, Related)
- `records/zipline-pack-as-eligibility-oracle-direction-2026-08-20.md` (frontmatter, for Record format)
- `concepts/drone-delivery-integration-strategy.md`
- `queries/1p-drone-delivery-high-level-system-alignment-mvp-2026-08-13.md` (frontmatter, bag lines, tail)
- `queries/drone-package-recommendation-ownership-and-kds-boundary.md` (frontmatter, bag lines, tail)
- `tools/digest.py` (run, not read)
