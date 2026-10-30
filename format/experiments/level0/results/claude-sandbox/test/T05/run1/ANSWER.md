# Answer — single-Zip width limit (2026-10-30)

## Answer

The reviewer's concern is justified: the compiled statement is not consistent with the Source it cites, and the vault's sources conflict on the single-Zip width.

**The compiled statement.** `concepts/drone-delivery-integration-strategy.md` claim `^c16` says the current single-Zip provider limit is `2495 g` and `338 × 254 × 205 mm` (`13.25 × 10 × 8 in`), citing s15 (the week-of-2026-09-07 Payload Dimensions slide Source) and s16 (`queries/zipline-wonder-weekly-deck-readout-2026-09-15`, a legacy compiled page cited as a record). The earlier claim `^c27` (`338 × 252 × 205 mm` per the 2026-07-30 partner QA) was superseded on 2026-09-15 on the ground that the slide "revised width to 254 mm".

**What the cited sources actually say.**

- **s15** (`Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Zipline Payload Dimensions Slide - Week of 2026-09-07.md`) — digest verified unchanged (`sha256:811e891e…770f0d`, blob `9b5a9ac7…`). It describes two artifacts: the 3D render labels width `10 in / 254 mm`, but the separate **Envelope card reads `338 × 252 × 205 mm`**. The Source states explicitly that the Envelope card is the numeric payload envelope, that it matches the 2026-07-30 partner QA, that `254 mm` is a rounded-imperial pairing (`10 in = 254 mm`) and not a 2 mm hardware change, and: "Do not treat `254 mm` as a superseding envelope width." The attached images (`Attachments/zipline-payload-dimensions-wk-of-2026-09-07/`) confirm both readings: the card shows `338 × 252 × 205 mm`; the render shows `10" / 254mm`.
- **s16** (`queries/zipline-wonder-weekly-deck-readout-2026-09-15.md`) — digest verified unchanged. It reads the same slide as revising width `252 → 254 mm` and lists s15 as its source. It is a compiled page, not independent evidence; it is a second reading of the same slide that disagrees with the Source's own text.
- The three Records that cite the slide (`records/zipline-mvp-partner-confirmed-contract-2026-07-30.md` §"Current Payload Envelope", `records/1p-drone-delivery-checkout-package-dimensions-contract-2026-07-16.md`, `records/zipline-drone-quote-and-package-eligibility-contract-2026-07-02.md`) all adopt `254 mm` and mention only the 3D render, not the Envelope card. All carry the identical slide digest, so none of them saw a different version of the Source.

**Other vault sources on the envelope.**

- `338 × 252 × 205 mm / 2495 g`: 2026-07-30 partner QA (via `records/zipline-mvp-partner-confirmed-contract-2026-07-30.md`); `Wonder/…/Archive/Eligibility and Architecture/1P Drone Delivery High-Level System Alignment - MVP.md`; `…/1P Drone Delivery MVP Dimensions Eligibility Proposal (2026-08-12).md`; `…/Slack Clarification - Drone MVP Medium Bag Selection - 2026-08-12.md`; `…/Zipline API Doc/Zipline API Documentation Runtime Annotations - 2026-08-27.md` (Pack accepted an isolated `252 × 205 × 338 mm / 2495 g` item; no numeric envelope is published by the API). **Dated after the slide:** `…/PRD/Drone Eligibility Check - MVP Plan - 2026-09-17.md` ("dropbox envelope 338 × 252 × 205 mm", with a `DIMENSION_EXCEEDED` example against "envelope width 252 mm") and `…/Raw/Investigation - Cookbook Weight and Dimension Backfill Review - 2026-10-26.md` ("226 mm vs 252 mm envelope axis").
- `338 × 254 × 205 mm`: only the 3D-render label inside s15 and the compiled pages/Records derived from it. No Source dated after 2026-09-07 uses 254 mm.
- Mass `2495 g` is undisputed everywhere; length `338` and height `205` are undisputed.

**Conclusion.** The sources conflict. The cited Source itself says 252 mm and rejects 254 mm; the compiled chain (s16 and the Records) says 254 mm; the two most recent Sources (2026-09-17, 2026-10-26) still operate on 252 mm. Per CONVENTIONS §8 this is a conflict between current sources I cannot rank (a Source's own statement against a process reading of its image, plus a 2 mm difference that Zipline alone can settle), so I have not picked a winner. The claim is marked `#disputed` and the question is recorded in `## Open`.

## Files relied on (vault-relative)

- `AGENTS.md`, `CONVENTIONS.md`, `log.md`, `tools/digest.py`
- `concepts/drone-delivery-integration-strategy.md`
- `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Zipline Payload Dimensions Slide - Week of 2026-09-07.md`
- `Attachments/zipline-payload-dimensions-wk-of-2026-09-07/payload-envelope-card-338-252-205.png`
- `Attachments/zipline-payload-dimensions-wk-of-2026-09-07/payload-dimensions-3d-wk-of-2026-09-07.png`
- `queries/zipline-wonder-weekly-deck-readout-2026-09-15.md`
- `records/zipline-mvp-partner-confirmed-contract-2026-07-30.md`
- `records/1p-drone-delivery-checkout-package-dimensions-contract-2026-07-16.md` (grep)
- `records/zipline-drone-quote-and-package-eligibility-contract-2026-07-02.md` (grep)
- `records/drone-mvp-medium-bag-outer-package-decision.md` (grep)
- `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/PRD/Drone Eligibility Check - MVP Plan - 2026-09-17.md` (lines 84–88)
- `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Raw/Investigation - Cookbook Weight and Dimension Backfill Review - 2026-10-26.md` (lines 190–193)
- `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Zipline API Doc/Zipline API Documentation Runtime Annotations - 2026-08-27.md` (table rows)
- Grep hits in: `…/Archive/Eligibility and Architecture/1P Drone Delivery High-Level System Alignment - MVP.md`, `…/1P Drone Delivery MVP Dimensions Eligibility Proposal (2026-08-12).md`, `…/Slack Clarification - Drone MVP Medium Bag Selection - 2026-08-12.md`

## Files changed and why

- `concepts/drone-delivery-integration-strategy.md` — appended `#disputed` to `^c16`; added `^q8` to `## Open` describing the 254 vs 252 mm conflict; appended Sources `s33` (2026-09-17 PRD plan) and `s34` (2026-10-26 backfill review) with digests and blobs; prepended a 2026-10-30 History line; set `updated`/`updated_by`. Page `status` was already `disputed` (because of `^c24`), so it was left as is. No claim text was altered or superseded; nothing deleted.
- `log.md` — one line under `## 2026-10-30` for the above write.
- `ANSWER.md` — this file (new).

Not changed: the three Records that adopt 254 mm (frozen evidence scope; CONVENTIONS §6 forbids rewriting, and a new Record would be picking a side), the legacy page `queries/zipline-wonder-weekly-deck-readout-2026-09-15.md`, and the slide Source (user-owned).

## Unable to establish

- Which width Zipline actually considers the limit. The 3D render and the Envelope card on the same week-of-9/7 slide differ by 2 mm; only Zipline (or the human who captured the slide) can say whether the card or the render is authoritative.
- Why the 2026-09-15 cook run recorded "revised width to 254 mm" when the Source it cited, at the same digest, says the opposite. The git history in this vault is shallow (three commits), so I could not check whether the Source text was edited after the Records were written; the digests in all citing pages match the current file, which suggests the Source read 252 mm at citation time.
- Whether the 2026-09-17 PRD plan and 2026-10-26 review use 252 mm as a deliberate correction or by carrying forward the July value; neither mentions the slide.
