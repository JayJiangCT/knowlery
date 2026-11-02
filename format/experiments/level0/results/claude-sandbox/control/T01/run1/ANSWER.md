# Answers — Zipline single-Zip limit, loading methods, custody

Answered from this vault only (Obsidian not running; file tools + read-only git). No vault pages were changed; only this file was created. `.knowlery/activity-disabled` exists, so no Activity Ledger record was written.

## 1. Single-Zip width: 252 mm or 254 mm? Can a direct-order Quote omit mass?

**Width — current answer: `252 mm` is the numeric payload envelope; `254 mm` is only the rounded imperial label (`10 in`).**

The source note [[Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Zipline Payload Dimensions Slide - Week of 2026-09-07]] records the two week-of-9/7 artifacts and states:

> "The Envelope card is the numeric payload envelope. It matches the 2026-07-30 partner QA of `338 × 252 × 205 mm`. The 3D width label `10 in / 254 mm` is a rounded-imperial pairing (`10 in = 254 mm`), not a 2 mm hardware change. … Do not treat `254 mm` as a superseding envelope width."

I checked both attached images: `Attachments/zipline-payload-dimensions-wk-of-2026-09-07/payload-envelope-card-338-252-205.png` reads "Envelope 338 × 252 × 205 mm"; the 3D render `payload-dimensions-3d-wk-of-2026-09-07.png` labels the axes `13.25"/338mm`, `10"/254mm`, `8"/205mm`. So the full single-Zip limit is `2495 g` gross, `338 mm L × 252 mm W × 205 mm H` (mass from the 2026-07-30 partner QA; neither 9/7 artifact shows mass).

**Earlier / conflicting answers:**
- The 2026-07-30 partner QA gave `338 × 252 × 205 mm / 2495 g` ([[zipline-mvp-partner-confirmed-contract-2026-07-30]], "Canonical Dual-Unit Package Limits (2026-07-30)"). That is consistent with the Envelope card, so it is not actually superseded on width.
- The earlier `12.5 × 9.5 × 7.75 in` loader reference in the PRD is explicitly superseded (same page: "a superseded PRD loader reference, not a current maximum package envelope"; struck through in PRD v16 per [[queries/1p-drone-delivery-checkout-package-dimensions-contract-2026-07-16]]).
- **Contradiction to flag:** several compiled pages treat `254 mm` as a superseding hardware revision and put `width_mm <= 254` in the eligibility rule: [[zipline-mvp-partner-confirmed-contract-2026-07-30]] ("Width is the only metric change: `252 mm` → `254 mm`"), [[queries/zipline-drone-quote-and-package-eligibility-contract-2026-07-02]] ("Current Eligibility / Quote comparison uses width `254 mm`"), [[queries/1p-drone-delivery-checkout-package-dimensions-contract-2026-07-16]], [[queries/1p-drone-delivery-eligibility-evaluation-trigger-and-revalidation-contract-2026-07-16]], [[queries/drone-mvp-medium-bag-outer-package-decision]], and [[concepts/drone-delivery-integration-strategy]] ("`2495 g / 338 × 254 × 205 mm`"). These compiled pages cite the 9/7 slide note as their source, but the source note itself (and the Envelope card image) says the opposite. The user note is primary evidence, so I answer 252 mm and treat the 254 mm statements in compiled pages as a compilation error that should be corrected (not done here; the task did not ask for vault changes). Practical note: the two values differ by only 2 mm, and the gap only matters for an item measuring 253–254 mm wide (e.g. the August new Medium bag at `330 × 254 mm`, which [[queries/drone-mvp-medium-bag-outer-package-decision]] calls an "exact match" on width under the 254 reading but 2 mm over under 252).

**Mass — current answer: No. A Quote used for direct-order fulfillment must carry a valid positive `mass_grams` (1–2495 g) before its Quote ID is used for Create Delivery Intent.**

- [[zipline-mvp-partner-confirmed-contract-2026-07-30]]: "A Quote used for direct-order fulfillment requires valid package mass. Create Quote also accepts omitted or `null` mass for the earlier RDP discovery use case."
- [[zipline-sandbox-quote-mass-gating-contract]] (runtime closure 2026-08-21): "omitted, explicit null, and zero mass each fail at Create Intent with `422 / Quote mass is required for direct orders`; `2496 g` fails … with `406 / Payload mass exceeds max payload`". Create Quote itself is permissive (it returns a Quote with `mass_grams: null`/`0`), so a successful Quote response is not proof of fulfillment readiness. Production behavior is noted as unverified.
- Earlier/replaced: the blanket statement "a no-mass Quote is invalid" is called "too broad"; the only mass-optional Quote was the non-binding RDP discovery Quote for serviceability/KOETA timing, and PRD v19 (2026-08-28) removed that RDP use case from MVP scope ([[zipline-discovery-vs-fulfillment-quote-mass-contract]], "Product scope override — 2026-08-28"). So currently every Quote Wonder uses for Intent must carry mass; the no-mass path is historical API evidence only.

## 2. Drone Loading vs Dropbox Loading at a store

**Current answer** ([[comparisons/zipline-loading-methods]], compiled from the 2026-09-15 Zipline x Wonder weekly deck, [[queries/zipline-wonder-weekly-deck-readout-2026-09-15]]):

> "Drone Loading is operationally flexible and more tolerant of large payloads in the September test, but it requires a longer, precisely timed associate handoff. Dropbox Loading shortens the associate action and is the intended repeatable infrastructure model, but it adds equipment, approvals, construction dependencies, and a demonstrated large-payload fit risk."

Specifics from the comparison table:
- Equipment/approvals: Drone Loading needs no permanent loading equipment and only partner approval; Dropbox needs an installed Dropbox plus partner, landlord, and city approvals and site construction (window, footing, curb, awning, roof).
- Associate time/timing: Drone Loading ≈ 2–3 min and the associate must coordinate with aircraft arrival and the "load now" signal in Loading Manager; Dropbox ≈ 1 min, associate waits for the Dropbox-ready state, and completing the load summons the drone (no separate summon call — [[zipline-dropbox-loading-window-contract]] / [[zipline-mvp-partner-confirmed-contract-2026-07-30]]).
- Reliability (week-of-9/7 test): Drone Loading 12/12 deliveries succeeded across three payloads; Dropbox pickup of the largest payload failed 3 of 6 times — the current Wonder bag sits at the Dropbox payload-bay limit.
- Decision rule: "Prefer Dropbox Loading when the site and bag are validated and the goal is repeatable, low-touch store handoff. Prefer Drone Loading during early launch, construction dependency, or payload-fit uncertainty."

**Earlier answer replaced?** None found. This comparison first appears with the 2026-09-15 deck; earlier pages assumed Dropbox loading only (e.g. [[zipline-dropbox-loading-window-contract]]). The readout lists as still open: "Confirm whether the first launches use Dropbox Loading, Drone Loading, or a site-specific mix."

## 3. Guaranteed single-Zip package, and when Zipline takes custody

**Package guarantee — current answer:** One approved standard outer package within all four limits — gross mass `<= 2495 g`, length `<= 338 mm`, width `<= 252 mm` (see Q1 regarding the 254 mm discrepancy in compiled pages), height `<= 205 mm`, `approved_outer_package = true` — "uses exactly one initial Zip." ([[zipline-mvp-partner-confirmed-contract-2026-07-30]], Single-Zip package row and Eligibility Service Impact.) Caveats on the same page: "Operational replacement after a failure is outside this guarantee", and the MVP "does not need Zipline Pack merely to prove one-Zip capacity" though Intent may still assert `expected_number_of_deliveries == 1` defensively.

**Custody — current answer:** Zipline takes custody when the P2 package is successfully loaded and the Dropbox locks; the authoritative API signal is `DELIVERY_INTENT_STATUS_IN_PROGRESS`.
- [[zipline-mvp-partner-confirmed-contract-2026-07-30]]: "`DELIVERY_INTENT_STATUS_IN_PROGRESS` confirms successful P2 loading and transfer of custody to Zipline" — "the authoritative irreversible custody boundary".
- [[zipline-dropbox-lock-custody-and-failure-disposition-contract-2026-07-28]]: "locking the P2 Dropbox is irreversible for the original package"; after lock Wonder cannot access the package, a failed delivery goes to a Zipline charging site for disposal, and "The package is never returned to Wonder". Before lock, IKC staff still control the package and may cancel the Intent / Reallocate to Ground. Page reviewed 2026-10-19, `freshness_status: active`.

**Earlier answers replaced:**
- Before 2026-07-30 the lock/custody event mapping was an open P0 question ("Which API status/event is the authoritative Dropbox-lock and custody-transfer signal? Does `DELIVERY_INTENT_STATUS_IN_PROGRESS` exactly represent that boundary?"); the partner answer closed it.
- The Zipline ReadMe statement that a failed delivery is "returned to the Partner" is confirmed incorrect by Zipline (2026-08-04); the direct partner answer overrides it ([[zipline-dropbox-lock-custody-and-failure-disposition-contract-2026-07-28]], "Current-Documentation Correction (2026-08-04)").
- Still open (not a replacement): whether an in-flight cancellation also routes the package to a charging station, and whether `DELIVERY_STATUS_CANCELED` is an equivalent terminal recovery signal (SP22 follow-up, 2026-10-13).

## Files relied on (vault-relative)

- `AGENTS.md`
- `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Zipline Payload Dimensions Slide - Week of 2026-09-07.md`
- `Attachments/zipline-payload-dimensions-wk-of-2026-09-07/payload-envelope-card-338-252-205.png`
- `Attachments/zipline-payload-dimensions-wk-of-2026-09-07/payload-dimensions-3d-wk-of-2026-09-07.png`
- `queries/zipline-mvp-partner-confirmed-contract-2026-07-30.md`
- `queries/zipline-discovery-vs-fulfillment-quote-mass-contract.md`
- `queries/zipline-sandbox-quote-mass-gating-contract.md`
- `comparisons/zipline-loading-methods.md`
- `queries/zipline-wonder-weekly-deck-readout-2026-09-15.md` (grep of loading sections)
- `queries/zipline-dropbox-lock-custody-and-failure-disposition-contract-2026-07-28.md`
- Grep hits only (not fully read): `queries/zipline-drone-quote-and-package-eligibility-contract-2026-07-02.md`, `queries/1p-drone-delivery-checkout-package-dimensions-contract-2026-07-16.md`, `queries/1p-drone-delivery-eligibility-evaluation-trigger-and-revalidation-contract-2026-07-16.md`, `queries/drone-mvp-medium-bag-outer-package-decision.md`, `concepts/drone-delivery-integration-strategy.md`

## Unable to establish

- Which reading of width Zipline itself intends (252 vs 254 mm) beyond the artifacts in the vault; the vault's source note and Envelope card say 252, the compiled pages say 254. No partner statement resolving the 2 mm difference exists in the vault.
- Whether Zipline Production enforces mass at Quote creation (sandbox evidence only).
- Which loading method the first Texas launches will use.
- Physical effect of an in-flight cancellation on the package.

## Files changed

- `ANSWER.md` (created — this file). No other files were created, edited, moved, or deleted.
