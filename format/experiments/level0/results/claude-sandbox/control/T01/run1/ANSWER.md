# Answer — Zipline single-Zip limits, loading methods, guarantee and custody

Answered from this vault only (Obsidian not running; retrieval via `node .knowlery/bin/query.mjs`, then file reads).

## 1. Single-Zip width: 252 mm or 254 mm? Can a direct-order Quote omit mass?

### Width — the vault is in conflict; the compiled pages say 254 mm, the underlying source note says 252 mm

**What the compiled (agent) pages say — 254 mm is current, 252 mm is superseded.**
`queries/zipline-mvp-partner-confirmed-contract-2026-07-30.md` (high priority, active, reviewed 2026-09-15), "Current Payload Envelope (Week of 2026-09-07)":

> "Width is the only metric change: `252 mm` → `254 mm`. Length and height stay `338 mm` and `205 mm`. ... Mass remains `2495 g` because this slide does not replace the 2026-07-30 weight answer."

and its eligibility rule `width_mm <= 254`. The same position is repeated in `queries/zipline-drone-quote-and-package-eligibility-contract-2026-07-02.md` ("The 2026-07-30 partner QA used ... width `252 mm`; that width is superseded."), `queries/zipline-integration-readiness-guide-2026-06-17.md` (line 383), `queries/1p-drone-delivery-checkout-package-dimensions-contract-2026-07-16.md` (line 273) and `queries/zipline-wonder-weekly-deck-readout-2026-09-15.md` (line 92). Under this reading the earlier answer (252 mm, from the 2026-07-30 partner QA, table "Canonical Dual-Unit Package Limits (2026-07-30)") has been replaced.

**What the cited source note says — 252 mm stands; 254 mm is a rounding artefact.**
Every one of those compiled pages cites `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Zipline Payload Dimensions Slide - Week of 2026-09-07.md` as the evidence for the change, but that note says the opposite:

> "The Envelope card states: `338 × 252 × 205 mm`. The Envelope card is the numeric payload envelope. It matches the 2026-07-30 partner QA of `338 × 252 × 205 mm`. The 3D width label `10 in / 254 mm` is a rounded-imperial pairing (`10 in = 254 mm`), not a 2 mm hardware change. ... **Do not treat `254 mm` as a superseding envelope width.**"

I checked the two attached images: `Attachments/zipline-payload-dimensions-wk-of-2026-09-07/payload-envelope-card-338-252-205.png` reads "Envelope 338 × 252 × 205 mm"; `.../payload-dimensions-3d-wk-of-2026-09-07.png` labels the bay 13.25"/338mm, 10"/254mm, 8"/205mm. So the raw evidence supports the source note: the only "254" in the primary material is the metric pairing of a rounded 10-inch label, while the explicit numeric envelope is 252 mm.

**My answer:** the only partner-stated numeric width limit in the vault is **252 mm** (2026-07-30 partner QA, confirmed by the week-of-9/7 Envelope card). The compiled pages' "254 mm supersedes 252 mm" conclusion is not supported by the source they cite and should be treated as disputed; the 2 mm difference comes from 10 in = 254 mm rounding. Length 338 mm, height 205 mm and mass 2495 g are not disputed anywhere. If a safe engineering threshold is needed, 252 mm is the conservative value. No freshness sidecar or log entry resolves this (`.knowlery/freshness/` does not exist in this copy).

### Mass — a direct-order (fulfillment) Quote cannot omit mass

`queries/zipline-mvp-partner-confirmed-contract-2026-07-30.md`, Confirmed Contract table, "Quote mass by lifecycle role":

> "A Quote used for direct-order fulfillment requires valid package mass. Create Quote also accepts omitted or `null` mass for the earlier RDP discovery use case. ... Checkout/execution must obtain a fresh fulfillment-capable Quote with valid positive mass before Intent."

Earlier answer replaced: the same page's "Source precedence" callout says "These 2026-07-30 partner answers supersede the assumption that a no-mass Quote can be used for direct-order fulfillment." Nuance from `queries/zipline-discovery-vs-fulfillment-quote-mass-contract.md` (watch): the API itself accepts omitted/`null`/`0` mass and returns a Quote, but sandbox evidence (`queries/zipline-sandbox-quote-mass-gating-contract.md`) shows that Quote ID is rejected at Create Delivery Intent; and PRD v19 (2026-08-28) removed the no-mass RDP discovery Quote from MVP scope, so "every Quote used for Delivery Intent must carry valid positive mass."

## 2. Drone Loading vs Dropbox Loading at a store

Current answer: `comparisons/zipline-loading-methods.md` (high, active, 2026-09-15), summary:

> "Drone Loading is operationally flexible and more tolerant of large payloads in the September test, but it requires a longer, precisely timed associate handoff. Dropbox Loading shortens the associate action and is the intended repeatable infrastructure model, but it adds equipment, approvals, construction dependencies, and a demonstrated large-payload fit risk."

Specifics from its table: Drone Loading — no permanent equipment, partner approval only, associate loads the aircraft directly, ~2–3 min, must coordinate with aircraft arrival/"load now" signal, 12/12 test deliveries succeeded. Dropbox Loading — installed Dropbox, partner + landlord + city approvals, site construction (window, footing, curb, awning, roof), ~1 min associate action, successful load itself summons the drone, but the largest payload failed 3 of 6 Dropbox pickups. Decision rule: prefer Dropbox when site and bag are validated for repeatable low-touch handoff; prefer Drone Loading during early launch, construction dependency or payload-fit uncertainty; fix marginal fit via bag/eligibility, not staff packout discipline. Corroborated by `queries/zipline-wonder-weekly-deck-readout-2026-09-15.md` ("What Changed Our Understanding" items 1 and 3).

Earlier replaced answer: none on the trade-off itself. Earlier pages (e.g. `Wonder/.../Archive/.../1P Drone Delivery System Orchestration Alignment Draft (2026-06-29).md`) only modelled a single "P2 / Zipping Station loading" path; the two-mode framing first appears in the 2026-09-15 deck readout, which says "Two store-loading modes are viable."

## 3. Guaranteed single-Zip package, and when Zipline takes custody

**Guarantee.** `queries/zipline-mvp-partner-confirmed-contract-2026-07-30.md`, Confirmed Contract, "Single-Zip package":

> "Maximum gross weight is `2495 g`; the 2026-07-30 dimensions were `338 mm L × 252 mm W × 205 mm H`. One approved outer package within all four limits uses exactly one initial Zip. ... Operational replacement after a failure is outside this guarantee."

So: one approved outer package, gross mass ≤ 2495 g, 338 × 252 × 205 mm (see Q1 for the 254 mm dispute), with `approved_outer_package = true`, is guaranteed one *initial* Zip; the guarantee does not cover a replacement delivery after a failure. Pack is not provider-required merely to prove one-Zip capacity (same page, Eligibility Service Impact), although Wonder has since chosen Pack as its own fit oracle (`queries/zipline-pack-as-eligibility-oracle-direction-2026-08-20.md`).

Earlier replaced answer: before 2026-07-30 the vault held that "Static Wonder weight and dimension rules are useful coarse filters, but the current documentation does not make them a single-delivery guarantee" (`queries/zipline-drone-quote-and-package-eligibility-contract-2026-07-02.md`, line 95); that page's "Partner-Confirmed Mass And Single-Zip Contract (2026-07-30)" section records the confirmation that replaced it.

**Custody.** Same page, "Custody transfer":

> "`DELIVERY_INTENT_STATUS_IN_PROGRESS` confirms successful P2 loading and transfer of custody to Zipline." — "Persist this as the authoritative irreversible custody boundary and gate cancel, modify, address change, dining-option change, and original-package Reallocation."

`queries/zipline-dropbox-lock-custody-and-failure-disposition-contract-2026-07-28.md` (high, active, reviewed 2026-10-19) adds the physical side: locking the P2 Dropbox is irreversible; after lock the package is either delivered or taken to a Zipline charging station and discarded, never returned to Wonder. Earlier replaced answer: the Zipline API docs' wording that a failed package is returned to the Partner — "its package-return language is known to be incorrect. Dated direct Zipline answers override the incorrect return-to-partner statement." Still open (same page, SP22 follow-up): whether an in-flight cancellation also routes the package to a charging station.

## Files relied on (vault-relative)

- AGENTS.md (instructions; CONVENTIONS.md does not exist)
- queries/zipline-mvp-partner-confirmed-contract-2026-07-30.md
- queries/zipline-drone-quote-and-package-eligibility-contract-2026-07-02.md
- queries/zipline-discovery-vs-fulfillment-quote-mass-contract.md
- queries/zipline-dropbox-lock-custody-and-failure-disposition-contract-2026-07-28.md
- queries/zipline-drone-dropoff-status-and-fallback-contract-gaps-2026-07-02.md (grep only)
- queries/zipline-integration-readiness-guide-2026-06-17.md (grep only)
- queries/1p-drone-delivery-checkout-package-dimensions-contract-2026-07-16.md (grep only)
- queries/zipline-wonder-weekly-deck-readout-2026-09-15.md (partial)
- queries/zipline-pack-as-eligibility-oracle-direction-2026-08-20.md (partial)
- comparisons/zipline-loading-methods.md
- Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Zipline Payload Dimensions Slide - Week of 2026-09-07.md
- Attachments/zipline-payload-dimensions-wk-of-2026-09-07/payload-envelope-card-338-252-205.png
- Attachments/zipline-payload-dimensions-wk-of-2026-09-07/payload-dimensions-3d-wk-of-2026-09-07.png
- Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Archive/Eligibility and Architecture/1P Drone Delivery System Orchestration Alignment Draft (2026-06-29).md (grep only)

## Unable to establish

- Which width Zipline itself regards as binding. The compiled pages and the source note they cite disagree (254 vs 252 mm); no freshness sidecar, log entry or later partner statement resolves it. Git history in this copy is a single squashed commit, so I could not see which text was written first.
- Whether the week-of-9/7 slide was ever reviewed with Zipline as a formal envelope change (vs. an illustrative render).
- Physical effect of in-flight cancellation (charging-station disposal vs other) — still pending per the SP22 follow-up.

## Files changed

- ANSWER.md (this file, created). No other file was created, edited, moved or deleted.
