# ANSWER: Single-Zip package width limit — 252 mm vs 254 mm

## Short answer

- **What the compiled (agent-maintained) layer currently holds as valid:** (b) **254 mm**. The 2026-07-30 value (a) **252 mm** is marked historical/superseded.
- **When and on what basis:** recorded on **2026-09-15**, from the `10 in / 254 mm` width label on the 3D render of the Zipline "Payload Dimensions — Wk. of 9/7" slide that Jay supplied in the 2026-09-15 agent session. Mass (`2495 g`), length (`338 mm`) and height (`205 mm`) were left unchanged; only width was revised.
- **Is the change disputed?** **Yes, by its own cited source.** The user note that the compiled pages cite for the week-of-9/7 slide concludes the opposite: the Envelope card from the same slide set reads `338 × 252 × 205 mm`, and the note states explicitly "Do not treat `254 mm` as a superseding envelope width." Later user notes (2026-09-17, 2026-10-26) also continue to use 252 mm. So the vault is internally inconsistent: the retrieval layer says 254, the primary evidence and all post-September user notes say 252.

My assessment (interpretation, not a vault statement): by the vault's own rule that "every claim must be backed by vault notes" and that freshness metadata is "a signal, not authority", the 254 mm claim has no backing — its only cited source rejects it. The defensible current value is **252 mm**, and the compiled pages carrying 254 mm should be corrected. I did not edit them; the task asked a question, not for changes.

## Evidence — compiled layer holds 254 mm as current

Primary carrier: `queries/zipline-mvp-partner-confirmed-contract-2026-07-30.md` (frontmatter: `retrieval_priority: high`, `freshness_status: active`, `updated: 2026-09-15`, `freshness_reviewed: 2026-09-15`, alias `338 254 205`, source list includes the slide note).

- Line 50 (Confirmed Contract table): "the 2026-07-30 dimensions were `338 mm L × 252 mm W × 205 mm H` … The current hardware envelope revises width to `254 mm`; see the week-of-2026-09-07 section below."
- Line 68 (eligibility rule block): `width_mm <= 254`.
- Lines 108–116 ("Canonical Dual-Unit Package Limits (2026-07-30)"): Maximum width `252 mm` / `9.92 in`; "That July envelope is now itself historical for width."
- Lines 123–130 ("Current Payload Envelope (Week of 2026-09-07)"): width `254 mm` / `10 in` vs 2026-07-30 `252 mm / 9.92 in`; "Width is the only metric change: `252 mm` → `254 mm` … The slide's imperial labels (`13.25 × 10 × 8 in`) are its own rounded pairings, not a second physical limit."

Pages propagating the 254 mm value (all cite the contract page and/or the slide note):

| Page | Lines | Freshness |
|---|---|---|
| `queries/zipline-wonder-weekly-deck-readout-2026-09-15.md` | 89, 92 ("This revises the 2026-07-30 partner QA width from `252 mm` to `254 mm`"), 185 | active, reviewed 2026-09-20 |
| `queries/zipline-drone-quote-and-package-eligibility-contract-2026-07-02.md` | 164, 178, 182 ("that width is superseded"), 189 ("`252 mm` is retained as historical") | active, updated 2026-09-29 |
| `queries/zipline-integration-readiness-guide-2026-06-17.md` | 374, 383 ("This is the authoritative Eligibility Service configuration") | watch, updated 2026-09-15 |
| `queries/1p-drone-delivery-system-responsibility-boundaries-2026-07-15.md` | 234, 245 | watch, updated 2026-10-23 |
| `queries/1p-drone-delivery-eligibility-evaluation-trigger-and-revalidation-contract-2026-07-16.md` | 265, 274 | watch, updated 2026-10-14 |
| `queries/drone-mvp-medium-bag-outer-package-decision.md` | 50, 72, 108–116 | active, updated 2026-10-19 |
| `queries/order-packaging-geometry-feasibility-for-drone-dimension-eligibility-2026-08-12.md` | 153 | — |

## Evidence — 252 mm as the original (2026-07-30 partner QA)

- `queries/zipline-mvp-final-partner-qa-working-draft-2026-07-26.md` line 66: "One approved outer package at or below `2495 g` and `338 × 252 × 205 mm` is guaranteed to use one initial Zip."
- `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Archive/Eligibility and Architecture/1P Drone Delivery MVP Dimensions Eligibility Proposal (2026-08-12).md` lines 51, 60, 202: Zipline envelope "338 × 252 × 205 mm, 2,495 g gross", citing the 2026-07-30 partner-confirmed contract.
- `Wonder/.../Archive/Eligibility and Architecture/1P Drone Delivery High-Level System Alignment - MVP.md` line 125: Width `252 mm`.
- `Wonder/.../Archive/Eligibility and Architecture/1P Drone Delivery Weight and Dimensions MVP Eligibility Proposal (2026-08-19).md` line 28.
- `Wonder/.../Slack Clarification - Drone MVP Medium Bag Selection - 2026-08-12.md` line 45: "Zipline provider envelope of `338 × 252 × 205 mm / 2495 g`".

## When and on what basis the change happened

- **Date:** 2026-09-15. The slide note was `created: 2026-09-15`; the contract page was `updated`/`freshness_reviewed` 2026-09-15; the deck readout that carries the revision was `created: 2026-09-15`. Git cannot narrow this further — every file in this vault arrived in one commit (`c7daf22`, 2026-10-28, "Knowlery cloud pilot: sanitized read-only Fulfillment/Dispatch subset"); there is no per-edit history.
- **Basis:** `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Zipline Payload Dimensions Slide - Week of 2026-09-07.md`, frontmatter `source: Zipline Payload Dimensions slide and Envelope card supplied by Jay in the 2026-09-15 agent session`. Its axis table (lines 21–25) records the 3D render labels: Length `13.25 in` / `338 mm`, Width `10 in` / `254 mm`, Height `8 in` / `205 mm`. The compiled pages took the `254 mm` label as a hardware revision of the width axis.
- **Verified against the attachment image** `Attachments/zipline-payload-dimensions-wk-of-2026-09-07/payload-dimensions-3d-wk-of-2026-09-07.png`: the render is labelled `13.25" / 338mm`, `10" / 254mm`, `8" / 205mm`.

## Evidence disputing the change

1. **The cited source note itself** — `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Zipline Payload Dimensions Slide - Week of 2026-09-07.md`, lines 30–36:
   > The Envelope card states: `338 × 252 × 205 mm`
   > The Envelope card is the numeric payload envelope. It matches the 2026-07-30 partner QA of `338 × 252 × 205 mm`. The 3D width label `10 in / 254 mm` is a rounded-imperial pairing (`10 in = 254 mm`), not a 2 mm hardware change. … 
   > Do not treat `254 mm` as a superseding envelope width.

   This is the only source the contract page cites for its "Current Payload Envelope (Week of 2026-09-07)" section, and it reaches the opposite conclusion.

2. **The Envelope card image** — `Attachments/zipline-payload-dimensions-wk-of-2026-09-07/payload-envelope-card-338-252-205.png` reads `Envelope 338 × 252 × 205 mm`. Verified by viewing the image.

3. **Unit arithmetic on the render (my inference):** the render's imperial labels are rounded from metric, not the reverse: `13.25 in = 336.6 mm` (labelled 338), `8 in = 203.2 mm` (labelled 205). Width is the one axis where `252 mm → 9.92 in → rounded 10 in → 254 mm` happens to produce a different millimetre figure. The contract page concedes (line 130) that the imperial labels are "its own rounded pairings" yet still treats 254 as a metric change, which is inconsistent.

4. **Later user notes keep 252 mm after the 2026-09-15 revision:**
   - `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/PRD/Drone Eligibility Check - MVP Plan - 2026-09-17.md` (`updated: 2026-10-27`) line 86: "dropbox envelope 338 × 252 × 205 mm (13.31 × 9.92 × 8.07 in)"; line 470: "box 292 × 292 mm … exceeds envelope width 252 mm".
   - `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Raw/Investigation - Cookbook Weight and Dimension Backfill Review - 2026-10-26.md` line 192: "largest outer footprint 226 mm vs 252 mm envelope axis"; line 287: "Rejected by prescreen (321 > 252 mm)".
   - `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Raw/Drone Eligibility Check - Research Log and Plan - 2026-09-07.md` line 179: Pack envelope "205 x 252 x 338 mm".

5. **Weaker, non-discriminating runtime evidence:** `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Zipline API Doc/Zipline API Documentation Runtime Annotations - 2026-08-27.md` line 47 — sandbox Pack accepted `252 × 205 × 338 mm / 2495 g` on 2026-08-27. Nothing in the vault tests 253–254 mm, so runtime evidence cannot decide between the two values.

## Why the 2 mm matters

`queries/drone-mvp-medium-bag-outer-package-decision.md` lines 108–116 argues the new August Medium bag (`330 × 254 × 330 mm`) is an "exact match" on width against the 254 mm envelope, and notes that against the 2026-07-30 envelope "the same bag was 2 mm over on width." Under the disputed 252 mm value the bag fails width, so the discrepancy changes an eligibility conclusion rather than being cosmetic.

## Files relied on (vault-relative)

- `AGENTS.md`, `SCHEMA.md`
- `queries/zipline-mvp-partner-confirmed-contract-2026-07-30.md`
- `queries/zipline-wonder-weekly-deck-readout-2026-09-15.md`
- `queries/zipline-drone-quote-and-package-eligibility-contract-2026-07-02.md`
- `queries/zipline-integration-readiness-guide-2026-06-17.md`
- `queries/1p-drone-delivery-system-responsibility-boundaries-2026-07-15.md`
- `queries/1p-drone-delivery-eligibility-evaluation-trigger-and-revalidation-contract-2026-07-16.md`
- `queries/drone-mvp-medium-bag-outer-package-decision.md`
- `queries/order-packaging-geometry-feasibility-for-drone-dimension-eligibility-2026-08-12.md`
- `queries/zipline-mvp-final-partner-qa-working-draft-2026-07-26.md`
- `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Zipline Payload Dimensions Slide - Week of 2026-09-07.md`
- `Attachments/zipline-payload-dimensions-wk-of-2026-09-07/payload-dimensions-3d-wk-of-2026-09-07.png`
- `Attachments/zipline-payload-dimensions-wk-of-2026-09-07/payload-envelope-card-338-252-205.png`
- `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/PRD/Drone Eligibility Check - MVP Plan - 2026-09-17.md`
- `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Raw/Investigation - Cookbook Weight and Dimension Backfill Review - 2026-10-26.md`
- `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Raw/Drone Eligibility Check - Research Log and Plan - 2026-09-07.md`
- `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Zipline API Doc/Zipline API Documentation Runtime Annotations - 2026-08-27.md`
- `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Archive/Eligibility and Architecture/1P Drone Delivery MVP Dimensions Eligibility Proposal (2026-08-12).md`
- `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Archive/Eligibility and Architecture/1P Drone Delivery High-Level System Alignment - MVP.md`
- `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Slack Clarification - Drone MVP Medium Bag Selection - 2026-08-12.md`
- `git log` (read-only): single import commit `c7daf22`

## Unable to establish

- Whether Zipline intended any hardware change: the vault holds no Zipline statement about width beyond the slide render and Envelope card, and no partner follow-up after 2026-09-15.
- The exact edit timestamp of the 254 mm revision beyond frontmatter dates (2026-09-15); git has only one import commit.
- Whether Zipline Pack/Quote accepts a 253–254 mm package: no runtime test in the vault covers that range.
- Which compiled page introduced 254 mm first (contract page vs deck readout): both are dated 2026-09-15 and cite each other.

## Files changed

None. `ANSWER.md` (this file) was created at the vault root. No compiled pages, user notes, `log.md`, or activity records were written (`.knowlery/activity-disabled` is present and the task asked for an answer, not vault changes).
