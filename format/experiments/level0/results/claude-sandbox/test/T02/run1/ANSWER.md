# Answer: single-Zip package width limit — 252 mm vs 254 mm

## Short answer

- **Currently valid (per the vault's knowledge layer): 254 mm.** Claim `[[drone-delivery-integration-strategy#^c16]]` in `## Current`: "The current single-Zip provider limit, the current hardware maximum, is 2495 g and 338 × 254 × 205 mm (5.50 lb, 13.25 × 10 × 8 in) … (src: s15, s16, s10)". The Record `[[zipline-mvp-partner-confirmed-contract-2026-07-30]]` (status `current`) agrees: "Width is the only metric change: `252 mm` → `254 mm`" and gives the current rule `width_mm <= 254` (section "Current Payload Envelope (Week of 2026-09-07)").
- **Historical: 252 mm.** It is the 2026-07-30 Zipline partner-QA value (`338 mm L × 252 mm W × 205 mm H`, `9.92 in`), recorded in the same Record's "Canonical Dual-Unit Package Limits (2026-07-30)" table, and in the concept's `## History` as superseded claim `^c27`.
- **When / on what basis the change happened:** on **2026-09-15**, by `process:cook`, the concept superseded `^c27` with `^c16` with the reason "week-of-2026-09-07 Payload Dimensions slide revised width to 254 mm", citing s15 (the Source note `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Zipline Payload Dimensions Slide - Week of 2026-09-07`) and s16 (the legacy readout `queries/zipline-wonder-weekly-deck-readout-2026-09-15`, "This revises the 2026-07-30 partner QA width from `252 mm` to `254 mm`"). The Record was revised the same day ("2026-09-15 · revised by process:cook · Current Payload Envelope (Week of 2026-09-07)"). The only new evidence behind the change is the 3D "Payload Dimensions, Wk. of 9/7" render, whose width axis is labelled `10" / 254mm`. No partner statement, document, or attestation says the hardware width changed.
- **Yes, the vault contains evidence disputing the change — and it is the very Source the change cites.** The Source note (s15 in the concept, s6 in the Record) says: "The Envelope card states: `338 × 252 × 205 mm` … The 3D width label `10 in / 254 mm` is a rounded-imperial pairing (`10 in = 254 mm`), not a 2 mm hardware change. … **Do not treat `254 mm` as a superseding envelope width.**" The attached Envelope-card image (`Attachments/zipline-payload-dimensions-wk-of-2026-09-07/payload-envelope-card-338-252-205.png`) indeed reads `338 × 252 × 205 mm`, while the render (`…/payload-dimensions-3d-wk-of-2026-09-07.png`) reads `10"/254mm`. I verified that the Source has **not changed since it was cited**: its evidence-scope digest today is `sha256:811e891e…770f0d` and its HEAD blob is `9b5a9ac7…33e4c`, both identical to the `## Sources` lines in the concept and the Record. So the Sept-15 supersession was made against a Source that, in the same version, explicitly argued the opposite; the Record and the readout did not acknowledge the Envelope card at all.

Later Sources also keep using 252 mm as the operating envelope after the change date: `…/PRD/Drone Eligibility Check - MVP Plan - 2026-09-17.md` line 86 ("dropbox envelope 338 × 252 × 205 mm (13.31 × 9.92 × 8.07 in)", also line 470) and `…/Raw/Investigation - Cookbook Weight and Dimension Backfill Review - 2026-10-26.md` lines 192 and 287 ("252 mm envelope axis", "321 > 252 mm"). The current Record `[[drone-mvp-medium-bag-outer-package-decision]]`, by contrast, builds on 254 ("Width | 254 mm | 254 mm | exact match"). The pilot question list also flags the matter as open (`pilot/questions-agent.md` line 49, G1-26).

## Assessment

Under CONVENTIONS §8 this is a conflict between two current sources that cannot be ranked (a rounded render label vs. a numeric Envelope card from the same slide set, with no partner attestation), so the 254 mm claim `^c16` should be treated as **disputed** rather than settled, and the 2 mm difference should be escalated to a human (Rob / Zipline) before it is relied on for eligibility thresholds. I did not edit the concept or Record because the task was a question, not an update; marking `^c16 #disputed` and opening an `## Open` question is the recommended follow-up.

## Files relied on (vault-relative)

- `AGENTS.md`, `CONVENTIONS.md`
- `concepts/drone-delivery-integration-strategy.md` (claims `^c16`, `^c27`; Sources s10, s15, s16; History 2026-09-15 line)
- `records/zipline-mvp-partner-confirmed-contract-2026-07-30.md` (Summary table row "Single-Zip package"; "Canonical Dual-Unit Package Limits (2026-07-30)"; "Current Payload Envelope (Week of 2026-09-07)"; Sources s6; History)
- `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Zipline Payload Dimensions Slide - Week of 2026-09-07.md`
- `Attachments/zipline-payload-dimensions-wk-of-2026-09-07/payload-dimensions-3d-wk-of-2026-09-07.png`
- `Attachments/zipline-payload-dimensions-wk-of-2026-09-07/payload-envelope-card-338-252-205.png`
- `queries/zipline-wonder-weekly-deck-readout-2026-09-15.md` (legacy page, no `updated_by`; section "Payload Envelope (Week of 2026-09-07)")
- `records/drone-mvp-medium-bag-outer-package-decision.md` (geometry table)
- `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/PRD/Drone Eligibility Check - MVP Plan - 2026-09-17.md` (lines 86, 470)
- `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Raw/Investigation - Cookbook Weight and Dimension Backfill Review - 2026-10-26.md` (lines 192, 287)
- `pilot/questions-agent.md` (G1-26)
- `tools/digest.py`, `log.md`, and read-only `git log` / `git rev-parse` / `git cat-file` for version checks

## Verification notes

- Source digest/blob match the cited versions exactly (no evidence change since 2026-09-15).
- Record `zipline-mvp-partner-confirmed-contract-2026-07-30`: evidence-scope digest `sha256:980486cf…8be2a` matches the concept's s10; its HEAD blob (`e23d5c6f…`) differs from the cited blob (`9fef7255…`) only because `## Sources` lines were later pinned from `@pin` to digests (commit 4630ba7) — not an evidence change per §7.
- Readout `queries/zipline-wonder-weekly-deck-readout-2026-09-15`: digest `sha256:14aff2c4…97d2` and blob `9840ab67…` match s16.

## Could not establish

- Whether Zipline's hardware bay is physically 252 or 254 mm: the vault has no partner statement after 2026-07-30 addressing the 2 mm difference; both numbers come from Zipline-supplied artifacts of the same week.
- Why `process:cook` on 2026-09-15 disregarded the Envelope card and the Source's own warning; no log or History line explains it (`log.md` only contains the 2026-10-30 build line).
- `tools/digest.py --claim` failed with a traceback in this environment, so claim fingerprints were not computed; this did not affect the answer.

## Files changed

- `ANSWER.md` — created (this file), as the task required.
- `log.md` — one line appended recording the ANSWER.md write, per CONVENTIONS §10.
