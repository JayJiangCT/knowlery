# Answer: Single-Zip package width limit — 252 mm vs 254 mm

## Short answer

- **Currently held as valid by the compiled (agent) pages: 254 mm.** The canonical contract page `queries/zipline-mvp-partner-confirmed-contract-2026-07-30.md` (status `active`, `retrieval_priority: high`, `freshness_status: active`, `freshness_reviewed: 2026-09-15`, alias `338 254 205`) states the current eligibility comparison as `width_mm <= 254` and says "Width is the only metric change: `252 mm` → `254 mm`."
- **Historical: 252 mm.** It was the 2026-07-30 partner-QA value (`338 mm L × 252 mm W × 205 mm H`, imperial `9.92 in`). The same page keeps it in the "Canonical Dual-Unit Package Limits (2026-07-30)" table and says "That July envelope is now itself historical for width."
- **When / basis of the change:** the compiled pages were revised on **2026-09-15** (`updated: 2026-09-15`) on the basis of the Zipline **Payload Dimensions slide, week of 2026-09-07**, which Jay supplied in the 2026-09-15 agent session. The slide's 3D render labels width `10 in / 254 mm` (length `13.25 in / 338 mm`, height `8 in / 205 mm`). Mass was not on the slide, so `2495 g` was kept from 2026-07-30.
- **Yes, there is evidence in the vault that disputes the change — and it comes from the very source note the change was compiled from.** The user note `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Zipline Payload Dimensions Slide - Week of 2026-09-07.md` says the slide package consisted of two artifacts, and that the separate **Envelope card reads `338 × 252 × 205 mm`**, matching the 2026-07-30 QA. It concludes: "The 3D width label `10 in / 254 mm` is a rounded-imperial pairing (`10 in = 254 mm`), not a 2 mm hardware change" and "**Do not treat `254 mm` as a superseding envelope width.**" The compiled pages that cite this note as their source contradict it. Several later user notes (PRD 2026-09-17, Investigation 2026-10-26) also continue to use 252 mm as the envelope.

So the vault is internally inconsistent: the compiled layer holds 254 mm as current; the raw source layer (including the source the compiled layer cites) holds 252 mm and explicitly rejects 254 mm.

## Evidence, in detail

### 1. The current (compiled) position: 254 mm

`queries/zipline-mvp-partner-confirmed-contract-2026-07-30.md`
- Frontmatter: `updated: 2026-09-15`, `status: active`, `retrieval_priority: high`, `freshness_status: active`, `freshness_reviewed: 2026-09-15`; aliases include `Payload Dimensions` and `338 254 205`; sources include `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Zipline Payload Dimensions Slide - Week of 2026-09-07.md`.
- Confirmed Contract table, "Single-Zip package" row: "the 2026-07-30 dimensions were `338 mm L × 252 mm W × 205 mm H` … The current hardware envelope revises width to `254 mm`; see the week-of-2026-09-07 section below."
- "## Canonical Dual-Unit Package Limits (2026-07-30)": `Maximum width | 252 mm | 9.92 in`, and "That July envelope is now itself historical for width."
- "## Current Payload Envelope (Week of 2026-09-07)": `Maximum width | 254 mm | 10 in | 252 mm / 9.92 in`; "Width is the only metric change: `252 mm` → `254 mm`. … Mass remains `2495 g` because this slide does not replace the 2026-07-30 weight answer." Code block: `width_mm <= 254`.

Corroborating compiled pages (all say 254 current / 252 historical, all citing the week-of-2026-09-07 slide):
- `queries/zipline-wonder-weekly-deck-readout-2026-09-15.md` (`updated: 2026-09-20`): "This revises the 2026-07-30 partner QA width from `252 mm` to `254 mm`. Mass is not on the slide; keep `2495 g`." Summary table: "width is 2 mm larger than the 2026-07-30 partner QA".
- `queries/zipline-drone-quote-and-package-eligibility-contract-2026-07-02.md` line 189: "Cook result: Current Eligibility / Quote comparison uses width `254 mm`. The 2026-07-30 partner QA width `252 mm` is retained as historical."
- `queries/1p-drone-delivery-checkout-package-dimensions-contract-2026-07-16.md` lines 259, 273, 331: "That July width is superseded. The current hardware envelope is `338 × 254 × 205 mm / 2495 g`".
- `queries/drone-mvp-medium-bag-outer-package-decision.md` (`updated: 2026-10-19`) lines 50, 108–116: envelope `338 × 254 × 205 mm`; "Against the earlier 2026-07-30 envelope (`338 × 252 × 205 mm`) the same bag was 2 mm over on width."
- `concepts/drone-delivery-integration-strategy.md` line 280; `queries/zipline-integration-readiness-guide-2026-06-17.md` lines 374, 383; `queries/1p-drone-delivery-system-responsibility-boundaries-2026-07-15.md` line 245; `queries/1p-drone-delivery-eligibility-evaluation-trigger-and-revalidation-contract-2026-07-16.md` line 274; `queries/order-packaging-geometry-feasibility-for-drone-dimension-eligibility-2026-08-12.md` line 153; `queries/drone-fit-exclusion-test-and-container-count-limits-2026-08-12.md` line 41.

### 2. The historical position: 252 mm (2026-07-30 partner QA)

- `queries/zipline-mvp-partner-confirmed-contract-2026-07-30.md` (above): `338 mm L × 252 mm W × 205 mm H`, `9.92 in`.
- `queries/zipline-mvp-final-partner-qa-working-draft-2026-07-26.md` line 66: "at or below `2495 g` and `338 × 252 × 205 mm`".
- `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Archive/Eligibility and Architecture/1P Drone Delivery High-Level System Alignment - MVP.md` line 125 (`Width | 252 mm`) and the compiled `queries/1p-drone-delivery-high-level-system-alignment-mvp-2026-08-13.md` line 143.
- `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Zipline API Doc/Zipline API Documentation Runtime Annotations - 2026-08-27.md` line 47: Sandbox Pack accepted an isolated `252 × 205 × 338 mm / 2495 g` package on 2026-08-27 (empirical, pre-slide).

### 3. When and on what basis the change happened

- Basis: `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Zipline Payload Dimensions Slide - Week of 2026-09-07.md` (`date: 2026-09-07`, `created/updated: 2026-09-15`, source "Zipline Payload Dimensions slide and Envelope card supplied by Jay in the 2026-09-15 agent session"). Its axis table: `Width | 10 in | 254 mm`.
- The attached render `Attachments/zipline-payload-dimensions-wk-of-2026-09-07/payload-dimensions-3d-wk-of-2026-09-07.png` (viewed) indeed reads "Payload Dimensions, Wk. of 9/7" with labels `13.25" 338mm`, `10" 254mm`, `8" 205mm`.
- Timing: the compiled contract page and the deck readout were both `updated`/`created` 2026-09-15 with `freshness_reviewed: 2026-09-15`, i.e. the change was compiled in the 2026-09-15 session. Git history in this working copy does not preserve that edit (only two commits: `cf9e378` 2026-10-29 and the `cc41286` baseline), so the date rests on the frontmatter and the source note's provenance line.
- Note the imperial side: 2026-07-30 was `9.92 in` (= 252 mm exactly); the slide pairs `10 in` with `254 mm` (10 in = 254.0 mm exactly). The compiled pages acknowledge the slide's imperial labels are "its own rounded pairings" yet still adopt 254 mm as a metric hardware change.

### 4. Evidence disputing the change

**(a) The cited source note itself rejects 254 mm.** `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Zipline Payload Dimensions Slide - Week of 2026-09-07.md`, after the axis table, embeds a second artifact `Attachments/zipline-payload-dimensions-wk-of-2026-09-07/payload-envelope-card-338-252-205.png` (viewed: a card titled "Envelope" reading `338 × 252 × 205 mm`) and states:

> "The Envelope card is the numeric payload envelope. It matches the 2026-07-30 partner QA of `338 × 252 × 205 mm`. The 3D width label `10 in / 254 mm` is a rounded-imperial pairing (`10 in = 254 mm`), not a 2 mm hardware change. Length and height stay `338 mm` and `205 mm`. … Do not treat `254 mm` as a superseding envelope width."

None of the compiled pages that cite this note mention the Envelope card or this instruction; they describe only the 3D render. This is a direct contradiction between the compiled layer and its own declared source.

**(b) Later user notes keep 252 mm as the operative envelope after 2026-09-07:**
- `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/PRD/Drone Eligibility Check - MVP Plan - 2026-09-17.md` (`updated: 2026-10-27`) line 86: "dropbox envelope 338 × 252 × 205 mm (13.31 × 9.92 × 8.07 in)"; line 470: "`DIMENSION_EXCEEDED`: box 292 × 292 mm … exceeds envelope width 252 mm".
- `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Raw/Investigation - Cookbook Weight and Dimension Backfill Review - 2026-10-26.md` line 192: "largest outer footprint 226 mm vs 252 mm envelope axis"; line 287: "Rejected by prescreen (321 > 252 mm)".
- `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Raw/Drone Eligibility Check - Research Log and Plan - 2026-09-07.md` line 179: Pack envelope `205 x 252 x 338 mm`.

**(c) Open question on record.** `pilot/questions-agent.md` line 49, G1-26: "Is the Zipline single-Zip width limit 252 mm or 254 mm …" — the vault's own evaluation set flags this as unresolved.

No vault note records Zipline (the partner) stating in words that the metric width changed from 252 to 254 mm; the only basis for 254 is the label on the 3D render.

## Assessment

Per the vault's freshness rules, the compiled pages with `retrieval_priority: high` / `freshness_status: active` hold **254 mm** as current and **252 mm** as historical, and that is the answer a retrieval-first reader will get. However, the change rests on a single rendered label whose own source note classifies it as an imperial rounding artifact and explicitly says not to supersede 252 mm, while the numeric Envelope card and all post-September user notes (PRD, investigation) use 252 mm. The change is therefore **disputed within the vault**, and the conservative value for eligibility comparison is 252 mm (the narrower bound, consistent with both the Envelope card and the 2026-07-30 QA). No compiled page is currently marked `freshness_status: disputed`.

## Files relied on (vault-relative)

- `AGENTS.md`, `.claude/CLAUDE.md`, `KNOWLEDGE.md` (instructions)
- `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Zipline Payload Dimensions Slide - Week of 2026-09-07.md`
- `Attachments/zipline-payload-dimensions-wk-of-2026-09-07/payload-dimensions-3d-wk-of-2026-09-07.png`
- `Attachments/zipline-payload-dimensions-wk-of-2026-09-07/payload-envelope-card-338-252-205.png`
- `queries/zipline-mvp-partner-confirmed-contract-2026-07-30.md`
- `queries/zipline-wonder-weekly-deck-readout-2026-09-15.md`
- `queries/zipline-drone-quote-and-package-eligibility-contract-2026-07-02.md`
- `queries/1p-drone-delivery-checkout-package-dimensions-contract-2026-07-16.md`
- `queries/drone-mvp-medium-bag-outer-package-decision.md`
- `queries/zipline-mvp-final-partner-qa-working-draft-2026-07-26.md`
- `queries/1p-drone-delivery-high-level-system-alignment-mvp-2026-08-13.md`
- `concepts/drone-delivery-integration-strategy.md`, `queries/zipline-integration-readiness-guide-2026-06-17.md`, `queries/1p-drone-delivery-system-responsibility-boundaries-2026-07-15.md`, `queries/1p-drone-delivery-eligibility-evaluation-trigger-and-revalidation-contract-2026-07-16.md`, `queries/order-packaging-geometry-feasibility-for-drone-dimension-eligibility-2026-08-12.md`, `queries/drone-fit-exclusion-test-and-container-count-limits-2026-08-12.md` (grep-level corroboration)
- `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/PRD/Drone Eligibility Check - MVP Plan - 2026-09-17.md`
- `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Raw/Investigation - Cookbook Weight and Dimension Backfill Review - 2026-10-26.md`
- `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Raw/Drone Eligibility Check - Research Log and Plan - 2026-09-07.md`
- `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Archive/Eligibility and Architecture/1P Drone Delivery High-Level System Alignment - MVP.md`
- `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Zipline API Doc/Zipline API Documentation Runtime Annotations - 2026-08-27.md`
- `pilot/questions-agent.md`
- `git log` of the working copy (read-only)

## Unable to establish

- Whether Zipline ever confirmed a metric change to 254 mm in words (no note records it; the only 254 mm evidence is the slide label).
- The exact edit that introduced 254 mm into the compiled pages: git history here has only two commits (2026-10-29 pilot split, baseline), so the 2026-09-15 date is from frontmatter and the source note's provenance line, not from a diff.
- Whether the Envelope card was added to the source note at the same time as, or after, the compiled pages were written (both carry `updated: 2026-09-15`); i.e. whether the compiler overlooked it or it was added later as a correction without recompiling.
- No `.knowlery/freshness/` sidecars or `log.md` exist in this copy, so no freshness-review record for this change could be consulted.

## Files changed

- `ANSWER.md` (this file, created). No other files were created or modified.
