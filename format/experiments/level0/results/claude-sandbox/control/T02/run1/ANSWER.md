# Answer: Single-Zip package width limit — 252 mm vs 254 mm

## Short answer

- **Currently held as valid by the compiled pages: 254 mm** (`338 × 254 × 205 mm`, `2495 g`). The canonical statement is in [[queries/zipline-mvp-partner-confirmed-contract-2026-07-30]] (`status: active`, `retrieval_priority: high`, `freshness_status: active`, `updated: 2026-09-15`), section "Current Payload Envelope (Week of 2026-09-07)": "Width is the only metric change: `252 mm` → `254 mm`. Length and height stay `338 mm` and `205 mm`." The eligibility block there reads `width_mm <= 254`.
- **Historical: 252 mm** — the 2026-07-30 Zipline partner QA answer (`338 mm L × 252 mm W × 205 mm H`, `9.92 in`), recorded in the same page's "Canonical Dual-Unit Package Limits (2026-07-30)" table and explicitly labelled "That July envelope is now itself historical for width."
- **When / basis of the change:** the change was made in the 2026-09-15 agent ("cook refresh") session, on the basis of a Zipline **Payload Dimensions** slide labelled "Wk. of 9/7" that Jay supplied. The 3D render in that slide labels the bay width `10" / 254mm` (`Attachments/zipline-payload-dimensions-wk-of-2026-09-07/payload-dimensions-3d-wk-of-2026-09-07.png`). Evidence of timing: [[queries/zipline-drone-quote-and-package-eligibility-contract-2026-07-02]] "Cook Refresh (2026-09-15) ... Cook result: Current Eligibility / Quote comparison uses width `254 mm`. The 2026-07-30 partner QA width `252 mm` is retained as historical."; the user note holding the slide has `created: 2026-09-15`; the partner-contract page has `updated: 2026-09-15`, `freshness_reviewed: 2026-09-15` and alias `338 254 205`.
- **Yes, the vault contains evidence disputing the change — and it is the compiled pages' own cited source.** The user note [[Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Zipline Payload Dimensions Slide - Week of 2026-09-07]] (user-owned, read-only) says the week-of-9/7 material consists of *two* artifacts: the 3D render (width `10 in / 254 mm`) and a separate **Envelope card** reading `338 × 252 × 205 mm` (`Attachments/zipline-payload-dimensions-wk-of-2026-09-07/payload-envelope-card-338-252-205.png`, which I viewed; it shows exactly that string). The note concludes: "The Envelope card is the numeric payload envelope. It matches the 2026-07-30 partner QA of `338 × 252 × 205 mm`. The 3D width label `10 in / 254 mm` is a rounded-imperial pairing (`10 in = 254 mm`), not a 2 mm hardware change." and ends with "**Do not treat `254 mm` as a superseding envelope width.**" Every compiled page that adopts 254 mm lists this note as its source but reports the opposite conclusion and never mentions the Envelope card.

## Supporting detail

### Pages that hold 254 mm as current (all compiled/agent pages, all dated 2026-09-15 or later)

| Page | Statement |
| --- | --- |
| [[queries/zipline-mvp-partner-confirmed-contract-2026-07-30]] | Current envelope table: width `254 mm` / `10 in`; 2026-07-30 column `252 mm / 9.92 in`; `width_mm <= 254` |
| [[queries/zipline-wonder-weekly-deck-readout-2026-09-15]] (`updated: 2026-09-20`) | "This revises the 2026-07-30 partner QA width from `252 mm` to `254 mm`. Mass is not on the slide; keep `2495 g`." |
| [[queries/zipline-drone-quote-and-package-eligibility-contract-2026-07-02]] | Cook Refresh 2026-09-15 result quoted above; "that width is superseded" |
| [[concepts/drone-delivery-integration-strategy]] | "The current provider Single-Zip limit is `2495 g / 338 × 254 × 205 mm`" |
| [[queries/1p-drone-delivery-checkout-package-dimensions-contract-2026-07-16]], [[queries/1p-drone-delivery-eligibility-evaluation-trigger-and-revalidation-contract-2026-07-16]], [[queries/1p-drone-delivery-system-responsibility-boundaries-2026-07-15]], [[queries/zipline-integration-readiness-guide-2026-06-17]], [[queries/drone-fit-exclusion-test-and-container-count-limits-2026-08-12]], [[queries/order-packaging-geometry-feasibility-for-drone-dimension-eligibility-2026-08-12]] | Each carries the same "current 338 × 254 × 205 mm; 2026-07-30 QA used 252 mm" sentence |
| [[queries/drone-mvp-medium-bag-outer-package-decision]] (`updated: 2026-10-19`) | Evaluates the new Medium bag against `338 × 254 × 205 mm`: width 254 mm = "exact match"; notes that "Against the earlier 2026-07-30 envelope (`338 × 252 × 205 mm`) the same bag was 2 mm over on width." |

### Pages that still state 252 mm without the revision

- [[queries/1p-drone-delivery-high-level-system-alignment-mvp-2026-08-13]] (`status: draft`, `updated: 2026-09-03`, description says "Historical") — "Provider Envelope and Weight Gate" table: Width `252 mm`. Predates the 2026-09-15 change; not an independent dispute, just not yet revised.
- User note `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Archive/Eligibility and Architecture/1P Drone Delivery High-Level System Alignment - MVP.md` (`updated: 2026-08-21`) — Width `252 mm` (source of the above).

### Evidence that disputes or undercuts the change

1. **Direct dispute (strongest):** the slide note itself, quoted above, plus the Envelope-card image `338 × 252 × 205 mm`. The compiled pages adopted the 3D-render label and did not record the Envelope card or the note's conclusion. This is an unresolved contradiction between a user source and the agent pages that cite it; the agent pages carry `freshness_status: active`, not `disputed`.
2. **Later user notes keep using 252 mm as the working envelope**, after the 2026-09-15 change:
   - `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/PRD/Drone Eligibility Check - MVP Plan - 2026-09-17.md` (`updated: 2026-10-27`): "dropbox envelope 338 × 252 × 205 mm (13.31 × 9.92 × 8.07 in)"; a test-case row reads "exceeds envelope width 252 mm".
   - `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Raw/Investigation - Cookbook Weight and Dimension Backfill Review - 2026-10-26.md`: "largest outer footprint 226 mm vs 252 mm envelope axis"; "Rejected by prescreen (321 > 252 mm)".
   These are the most recent user-authored statements in the vault (October 2026) and they do not adopt 254 mm.
3. **Practical significance:** per [[queries/drone-mvp-medium-bag-outer-package-decision]], the new Medium bag's 254 mm width is an exact fit only under the 254 mm envelope and is 2 mm over under 252 mm, so the 2 mm question is decision-relevant, not cosmetic.

### Assessment

The vault's *compiled* position is 254 mm current / 252 mm historical, changed on 2026-09-15 from the week-of-9/7 slide's 3D render. However, the underlying user note explicitly rejects that reading (Envelope card = 252 mm; 254 mm is a `10 in` rounding), and the newest user documents (2026-09-17 PRD, 2026-10-26 investigation) continue to use 252 mm. The agent pages therefore state the change with more confidence than the evidence supports; a correct reading of the vault is "252 mm is the partner-confirmed numeric envelope; 254 mm is a rounded-imperial label that the compiled pages promoted to a revision, and that promotion is disputed by its own source."

## Files relied on (vault-relative)

- `AGENTS.md`
- `queries/zipline-mvp-partner-confirmed-contract-2026-07-30.md`
- `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Zipline Payload Dimensions Slide - Week of 2026-09-07.md`
- `Attachments/zipline-payload-dimensions-wk-of-2026-09-07/payload-dimensions-3d-wk-of-2026-09-07.png`
- `Attachments/zipline-payload-dimensions-wk-of-2026-09-07/payload-envelope-card-338-252-205.png`
- `queries/zipline-wonder-weekly-deck-readout-2026-09-15.md`
- `queries/zipline-drone-quote-and-package-eligibility-contract-2026-07-02.md`
- `queries/1p-drone-delivery-high-level-system-alignment-mvp-2026-08-13.md`
- `queries/drone-mvp-medium-bag-outer-package-decision.md`
- `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/PRD/Drone Eligibility Check - MVP Plan - 2026-09-17.md` (grep + frontmatter)
- `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Raw/Investigation - Cookbook Weight and Dimension Backfill Review - 2026-10-26.md` (grep + frontmatter)
- `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Archive/Eligibility and Architecture/1P Drone Delivery High-Level System Alignment - MVP.md` (grep + frontmatter)
- Grep hits (not read in full): `concepts/drone-delivery-integration-strategy.md`, `queries/1p-drone-delivery-checkout-package-dimensions-contract-2026-07-16.md`, `queries/1p-drone-delivery-eligibility-evaluation-trigger-and-revalidation-contract-2026-07-16.md`, `queries/1p-drone-delivery-system-responsibility-boundaries-2026-07-15.md`, `queries/zipline-integration-readiness-guide-2026-06-17.md`, `queries/drone-fit-exclusion-test-and-container-count-limits-2026-08-12.md`, `queries/order-packaging-geometry-feasibility-for-drone-dimension-eligibility-2026-08-12.md`
- `git log` (read-only): only two commits (2026-10-29 pilot split, 2026-11-02 baseline), so git history does not record the 2026-09-15 change; timing comes from page metadata and the Cook Refresh entry.

## Unable to establish

- The original 2026-07-30 Zipline QA document is an external Google Doc (not in the vault); the 252 mm value is known only via compiled pages and user notes that cite it.
- Whether Zipline itself ever confirmed a 254 mm envelope. The vault contains no partner statement to that effect; the only 254 mm primary artifact is a 3D-render label on the slide.
- No `log.md`, `.knowlery/freshness/` sidecar, or activity record exists for the 2026-09-15 change, so the exact decision rationale beyond the Cook Refresh note cannot be recovered.
- `pilot/questions-agent.md` lists this as experiment question G1-26; I did not consult any answer key.

## Files changed

- `ANSWER.md` (this file, created as instructed). No other files were created or modified; no git commit or push. `.knowlery/activity-disabled` exists, so no activity-ledger record was written.
