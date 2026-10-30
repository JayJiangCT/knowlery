# ANSWER — single-Zip package width: 252 mm vs 254 mm

## Answer

**Currently valid in the vault: (b) 254 mm.** The only Knowledge page carrying the claim holds it in `## Current`:

- `concepts/drone-delivery-integration-strategy.md`, claim `[[drone-delivery-integration-strategy#^c16]]`: "The current single-Zip provider limit is 2495 g and 338 × 254 × 205 mm (5.50 lb, 13.25 × 10 × 8 in); implementation stays canonical in grams and millimetres (src: s15, s16)".

**Historical: (a) 252 mm.** The same page moved the earlier claim to `## History` (line 143): "The current single-Zip provider limit is 2495 g and 338 × 252 × 205 mm (5.50 lb, 13.31 × 9.92 × 8.07 in) per the 2026-07-30 partner QA (src: s10) · superseded 2026-09-15 by [[#^c16]] · week-of-2026-09-07 Payload Dimensions slide revised width to 254 mm; mass, length and height unchanged · src: s15, s16 · by process:cook ^c27". 252 mm originates in the 2026-07-30 Zipline partner QA, recorded in `records/zipline-mvp-partner-confirmed-contract-2026-07-30.md` ("Canonical Dual-Unit Package Limits (2026-07-30)" table, line 105: Maximum width `252 mm` / `9.92 in`).

**When and on what basis the change happened.** Supersession date 2026-09-15, actor `process:cook`. Basis: s15 = the source note `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Zipline Payload Dimensions Slide - Week of 2026-09-07.md` (Zipline "Payload Dimensions, Wk. of 9/7" 3D render labelled `13.25" / 338mm`, `10" / 254mm`, `8" / 205mm`), and s16 = `queries/zipline-wonder-weekly-deck-readout-2026-09-15.md` (legacy 1.x page, "Payload Envelope (Week of 2026-09-07)" section: "This revises the 2026-07-30 partner QA width from `252 mm` to `254 mm`. Mass is not on the slide; keep `2495 g`"). The Record `records/zipline-mvp-partner-confirmed-contract-2026-07-30.md` was also revised the same day (History: "2026-09-15 · revised by process:cook · Current Payload Envelope (Week of 2026-09-07)"; lines 112–132 state "Width is the only metric change: `252 mm` → `254 mm`" and give the rule `width_mm <= 254`).

Version check: the `sha256:` digests on s15 (`811e891e…`) and s16 (`14aff2c4…`) in the concept page, and s6 on the Record, match `tools/digest.py` on the current files, and `blob:9b5a9ac7…` / `blob:9840ab67…` are the current HEAD blobs. The citations are intact; the sources have not changed since citation.

**Yes — the vault contains evidence that disputes the change, and it is in the very source cited for it.**

1. `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Zipline Payload Dimensions Slide - Week of 2026-09-07.md` (the s15 source) lines 30–36: the second week-of-9/7 artifact, the Envelope card, states "`338 × 252 × 205 mm`"; the note concludes "The Envelope card is the numeric payload envelope. It matches the 2026-07-30 partner QA … The 3D width label `10 in / 254 mm` is a rounded-imperial pairing (`10 in = 254 mm`), not a 2 mm hardware change" and ends "**Do not treat `254 mm` as a superseding envelope width.**" The embedded image `Attachments/zipline-payload-dimensions-wk-of-2026-09-07/payload-envelope-card-338-252-205.png` indeed reads "Envelope 338 × 252 × 205 mm". So the cited source supports 254 mm only as a rounded imperial label and explicitly argues against the supersession that cites it; the s16 readout and the 2026-09-15 Record revision adopted the 3D-render label and did not address the Envelope card.
2. Later user Sources keep using 252 mm as the operative width: `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/PRD/Drone Eligibility Check - MVP Plan - 2026-09-17.md` line 470 ("box 292 × 292 mm … exceeds envelope width 252 mm", dated two days after the supersession) and `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Raw/Investigation - Cookbook Weight and Dimension Backfill Review - 2026-10-26.md` lines 192 and 287 ("252 mm envelope axis"; "Rejected by prescreen (321 > 252 mm)").
3. Several other pages carry the 254 figure only by repeating the concept/Record (`queries/1p-drone-delivery-system-responsibility-boundaries-2026-07-15.md` l.245, `queries/zipline-integration-readiness-guide-2026-06-17.md` l.374, `records/zipline-drone-quote-and-package-eligibility-contract-2026-07-02.md` l.137–161, `records/1p-drone-delivery-checkout-package-dimensions-contract-2026-07-16.md` l.220, `records/drone-mvp-medium-bag-outer-package-decision.md` l.99). They add no independent evidence. The pilot question file `pilot/questions-agent.md` line 49 (G1-26) already flags the 252/254 question as open.

Net assessment: the 2 mm "change" rests on one slide label versus one slide card from the same week; no Zipline partner answer in the vault states 254 mm. Under CONVENTIONS §8 this is a conflict between two current sources that the vault has not ranked, so `^c16` should be treated as `#disputed` and the question raised in `## Open` rather than resolved either way. A secondary process issue: the Record's frozen Detail (§6) was rewritten on 2026-09-15 instead of a follow-on Record being written, so every page citing `zipline-mvp-partner-confirmed-contract-2026-07-30` for the width should be reviewed. I made no vault edits because the task did not ask for changes.

## Files relied on (vault-relative)

- `AGENTS.md`, `CONVENTIONS.md`, `.claude/CLAUDE.md`
- `concepts/drone-delivery-integration-strategy.md`
- `records/zipline-mvp-partner-confirmed-contract-2026-07-30.md`
- `queries/zipline-wonder-weekly-deck-readout-2026-09-15.md`
- `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Zipline Payload Dimensions Slide - Week of 2026-09-07.md`
- `Attachments/zipline-payload-dimensions-wk-of-2026-09-07/payload-envelope-card-338-252-205.png`
- `Attachments/zipline-payload-dimensions-wk-of-2026-09-07/payload-dimensions-3d-wk-of-2026-09-07.png`
- `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/PRD/Drone Eligibility Check - MVP Plan - 2026-09-17.md` (line 470 only)
- `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Raw/Investigation - Cookbook Weight and Dimension Backfill Review - 2026-10-26.md` (frontmatter and lines 192, 287)
- `log.md`, `tools/digest.py` (run, not edited), git history (read-only `git log`/`git show`/`git rev-parse`)
- grep hits across `queries/`, `records/`, `pilot/questions-agent.md` listed above (not read in full)

## Not established

- Whether Zipline itself ever confirmed 254 mm as a hardware change; the vault has no partner statement to that effect, only the slide label.
- The original Google Slides deck (s16 source URL) is not in the vault and the network was not used, so the slide cannot be re-checked beyond the two PNG captures.
- Why `process:cook` on 2026-09-15 adopted the 3D label over the Envelope card; no reasoning is logged (`log.md` has only the 2026-10-30 build line).

## Files changed

- `ANSWER.md` (this file, new). No other vault files were changed.
