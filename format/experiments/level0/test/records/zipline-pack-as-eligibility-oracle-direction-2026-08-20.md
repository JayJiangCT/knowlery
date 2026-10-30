---
type: record
title: Zipline Pack as Eligibility Oracle Direction (2026-08-20)
description: What Rob Knudson's 2026-08-20 direction for Drone MVP fit eligibility is (Wonder measures item weight and dimensions, Zipline Pack decides fit via total_deliveries == 1) and how it was refined through the 2026-10-26 Cookbook profile-sync decision; the Pack representation, Pack-to-Intent binding, bag tare and checkout SLO remain open and are not resolved here.
date: 2026-08-20
kind: finding
tags:
  - api
  - architecture
  - drone-delivery
  - mvp
status: current
updated: 2026-10-19
updated_by: process:cook
verified: 2026-10-26
verified_by: process:cook
aliases:
  - Pack as Eligibility Oracle
  - Zipline Pack Eligibility Direction
  - Pack API 资格判定方向
---

# Zipline Pack as Eligibility Oracle Direction (2026-08-20)

## Summary

In the 2026-08-20 morning meeting, [[rob-knudson|Rob Knudson]] proposed that Wonder should not build its own fit logic. Instead:

1. **Cookbook provides** item-level weight and packed dimensions through the agreed profile API and Kafka change topic. Delivery Catalog stores a synchronized local projection, with profile validity and sync health tracked locally.
2. **Zipline decides fit.** At checkout, the order's items go to the [[Pack items into deliveries|Zipline Pack API]]; `metadata.total_deliveries == 1` means the order fits a single drone delivery, anything else means ground only.

This is the current Wonder implementation direction, with the Pack representation, Pack-to-Intent binding, detailed bag packing limits/tare, and checkout operating contract still open. Consumer reaches Delivery Catalog Service through OMS/CCP; Delivery Catalog resolves approved profiles, calls Pack as the preferred affirmative fit oracle, and supplies Quote timing source data to KOETA. Zipline does not require Pack when one approved outer package is already within the confirmed envelope, so that partner-supported alternative remains distinct from the chosen Wonder path. See [[1P Drone Delivery Weight and Dimensions MVP Eligibility Proposal (2026-08-19)]].

## Detail

> [!note] Later refinement (2026-10-26)
> The Pack-as-oracle core still holds. Cookbook now provides item-level profile values through an API and Kafka change topic. Delivery Catalog periodically synchronizes those values into a local table, and Drone Eligibility reads the local projection. The existing classification resolution remains the fallback for missing or unusable Cookbook profiles. See [[drone-cookbook-menu-item-profile-sync-decision-2026-10-26|Drone Cookbook Menu Item Profile Sync Decision (2026-10-26)]].

> [!warning] Green-data authority clarification (2026-09-14)
> Rob clarified that the spreadsheet's `Primary Container` field is reference-only. Green weight/dimension cells are direct measurements and an initial criteria set, not a maintained current-pack source of truth. Currentness, packaging-change handling, and mapping to uncovered items remain required before the values are reused in Pack input.

> [!important] Outer-package status update (2026-10-19)
> Rob's PRD v26 reports that the **new Medium Wonder bag, 12 × 8.5 × 13 in**, has been validated by Zipline across multiple packaging configurations and is the default MVP launch bag. Small is an operational fallback at IKC staff discretion; Large is out of scope. This supersedes the September 20 candidate-testing status. Item-level Pack evaluation remains required; nominal bag dimensions do not establish that every cart fits. The PRD does not specify the bag SKU, tare, tested fill/fold limits, or partner-site configuration. See [[drone-mvp-medium-bag-outer-package-decision]] for the evidence and historical specifications.

> [!important] MVP identity correction (2026-09-01)
> The earlier Cookbook-dependent packaging signature is no longer part of the current MVP path. Delivery should derive a configuration identity from Consumer Cart fields, verify it against OMS Order fields, and resolve it to the local Delivery Catalog profile projection and `containers[]`. Cookbook supplies item-level profile data through the sync contract, but is not called during Checkout. See [[drone-checkout-cart-profile-identity-and-container-schema-2026-08-31|Drone Checkout Cart Profile Identity and Container Schema (2026-08-31)]].

### Rob's Midtown East Operational Update (2026-08-20 PM)

[[rob-knudson|Rob Knudson]] reported five concrete outcomes after visiting Midtown East [[ikc|IKC]]:

1. **Robotic Arm weight capture is out of MVP scope.** The readings remained inconsistent and often incorrect even when the arm paused for five seconds to reduce vibration. Longer-term improvement remains possible, but Eligibility should not depend on it.
2. **Manual scale capture worked.** Rob photographed prepared order items on a digital scale with the printed order label visible. An extraction tool then converted the photo evidence into a Markdown table, reducing data-entry effort.
3. **The first batch is material but not a unique-item master.** The supplied summary contains 88 photo-backed observations from 57 orders across 68 distinct `Concept + Item` labels. Its source-photo mapping has 89 rows, with order `11342894` absent from the summary. These counts do not establish approximately 85 unique menu-item identities.
4. **Dimensions are next.** Rob plans additional IKC visits to expand top-seller coverage and capture packed dimensions alongside weight.
5. **Fallback remains required.** The initial measured catalog will be limited, so missing-data behavior and fallback logic are Rob's expected focus early the following week.

The photographic workflow preserves useful provenance: order number, displayed item description, concept/location, physical packed form, scale reading, and source image. It accelerates collection but does not by itself define a canonical profile. The supplied Markdown is already a transformed artifact: OCR corrections and a highest-reading rule were applied, and several documented ranges are too large to treat as ordinary scale stabilization. Repeated observations, source-photo review, a pinned measurement convention, Cart/Order-native parent mapping, and an approval step are still required before the result can safely feed Pack or Quote mass.

#### Data custody implied by the collection workflow

The evidence naturally separates into two layers:

- **Raw measurement observations:** order-linked photos, extracted readings, source metadata, and review status. A lightweight evidence/staging store can hold these records.
- **Local runtime profiles:** item-level weight and dimensions received from Cookbook and stored in Delivery Catalog, plus the existing Delivery resolution used when no usable Cookbook profile exists. Delivery owns the local serving projection and runtime orchestration; Cookbook owns the source values and delivery contracts.

The MVP boundary is: Ops/Packaging executes measurements, Cookbook provides source profiles and change interfaces, Consumer/OMS provide identity fields, Delivery Catalog owns the synchronized local projection and orchestration, Zipline owns the Pack fit verdict, and KOETA consumes Quote timing source data for customer ETA.

### What Changes If This Direction Holds

| Concern | Before (Wonder-owned fit) | After (Pack as oracle) |
| --- | --- | --- |
| Fit decision | Wonder-built gate: exclusion table + drone menu of physically validated items | Zipline Pack API; Wonder checks `total_deliveries == 1` |
| Bin-packing logic | Avoided by design (allowlist sidesteps it) | Owned by Zipline, which also owns the physical Pod |
| Physical work | Validation sessions producing a binary fits/does-not-fit verdict per item | Measurement sessions producing physical-unit `length_mm × width_mm × height_mm + mass_g` profiles |
| Data product | Drone menu (allowlist) + per-item validated max weight | Versioned mappings from Wonder item/configuration to one or more physical-unit profiles |
| Customization handling | Maximal-form dominance rule for fit | Absorbed by Pack input if measurements use the packaging-heaviest build; dominance machinery no longer needed for fit |
| Coverage boundary | Order eligible only if all items on the drone menu | Order eligible only if every Cart line resolves to a complete approved physical-unit set |

Delivery Catalog Service becomes a **data provider plus orchestrator**: resolve the order's items, look up measured dimensions and mass, call Pack, interpret the count, and provide the Quote source-data path. It stops being the owner of a fit algorithm. That is the scope convergence: no Wonder bin-packing, no fit-validation verdict pipeline, and the decision authority sits with the party that owns the Pod geometry, so envelope changes (such as the 40% larger Q4 cargo compartment Zipline has mentioned) require no Wonder rule update.

### Pack Item Grain Clarification (2026-08-26)

Norbert Lichao flagged that a Zipline Pack `item` may be modeled at the indivisible-container level rather than the Wonder selling-item level. Under that interpretation, one Wonder item can produce multiple Pack items when its entrée, side, sauce, drink, or customization ships in separate containers.

This invalidates a simple one-to-one model of `Wonder item → one weight and one L/W/H`. The required resolution becomes:

```text
Wonder Cart line + selected options + location/package context
→ complete list of physical package units
→ one Pack item per indivisible unit
```

Mass can be summed across the units for Wonder's payload guard, but their dimensions must remain separate for Zipline's packing calculation. Measurement collection must include every normally shipped container, not only the main food package. The interpretation still requires Zipline confirmation, especially because the order is ultimately placed inside one Wonder Medium bag. See [[1p-drone-delivery-eligibility-data-and-pack-contract-2026-08-21|1P Drone Delivery Eligibility Data and Pack Contract (2026-08-21)]] and [[cookbook-physical-packaging-data-model-and-drone-eligibility-feasibility-2026-07-23|Cookbook Physical Packaging Data Model and Drone Eligibility Feasibility (2026-07-23)]].

#### Base container plus option deltas (2026-09-01)

Rob later confirmed that customization does not replace the standard base container. The MVP candidate can therefore resolve the Cart item to a base profile, then use selected Cart option/value IDs to append separately packed sauce/dip container profiles. Bundle choices expand child item profiles. When sauce placement is uncertain, treat it as a separate measurable Pack item. This composition avoids both per-configuration Cookbook signatures and a blanket customized-item exclusion.

### What Survives From the Earlier Proposals

The earlier proposals are not wasted work; their components map onto this direction:

- **The load-failure-first framing and error asymmetry** (offer drone on fewer orders rather than fail at the Zipping Station) still governs every default in the new flow.
- **The sales-ranked measurement workflow** in [[1P Drone Delivery Weight and Dimensions MVP Eligibility Proposal (2026-08-19)]] is exactly the data-collection program Pack needs. Per [[order-packaging-geometry-feasibility-for-drone-dimension-eligibility-2026-08-12|Order Packaging Geometry Feasibility for Drone Dimension Eligibility (2026-08-12)]], 187 menu items cover 80% of volume and 350 cover 95%, so the measurement target is bounded.
- **Conservative missing-data behavior**: use an approved exact or conservative profile and still call Pack; if no approved profile exists, return ground-only or unavailable.
- **The rigid-container exclusion insight** remains available as a cheap local pre-screen to avoid pointless Pack calls, though Pack would also reject oversized items on its own if their dimensions are recorded.
- **Mass still matters to Wonder independently**: Create Delivery Intent requires positive `mass_grams` per [[zipline-sandbox-quote-mass-gating-contract]], so the measured weights feed both Pack and the Quote/Intent path.

### The Four Gaps That Must Close

From the 2026-08-20 evaluation, in current status order:

1. **Input data for soft packaging.** Pack requires `width_mm`, `height_mm`, `length_mm`, `mass_g` per item, but wraps and bags have no fixed dimensions ([[order-packaging-geometry-feasibility-for-drone-dimension-eligibility-2026-08-12|Order Packaging Geometry Feasibility for Drone Dimension Eligibility (2026-08-12)]]: 94.6% of orders contain packaging with no meaningful catalog dimensions). Rob's top-seller measurement program addresses this only if the measurement convention is pinned: measure the packed form, packaging-heaviest customization, stated orientation. Partially addressed, convention still open.
2. **Container semantics: physical units versus one Medium bag.** A Wonder selling item may resolve to multiple indivisible containers. PRD v26 (2026-10-19) reports validation of the new 12 × 8.5 × 13 in Medium and retains item-level Pack objects derived from packaging-group data. The earlier August sample/SKU interpretation is historical. The PRD does not document the tested fill/fold limits or how the partner-site configuration accounts for the outer bag. See [[drone-mvp-medium-bag-outer-package-decision]].
3. **Pack-Intent binding.** Whether a Pack result binds or guarantees the subsequent Delivery Intent, or is purely advisory, is unknown. If advisory, a Pack-passed order could still fail at Intent or at the Dropbox. Open, on Rob's Zipline agenda.
4. **Checkout latency and reliability.** Pack becomes a synchronous external call on the checkout path. Needed: an SLO from Zipline, a call-placement decision (cart-change versus checkout-only), and a fail-closed default (Pack unavailable means ground only, never optimistic drone). Open.

### Open Decisions

- Where measurements live: **Cookbook source profiles synchronized into a Delivery Catalog local table**. Runtime lookup uses Consumer Cart / OMS Order identity and reads the local projection, not a Checkout-time Cookbook request. The existing classification resolution is the fallback for missing or unusable profiles. See [[drone-cookbook-menu-item-profile-sync-decision-2026-10-26|Drone Cookbook Menu Item Profile Sync Decision (2026-10-26)]].
- Whether the earlier unit-cap `K` survives as a cheap sanity guardrail in front of Pack.
- Who owns the measurement SOP and re-measurement on packaging changes (item numbers version physical materials, which helps).
- Whether Pack accounts for payload mass against the 2495 g ceiling or Wonder must still pre-check mass.

### Fallback Coherence

Rob expects the limited initial measurement catalog to require fallback logic. The word “fallback” must distinguish degradation from a second eligibility authority:

- **Coherent with Pack:** use an approved exact or conservative measurement profile and still call Pack; otherwise fail closed to standard delivery.
- **Potentially contradictory:** let item count or another Wonder heuristic independently approve a Cart containing unmeasured items.

If Pack is chosen because Zipline should own the fit algorithm, a count-only affirmative branch recreates a Wonder-owned fit path and can approve one heavy or oversized item. Count may remain a rejection-only sanity guard. Rob's 2026-08-25 comment and 2026-08-30 replies now propose conservative estimated profiles that still call Pack; see [[1p-drone-delivery-weight-and-dimension-eligibility-current-proposal-2026-08-31|1P Drone Delivery Weight and Dimension Eligibility Current Proposal (2026-08-31)]].

The **mass** side has a researched BOM-derived candidate, but it is not required by the current MVP design and its calibration is not approved. If revisited as a future estimator, use it only with an explicit conservative policy and revalidated sample; see [[bom-net-weight-vs-measured-gross-weight-calibration-2026-08-21|BOM Net Weight vs Measured Gross Weight Calibration (2026-08-21)]] and [[cookbook-bom-and-unit-conversion-warehouse-availability-2026-08-21|Cookbook BOM and Unit Conversion Warehouse Availability (2026-08-21)]]. Dimensions still have no equivalent Cookbook estimator.

### Relation To Existing Pages

- Supersedes-if-confirmed: the Wonder-owned fit-gate half of [[1P Drone Delivery Weight and Dimensions MVP Eligibility Proposal (2026-08-19)]], [[1P Drone Delivery Phase 0 Eligibility Proposal (2026-08-18)]], and [[1P Drone Delivery MVP Dimensions Eligibility Proposal (2026-08-12)]]. Those pages are marked `freshness_status: watch` pending Rob's Zipline conversation.
- Consistent with: [[zipline-mvp-partner-confirmed-contract-2026-07-30]] (envelope unchanged), [[1p-drone-delivery-checkout-package-dimensions-contract-2026-07-16|1P Drone Delivery Checkout Package Dimensions Contract (2026-07-16)]] (PRD v16 open question "Will Wonder use Zipline packing for any orders?" now has an active answer track).
- Later Product refinement: [[1p-drone-delivery-weight-and-dimension-eligibility-current-proposal-2026-08-31|1P Drone Delivery Weight and Dimension Eligibility Current Proposal (2026-08-31)]].
- Profile sync decision: [[drone-cookbook-menu-item-profile-sync-decision-2026-10-26|Drone Cookbook Menu Item Profile Sync Decision (2026-10-26)]].
- Current Consumer/OMS boundary: [[1p-drone-delivery-consumer-ccp-oms-alignment-decisions-2026-08-26|1P Drone Delivery Consumer, CCP, and OMS Alignment Decisions (2026-08-26)]].
- Meeting record: [[Meeting Notes - Weight and Dimensions Alignment with Rob (2026-08-19)]].

## Sources
- s1 · https://wonder.atlassian.net/wiki/spaces/~712020f40ba91c0864455e9792d8f51b9f008d/pages/5462392836/PRD+Weight+and+Dimension+Eligibility+for+1P+Drone+Delivery · fetched:2026-10-19 · source · no-snapshot · Weight and Dimension Eligibility PRD, read as v26 on 2026-10-19
- s2 · [[Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Meeting Notes - Weight and Dimensions Alignment with Rob (2026-08-19)]] · @pin · source
- s3 · [[Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Zipline API Doc/Pack items into deliveries]] · @pin · source
- s4 · [[Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Archive/Eligibility and Architecture/1P Drone Delivery Weight and Dimensions MVP Eligibility Proposal (2026-08-19)]] · @pin · source
- s5 · [[1p-drone-delivery-checkout-package-dimensions-contract-2026-07-16]] · @pin · record
- s6 · [[zipline-drone-quote-and-package-eligibility-contract-2026-07-02]] · @pin · record
- s7 · [[drone-mvp-medium-bag-outer-package-decision]] · @pin · record
- s8 · human:rob-knudson · stated:2026-08-20 · attestation · Slack thread screenshot (Jay Nan, Rob Knudson, Stephen Acciaioli) supplied by Jay; the page does not isolate which statement in the thread it uses
- s9 · human:rob-knudson · stated:2026-08-20 · attestation · Slack DM thread to Jay Nan, 22:21-22:25 ET: Midtown East operational update, the Robotic Arm is out of MVP scope, manual scale capture worked, dimensions are next, fallback remains required
- s10 · <local-download>/weight_capture_data.md · unverified · source · local download, as written; the extracted Markdown table of 88 photo-backed weight observations
- s11 · Manual scale and extraction-example images supplied by Jay, 2026-08-20 · unverified · source · as written
- s12 · human:jay · stated:2026-08-20 · attestation · Conversation alignment with Jay, 2026-08-20; the page does not isolate what was agreed
- s13 · human:norbert-lichao · stated:2026-08-26 · attestation · Confluence inline comment on Rob Knudson's Weight and Dimension Eligibility PRD, supplied by Jay: a Zipline Pack item may be modeled at the indivisible-container level rather than the Wonder selling-item level
- s14 · [[1p-drone-delivery-weight-and-dimension-eligibility-current-proposal-2026-08-31]] · @pin · record
- s15 · [[drone-checkout-cart-profile-identity-and-container-schema-2026-08-31]] · @pin · record
- s16 · [[drone-delivery-catalog-order-item-profile-schema-proposal-2026-08-31]] · @pin · record
- s17 · [[Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Confluence Comment - Zipline Item Grain and Sauce Containers - 2026-09-01]] · @pin · source
- s18 · https://remarkable-foods.slack.com/archives/C09MGEPLNJ1/p1789375418083879 · fetched:2026-09-14 · source · no-snapshot · Slack message; date inferred from the permalink timestamp, matching the green-data clarification
- s19 · https://wonder.atlassian.net/wiki/spaces/~5f811730e31b69006feed38a/pages/5706907865/Drone+Eligibility+Check+-+MVP+Plan?focusedCommentId=5707792556 · fetched:2026-08-20 · source · no-snapshot · Drone Eligibility Check - MVP Plan comment; no fetch date on the 1.x page

## History
- 2026-10-26 · verified by process:cook
- 2026-10-26 · revised by process:cook · Later refinement
- 2026-10-19 · revised by process:cook · Outer-package status update
- 2026-09-14 · revised by process:cook · Green-data authority clarification
- 2026-09-01 · revised by process:cook · MVP identity correction
- 2026-09-01 · revised by process:cook · Base container plus option deltas
- 2026-08-26 · revised by process:cook · Pack Item Grain Clarification
- 2026-08-20 · revised by process:cook · Rob's Midtown East Operational Update (2026-08-20 PM)
