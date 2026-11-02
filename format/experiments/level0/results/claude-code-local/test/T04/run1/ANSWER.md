# ANSWER — absorbing the 2026-10-28 update to the Medium bag Slack note

## Answer

The owner appended an `## Update (2026-10-28)` section to `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Slack Clarification - Drone MVP Medium Bag Selection - 2026-08-12.md` (commit 45f8e61). Evidence-scope digest changed from `sha256:79548617…` (blob `deaef9a7…`) to `sha256:89ef80b2…` (blob `3e52313b…`). The new information: IKC Ops completed the sample testing; the mailed samples (new August 2026 Medium bag, "the PRD v26 default", and the guest packaging) fit the production Pod; the new Medium is confirmed as the MVP outer package; no further bag testing is planned before launch.

Pages depending on this note (grep of `## Sources` lines and legacy `sources:` frontmatter):

| Page | Kind | What the update changes | Action |
| --- | --- | --- | --- |
| `concepts/drone-delivery-integration-strategy.md` (s17) | Knowledge page | Claim `^c17` said "bag and guest-packaging samples still need testing" — now false | `^c17` superseded by `^c38`; `^q12` opened on the dimension-identity question; `s33`, `s34` appended |
| `records/drone-mvp-medium-bag-outer-package-decision.md` (s2) | Record, frozen | Its "Not Confirmed" list and Jay's "pending confirmation" interpretation are now partly answered | New follow-on Record; `followed_by`, History line and Related link added (frontmatter/History/Related only — not an evidence change) |
| `records/1p-drone-delivery-checkout-package-dimensions-contract-2026-07-16.md` (s14) | Record, frozen | Its 2026-09-20 "bag status" callout and "pending Zipline validation" statements are now a dated snapshot | History line and Related link only |
| `queries/drone-package-recommendation-ownership-and-kds-boundary.md` | Legacy 1.x | Bag-status paragraph and open question 1 are dated | Dated note appended at end (per CONVENTIONS §2a) |
| `queries/1p-drone-delivery-high-level-system-alignment-mvp-2026-08-13.md` | Legacy 1.x | Packaging section and open decision 1 are dated | Dated note appended at end |

Nothing was deleted. The old claim text of `^c17` is preserved in `## History` with its original id. Both frozen Records' evidence-scope digests were re-computed after editing and are unchanged (`fd7e1f24…` and `508fb12c…`), so the digests on every page citing them (including the concept's `s18`) remain valid.

## Files changed

1. `records/drone-mvp-medium-bag-sample-testing-completed-2026-10-28.md` — **new** Record (`kind: finding`, `date: 2026-10-28`) recording the test result, what it closes, and what it does not establish. Cites the new source version, the decision Record and Rob's relayed attestation.
2. `concepts/drone-delivery-integration-strategy.md` — `^c17` moved to History with supersession suffix; `^c38` added under "Eligibility and package data"; `^q12` added to `## Open`; `s33` (new source version) and `s34` (new Record) appended; History line; `updated`/`updated_by`/`description` date bumped. `status: disputed` left as is (it belongs to `^c24`).
3. `records/drone-mvp-medium-bag-outer-package-decision.md` — `followed_by` added; History line noting source s2 revised and evidence scope unchanged; Related link to the new Record.
4. `records/1p-drone-delivery-checkout-package-dimensions-contract-2026-07-16.md` — History line noting source s14 revised; Related link to the new Record.
5. `queries/drone-package-recommendation-ownership-and-kds-boundary.md` — `## Update Note (2026-11-02)` appended.
6. `queries/1p-drone-delivery-high-level-system-alignment-mvp-2026-08-13.md` — `## Update Note (2026-11-02)` appended.
7. `log.md` — `## 2026-11-02` block, one line per write.
8. `ANSWER.md` — this file.

## Paths relied on

- `AGENTS.md`, `CONVENTIONS.md`, `log.md`, `tools/digest.py`
- `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Slack Clarification - Drone MVP Medium Bag Selection - 2026-08-12.md` (current and `8b33278` versions via `git show`)
- `records/drone-mvp-medium-bag-outer-package-decision.md`
- `records/1p-drone-delivery-checkout-package-dimensions-contract-2026-07-16.md`
- `concepts/drone-delivery-integration-strategy.md`
- `queries/drone-package-recommendation-ownership-and-kds-boundary.md`
- `queries/1p-drone-delivery-high-level-system-alignment-mvp-2026-08-13.md`
- `records/zipline-pack-as-eligibility-oracle-direction-2026-08-20.md` (Record style reference only)

## Not established / caveats

- **Dimension identity.** The update equates "the new August 2026 Medium bag" with "the PRD v26 default", but the decision Record carries `13" × 10" × 13"` for the August spec and `12 × 8.5 × 13 in` for PRD v26. The update does not say which tuple is right or whether they are one SKU. Recorded as `^q12` on the concept page and in the new Record, not resolved (CONVENTIONS §8).
- **Evidence quality.** The new fact is a single relayed attestation (Rob via Jay, written down by the note owner). It confirms PRD v26 rather than contradicting a current source, so it was absorbed; it was not marked `#disputed`.
- **Scope of "sample testing".** The update describes an IKC Ops fit check against the production Pod. It is not a Zipline test report, and the SKU, tare, fill line, folded height, orientation and handle/closure rule remain unpublished.
- **No `blob:` for the new Record.** It is uncommitted (no commit was made, per the task), so the concept's `s34` line says "uncommitted at citation time, no blob". Add the blob after commit if desired.
- **No transitive dependency via `^c17`.** `grep -rn 'integration-strategy#\^c17'` over `concepts entities comparisons records queries` returns nothing, so no Knowledge page cites the superseded claim as `derived`; the supersession has no downstream citers to review.
- **Pages not touched.** Six other pages link to `drone-mvp-medium-bag-outer-package-decision` but not to the changed note: `records/zipline-pack-as-eligibility-oracle-direction-2026-08-20.md`, `queries/1p-drone-delivery-system-responsibility-boundaries-2026-07-15.md`, `queries/customization-packaging-delta-verification-for-drone-eligibility-2026-08-13.md`, `queries/kds-bag-recommendation-feature-and-algorithm-2026-07-22.md`, `queries/kds-pre-order-bag-recommendation-feasibility-2026-07-16.md`, `queries/order-packaging-geometry-feasibility-for-drone-dimension-eligibility-2026-08-12.md`. Their evidence (that Record's scope) did not change, so they were left alone. Some of their prose may still say "pending Zipline validation"; that was already dated by PRD v26 on 2026-10-19 and is a candidate for a separate review, not part of this change.
- `pilot/FILES.txt` lists the note's path as a manifest entry, not as evidence; left alone. `.knowlery/` is derived data; left alone.
- Nothing in this vault enforces frozen scopes or append-only sections (§9); the checks above were done by hand with `tools/digest.py`.
