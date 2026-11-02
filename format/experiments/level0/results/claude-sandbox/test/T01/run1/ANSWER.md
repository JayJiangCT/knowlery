# Answer — three Zipline questions (answered 2026-11-02, vault-only)

## 1. Single-Zip width limit (252 vs 254 mm) and whether a direct-order Quote can omit mass

**Current answer: 254 mm.** The current single-Zip envelope is 2495 g gross and 338 × 254 × 205 mm (5.50 lb, 13.25 × 10 × 8 in). **A direct-order (fulfillment) Quote cannot omit mass**; only the non-binding RDP discovery Quote may omit or send `null` mass, and that Quote must never be used to create a Delivery Intent.

**Earlier answer replaced: yes.** The width was 252 mm per the 2026-07-30 partner QA; it was superseded on 2026-09-15 by the week-of-2026-09-07 Zipline Payload Dimensions slide. Length, height and mass did not change. On mass, the 2026-07-30 partner answers superseded the earlier assumption that a no-mass Quote could be used for direct-order fulfillment.

Relied on:
- `[[drone-delivery-integration-strategy#^c16]]` (concepts/drone-delivery-integration-strategy.md): "The current single-Zip provider limit, the current hardware maximum, is 2495 g and 338 × 254 × 205 mm (5.50 lb, 13.25 × 10 × 8 in); one approved package within it guarantees one initial Zip" (src: s15, s16, s10).
- Same page, History `^c27`: "The current single-Zip provider limit is 2495 g and 338 × 252 × 205 mm … per the 2026-07-30 partner QA … superseded 2026-09-15 by [[#^c16]] · week-of-2026-09-07 Payload Dimensions slide revised width to 254 mm".
- `[[drone-delivery-integration-strategy#^c18]]`: "A direct-order Quote requires reliable mass, so package-data completeness is a hard eligibility dependency" (src: s10).
- `[[zipline-mvp-partner-confirmed-contract-2026-07-30]]` (records/…, Record, date 2026-07-30, refreshed 2026-09-15): Confirmed Contract table, row "Quote mass by lifecycle role": "A Quote used for direct-order fulfillment requires valid package mass. Create Quote also accepts omitted or `null` mass for the earlier RDP discovery use case." Row "Single-Zip package": "the 2026-07-30 dimensions were `338 mm L × 252 mm W × 205 mm H` … The current hardware envelope revises width to `254 mm`." Section "Current Payload Envelope (Week of 2026-09-07)": "Width is the only metric change: `252 mm` → `254 mm`."
- `[[zipline-drone-quote-and-package-eligibility-contract-2026-07-02]]` (records/…): sandbox evidence 2026-08-11 — "Zipline staging created Quotes whose mass was `null` or `0`, but Create Delivery Intent rejected those Quote IDs."

## 2. Trade-off between Drone Loading and Dropbox Loading at a store

**Current answer.** Drone Loading (associate loads the aircraft directly) is operationally flexible, needs only partner approval and no permanent equipment, and tolerated large payloads in the September test (12/12 deliveries succeeded), but it costs a longer, precisely timed associate handoff (about 2–3 minutes, coordinated with aircraft arrival and the "load now" signal). Dropbox Loading (associate places the order in an installed Dropbox) cuts the associate action to about 1 minute and is the intended repeatable steady-state model, but it requires installed hardware, partner + landlord + city approvals, possible site construction (window, footing, curb, awning, roof), and showed a large-payload fit risk (largest payload failed 3 of 6 pickups). Decision rule: prefer Dropbox when site and bag are validated and the goal is low-touch repeatable handoff; prefer Drone Loading during early launch, construction dependency or payload-fit uncertainty; do not rely on staff packout discipline to fix a marginal Dropbox fit.

**Earlier answer replaced: no.** The comparison page has no superseded claims; all claims `^c1`–`^c19` were added 2026-09-15 and are current.

Relied on (`[[zipline-loading-methods]]`, comparisons/zipline-loading-methods.md, status current):
- `^c1`: "Drone Loading is operationally flexible and more tolerant of large payloads in the September test, but it requires a longer, precisely timed associate handoff".
- `^c2`: "Dropbox Loading shortens the associate action and is the intended repeatable infrastructure model, but it adds equipment, approvals, construction dependencies, and a demonstrated large-payload fit risk".
- `^c4`, `^c6`, `^c9`, `^c10` (approvals, 2–3 min vs ~1 min, construction dependency, 12/12 vs 3-of-6 failures).
- `^c17`, `^c18`, `^c19` (decision rule).
- Evidence is the 2026-09-15 Zipline x Wonder weekly deck (s1, no snapshot) and the legacy readout `queries/zipline-wonder-weekly-deck-readout-2026-09-15.md` (s2; digest verified).

## 3. What package Zipline guarantees to carry in a single Zip, and when Zipline takes custody

**Current answer.** One approved standard Wonder outer package (the existing Medium bag) that is within all four limits — gross mass ≤ 2495 g, length ≤ 338 mm, width ≤ 254 mm, height ≤ 205 mm — is guaranteed to use exactly one initial Zip. Operational replacement after a failure is outside that guarantee, and Zipline Pack is not required merely to prove one-Zip capacity. Zipline takes custody when the Delivery Intent reaches `DELIVERY_INTENT_STATUS_IN_PROGRESS`, which confirms successful P2 loading; this is the authoritative, irreversible custody boundary. After it, the package never returns to Wonder; a failed delivery is taken near a Zipline charging site and discarded, so recovery is refund/remake/new delivery, not same-package Ground fallback.

**Earlier answer replaced: partly.** The guaranteed envelope's width moved from 252 mm to 254 mm (see Q1). The custody boundary itself has not been superseded; it was an open P0 question ("Which API status/event is the authoritative Dropbox-lock and custody-transfer signal?") until Zipline confirmed `IN_PROGRESS` on 2026-07-30. The Zipline ReadMe's "returned to the Partner" wording was confirmed incorrect on 2026-08-04 and is overridden by the direct partner answer.

Relied on:
- `[[drone-delivery-integration-strategy#^c16]]` (envelope and one-Zip guarantee, quoted above) and `#^c17`: "The Wonder-side outer package that must fit that envelope is the existing Medium bag".
- `[[drone-delivery-integration-strategy#^c19]]`: "`DELIVERY_INTENT_STATUS_IN_PROGRESS` is the authoritative, irreversible custody boundary; food that fails after custody is discarded near a Zipline charging site and never returns to Wonder" (src: s10, s19, s20).
- `[[zipline-mvp-partner-confirmed-contract-2026-07-30]]`: "One approved outer package within all four limits uses exactly one initial Zip … Operational replacement after a failure is outside this guarantee." and "`DELIVERY_INTENT_STATUS_IN_PROGRESS` confirms successful P2 loading and transfer of custody to Zipline."
- `[[zipline-dropbox-lock-custody-and-failure-disposition-contract-2026-07-28]]` (records/…): "Zipline confirmed that `DELIVERY_INTENT_STATUS_IN_PROGRESS` is the authoritative event that the P2 package was successfully loaded and custody transferred to Zipline. This closes the earlier open lock-event mapping." and the Current-Documentation Correction (2026-08-04).

## Files relied on (vault-relative)

- AGENTS.md, CONVENTIONS.md (contract)
- concepts/drone-delivery-integration-strategy.md
- comparisons/zipline-loading-methods.md
- records/zipline-mvp-partner-confirmed-contract-2026-07-30.md
- records/zipline-drone-quote-and-package-eligibility-contract-2026-07-02.md
- records/zipline-dropbox-lock-custody-and-failure-disposition-contract-2026-07-28.md
- records/1p-drone-delivery-checkout-package-dimensions-contract-2026-07-16.md (grep only, lines 220, 290)
- queries/zipline-wonder-weekly-deck-readout-2026-09-15.md (frontmatter + digest only)
- tools/digest.py (run read-only to verify cited sha256 digests; all matched)

## Unable to establish / caveats

- `concepts/drone-delivery-integration-strategy.md` has page `status: disputed`, but the dispute is `^c24` (launch dates), unrelated to the claims used here; `verified` is 2026-07-17, older than the 2026-09-15 width change.
- The 2026-09-15 weekly deck (s1 on the comparison page) is a Google Slides URL with `no-snapshot`; the claims rest on the compiled readout and the deck image attachments, which I did not open.
- The three `records/` pages carry `date` values of July 2026 but have "revised by process:cook" History lines through 2026-10-19, i.e. their frozen scope was edited after creation. Per CONVENTIONS §6 that means pages citing them need review; however their current digests match the versions cited by the concept and comparison pages, so no citation is stale today.
- Mass (2495 g) comes only from the 2026-07-30 partner QA; the week-of-2026-09-07 slide does not show mass.
- Whether an in-flight cancellation after custody physically sends the package to a charging station, and whether `DELIVERY_STATUS_FAILED` carries a reason, remain open in the vault.

## Files changed

- ANSWER.md (this file, new). No other vault file was created, edited, moved or deleted; no git commit or push.
