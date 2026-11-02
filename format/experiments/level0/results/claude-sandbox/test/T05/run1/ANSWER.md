# ANSWER — single-Zip width limit review (2026-11-02)

## Answer

The reviewer's concern is justified, but the vault's rules do not let me decide which figure is right, so I recorded a conflict rather than correcting the page.

**What the compiled page says.** `[[drone-delivery-integration-strategy#^c16]]` states the current single-Zip limit is 2495 g and 338 × **254** × 205 mm, citing s15 (the week-of-2026-09-07 Payload Dimensions slide note), s16 (`zipline-wonder-weekly-deck-readout-2026-09-15`) and s10 (`zipline-mvp-partner-confirmed-contract-2026-07-30`). The earlier 252 mm claim `^c27` was superseded on 2026-09-15 on the strength of that slide.

**What the cited sources actually say.**

- s15, `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Zipline Payload Dimensions Slide - Week of 2026-09-07.md`, is unchanged since citation (digest `sha256:811e891e…` and blob `9b5a9ac7…` both match). Its text says the Envelope card reads `338 × 252 × 205 mm`, matching the 2026-07-30 partner QA; that the 3D render's `10 in / 254 mm` width label is a rounded-imperial pairing, "not a 2 mm hardware change"; and, verbatim, "Do not treat `254 mm` as a superseding envelope width." The attachment is even named `payload-envelope-card-338-252-205.png`. This Source directly contradicts the claim that cites it.
- s10 (Record, frozen) and s16 (a legacy query page cited as `record`) both state 254 mm as the current width — but both derive that number from the same slide (s15). They add no independent evidence; they are a second reading of one artifact.
- s10's blob differs from HEAD only because Sources lines were pinned (`@pin` → digests); the evidence scope digest matches, so that is not an evidence change.

**Other vault sources on the payload envelope.** Every other Source I found uses 252 mm, including ones written after the slide: `PRD/Drone Eligibility Check - MVP Plan - 2026-09-17.md` ("dropbox envelope 338 × 252 × 205 mm (13.31 × 9.92 × 8.07 in)", and a worked rejection "exceeds envelope width 252 mm"); `Raw/Drone Eligibility Check - Research Log and Plan - 2026-09-07.md` (205 × 252 × 338 mm); `Raw/Investigation - Cookbook Weight and Dimension Backfill Review - 2026-10-26.md` (252 mm envelope axis); the 2026-08-12 and 2026-08-19 eligibility proposals, the Medium-bag Slack clarification, the High-Level System Alignment and the 2026-08-27 API runtime annotations. None asserts 254 mm independently of the slide.

**Conclusion.** The sources conflict: the Source cited for 254 mm says 252 mm; the Records that say 254 mm rest on that same Source; later independent Sources use 252 mm. Mass (2495 g), length (338 mm) and height (205 mm) are not in dispute. Per CONVENTIONS §8 this is "two sources that contradict each other … a finding to surface, never a choice to make silently", so I did not supersede `^c16` or reinstate `^c27`. A human (Jay or Rob) needs to confirm with Zipline whether 252 mm or 254 mm is the hardware limit; until then eligibility code using `width_mm <= 254` (as written in s10) is 2 mm more permissive than the Envelope card.

## Files changed and why

- `concepts/drone-delivery-integration-strategy.md` — appended `#disputed` to `^c16`; added `^q12` to `## Open` describing the conflict and what a human must decide; appended Sources `s33` (MVP Plan 2026-09-17) and `s34` (Backfill Review 2026-10-26) with digests and blobs as the independent 252 mm evidence; prepended a 2026-11-02 History line; set frontmatter `updated: 2026-11-02`, `updated_by: claude-code/claude-fable-5-1` (status was already `disputed`). No claim text was altered or deleted; no `protected` claims exist on the page.
- `log.md` — one line under `## 2026-11-02` for the write above.
- `ANSWER.md` — this file (new).

Not changed, deliberately: Records `zipline-mvp-partner-confirmed-contract-2026-07-30`, `1p-drone-delivery-checkout-package-dimensions-contract-2026-07-16`, `zipline-drone-quote-and-package-eligibility-contract-2026-07-02`, `drone-mvp-medium-bag-outer-package-decision` and the legacy query page `zipline-wonder-weekly-deck-readout-2026-09-15` also assert 254 mm. Records are frozen and legacy pages are not restructured; once a human resolves `^q12`, a new Record with `followed_by` is the right vehicle, not edits to these.

## Vault-relative paths relied on

- `AGENTS.md`, `CONVENTIONS.md`, `.claude/CLAUDE.md`, `log.md`, `tools/digest.py`
- `concepts/drone-delivery-integration-strategy.md`
- `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Zipline Payload Dimensions Slide - Week of 2026-09-07.md` (s15)
- `queries/zipline-wonder-weekly-deck-readout-2026-09-15.md` (s16)
- `records/zipline-mvp-partner-confirmed-contract-2026-07-30.md` (s10), including `git diff` of blob `9fef7255…` vs `e23d5c6f…`
- `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/PRD/Drone Eligibility Check - MVP Plan - 2026-09-17.md`
- `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Raw/Investigation - Cookbook Weight and Dimension Backfill Review - 2026-10-26.md`
- grep hits (not read in full): `Wonder/.../Raw/Drone Eligibility Check - Research Log and Plan - 2026-09-07.md`, `Wonder/.../Archive/Eligibility and Architecture/1P Drone Delivery MVP Dimensions Eligibility Proposal (2026-08-12).md`, `.../1P Drone Delivery Weight and Dimensions MVP Eligibility Proposal (2026-08-19).md`, `.../1P Drone Delivery High-Level System Alignment - MVP.md`, `Wonder/.../Slack Clarification - Drone MVP Medium Bag Selection - 2026-08-12.md`, `Wonder/.../Zipline API Doc/Zipline API Documentation Runtime Annotations - 2026-08-27.md`, and the `records/` files listed above
- `Attachments/zipline-payload-dimensions-wk-of-2026-09-07/` (filenames only)

## Unable to establish

- Which width Zipline actually means: I could not read the two PNG slide images to check the Envelope card and 3D label myself, and there is no Zipline statement in the vault other than the slide note. The 2 mm difference could be a real revision or the rounded-imperial artifact the Source describes.
- Whether the 2026-09-15 cook that wrote `^c16`, s10's "Current Payload Envelope" section and s16's "Payload Envelope" section had access to a different version of the slide note: git history shows a single commit for s15 and its digest matches the citation, so the Source text has not changed in this repository since citation.
- Whether `width_mm <= 254` has been implemented anywhere; the vault contains plans, not code.
