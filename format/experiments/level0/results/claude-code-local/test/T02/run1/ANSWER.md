# ANSWER — Single-Zip package width: 252 mm or 254 mm?

Answered 2026-11-02 by claude/fable-5.1, read-only investigation (no Knowledge page or Record was edited).

## Short answer

- **Currently held as valid: 254 mm.** The concept page `concepts/drone-delivery-integration-strategy.md` holds it as claim `^c16` under `## Current` ("… 2495 g and 338 × 254 × 205 mm (5.50 lb, 13.25 × 10 × 8 in) …", src: s15, s16, s10). The Record `records/zipline-mvp-partner-confirmed-contract-2026-07-30.md` section "Current Payload Envelope (Week of 2026-09-07)" states "Width is the only metric change: `252 mm` → `254 mm`" and gives `width_mm <= 254` as the current eligibility comparison. `records/drone-mvp-medium-bag-outer-package-decision.md` (line 99) also treats `338 × 254 × 205 mm` as the current envelope.
- **Historical: 252 mm.** It is the 2026-07-30 partner-QA value. On the concept page it is claim `^c27`, now in `## History`: "The current single-Zip provider limit is 2495 g and 338 × 252 × 205 mm (width 9.92 in) per the 2026-07-30 partner QA … · superseded 2026-09-15 by [[#^c16]] · week-of-2026-09-07 Payload Dimensions slide revised width to 254 mm · src: s15, s16 · by process:cook ^c27". The same Record keeps 252 mm in its "Canonical Dual-Unit Package Limits (2026-07-30)" table and calls the July envelope "now itself historical for width".
- **When and on what basis:** 2026-09-15, by `process:cook`, on the basis of the Zipline "Payload Dimensions, Wk. of 9/7" slide, whose 3D render labels the width axis `10" / 254mm` (confirmed by viewing `Attachments/zipline-payload-dimensions-wk-of-2026-09-07/payload-dimensions-3d-wk-of-2026-09-07.png`). The change was recorded in the concept History line above and in the Record History line "2026-09-15 · revised by process:cook · Current Payload Envelope (Week of 2026-09-07)".
- **Is the change disputed in the vault? Yes, and by its own cited source.** See below. By CONVENTIONS §8 this is a conflict between two current sources that should be surfaced, not resolved; `^c16` is not currently marked `#disputed` and no `## Open` question exists for it. I did not change that because the task was a question, not a vault change.

## Evidence that disputes the change

1. **The Source cited for the change says the opposite.** `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Zipline Payload Dimensions Slide - Week of 2026-09-07.md` (cited as s15 on the concept page and s6 on the 2026-07-30 Record) records two artifacts: the 3D render (width label `10 in / 254 mm`) and a separate Envelope card reading `338 × 252 × 205 mm` (confirmed by viewing `Attachments/zipline-payload-dimensions-wk-of-2026-09-07/payload-envelope-card-338-252-205.png`). The note concludes: "The Envelope card is the numeric payload envelope. It matches the 2026-07-30 partner QA of `338 × 252 × 205 mm`. The 3D width label `10 in / 254 mm` is a rounded-imperial pairing (`10 in = 254 mm`), not a 2 mm hardware change." and "Do not treat `254 mm` as a superseding envelope width."
   - Version check: `tools/digest.py` on the current file gives `sha256:811e891e…770f0d`, identical to the digest pinned on both citing pages, and `git rev-parse HEAD:<path>` gives blob `9b5a9ac7…c93b1a820f33e4c`, also identical. So the Source text that contradicts the supersession is exactly the version the citing pages pin.
2. **Later-dated Sources still use 252 mm as the envelope.** `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/PRD/Drone Eligibility Check - MVP Plan - 2026-09-17.md` line 470 ("exceeds envelope width 252 mm") and `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Raw/Investigation - Cookbook Weight and Dimension Backfill Review - 2026-10-26.md` lines 192 ("226 mm vs 252 mm envelope axis") and 287 ("Rejected by prescreen (321 > 252 mm)") are dated after 2026-09-15 and treat 252 mm as the limit in use.
3. **The supporting evidence for 254 mm is thin and partly circular.** `^c16` cites s15 (the slide note, which disputes it), s16 (`queries/zipline-wonder-weekly-deck-readout-2026-09-15.md`, a legacy 1.x page with no `updated_by`, per §2a a dated snapshot; it restates the 3D label and cites the same slide), and s10 (the 2026-07-30 Record, whose 254 mm section was written by the same actor on the same day). Net: one slide label, read against the Envelope card on the same slide set.
4. **The 2026-07-30 Record's frozen part was rewritten.** Its `## History` shows three "revised by process:cook" lines dated after the Record's own date (2026-08-03, 08-04, 09-15; plus a 07-30 line that is arguably the original authoring), the last one being the 254 mm section, while `status: current` and `kind: finding`. Per §6 the evidence scope of a non-draft Record is never rewritten and every page citing it needs review. Its pinned digest matches the current file, so the citation is at least consistent with the revised text.

## Paths relied on

- `AGENTS.md`, `CONVENTIONS.md`, `log.md`, `tools/digest.py`
- `concepts/drone-delivery-integration-strategy.md` (`^c16`, `^c27`, Sources s10/s15/s16, History)
- `records/zipline-mvp-partner-confirmed-contract-2026-07-30.md` (both envelope tables, Sources s6, History)
- `records/drone-mvp-medium-bag-outer-package-decision.md`
- `queries/zipline-wonder-weekly-deck-readout-2026-09-15.md` (legacy; "Payload Envelope (Week of 2026-09-07)" section)
- `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Zipline Payload Dimensions Slide - Week of 2026-09-07.md`
- `Attachments/zipline-payload-dimensions-wk-of-2026-09-07/payload-dimensions-3d-wk-of-2026-09-07.png`, `Attachments/zipline-payload-dimensions-wk-of-2026-09-07/payload-envelope-card-338-252-205.png`
- `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/PRD/Drone Eligibility Check - MVP Plan - 2026-09-17.md`
- `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Raw/Investigation - Cookbook Weight and Dimension Backfill Review - 2026-10-26.md`
- Other pages echoing the change, used only to confirm vault-wide state: `records/zipline-drone-quote-and-package-eligibility-contract-2026-07-02.md`, `records/1p-drone-delivery-checkout-package-dimensions-contract-2026-07-16.md`, `queries/1p-drone-delivery-system-responsibility-boundaries-2026-07-15.md`, `queries/1p-drone-delivery-eligibility-evaluation-trigger-and-revalidation-contract-2026-07-16.md`, `queries/zipline-integration-readiness-guide-2026-06-17.md`, `queries/order-packaging-geometry-feasibility-for-drone-dimension-eligibility-2026-08-12.md`, `queries/drone-fit-exclusion-test-and-container-count-limits-2026-08-12.md`.
- Git (read-only): `git log`, `git rev-parse HEAD:<path>`, `git cat-file -p`, `git show c2ddf3e:<path>`.

## What I could not establish

- **Whether the slide note's "do not treat 254 mm as superseding" paragraph existed when `^c16` was written.** The slide note has `created: 2026-09-15` and `updated: 2026-09-15`, and all content entered git in one commit `c7daf22` (2026-10-28); the `sha256:`/`blob:` pins were added later by commit `79be26b` (previously the lines read `@pin`). So the digest proves what the Source said at pin time, not at supersession time. The order of the two 2026-09-15 writes is unrecoverable from the vault.
- **The actual date of the change.** 2026-09-15 comes only from History lines and frontmatter; no git commit dates it.
- **Which value Zipline actually intends.** The vault has no partner statement resolving the 2 mm difference; the slide's own two artifacts disagree, and the slide note's reading (252 mm is the envelope; 254 mm is `10 in` rounded) is itself an interpretation by whoever wrote the note.

## Files changed

- `ANSWER.md` (this file) — created, as the task required.
- `log.md` — one line appended under a new `## 2026-11-02` heading per CONVENTIONS §10, recording the ANSWER.md write. No Knowledge page, Record or Source was modified.
