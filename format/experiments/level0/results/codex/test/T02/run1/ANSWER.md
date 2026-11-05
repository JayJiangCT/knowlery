# Single-Zip package width limit

## Answer

The vault’s **current maintained/canonical rule is 254 mm**, while **252 mm is retained as the historical 2026-07-30 partner-QA value**.

The current rule is stated explicitly in `records/zipline-mvp-partner-confirmed-contract-2026-07-30.md`: the deterministic eligibility rule is `width_mm <= 254` (lines 57–65), and the record says the current hardware envelope revises width from the 2026-07-30 dimensions (line 44). `records/zipline-drone-quote-and-package-eligibility-contract-2026-07-02.md` likewise says to use `width_mm <= 254` (lines 143–154) and records the 2026-07-30 `252 mm` value as superseded/historical (lines 137, 154, 158–161). The knowledge-page history records the transition as a supersession on **2026-09-15**: the 252 mm claim was superseded by a claim that the week-of-2026-09-07 Payload Dimensions slide revised width to 254 mm (`concepts/drone-delivery-integration-strategy.md`, lines 142–148, especially line 143).

The stated basis for the change was the **Zipline Payload Dimensions slide dated the week of 2026-09-07**, supplied by Jay. The maintained record identifies that slide as the current hardware envelope and gives `254 mm / 10 in`; it says width is the only metric change, from `252 mm` to `254 mm`, with length and height unchanged (`records/zipline-mvp-partner-confirmed-contract-2026-07-30.md`, lines 112–131). The change was captured in the vault on 2026-09-15 (the refresh section in `records/zipline-drone-quote-and-package-eligibility-contract-2026-07-02.md`, lines 156–161).

## Dispute / limitation

Yes. The vault contains direct evidence that disputes the change. The underlying source note, `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Zipline Payload Dimensions Slide - Week of 2026-09-07.md`, says:

- the 3D render labels width as `10 in / 254 mm` (lines 20–26);
- a separate **Envelope card** states `338 × 252 × 205 mm` (lines 28–33);
- that Envelope card is the numeric payload envelope and matches the 2026-07-30 partner QA; `10 in / 254 mm` is described as a rounded imperial pairing, **not** a 2 mm hardware change (line 34); and
- it explicitly says: “Do not treat `254 mm` as a superseding envelope width” (line 36).

A separate later readout adopts the opposite interpretation and says the slide revises 252 mm to 254 mm (`queries/zipline-wonder-weekly-deck-readout-2026-09-15.md`, lines 82–92). Therefore, the vault’s maintained/canonical pages currently use **254 mm**, but the evidence chain is internally disputed; the vault does not establish an uncontested physical change. Under `CONVENTIONS.md` section 8, this conflict should be surfaced rather than silently resolved.

## Vault-relative paths relied on

- `records/zipline-mvp-partner-confirmed-contract-2026-07-30.md`
- `records/zipline-drone-quote-and-package-eligibility-contract-2026-07-02.md`
- `records/1p-drone-delivery-checkout-package-dimensions-contract-2026-07-16.md`
- `concepts/drone-delivery-integration-strategy.md`
- `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Zipline Payload Dimensions Slide - Week of 2026-09-07.md`
- `queries/zipline-wonder-weekly-deck-readout-2026-09-15.md`
- `CONVENTIONS.md`

## Unable to establish

I could not establish from the vault which artifact is authoritative when the 3D render and the Envelope card conflict, or whether the physical hardware actually changed by 2 mm. The vault contains no further direct measurement or external change log that resolves that contradiction.

## Files changed

- `ANSWER.md` — created to record this evidence-backed answer.
