---
type: record
title: 1P Drone Delivery Checkout Package Dimensions Contract (2026-07-16)
description: What package-dimension and weight contract Checkout eligibility for the 1P Drone Delivery MVP must satisfy, traced from the 2026-07-16 alignment through the 2026-09-29 review (provider envelope, profile schema, responsibility boundary, failure semantics, open decisions); the final outer-bag SKU, filled profile and tare are not covered.
date: 2026-07-16
kind: finding
tags:
  - api
  - architecture
  - drone-delivery
  - mvp
status: current
updated: 2026-09-29
updated_by: process:cook
verified: 2026-09-29
verified_by: process:cook
aliases:
  - Drone Checkout Dimensions Contract
  - Pre-order Bag Recommendation Contract
  - 无人机配送结账前包裹尺寸契约
---

# 1P Drone Delivery Checkout Package Dimensions Contract (2026-07-16)

## Summary

> [!warning] Bag status update (2026-09-20)
> The earlier existing-Medium direction is no longer a final package decision. Stephen has requested two new bag sizes that are expected to be slightly smaller than the Dropbox and will be sent to Zipline for testing. The final SKU, filled/folded profile, tare, and partner-site configuration remain pending. Do not treat the earlier Medium dimensions or Pod-fit observation as final approval.

The current MVP direction does not expect Checkout to compute exact order geometry or reuse the KDS bag recommendation algorithm. Consumer sends cart and address context through OMS/CCP to Delivery Catalog Service. Delivery Catalog resolves the approved profile, calls Pack when the current representation is available, and supplies Quote timing source data to KOETA. Wonder expects one designated outer bag for eligible Drone orders, but the final bag SKU and filled/folded profile are still pending Zipline validation. See [[drone-mvp-medium-bag-outer-package-decision]].

The current candidate path uses manually measured packed-item weight and dimensions for top sellers in a Delivery-owned static dataset. Eligibility normalizes Consumer Cart item/option/bundle/quantity fields into a configuration identity, resolves the profile, and calls Zipline Pack. Cookbook is not required for MVP lookup. KDS/KOM remains operational only: instruct IKC staff to use the designated bag once the final package profile is approved.

The [[1P Drone Delivery MVP Dimensions Eligibility Proposal (2026-08-12)|configuration-allowlist proposal]] remains valuable as historical reasoning and a fallback if Pack cannot satisfy the Wonder contract.

## Detail

> [!warning] Current Checkout profile direction (2026-09-01)
> The provider envelope, conservative missing-data principle, KDS boundary, and Medium-bag questions remain current. The Cookbook-dependent configuration allowlist/signature below is historical. The current MVP candidate derives identity from Consumer Cart fields, serves a Delivery-owned physical profile and `containers[]`, and calls Zipline Pack. See [[1p-drone-delivery-weight-and-dimension-eligibility-current-proposal-2026-08-31|1P Drone Delivery Weight and Dimension Eligibility Current Proposal (2026-08-31)]].

### Where Dimensions Are Used

| Stage | Use | Required confidence |
| --- | --- | --- |
| Delivery Catalog fit evaluation via OMS/CCP | Resolve the Cart snapshot and suppress a request that clearly exceeds single-Drone MVP package limits before Quote/Pack | Predictive, conservative and fast |
| Zipline Pack evaluation through Delivery Catalog | Ask Zipline how the resolved physical units fit into deliveries for a partner site | Exact units and stable package snapshot |
| IKC final validation | Confirm the prepared physical package remains safe to load | Operational and closest to physical truth |

A Checkout recommendation is predictive. It reduces late failure risk but does not replace the final Zipping Station guardrail.

### Earlier Proposed Pre-Order Data Chain (Superseded For MVP)

> [!warning] Historical direction
> The geometry-resolution chain below remains useful background but is not the current MVP proposal. Production analysis found that flexible and conformable packaging makes exact order-level geometry non-modelable for most orders. See [[order-packaging-geometry-feasibility-for-drone-dimension-eligibility-2026-08-12|Order Packaging Geometry Feasibility for Drone Dimension Eligibility (2026-08-12)]] and the [[1P Drone Delivery MVP Dimensions Eligibility Proposal (2026-08-12)|current proposal]].

```text
Final Cart items, quantities and customizations
→ Cookbook PackageSKUConfig resolution
→ physical Packaged SKUs and counts
→ inventory-UOM dimensions + food net weight
→ packaging tare and approved outer-package profile
→ versioned package dimensions, mass and confidence
→ Drone Eligibility precheck
```

The chain above is retained only as historical evidence. The current MVP does not require Cookbook PackageSKUConfig resolution; Delivery uses Cart-native identity and its own approved physical-profile snapshot.

Consumer supplies Cart context to one Wonder-owned eligibility contract. It does not call Cookbook, KDS, or Zipline directly.

### Required Package Profile

The eligibility capability needs more than one largest dimension tuple. The reusable package result should include:

```text
configuration_fingerprint       # Consumer Cart fields; reproducible from OMS Order
profile_id
profile_version
eligibility_rule_version
physical_units[]:
  container_profile_key
  container_role
  count
  length_mm
  width_mm
  height_mm
  gross_mass_g
  source_type
  measurement_source
outer_package:
  profile_id
  mass_g
confidence
used_default_data
missing_item_ids[]
reason_codes[]
```

Package-resolution version, physical-profile version, and eligibility-rule version must remain separate. Packaging facts can change without changing the policy that evaluates them.

### Responsibility Boundary

- Consumer owns the Cart identity fields; OMS preserves comparable post-order identity for validation.
- Delivery owns the static MVP profile snapshot, serving SLA, profile/version selection, and eligibility orchestration.
- Ops/Packaging owns raw measurement execution and evidence; profile approval governance remains open.
- Cookbook is not an MVP runtime dependency and remains a possible long-term master-data owner.
- KDS/KOM owns the operational instruction presented to Runner when an eligible Drone order must use the designated Medium bag; the current KDS recommendation algorithm is not expected to drive eligibility.
- Delivery Catalog Service owns comparison against provider/site rules, Pack/Quote calls, and the normalized eligibility/Quote source-data result.
- Delivery Task Service owns execution-time Quote consumption and Delivery Intent lifecycle.
- OMS/CCP is the Consumer-facing forwarding boundary; Consumer owns presentation only.

The Runner instruction contract and rollout remain open. A pre-order KDS recommendation API is no longer a current MVP dependency. See [[drone-package-recommendation-ownership-and-kds-boundary]].

### Relationship to Zipline APIs

[[Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Zipline API Doc/Create Quote|Create Quote]] accepts optional total mass but no dimension fields. Delivery Catalog package/profile evaluation is therefore separate from Quote; the Quote timing result becomes source data for KOETA and is returned to Consumer through OMS/CCP.

[[Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Zipline API Doc/Pack items into deliveries|Pack]] accepts items with `width_mm`, `height_mm`, `length_mm`, and `mass_g`, plus `partner_site_id`. It returns packed deliveries and `metadata.total_deliveries`.

Important consequences:

- Bag recommendation output needs an approved Pack representation if Pack is used.
- It is open whether one recommended Wonder bag is one Pack item or whether its contents must be represented individually.
- Pack is not documented as an input to Quote or Delivery Intent.
- Pack returning one delivery is a strong pre-Intent signal, not yet a contractual guarantee that Intent also produces exactly one Delivery.

### Multi-Bag Semantics

A recommendation must return bag count, not only largest bag type. Two individually valid bags can still violate the single-Delivery MVP.

Product and engineering must choose one explicit rule:

- exactly one supported bag is required;
- multiple bags can enter one approved outer package;
- multiple bags are passed to Pack and accepted only when `total_deliveries = 1`;
- any multi-bag recommendation is rejected for MVP.

Static maximum dimensions alone do not prove that Zipline will avoid splitting a Delivery.

### Weight Is Separate

Container dimensions do not establish gross package mass. Cookbook's calculated `NetWeight` excludes non-food packaging, so Checkout eligibility also needs packaging, utensils, beverages, bags, and other included materials.

The Midtown East Robotic Arm is now out of MVP scope after remaining inconsistent even with a five-second stabilization pause. Rob has started manual standalone-scale capture of prepared packed items and plans to collect dimensions in the same top-seller program. See [[drone-mvp-weight-gate-status-and-discrete-pivot-2026-08-18|Drone MVP Weight Gate Status and Discrete Pivot (2026-08-18)]].

The raw photos and extracted order observations are evidence, not yet canonical profiles. Checkout needs reviewed conservative profiles tied to Cart-native configuration identity and reproducible from OMS Order fields, plus Medium-bag tare. Customization handling, site and vending coverage, aggregation method, confidence, and freshness cadence remain open. Weight confidence should be modeled independently from dimension confidence even when both fields are sent together to Pack.

### Failure Semantics

| Condition | Working treatment |
| --- | --- |
| Complete high-confidence profile and Pack-backed fit within limits | Continue to Quote through Delivery Catalog |
| Known dimensions exceed limit | Reject locally and do not call Quote |
| Multiple bags conflict with MVP policy | Reject or evaluate through the approved Pack policy |
| Missing/defaulted Packaged Size | Return unknown or use an explicitly conservative fallback |
| Recommendation dependency unavailable | Use an approved fallback; never silently assume eligible |
| Bag mapping version missing | Return configuration failure and suppress Drone |

### Open Decisions

1. Who approves the Delivery-owned MVP profiles and preserves the raw photos separately as evidence?
2. What exact measurement convention applies to customization: exact configuration, maximal build, or another conservative profile?
3. How is the designated Medium bag represented in Pack, and has Zipline approved the final SKU/folded profile?
4. Is `total_deliveries == 1` advisory or binding for the subsequent Delivery Intent?
5. What checkout SLO, rate-limit, retry, algorithm-version, and fail-closed contract applies to Pack?
6. Does any missing-data fallback remain within the Pack path, or is Wonder intentionally creating a second fit authority?
7. Which Consumer Cart fields form the profile key, can OMS reproduce them, and how do Cart/profile changes invalidate cached results?
8. How is final Medium-bag tare included in Pack and Quote mass?

### Consumer PRD v8 Confirmation (2026-07-17)

Nina's comment thread confirms that Consumer calls the Drone Eligibility Service for cart-volume eligibility and that Fulfillment/Delivery intends weight and dimension checks to be composed inside that service using the KDS bag-size direction. A linked Zipline Pack endpoint is evidence of an available provider capability, not confirmation that Pack is mandatory for MVP. See [[1p-drone-delivery-consumer-mvp-product-requirements-review-2026-07-17|1P Drone Delivery Consumer MVP Product Requirements Review (2026-07-17)]].

### Cookbook Model Refinements (2026-07-24)

The changed Cookbook feasibility source adds four constraints to the package-profile contract:

- `PACKAGED`, `NON_FOOD`, and `PackageSKUConfig` are distinct models; the mapping must not treat them as interchangeable package facts.
- BOM guest/internal-packaging classifications and quantities are useful inputs but do not prove how physical units are combined for delivery.
- Customizations, especially On the Side, can create extra customer-facing containers that the current package-SKU response may not expose.
- Eligibility output should preserve the effective item, BOM, sub-item, package-profile, and rule versions used for the decision.

Historical interpretation: these refinements supported the earlier Cookbook-based design. They remain useful for a future master-data migration but are not part of the current MVP runtime identity or Checkout lookup. Source: [[cookbook-physical-packaging-data-model-and-drone-eligibility-feasibility-2026-07-23|Cookbook Physical Packaging Data Model and Drone Eligibility Feasibility (2026-07-23)]].

### Rob Weight and Dimension PRD Direction vs Readiness (2026-07-29)

The updated supplemental PRD turns weight and dimension eligibility into an explicit MVP workstream. Source: [PRD: Weight and Dimension Eligibility for 1P Drone Delivery](https://wonder.atlassian.net/wiki/spaces/~712020f40ba91c0864455e9792d8f51b9f008d/pages/5462392836/PRD+Weight+and+Dimension+Eligibility+for+1P+Drone+Delivery).

#### Product direction

- MVP payload threshold is 5.5 lb. The loader reference in this July revision was 12.5 in L x 9.5 in W x 7.75 in H; PRD v16 (2026-08-11) replaced it with 13.31 x 9.92 x 8.07 in. See the PRD v16 section below.
- Midtown East Expo robot-arm measurements are the preferred item-weight source; Cookbook component sums provide conservative fallback values with source and confidence.
- Product proposes reusing the KDS bag-recommendation output before Checkout and evaluating the predicted bag configuration in a Fulfillment/Delivery-owned eligibility capability.
- The service should return stable ineligibility reasons and log overweight, oversize, missing data, fallback-derived data, and multi-package outcomes.
- Success-metric targets in the current PRD (v16, 2026-08-11) are placeholders: coverage `X%+`, false-positive rate `< X%`, p95 latency `< X ms`. The 95 percent / 2 percent / 300 ms figures previously recorded here do not appear in the current PRD and must not be quoted as product commitments.

#### Current bag implication

The 2026-07-29 catalog comparison treated published uncompressed bag dimensions against the earlier `12.5 × 9.5 × 7.75 in` loader reference and concluded that Small was the closest candidate, while Medium and Large were likely ineligible. Insulated bags remain outside the current bag-recommendation MVP.

That catalog conclusion is **superseded for outer-package selection**. On 2026-08-12, IKC Ops and Stephen Acciaioli preferred the existing Medium bag because it fits the 3D printed Pod sample. See [[drone-mvp-medium-bag-outer-package-decision]]. Published Medium dimensions still exceed the provider envelope if treated as a rigid box; eligibility must use a filled/folded profile, not the catalog size.

#### Readiness conflict that must remain explicit

[[kds-bag-recommendation-feature-and-algorithm-2026-07-22|KDS Bag Recommendation Feature and Algorithm (2026-07-22)]] is currently a post-order Runner recommendation produced around parking-spot reservation. Its Expo-unit scores and bag capacities are abstract packing units, not inches or physical fit proof, and the reviewed application path was not yet merged to main. [[cookbook-physical-packaging-data-model-and-drone-eligibility-feasibility-2026-07-23|Cookbook Physical Packaging Data Model and Drone Eligibility Feasibility (2026-07-23)]] shows a feasible physical-data foundation, but production coverage is unknown, Cookbook net weight excludes packaging tare, and the current Product Catalog sync does not populate its declared dimension field.

Therefore the product Scope is confirmed but the dependency contract is not implementation-ready. Checkout eligibility still needs an explicitly owned pre-order package-profile API, versioned physical bag facts, gross-payload calculation, confidence policy, and conservative Unknown/ineligible behavior. The final Zipping Station scale remains a safeguard, not the primary eligibility decision.

### Partner-Confirmed Package Envelope (2026-07-30)

[[zipline-mvp-partner-confirmed-contract-2026-07-30]] first established the launch package envelope on 2026-07-30 as:

```text
gross_mass_g <= 2495
length_mm <= 338
width_mm <= 252
height_mm <= 205
approved_outer_package = true
```

The current hardware envelope, from the week-of-2026-09-07 Payload Dimensions slide, keeps mass, length, and height and revises width to `254 mm`. See the current section below.

One approved outer package within every limit is a single-Zip package for the initial delivery. This supersedes the earlier statement that static maximum dimensions cannot establish single-delivery eligibility and removes Zipline Pack as a mandatory MVP proof step.

The package-data readiness gaps on this page remain valid: Wonder still needs reliable gross mass including packaging, physical dimensions, versioning, customization coverage, and conservative handling of missing data. The preferred outer package is now the existing Medium bag; multiple internal bags are acceptable only when that final Medium package remains within the confirmed envelope. See [[drone-mvp-medium-bag-outer-package-decision]].

### Dual-Unit Limit And Earlier Loader Reference Clarification (2026-07-30)

The 2026-07-30 partner-QA maximum from [[zipline-mvp-partner-confirmed-contract-2026-07-30]] was:

> `338 × 252 × 205 mm / 2495 g`
> `13.31 × 9.92 × 8.07 in / 5.50 lb`

That July width is superseded. The current hardware envelope is `338 × 254 × 205 mm / 2495 g`, labeled `13.25 × 10 × 8 in / 5.50 lb` on the week-of-2026-09-07 slide.

The earlier PRD loader reference is:

> `12.5 × 9.5 × 7.75 in`
> `317.5 × 241.3 × 196.85 mm`

These values are compatible but not identical. The earlier reference is smaller by `20.5 mm` in length, `10.7 mm` in width, and `8.15 mm` in height. It must not be used as the authoritative provider maximum.

The physical meaning of the difference is not confirmed. Preserve the earlier number as historical loader context, but do not label it as current maximum outer-package capacity or silently assume that it is usable interior space.

Eligibility implementation should compare exact integer values in grams and millimeters. Rounded inch and pound values are for human-readable PRD, planning, and operational communication.

### Midtown East Robot-Arm Weight Capture Ownership and Readiness (2026-08-10)

Rob clarified in an inline reply on the [Weight and Dimension Eligibility PRD](https://wonder.atlassian.net/wiki/spaces/~712020f40ba91c0864455e9792d8f51b9f008d/pages/5462392836/PRD+Weight+and+Dimension+Eligibility+for+1P+Drone+Delivery) that [[jordan-adelson|Jordan Adelson]], Director of Automation Engineering & Design, is the best current point of contact for Midtown East Robot Arm item-weight capture and storage. Rob expects the data to be captured in the BigQuery table referenced by the PRD, but he could not yet find the data there. He planned to review the initial process observations with Jordan during the week of 2026-08-10 and provide a follow-up.

#### Current interpretation

- Raw measurement capture and storage should not yet be attributed to [[kds|KDS]]. The current ownership signal points to Automation Engineering & Design / Operations, pending Jordan confirmation.
- The dedicated weight dataset remains unverified. The PRD direction is not evidence that Midtown East already has a working, durable item-weight capture pipeline.
- A BigQuery capture table, even when confirmed, does not by itself establish the low-latency operational reference needed by the [[1p-drone-delivery-eligibility-evaluation-trigger-and-revalidation-contract-2026-07-16|Drone Eligibility Service]]. The runtime contract still needs an item-identifier mapping, schema, quality and freshness policy, coverage measurement, and an approved serving path or materialized store.
- KDS may still participate in item mapping, bag recommendation, or downstream integration, but no current evidence assigns KDS ownership of the raw weight-capture process.

#### Follow-up contract to confirm

1. Exact BigQuery table identifier and whether records are currently landing.
2. Available fields, units, item identifiers, capture timestamps, and measurement context.
3. Coverage, sample aggregation, outlier handling, and freshness cadence.
4. Durable DRI for capture, data quality, and missing-item remediation.
5. Runtime path from the analytical/raw table to Checkout eligibility.

Source: Rob Knudson Confluence inline reply reviewed 2026-08-10; screenshot supplied by Jay in the agent session.

### KDS And Packaging Ownership Clarification (2026-08-11)

The supplemental PRD's statement that Drone eligibility should reuse KDS recommendation upstream is a proposed direction, not a confirmed dependency contract. [[kds-bag-recommendation-feature-and-algorithm-2026-07-22|KDS Bag Recommendation Feature and Algorithm (2026-07-22)]] currently uses categorical Packaged Size values and abstract Expo-unit capacity; it does not calculate physical loaded-package dimensions. Its observed initial-generation trigger is post-order Expo parking-spot reservation, and no supported pre-order Cart API or Checkout SLO is confirmed.

The July 22 and August 4 Delivery Bi-Weekly notes left the launch bag open between a standardized Wonder bag and one Drone-specific package. The 2026-08-12 IKC Ops direction preferred the existing Medium bag, but Rob's 2026-09-20 update says Stephen has requested two new candidate sizes for Zipline testing. Packaging must own or approve the final bag's fill line, folded height, orientation, closure/handle treatment, SKU identity, and empirical fit evidence.

Checkout Eligibility and post-order KDS must not produce independent bag recommendations. Wonder needs one versioned Package Recommendation authority consumed by both stages, while Drone Eligibility composes that candidate package with the approved physical profile, gross mass, and Zipline rules. If KDS cannot support a pre-order API or versioned contract, Product and Engineering must explicitly choose another owner and narrow MVP scope rather than duplicating the logic.

See [[drone-package-recommendation-ownership-and-kds-boundary|Drone Package Recommendation Ownership and KDS Boundary]].

### Outer Package Status (updated 2026-09-20)

The existing Wonder Medium bag was the preferred working direction after the 2026-08-12 IKC Ops review because it fit the 3D printed Pod sample. That direction is now historical rather than final. Stephen has requested two new bag sizes from the vendor. Both are expected to be slightly smaller than the Dropbox for a more comfortable fit and will be sent to Zipline for validation.

This does not change the provider envelope itself; that envelope is now `338 × 254 × 205 mm / 2495 g`. The final bag SKU, filled/folded profile, empty tare, and partner-site configuration are not yet confirmed. Checkout must use the validated physical profile rather than any nominal catalog dimensions.

See [[drone-mvp-medium-bag-outer-package-decision]].

### PRD v16 Loader Threshold Aligned With Provider Envelope (2026-08-11, captured 2026-08-20)

Rob's v16 edit of the [Weight and Dimension Eligibility PRD](https://wonder.atlassian.net/wiki/spaces/~712020f40ba91c0864455e9792d8f51b9f008d/pages/5462392836/PRD+Weight+and+Dimension+Eligibility+for+1P+Drone+Delivery) (2026-08-11) updates the PRD's own dimension threshold:

- The "Known Zipline packaging / loader constraints" section now states the current ideal packaging dimensions as `13.31 × 9.92 × 8.07 in`, with the earlier `12.5 × 9.5 × 7.75 in` struck through. The data-model eligibility rules use the same new value.
- `13.31 × 9.92 × 8.07 in` equals `338 × 252 × 205 mm`, so the PRD v16 threshold matched the 2026-07-30 partner QA. The week-of-2026-09-07 hardware slide later revised width to `254 mm / 10 in`. The earlier `12.5 × 9.5 × 7.75 in` number remains a superseded loader reference inside the PRD itself.
- Residual inconsistency to be aware of: the PRD problem statement still cites `12.5" L × 9.5" W × 7.75" H` without strikethrough, and a "Current constraint: 12.5..." bullet remains under the loader-constraints section. Do not re-capture those as current values.

New PRD content not previously recorded on this page:

- **Coverage note**: Midtown East carries approximately 63 percent of Wonder's catalog by SKU but those items account for approximately 98 percent of company-wide order volume by revenue and units. The PRD uses this to argue robot-arm capture covers the vast majority of drone-eligible volume, with fallback logic needed only for the roughly 2 percent long tail. This is a PRD claim, not independently verified; the arm-capture pipeline itself remains unstable per [[drone-mvp-weight-gate-status-and-discrete-pivot-2026-08-18|Drone MVP Weight Gate Status and Discrete Pivot (2026-08-18)]].
- **Success metrics are placeholders** (`X%+`, `< X%`, `< X ms`), so no coverage, false-positive, or latency target is currently committed in the PRD.
- **New open question**: "Will Wonder use Zipline packing for any orders?" This connects to the Pack-as-eligibility-oracle direction Rob raised on 2026-08-20; see [[zipline-drone-quote-and-package-eligibility-contract-2026-07-02|Zipline Drone Quote and Package Eligibility Contract (2026-07-02)]].

The v16 bag table still predates the 2026-08-12 Medium-bag direction: it calls Small the closest MVP candidate and flags Medium as likely ineligible, including for having a handle. That assessment is superseded for outer-package selection by [[drone-mvp-medium-bag-outer-package-decision]].

### Current Payload Envelope (Week of 2026-09-07)

The current provider envelope is the Zipline Payload Dimensions slide dated week of 2026-09-07:

```text
gross_mass_g <= 2495
length_mm <= 338
width_mm <= 254
height_mm <= 205
```

Slide labels: `13.25 × 10 × 8 in`. Mass is unchanged from the 2026-07-30 partner QA because the slide does not show weight. Source: [[Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Zipline Payload Dimensions Slide - Week of 2026-09-07]] and [[zipline-mvp-partner-confirmed-contract-2026-07-30]].

## Sources
- s1 · https://wonder.atlassian.net/wiki/spaces/CP/pages/5383618636/Drone+Delivery+Consumer · fetched:2026-07-16 · source · no-snapshot · Drone Delivery Consumer PRD
- s2 · https://wonder.atlassian.net/wiki/spaces/~712020f40ba91c0864455e9792d8f51b9f008d/pages/5462392836/PRD+Weight+and+Dimension+Eligibility+for+1P+Drone+Delivery · fetched:2026-08-20 · source · no-snapshot · Weight and Dimension Eligibility PRD, read as the July revision on 2026-07-29 and as v16 (2026-08-11) on 2026-08-20
- s3 · https://wonder.atlassian.net/wiki/spaces/~712020a23d399f56f34b208584dc6e78d90758/pages/5152079922/Bag+Size+Recommendations+at+Runner+Scanning+-+Product+Requirements+Document+PRD · fetched:2026-07-16 · source · no-snapshot · Bag Size Recommendations at Runner Scanning PRD
- s4 · [[Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Xiamen Drone Delivery Alignment Meeting Notes - 2026-07-16]] · @pin · source
- s5 · [[Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Zipline API Doc/Create Quote]] · @pin · source
- s6 · [[Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Zipline API Doc/Pack items into deliveries]] · @pin · source
- s7 · human:rob-knudson · stated:2026-07-16 · attestation · Confluence replies on the Weight and Dimension PRD, reviewed 2026-07-16; the page does not isolate what these replies added
- s8 · human:jay · stated:2026-07-16 · attestation · Conversation alignment between Jay and Codex, 2026-07-16; the page does not isolate what was agreed
- s9 · human:jay · stated:2026-07-17 · attestation · Conversation alignment with Jay, 2026-07-17; the page does not isolate what was agreed beyond the Consumer PRD v8 Confirmation section dated the same day
- s10 · [[cookbook-physical-packaging-data-model-and-drone-eligibility-feasibility-2026-07-23]] · @pin · record
- s11 · [[Wonder/Wonder Fulfillment/Sprints/2026/SP16/Agenda/Meeting Notes]] · @pin · source
- s12 · [[Wonder/Wonder Fulfillment/Sprints/2026/SP17/Agenda/Meeting Notes]] · @pin · source
- s13 · human:jay · stated:2026-08-11 · attestation · Conversation alignment between Jay and Codex, 2026-08-11; the page does not isolate what was agreed beyond the KDS And Packaging Ownership Clarification section dated the same day
- s14 · [[Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Slack Clarification - Drone MVP Medium Bag Selection - 2026-08-12]] · @pin · source
- s15 · [[drone-mvp-medium-bag-outer-package-decision]] · @pin · record
- s16 · [[Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Archive/Eligibility and Architecture/1P Drone Delivery MVP Dimensions Eligibility Proposal (2026-08-12)]] · @pin · source
- s17 · https://wonder.atlassian.net/wiki/spaces/~712020f40ba91c0864455e9792d8f51b9f008d/pages/5462392836/PRD+Weight+and+Dimension+Eligibility+for+1P+Drone+Delivery?focusedCommentId=5580029984 · fetched:2026-09-20 · source · no-snapshot · Rob's 2026-09-20 PRD comment: Stephen requested two new bag sizes for Zipline testing
- s18 · [[zipline-pack-as-eligibility-oracle-direction-2026-08-20]] · @pin · record
- s19 · [[drone-mvp-weight-gate-status-and-discrete-pivot-2026-08-18]] · @pin · record
- s20 · [[1p-drone-delivery-weight-and-dimension-eligibility-current-proposal-2026-08-31]] · @pin · record
- s21 · [[drone-checkout-cart-profile-identity-and-container-schema-2026-08-31]] · @pin · record
- s22 · [[drone-delivery-catalog-order-item-profile-schema-proposal-2026-08-31]] · @pin · record
- s23 · [[Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Zipline Payload Dimensions Slide - Week of 2026-09-07]] · @pin · source
- s24 · https://wonder.atlassian.net/wiki/spaces/~5f811730e31b69006feed38a/pages/5706907865/Drone+Eligibility+Check+-+MVP+Plan?focusedCommentId=5707792556 · fetched:2026-07-16 · source · no-snapshot · Drone Eligibility Check - MVP Plan comment; no fetch date on the 1.x page

## History
- 2026-09-29 · verified by process:cook
- 2026-09-29 · contradiction recorded in 1.x against [[drone-mvp-medium-bag-outer-package-decision]] · kept in Detail
- 2026-09-20 · revised by process:cook · Outer Package Status
- 2026-09-07 · revised by process:cook · Current Payload Envelope (Week of 2026-09-07)
- 2026-09-01 · revised by process:cook · Current Checkout profile direction
- 2026-08-20 · revised by process:cook · PRD v16 Loader Threshold Aligned With Provider Envelope
- 2026-08-11 · revised by process:cook · KDS And Packaging Ownership Clarification
- 2026-08-10 · revised by process:cook · Midtown East Robot-Arm Weight Capture Ownership and Readiness
- 2026-07-30 · revised by process:cook · Dual-Unit Limit And Earlier Loader Reference Clarification
- 2026-07-30 · revised by process:cook · Partner-Confirmed Package Envelope
- 2026-07-29 · revised by process:cook · Rob Weight and Dimension PRD Direction vs Readiness
- 2026-07-24 · revised by process:cook · Cookbook Model Refinements
- 2026-07-17 · revised by process:cook · Consumer PRD v8 Confirmation

## Related
- [[kds-pre-order-bag-recommendation-feasibility-2026-07-16|KDS Pre-Order Bag Recommendation Feasibility (2026-07-16)]]
- [[cookbook-physical-packaging-data-model-and-drone-eligibility-feasibility-2026-07-23|Cookbook Physical Packaging Data Model and Drone Eligibility Feasibility (2026-07-23)]]
- [[kds|KDS]]
- [[zipline|Zipline]]
- [[1p-drone-delivery-eligibility-evaluation-trigger-and-revalidation-contract-2026-07-16|1P Drone Delivery Eligibility Evaluation Trigger and Revalidation Contract (2026-07-16)]]
- [[1p-drone-delivery-system-responsibility-boundaries-2026-07-15|1P Drone Delivery System Responsibility Boundaries (2026-07-15)]]
- [[zipline-drone-quote-and-package-eligibility-contract-2026-07-02|Zipline Drone Quote and Package Eligibility Contract (2026-07-02)]]
- [[drone-mvp-medium-bag-outer-package-decision]]
