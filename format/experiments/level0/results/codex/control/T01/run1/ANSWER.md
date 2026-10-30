# Zipline answers

## 1. Single-Zip width and Quote mass

- **Current answer:** The current Single-Zip width limit is **254 mm**. A Quote used for **direct-order fulfillment cannot omit mass**: it requires valid positive `mass_grams`. Create Quote may omit or set mass to `null` only for the separate, non-binding RDP discovery flow; that Quote must not be used to create a Delivery Intent.
- **Earlier answer replaced:** **252 mm** was the width in the 2026-07-30 partner QA and is explicitly superseded by the week-of-2026-09-07 hardware envelope. The earlier assumption that a no-mass Quote could support direct-order fulfillment was also superseded; only discovery remains mass-optional.
- **Evidence:** `queries/zipline-mvp-partner-confirmed-contract-2026-07-30.md` states that direct-order fulfillment requires valid mass, that the earlier dimensions used `252 mm`, and that the current hardware envelope revises width to `254 mm` (sections “Confirmed Contract,” “Current Payload Envelope,” and “Source precedence”).

## 2. Drone Loading versus Dropbox Loading

- **Current answer:** **Drone Loading** is more flexible and handled larger payloads in the September test (12/12 succeeded), but it takes about 2–3 minutes and requires the associate to coordinate with the aircraft’s arrival and “load now” signal. **Dropbox Loading** takes about 1 minute and is the intended repeatable, lower-touch store handoff, but it requires installed/approved infrastructure and had a large-payload fit risk (largest payload succeeded 3/6 pickups in the cited test). Successful Dropbox loading itself summons the drone.
- **Earlier answer replaced:** No earlier answer is identified as superseded in the current comparison; the comparison is marked active and dated 2026-09-15. The test result is scoped to that week’s payloads and is not a universal failure rate.
- **Evidence:** `comparisons/zipline-loading-methods.md`, especially “Short summary,” “Side-by-Side Comparison,” and “Reliability Evidence.” The Dropbox summon rule is also stated in `queries/zipline-mvp-partner-confirmed-contract-2026-07-30.md` under “Dropbox Trigger and Advisory Loading Window.”

## 3. Guaranteed package and custody

- **Current answer:** Zipline guarantees that an approved outer package within the current envelope—**gross mass ≤ 2495 g; length ≤ 338 mm; width ≤ 254 mm; height ≤ 205 mm**—uses exactly **one initial Zip**. The guarantee does not cover an operational replacement after a failure. Zipline takes custody when `DELIVERY_INTENT_STATUS_IN_PROGRESS` confirms successful P2 loading and transfer of custody. After that boundary, the original package cannot return to Wonder; a failed package is taken near a Zipline charging site and discarded.
- **Earlier answer replaced:** The earlier one-Zip dimensions used **338 × 252 × 205 mm**; the width is now 254 mm. Earlier uncertainty about which event marked custody was resolved by the partner confirmation of `DELIVERY_INTENT_STATUS_IN_PROGRESS`.
- **Evidence:** `queries/zipline-mvp-partner-confirmed-contract-2026-07-30.md` (the “Confirmed Contract,” “Eligibility Service Impact,” and “Delivery Lifecycle Impact” sections) and `queries/zipline-dropbox-lock-custody-and-failure-disposition-contract-2026-07-28.md` (the “Partner-Confirmed API Boundary” section).

## Vault paths relied on

- `queries/zipline-mvp-partner-confirmed-contract-2026-07-30.md`
- `comparisons/zipline-loading-methods.md`
- `queries/zipline-dropbox-lock-custody-and-failure-disposition-contract-2026-07-28.md`

## Unable to establish

The vault does not establish that a failed or canceled **post-custody** execution has exactly the same physical outcome in every cancellation case; it records cancellation semantics as partly unresolved. It does establish the confirmed failed-delivery disposal path and the irreversible custody boundary above.
