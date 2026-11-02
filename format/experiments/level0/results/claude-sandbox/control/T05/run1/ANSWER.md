# ANSWER — Single-Zip width limit: do the compiled pages match their sources?

## Answer

The reviewer is right that the compiled pages are not supported by the source they cite.

Eleven compiled pages state that the current Zipline Single-Zip width limit is `254 mm` and that the 2026-07-30 partner-QA width of `252 mm` is superseded, citing `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Zipline Payload Dimensions Slide - Week of 2026-09-07.md` as the basis. That source note says the opposite:

- Its Envelope card reads `338 × 252 × 205 mm` (image `Attachments/zipline-payload-dimensions-wk-of-2026-09-07/payload-envelope-card-338-252-205.png`).
- It describes the 3D render's `10 in / 254 mm` label as a rounded-imperial pairing (`10 in = 254 mm`), "not a 2 mm hardware change".
- It states explicitly: "Do not treat `254 mm` as a superseding envelope width."

The only vault artifact that shows `254 mm` is the 3D render label (`payload-dimensions-3d-wk-of-2026-09-07.png`: `13.25" / 338mm`, `10" / 254mm`, `8" / 205mm`). Every other source in the vault about the payload envelope uses `252 mm`, including sources dated after the slide:

- `.../PRD/Drone Eligibility Check - MVP Plan - 2026-09-17.md` — "dropbox envelope 338 × 252 × 205 mm (13.31 × 9.92 × 8.07 in)"; example rejection "exceeds envelope width 252 mm".
- `.../Raw/Investigation - Cookbook Weight and Dimension Backfill Review - 2026-10-26.md` — "252 mm envelope axis"; prescreen "321 > 252 mm".
- `.../Raw/Drone Eligibility Check - Research Log and Plan - 2026-09-07.md` — Pack envelope `205 × 252 × 338 mm`.
- `.../Zipline API Doc/Zipline API Documentation Runtime Annotations - 2026-08-27.md` — Pack accepted `252 × 205 × 338 mm / 2495 g`.
- `.../Archive/Eligibility and Architecture/1P Drone Delivery MVP Dimensions Eligibility Proposal (2026-08-12).md`, `... Weight and Dimensions MVP Eligibility Proposal (2026-08-19).md`, `... High-Level System Alignment - MVP.md`, and `.../Slack Clarification - Drone MVP Medium Bag Selection - 2026-08-12.md` — all `338 × 252 × 205 mm`.

So the sources do not agree with the compiled statement. Between the raw artifacts themselves there is a numeric discrepancy (render label `254 mm` vs Envelope card `252 mm`); the user's source note interprets it as rounding, and no Zipline statement in the vault resolves it further. Following the vault rules ("check for contradictions — never silently overwrite"; `freshness_status: disputed` with a sidecar), I recorded the conflict rather than rewriting the numbers. The compiled page `queries/1p-drone-delivery-high-level-system-alignment-mvp-2026-08-13.md` (width `252 mm`) is consistent with the sources and was left untouched.

What a human needs to decide: confirm with Zipline whether the Single-Zip width is `252 mm` or `254 mm`, then either correct the eleven pages to `252 mm` or add a source that actually supports `254 mm`.

## Files relied on (vault-relative)

Instruction and schema files:
- `AGENTS.md`, `.claude/CLAUDE.md`, `KNOWLEDGE.md`, `SCHEMA.md`, `.agents/rules/*.md` (`CONVENTIONS.md` does not exist in this vault)
- `pilot/AUDIT.md`, `pilot/questions-agent.md` (context only)

Sources:
- `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Zipline Payload Dimensions Slide - Week of 2026-09-07.md`
- `Attachments/zipline-payload-dimensions-wk-of-2026-09-07/payload-dimensions-3d-wk-of-2026-09-07.png`
- `Attachments/zipline-payload-dimensions-wk-of-2026-09-07/payload-envelope-card-338-252-205.png`
- `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/PRD/Drone Eligibility Check - MVP Plan - 2026-09-17.md`
- `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Raw/Drone Eligibility Check - Research Log and Plan - 2026-09-07.md`
- `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Raw/Investigation - Cookbook Weight and Dimension Backfill Review - 2026-10-26.md`
- `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Zipline API Doc/Zipline API Documentation Runtime Annotations - 2026-08-27.md`
- `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Zipline API Doc/Pack items into deliveries.md`
- `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Archive/Eligibility and Architecture/1P Drone Delivery MVP Dimensions Eligibility Proposal (2026-08-12).md`
- `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Archive/Eligibility and Architecture/1P Drone Delivery Weight and Dimensions MVP Eligibility Proposal (2026-08-19).md`
- `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Archive/Eligibility and Architecture/1P Drone Delivery High-Level System Alignment - MVP.md`
- `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Slack Clarification - Drone MVP Medium Bag Selection - 2026-08-12.md`
- `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Zipline Google Doc Alignment Responses - Pre-Production and API Documentation - 2026-08-04.md` and `... Zipline Slack Clarification - Dropbox Loading Window and Drone Summon - 2026-08-03.md` (cited by the 2026-07-30 contract page; searched, contain no width figure)

Compiled pages checked (grep over `concepts/`, `entities/`, `comparisons/`, `queries/` plus full read of the envelope sections of):
- `queries/zipline-mvp-partner-confirmed-contract-2026-07-30.md`
- `queries/1p-drone-delivery-checkout-package-dimensions-contract-2026-07-16.md`
- `concepts/drone-delivery-integration-strategy.md`
- `queries/zipline-wonder-weekly-deck-readout-2026-09-15.md`
- `queries/zipline-drone-quote-and-package-eligibility-contract-2026-07-02.md`
- `queries/1p-drone-delivery-high-level-system-alignment-mvp-2026-08-13.md`

## Unable to establish

- Whether the 2 mm difference between the render label (`254 mm`) and the Envelope card (`252 mm`) is a rounding artifact or a real hardware change. The vault holds only the user note's interpretation; no Zipline statement settles it.
- The original 2026-07-30 partner QA is a Google Doc URL not present in the vault; its `252 mm` is known only through vault notes.
- Why the compiled pages diverged from the source note (no git history for the compiled pages beyond the baseline commit).

## Files changed and why

Marked `freshness_status: disputed`, `freshness_reviewed: 2026-11-02`, `updated: 2026-11-02`, added `freshness_sidecar`, and inserted a `[!warning] Disputed` callout under the H1 (width values on the pages were not altered):
1. `concepts/drone-delivery-integration-strategy.md`
2. `queries/zipline-drone-quote-and-package-eligibility-contract-2026-07-02.md`
3. `queries/1p-drone-delivery-checkout-package-dimensions-contract-2026-07-16.md`
4. `queries/zipline-mvp-partner-confirmed-contract-2026-07-30.md`
5. `queries/1p-drone-delivery-eligibility-evaluation-trigger-and-revalidation-contract-2026-07-16.md`
6. `queries/zipline-integration-readiness-guide-2026-06-17.md`
7. `queries/1p-drone-delivery-system-responsibility-boundaries-2026-07-15.md`
8. `queries/zipline-wonder-weekly-deck-readout-2026-09-15.md`
9. `queries/drone-mvp-medium-bag-outer-package-decision.md`
10. `queries/order-packaging-geometry-feasibility-for-drone-dimension-eligibility-2026-08-12.md`
11. `queries/drone-fit-exclusion-test-and-container-count-limits-2026-08-12.md`

Created:
- `.knowlery/freshness/notes/zipline-single-zip-width-252-vs-254.json` — sidecar with the finding, evidence list, open questions, and affected pages (SCHEMA.md freshness convention).
- `log.md` — agent-page log entry required after modifying compiled pages (file did not exist before).
- `ANSWER.md` — this file.

Not done: no user notes modified; no activity-ledger record written because `.knowlery/activity-disabled` exists; no git commit or push; no network.
