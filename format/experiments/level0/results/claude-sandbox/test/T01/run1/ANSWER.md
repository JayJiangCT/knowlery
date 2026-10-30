# ANSWER — three Zipline questions (answered 2026-10-30 from this vault only)

## 1. Single-Zip width limit, and whether a direct-order Quote may omit mass

**Current answer: 254 mm. A direct-order (fulfillment) Quote may NOT omit mass; only the non-binding RDP discovery Quote may.**

- Width: the current single-Zip envelope is `2495 g`, `338 mm L × 254 mm W × 205 mm H`. Current claim: [[drone-delivery-integration-strategy#^c16]] — "The current single-Zip provider limit is 2495 g and 338 × 254 × 205 mm (5.50 lb, 13.25 × 10 × 8 in)" (src: s15 Payload Dimensions slide week of 2026-09-07, s16 weekly deck readout). Record detail: [[zipline-mvp-partner-confirmed-contract-2026-07-30]] §"Current Payload Envelope (Week of 2026-09-07)" — "Width is the only metric change: `252 mm` → `254 mm`. Length and height stay `338 mm` and `205 mm`. … Mass remains `2495 g`."
- **Earlier answer replaced: yes.** `252 mm` was the 2026-07-30 partner-QA width. It is in History on the concept page: [[drone-delivery-integration-strategy#^c27]] "…338 × 252 × 205 mm … per the 2026-07-30 partner QA · superseded 2026-09-15 by [[#^c16]] · week-of-2026-09-07 Payload Dimensions slide revised width to 254 mm". An even earlier `12.5 × 9.5 × 7.75 in` PRD loader reference was superseded on 2026-07-30 (same page History). Note that 252 mm still appears as the historical value inside frozen Record text (e.g. the "Canonical Dual-Unit Package Limits (2026-07-30)" table in the partner-confirmed record and [[zipline-mvp-final-partner-qa-working-draft-2026-07-26]]); those are dated snapshots, not current.
- Mass on a direct-order Quote: [[drone-delivery-integration-strategy#^c18]] — "A direct-order Quote requires reliable mass, so package-data completeness is a hard eligibility dependency; Pack is not a mandatory single-Zip proof for the MVP" (src: s10). Record statement: [[zipline-mvp-partner-confirmed-contract-2026-07-30]] "Confirmed Contract" table, row "Quote mass by lifecycle role": "A Quote used for direct-order fulfillment requires valid package mass. Create Quote also accepts omitted or `null` mass for the earlier RDP discovery use case." Sandbox evidence in [[zipline-drone-quote-and-package-eligibility-contract-2026-07-02]]: "Zipline staging created Quotes whose mass was `null` or `0`, but Create Delivery Intent rejected those Quote IDs."
- **Earlier answer replaced: yes.** The partner-confirmed record states: "These 2026-07-30 partner answers supersede the assumption that a no-mass Quote can be used for direct-order fulfillment." The discovery (RDP) no-mass Quote remains allowed but "must not be used for Delivery Intent".

## 2. Drone Loading vs Dropbox Loading trade-off at a store

**Current answer** (all from [[zipline-loading-methods]], `status: current`, as of the 2026-09-15 Zipline x Wonder weekly deck):

- [[zipline-loading-methods#^c1]]: "Drone Loading is operationally flexible and more tolerant of large payloads in the September test, but it requires a longer, precisely timed associate handoff."
- [[zipline-loading-methods#^c2]]: "Dropbox Loading shortens the associate action and is the intended repeatable infrastructure model, but it adds equipment, approvals, construction dependencies, and a demonstrated large-payload fit risk."
- Specifics: associate time 2–3 min vs ~1 min ([[#^c6]]); approvals partner-only vs partner + landlord + city ([[#^c4]]); Drone Loading needs coordination with aircraft arrival and a "load now" signal, Dropbox waits for Dropbox-ready state ([[#^c7]]); Dropbox needs an installed Dropbox and possible window/footing/curb/awning/roof work ([[#^c3]], [[#^c9]]); test signal 12/12 successes for Drone Loading vs the largest payload failing 3 of 6 pickups under Dropbox ([[#^c10]]).
- Decision rule: [[zipline-loading-methods#^c17]] "Prefer Dropbox Loading when the site and bag are validated and the goal is repeatable, low-touch store handoff"; [[#^c18]] "Prefer Drone Loading during early launch, construction dependency, or payload-fit uncertainty"; [[#^c19]] "Do not use staff packout discipline as the primary mitigation for a marginal Dropbox fit; address the bag or app eligibility boundary." Dropbox's long-term labor advantage applies only after four conditions are met ([[#^c15]]).
- **Earlier answer replaced: no.** The page's History has only the 2026-09-15 creation line (c1–c19 added); no superseded claims exist on this subject in the vault.

## 3. Package Zipline guarantees to carry in a single Zip, and when custody transfers

**Current answer:**

- Guarantee: one approved standard outer package within all four limits — `gross_mass_g <= 2495`, `length_mm <= 338`, `width_mm <= 254`, `height_mm <= 205`, `approved_outer_package = true` — "uses exactly one initial Zip". Source statement: [[zipline-mvp-partner-confirmed-contract-2026-07-30]] "Single-Zip package" row: "One approved outer package within all four limits uses exactly one initial Zip. The current hardware envelope revises width to `254 mm` … Operational replacement after a failure is outside this guarantee." Also [[zipline-drone-quote-and-package-eligibility-contract-2026-07-02]] §"Partner-Confirmed Mass And Single-Zip Contract (2026-07-30)": "One approved outer package within all limits is guaranteed to use exactly one initial Zip; failure replacement is outside that guarantee." Current concept claims: [[drone-delivery-integration-strategy#^c16]] (envelope) and [[#^c18]] (Pack not mandatory as single-Zip proof).
- Custody: `DELIVERY_INTENT_STATUS_IN_PROGRESS`. Current claim [[drone-delivery-integration-strategy#^c19]]: "`DELIVERY_INTENT_STATUS_IN_PROGRESS` is the authoritative, irreversible custody boundary; food that fails after custody is discarded near a Zipline charging site and never returns to Wonder" (src: s10, s19, s20). Record statement: [[zipline-dropbox-lock-custody-and-failure-disposition-contract-2026-07-28]] §"Partner-Confirmed API Boundary (2026-07-30)": "Zipline confirmed that `DELIVERY_INTENT_STATUS_IN_PROGRESS` is the authoritative event that the P2 package was successfully loaded and custody transferred to Zipline. This closes the earlier open lock-event mapping." Operationally, custody passes at successful P2/Dropbox loading, which also summons the drone ([[drone-delivery-integration-strategy#^c21]]).
- **Earlier answer replaced: partly.** (a) The single-Zip envelope's width was 252 mm before 2026-09-15 (see Q1; [[drone-delivery-integration-strategy#^c27]] in History). (b) Before 2026-07-30 the vault treated single-delivery as *not* guaranteed by static rules — [[zipline-drone-quote-and-package-eligibility-contract-2026-07-02]] §"Single-Delivery MVP Guardrail (2026-07-15)": "the current documentation does not make them a single-delivery guarantee" and Pack `total_deliveries = 1` was "the strongest currently documented pre-Intent signal"; the 2026-07-30 partner confirmation replaced that with the explicit one-Zip guarantee. (c) For custody, the exact lock/custody event was an open question in the 2026-07-28 record ("Does `DELIVERY_INTENT_STATUS_IN_PROGRESS` exactly represent that boundary?") until Zipline's 2026-07-30 answer closed it. The ReadMe's "package returns to partner" wording is documented as incorrect and overridden by the dated partner answers.

## Files relied on (vault-relative)

- `AGENTS.md`, `CONVENTIONS.md`, `.claude/CLAUDE.md` (instructions)
- `concepts/drone-delivery-integration-strategy.md`
- `comparisons/zipline-loading-methods.md`
- `records/zipline-mvp-partner-confirmed-contract-2026-07-30.md`
- `records/zipline-drone-quote-and-package-eligibility-contract-2026-07-02.md`
- `records/zipline-dropbox-lock-custody-and-failure-disposition-contract-2026-07-28.md` (partial: §Partner-Confirmed API Boundary, History, frontmatter)
- `records/zipline-mvp-final-partner-qa-working-draft-2026-07-26.md` (grep hits only)
- `records/1p-drone-delivery-checkout-package-dimensions-contract-2026-07-16.md`, `records/drone-mvp-medium-bag-outer-package-decision.md` (grep hits only)
- `queries/zipline-wonder-weekly-deck-readout-2026-09-15.md` (frontmatter and digest only)
- `log.md`, `tools/digest.py`

## Unable to establish / caveats

- `concepts/drone-delivery-integration-strategy.md` is `status: disputed` (because of launch-date claim ^c24), and its `verified` date (2026-07-17) predates the claims used here; the claims relied on (c16, c18, c19, c21) are not themselves disputed.
- Source-version drift (computed with `tools/digest.py --scope record`): the strategy page's s10 (`735dd357…`) and s19 (`310e67cf…`) digests no longer match the current records (`f7eb0926…`, `d65d4ba1…`), and `zipline-loading-methods` s2 (`14aff2c4…`) no longer matches the readout (`271534b0…`; legacy page updated 2026-09-20). The records' History lines show only additive revisions, and the quoted statements remain in the current texts, so the answers above stand, but the cited claims are formally due for re-verification. Not changed here (read-only task).
- Mass `2495 g` is carried forward from the 2026-07-30 partner QA; the week-of-2026-09-07 slide "does not show" mass, so no newer mass confirmation exists in the vault.
- No vault page records an earlier, now-replaced answer for the Drone Loading vs Dropbox Loading trade-off.
- The original Zipline Google Doc/Slides sources are `no-snapshot` URLs; their text was not accessible (no network) and was not needed.

## Files changed

- `ANSWER.md` (new) — this answer, as the task required.
- `log.md` — one line appended under 2026-10-30 recording the ANSWER.md write (CONVENTIONS §10). No knowledge pages, records or sources were modified.
