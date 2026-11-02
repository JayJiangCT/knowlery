# ANSWER — single-Zip width limit review (2026-11-02)

## Answer

The reviewer is partly right, and the sources conflict. The conflict is now recorded in the vault; no winner was picked.

- The compiled claim `[[drone-delivery-integration-strategy#^c16]]` says the current single-Zip limit is `2495 g / 338 × 254 × 205 mm` and cites s15 (the week-of-2026-09-07 Payload Dimensions slide note), s16 (the 2026-09-15 weekly deck readout) and s10 (the 2026-07-30 partner-confirmed Record).
- Its primary cited source **s15 says the opposite**: the Envelope card reads `338 × 252 × 205 mm`, the 3D render's `10 in / 254 mm` label is a rounded-imperial pairing, and the note ends "Do not treat `254 mm` as a superseding envelope width." The two attached PNGs confirm the two slide artifacts disagree with each other (3D label 254 mm; Envelope card 252 mm).
- s10 and s16 both adopt 254 mm, but they are not independent: both read the same slide. s10's "Current Payload Envelope (Week of 2026-09-07)" section was appended on 2026-09-15 into the frozen part of a 2026-07-30 Record (its History records "revised by process:cook"); the Record's original partner-QA width is 252 mm.
- Source digests pinned on the concept page match the current files for s15, s10 and s16, so this is not a changed-source case: the claim disagreed with s15 at citation time.

Per CONVENTIONS §8 (two current sources that contradict each other and cannot be ranked), `^c16` is marked `#disputed`, question `^q12` is opened, and the decision is left to a human. The vault cannot currently establish whether the single-Zip width limit is 252 mm or 254 mm.

## Files changed

- `concepts/drone-delivery-integration-strategy.md` — appended `#disputed` to `^c16` (claim text unchanged, id still last token); added `^q12` to `## Open` describing the 252 vs 254 mm conflict; added a 2026-11-02 line at the top of `## History`; bumped `updated` / `updated_by`. `status` was already `disputed`. No `## Sources` lines changed.
- `log.md` — new `## 2026-11-02` heading with one line per write.
- `ANSWER.md` — this file.

Not changed, on purpose: `records/zipline-mvp-partner-confirmed-contract-2026-07-30.md` (frozen Record; its post-freeze revision is already in its History, and §6 says the consequence is review of citing pages, which is what was done), and legacy `queries/` pages that also state 254 mm (§2a: do not restructure legacy pages).

## Paths relied on

- `CONVENTIONS.md`, `AGENTS.md`, `tools/digest.py`
- `concepts/drone-delivery-integration-strategy.md` (claim `^c16`, superseded `^c27`, sources s10, s15, s16)
- `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Zipline Payload Dimensions Slide - Week of 2026-09-07.md` (s15; digest `sha256:811e891e…` and blob `9b5a9ac7…` verified against HEAD)
- `Attachments/zipline-payload-dimensions-wk-of-2026-09-07/payload-dimensions-3d-wk-of-2026-09-07.png` (shows 13.25" / 338 mm, 10" / 254 mm, 8" / 205 mm)
- `Attachments/zipline-payload-dimensions-wk-of-2026-09-07/payload-envelope-card-338-252-205.png` (shows `338 × 252 × 205 mm`)
- `records/zipline-mvp-partner-confirmed-contract-2026-07-30.md` (s10; digest matches; blob differs from the pinned one only in `## Sources` lines, which is not an evidence change)
- `queries/zipline-wonder-weekly-deck-readout-2026-09-15.md` (s16, legacy page; digest and blob match)

Other vault pages carrying the same unresolved 254 mm figure (not edited): `records/zipline-drone-quote-and-package-eligibility-contract-2026-07-02.md`, `records/1p-drone-delivery-checkout-package-dimensions-contract-2026-07-16.md`, `records/drone-mvp-medium-bag-outer-package-decision.md`, `queries/zipline-integration-readiness-guide-2026-06-17.md`, `queries/1p-drone-delivery-system-responsibility-boundaries-2026-07-15.md`. Anyone resolving `^q12` should review these too.

## Unable to establish

- Which number Zipline intends as the hardware limit: the 3D-render label (254 mm) or the Envelope card (252 mm). No source in the vault states which artifact is authoritative, and the network and the slide owner (Jay supplied the slide) are out of reach for this task.
- Whether a 2 mm difference has practical effect; the Medium bag decision Record notes the `330 × 254` footprint matches a 254 mm width exactly, so the choice may matter for bag eligibility.
- Mass (`2495 g`), length (`338 mm`) and height (`205 mm`) are consistent across all sources; only width is in dispute.
