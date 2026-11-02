# Answer — Zipline single-Zip limits, loading methods, custody

Answered from this vault only (file tools, read-only `git`). No network, no commits. `.knowlery/activity-disabled` exists, so no Activity Ledger record was written. No compiled pages were modified, so no `log.md` entry.

## 1. Width limit: 252 mm or 254 mm? Can a direct-order Quote omit mass?

### Current answer

**Width: 252 mm.** The single-Zip envelope is `338 mm L × 252 mm W × 205 mm H`, with a gross mass limit of `2495 g`. The `254 mm` figure is a rounded-imperial label (`10 in = 254 mm`) on a 3D render, not a hardware change.

Primary evidence (user notes and images):

- `Attachments/zipline-payload-dimensions-wk-of-2026-09-07/payload-envelope-card-338-252-205.png` — the Envelope card itself reads `338 × 252 × 205 mm` (viewed directly).
- `Attachments/zipline-payload-dimensions-wk-of-2026-09-07/payload-dimensions-3d-wk-of-2026-09-07.png` — the 3D render labels width `10" / 254mm`, length `13.25" / 338mm`, height `8" / 205mm`.
- [[Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Zipline Payload Dimensions Slide - Week of 2026-09-07]]: "The Envelope card is the numeric payload envelope. It matches the 2026-07-30 partner QA of `338 × 252 × 205 mm`. The 3D width label `10 in / 254 mm` is a rounded-imperial pairing (`10 in = 254 mm`), not a 2 mm hardware change." and "Do not treat `254 mm` as a superseding envelope width."
- Later user notes keep using 252: [[Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/PRD/Drone Eligibility Check - MVP Plan - 2026-09-17]] line 86: "dropbox envelope 338 × 252 × 205 mm (13.31 × 9.92 × 8.07 in)"; [[Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Raw/Investigation - Cookbook Weight and Dimension Backfill Review - 2026-10-26]] line 192: "226 mm vs 252 mm envelope axis".

**Mass: a direct-order (fulfillment) Quote cannot omit mass.** Create Quote accepts an omitted or `null` `mass_grams` and returns a Quote, but that Quote ID cannot create a Delivery Intent. A Quote used for a direct order must carry an integer mass from 1 through 2495 g.

- [[Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Zipline Sandbox Quote Mass Validation Evidence - 2026-08-11]]: "`mass_grams` omitted / null-valued Quote | Quote created successfully | `null` | Failed when the returned Quote ID was used" and "the resulting null- and zero-mass Quote IDs cannot create a Delivery Intent."
- [[Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Zipline API Doc/Zipline API Documentation Runtime Annotations - 2026-08-27]] line 49: "Quote accepted omitted, `null`, `0`, and `2496`; their Quote IDs later failed Create Delivery Intent (`422` for missing/null/zero; `406` for `2496`) | Direct-order Quote must include an integer mass from `1` through `2495` grams".
- Compiled: [[queries/zipline-mvp-partner-confirmed-contract-2026-07-30]]: "A Quote used for direct-order fulfillment requires valid package mass. Create Quote also accepts omitted or `null` mass for the earlier RDP discovery use case."

### Earlier answers that were replaced

- **Dimensions:** the earlier PRD loader reference `12.5 × 9.5 × 7.75 in` was struck in PRD v16 (2026-08-11) and replaced by the 2026-07-30 partner QA envelope ([[queries/zipline-mvp-partner-confirmed-contract-2026-07-30]], "Canonical Dual-Unit Package Limits" section). The 252 mm width itself has **not** been replaced.
- **Mass:** the 2026-06-29 draft treated a no-mass Quote as a serviceability check and left open whether it could create an Intent ([[Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Archive/Eligibility and Architecture/1P Drone Delivery System Orchestration Alignment Draft (2026-06-29)]] lines 44 and 429). The 2026-07-30 partner answer and the 2026-08-11 sandbox test closed that: no-mass Quotes are discovery-only. PRD v19 (2026-08-28) then removed the no-mass RDP Quote use case from MVP scope entirely ([[queries/zipline-discovery-vs-fulfillment-quote-mass-contract]], "Product scope override" callout).

### Vault inconsistency to flag (not fixed)

Several compiled pages state that the week-of-2026-09-07 slide "revises" width from 252 to 254 mm and use `width_mm <= 254` as the current rule: [[queries/zipline-mvp-partner-confirmed-contract-2026-07-30]] (rows "Single-Zip package" and "Current Payload Envelope"), [[queries/zipline-wonder-weekly-deck-readout-2026-09-15]] ("This revises the 2026-07-30 partner QA width from `252 mm` to `254 mm`"), and also `queries/zipline-drone-quote-and-package-eligibility-contract-2026-07-02.md`, `queries/zipline-integration-readiness-guide-2026-06-17.md`, `queries/1p-drone-delivery-system-responsibility-boundaries-2026-07-15.md`, `queries/1p-drone-delivery-eligibility-evaluation-trigger-and-revalidation-contract-2026-07-16.md`. They cite the same user note that says the opposite. Because user notes are the raw source, the Envelope card image shows 252, and all later user notes (09-17, 10-26) use 252, I treat 252 mm as current and the compiled 254 mm claims as drift. The task did not ask me to change the vault, so I left these pages untouched.

## 2. Drone Loading vs Dropbox Loading trade-off

### Current answer

| | Drone Loading | Dropbox Loading |
| --- | --- | --- |
| Equipment | None | Installed Dropbox |
| Approvals | Partner only | Partner, landlord, city |
| Associate action | Collects food and loads the aircraft directly, timed to the aircraft's arrival and "load now" prompt | Walks to the Dropbox and places food inside when the unit reports ready |
| Associate time | ~2–3 min | ~1 min |
| Drone trigger | Associate requests/calls the drone in Loading Manager | Completing the load summons the drone; no separate call |
| Site work | Lower | Window, footing, curb, awning, roof work vary by site |
| Week-of-9/7 packaging test | 12/12 deliveries succeeded (payloads 1–3) | Largest payload (#3) failed 3 of 6 pickups |

Net: Drone Loading is flexible and tolerant of large payloads but costs more associate time and tight synchronization. Dropbox Loading is the intended repeatable low-touch model but adds equipment, approvals, construction dependencies, and a demonstrated large-payload fit risk. Decision rule in the vault: prefer Dropbox once site and bag are validated; prefer Drone Loading during early launch, construction dependency, or payload-fit uncertainty.

Evidence:

- `Attachments/zipline-x-wonder-weekly-2026-09-15/slide-03-loading-methods.png` (viewed): "Equipment: None | Dropbox"; "Approvals: Partner | Partner, Landlord, City"; "Loading Duration: ~2-3 min., all handled by Partner | ~1 min., all handled by Partner".
- `Attachments/zipline-x-wonder-weekly-2026-09-15/slide-20-packaging-test-results.png` (viewed): "Drone Loading was successful for all payloads — Test Payloads #1-3 12/12 deliveries successful"; "Dropbox Pickups are high risk for large payloads — Test Payload #3 3/6 pickups failed".
- [[comparisons/zipline-loading-methods]] — summary callout and "Decision Rule" section (quoted above).
- [[queries/zipline-wonder-weekly-deck-readout-2026-09-15]] "Loading Model" section: "For Dropbox, the associate waits until the UI reports the unit ready, then loads the order. For Drone Loading, the associate requests the aircraft and follows the arrival and 'load now' prompts."
- [[Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Zipline Slack Clarification - Dropbox Loading Window and Drone Summon - 2026-08-03]]: "The completed load summons the Drone." / "the load itself is the trigger."

### Earlier answers replaced

None found. Earlier user notes (e.g. the 2026-06-29 Station Loading Sequencing proposal) discuss a per-station loading queue but do not compare the two methods. [[Wonder/Wonder Fulfillment/Sprints/2026/SP22/Agenda/Meeting Notes]] (2026-10-13) records that "Gen 1 and direct drone loading remain options under discussion; no final launch hardware/loading choice was recorded" — so which method launches first is still open, not replaced.

## 3. Single-Zip guarantee and custody point

### Current answer

**Guarantee:** one approved standard outer package within all four limits — `2495 g` gross, `338 mm × 252 mm × 205 mm` — is a single-Zip package and uses exactly one initial Zip. Operational replacement after a failure is outside this guarantee; Wonder may still assert `expected_number_of_deliveries == 1` defensively.

- [[queries/zipline-mvp-partner-confirmed-contract-2026-07-30]], "Single-Zip package" row: "Maximum gross weight is `2495 g`; the 2026-07-30 dimensions were `338 mm L × 252 mm W × 205 mm H`. | One approved outer package within all four limits uses exactly one initial Zip. ... Operational replacement after a failure is outside this guarantee." (For width, see question 1: I use 252 mm, not the 254 mm this page also asserts.)

**Custody:** Zipline takes custody when the webhook reports `DELIVERY_INTENT_STATUS_IN_PROGRESS`, which confirms successful P2/Dropbox loading. The transfer is irreversible: a failed delivery is taken to a Zipline charging site and discarded; the package never returns to Wonder. Before that event, IKC staff still control the package and can cancel the Intent and Reallocate to Ground.

- [[queries/zipline-mvp-partner-confirmed-contract-2026-07-30]], "Custody transfer" row: "`DELIVERY_INTENT_STATUS_IN_PROGRESS` confirms successful P2 loading and transfer of custody to Zipline."
- [[queries/zipline-dropbox-lock-custody-and-failure-disposition-contract-2026-07-28]], "Partner-Confirmed API Boundary (2026-07-30)": "Zipline confirmed that `DELIVERY_INTENT_STATUS_IN_PROGRESS` is the authoritative event that the P2 package was successfully loaded and custody transferred to Zipline." and "Operational State Contract" table (pre-lock vs locked recovery options).
- [[Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Zipline Google Doc Alignment Responses - Pre-Production and API Documentation - 2026-08-04]]: "The documentation language saying a failed package is returned to the partner is incorrect. Zipline reiterated that the package will not be returned to Wonder."

### Earlier answers replaced

- The Zipline ReadMe's statement that a failed package is "returned to the Partner" — corrected by the 2026-07-30 partner answers and reconfirmed 2026-08-04 (sources above).
- The open question "Does `DELIVERY_INTENT_STATUS_IN_PROGRESS` exactly represent that boundary?" in the "Remaining P0 API Contract" section of [[queries/zipline-dropbox-lock-custody-and-failure-disposition-contract-2026-07-28]] — closed by the 2026-07-30 section lower on the same page. The page carries both the open and the closed form.
- Wonder's 2026-07-15 request that Zipline reject rather than split multi-Zip orders ([[Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Questions for Zipline - Single-Delivery Guarantee and Multi-Delivery Handling (2026-07-15)]], Q1–Q2, answers blank) — answered for in-envelope packages by the 2026-07-30 single-Zip guarantee. Whether Zipline rejects or splits an oversized order is not shown as settled in the vault.

Still open (per the compiled pages): whether `DELIVERY_STATUS_CANCELED` is an equivalent terminal recovery signal, and what physically happens on an in-flight cancellation (SP22, 2026-10-13).

## Files relied on (vault-relative)

- Attachments/zipline-payload-dimensions-wk-of-2026-09-07/payload-envelope-card-338-252-205.png
- Attachments/zipline-payload-dimensions-wk-of-2026-09-07/payload-dimensions-3d-wk-of-2026-09-07.png
- Attachments/zipline-x-wonder-weekly-2026-09-15/slide-03-loading-methods.png
- Attachments/zipline-x-wonder-weekly-2026-09-15/slide-20-packaging-test-results.png
- Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Zipline Payload Dimensions Slide - Week of 2026-09-07.md
- Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/PRD/Drone Eligibility Check - MVP Plan - 2026-09-17.md
- Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Raw/Investigation - Cookbook Weight and Dimension Backfill Review - 2026-10-26.md
- Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Zipline Sandbox Quote Mass Validation Evidence - 2026-08-11.md
- Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Zipline API Doc/Zipline API Documentation Runtime Annotations - 2026-08-27.md
- Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Archive/Eligibility and Architecture/1P Drone Delivery System Orchestration Alignment Draft (2026-06-29).md
- Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Zipline Slack Clarification - Dropbox Loading Window and Drone Summon - 2026-08-03.md
- Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Zipline Google Doc Alignment Responses - Pre-Production and API Documentation - 2026-08-04.md
- Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Questions for Zipline - Single-Delivery Guarantee and Multi-Delivery Handling (2026-07-15).md
- Wonder/Wonder Fulfillment/Sprints/2026/SP22/Agenda/Meeting Notes.md
- queries/zipline-mvp-partner-confirmed-contract-2026-07-30.md
- queries/zipline-wonder-weekly-deck-readout-2026-09-15.md
- queries/zipline-discovery-vs-fulfillment-quote-mass-contract.md
- queries/zipline-dropbox-lock-custody-and-failure-disposition-contract-2026-07-28.md
- comparisons/zipline-loading-methods.md

## Unable to establish

- The 2026-07-30 partner answers (single-Zip guarantee, custody event) exist in the vault only as compiled pages; the primary Google Doc is an external link, and the 2026-08-04 user note points back to it. I could not verify the exact partner wording from a user note.
- The Zipline weekly deck is also an external Google Slides link; in-vault primary evidence is limited to the slide screenshots listed above.
- The exact HTTP error for a no-mass Quote used in Create Delivery Intent is recorded only in the 2026-08-27 runtime annotations as "historical, not rerun" (`422`); the 2026-08-11 note explicitly did not capture it.
- Whether the compiled pages' 254 mm claim reflects some later Zipline confirmation not captured in any user note. Nothing in the vault supports that, so I treat it as drift.

## Files changed

- `ANSWER.md` (this file, created). No other files were changed.
