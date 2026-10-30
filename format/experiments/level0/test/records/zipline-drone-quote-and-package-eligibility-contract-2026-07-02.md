---
type: record
title: Zipline Drone Quote and Package Eligibility Contract (2026-07-02)
description: How Wonder's 1P Drone Delivery MVP should treat Zipline Quote mass, package limits, single-Zip behavior and Pack, as framed on 2026-07-02 and refreshed through 2026-09-29; final launch-site payload capacity and the Pack-to-Intent binding remain open and are not resolved here.
date: 2026-07-02
kind: finding
tags:
  - api
  - delivery-service
  - drone-delivery
  - mvp
status: current
updated: 2026-09-29
updated_by: process:cook
verified: 2026-09-29
verified_by: process:cook
aliases:
  - Zipline Package Eligibility Contract
  - Zipline Quote and Pack Contract
  - Zipline 有效载荷尺寸
---

# Zipline Drone Quote and Package Eligibility Contract (2026-07-02)

## Summary

For 1P Drone Delivery MVP, Consumer reaches the current Quote path through OMS/CCP. Delivery Catalog Service owns eligibility orchestration and Quote source data; KOETA owns the customer-facing ETA. The historical RDP discovery Quote may omit `mass_grams` or send `null`, but it is never used for Intent. A later fulfillment-capable Quote uses the stable Cart or Order package mass and may be consumed by Delivery Intent. Package weight and fit remain separate from the discovery result.

> [!warning] Sandbox runtime evidence — 2026-08-11
> Zipline staging created Quotes whose mass was `null` or `0`, but Create Delivery Intent rejected those Quote IDs. A successful Quote response is therefore not proof of fulfillment readiness. The focused runtime contract and remaining evidence gaps are maintained in [[zipline-sandbox-quote-mass-gating-contract|Zipline Sandbox Quote Mass Gating Contract]].

This distinction matters because [[Wonder]] likely cannot know final prepared package weight at checkout. Items may be prepared across Super PODs and assembled later, so final package mass may depend on item weights, item-to-order association, all-items-complete timing, packaging assumptions, and any final bag/container decisions. See [[1P Drone Delivery System Orchestration Alignment Draft (2026-06-29)]].

## Detail

> [!important] “Not required” versus “chosen by Wonder”
> The 2026-07-30 partner contract established that Pack is not mandatory merely to prove one-Zip capacity when one approved outer package is already known to be within the confirmed limits. That remains true. The current Wonder direction is for OMS/CCP to forward the request to Delivery Catalog Service, which resolves approved profiles and uses Pack as the preferred affirmative fit oracle when the Pack representation is available. These statements are compatible: Zipline does not require Pack, while Wonder may choose Pack as its eligibility path. Medium-bag representation, Pack-to-Intent binding, and checkout reliability remain open. See [[zipline-pack-as-eligibility-oracle-direction-2026-08-20]].

### Recommended Working Contract

- Consumer sends cart and address context to OMS/CCP; OMS/CCP forwards the request to Delivery Catalog Service and keeps Zipline identifiers out of Consumer.
- Delivery Catalog Service owns profile resolution, `partner_site_id` resolution, Zipline Pack/Quote orchestration, and normalized eligibility/Quote source data.
- Place Order always performs the current fresh eligibility evaluation; execution obtains a separate fresh mass-bearing Quote rather than reusing the Checkout or Place Order Quote ID.
- For Wonder 1P, Place Order is followed almost immediately by order persistence, Assign to Pod, Delivery Task creation, and Delivery Intent creation; the remaining design work is the SLA, retry, Quote-validity, and failure-recovery contract.
- `loading_pin` is an asynchronous fulfillment result consumed by KOS/KOM, not something Consumer or OMS derives.

### No-Mass Quote Semantics

The provider documentation is internally inconsistent only when discovery and fulfillment are treated as one lifecycle role. Current Wonder validation resolves the implementation boundary: Create Quote accepts omitted or `null` mass for the RDP discovery request, while Create Delivery Intent rejects a Quote that lacks usable mass.

The two meanings are:

| Meaning | Interpretation | MVP implication |
|---|---|---|
| Drone available by serviceability | Zipline can likely serve the recipient under current serviceability, capacity, weather, and operating constraints | Appropriate for RDP discovery and KOETA timing features; non-binding |
| Package eligible by weight/fit | The stable Cart or Order fits payload and volume constraints | Requires a later package evaluation and mass-bearing fulfillment Quote |

The discovery Quote must never be interpreted as a Quote that can create a Delivery Intent. See [[zipline-discovery-vs-fulfillment-quote-mass-contract|Zipline Discovery vs Fulfillment Quote Mass Contract]] and [[zipline-sandbox-quote-mass-gating-contract|Zipline Sandbox Quote Mass Gating Contract]].

### Package Eligibility Layers

MVP should avoid relying only on the Zipping Station as the final eligibility gate. A late station rejection after food is prepared creates fallback, CX, payment/tip, and food-quality risk.

A layered model is safer:

1. Consumer sends the cart and address through OMS/CCP to Delivery Catalog Service.
2. Delivery Catalog resolves approved Delivery-owned profiles and calls Zipline Pack when the current representation is available.
3. A Pack result with `metadata.total_deliveries == 1` is the preferred affirmative fit signal; an approved outer-package profile within the confirmed envelope remains a partner-supported alternative.
4. Delivery Catalog obtains a fulfillment-capable Quote and supplies timing source data to KOETA; Delivery Task Service uses a fresh execution Quote for Intent creation.
5. Zipping Station validation remains a final operational guardrail, not the only eligibility check.

[[zipline-integration-readiness-guide-2026-06-17]] already captures the earlier package/bag-level question: can Zipline validate the final Wonder bag/package as the packable unit, or must Wonder provide item-level dimensions and weights?

### Delivery Intent Trigger

The current Wonder 1P sequence is Place Order → order persistence → near-immediate Assign to Pod → Delivery Task creation → Delivery Intent creation. This is compatible with Zipline journey guidance to create Intent when the customer submits the order because the internal Wonder steps occur in the same near-real-time business phase.

The remaining risk is the partial-failure boundary: the order may already exist when Delivery Task or Intent creation fails. Wonder still needs an explicit SLA, exactly-once retry using `order_id`, Quote-validity check, loading-pin propagation, and safe order-recovery behavior.

### Single-Delivery MVP Guardrail (2026-07-15)

Multi-drone delivery is outside the initial MVP. Static Wonder weight and dimension rules are useful coarse filters, but the current documentation does not make them a single-delivery guarantee.

Pratik's May 2026 site visit recorded a current P2 payload of 5.5 lb, with 8 lb and 10 lb described as roadmap targets. That is historical hardware context rather than the confirmed Wonder launch-site contract, and the note does not provide a numeric current Droid volume limit. Gross prepared package weight, packaging dimensions, site-specific configuration, and the representation sent to Pack all matter.

The strongest currently documented pre-Intent signal is [[Pack items into deliveries]] returning `metadata.total_deliveries = 1` for the exact package/item snapshot and `partner_site_id`. It is still not a guarantee because:

- Pack does not return a documented identifier that Quote or Delivery Intent accepts;
- Quote accepts optional total mass but not dimensions;
- Delivery Intent accepts `quote_id` and `order_id`, not the Pack result;
- the API does not expose `max_deliveries = 1` or another reject-instead-of-split constraint.

Until Zipline confirms a stronger contract, use layered validation:

1. Apply a conservative Wonder-side weight/dimension rule using the confirmed launch-site configuration and packaging tolerance.
2. Continue only when Pack returns one delivery for the exact, versioned package snapshot.
3. After Intent creation, verify the authoritative initial delivery count before exposing `loading_pin` or proceeding with loading.
4. Treat any initial multi-delivery result as a provider-contract exception requiring safe cancellation and fallback handling.

The preferred external contract is explicit single-delivery-only behavior: reject an order that cannot fit into exactly one Delivery rather than splitting it automatically.

### Open Questions

- Does Create Delivery Intent reserve fleet capacity, assign a Zip, or only create a loadable order workflow?
- What SLA and recovery contract applies when the Wonder order succeeds but near-real-time Delivery Task or Intent creation fails?
- What is the launch payload capacity and volume limit for Wonder orders?
- Can Zipline enforce exactly one Delivery per Wonder order and reject instead of split?
- Does Pack returning one Delivery guarantee the initial Delivery Intent also contains one Delivery?
- What field and timing are authoritative for the initial Delivery count?
- Can Zipline fit validation work at bag/package level, or does it require item-level dimensions?
- What event timing guarantees are needed so `loading_pin` reaches KOS before receipt/label printing?

### Cook Refresh (2026-07-08)

Reviewed changed sources:
- [[Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Questions for Zipline Team - 1P Drone Delivery (2026-07-01)]] — Refines the Zipline question list into partner-facing API/operations contract clarifications: no-mass quote semantics, pack/weight eligibility, station validation, status/custody mapping, drop-off location, and fallback reasons.

Cook result: The partner-facing question list keeps quote/package eligibility focused on Zipline contract semantics, especially no-mass quotes, pack/weight handling, and validation failure behavior.

### Cook Refresh (2026-07-13)

Reviewed changed sources:
- [[zipline-integration-readiness-guide-2026-06-17]] and [[zipline-direct-1p-delivery-software-contract-scope-2026-06-15|Zipline Direct 1P Delivery Software Contract Scope (2026-06-15)]] — Add the official Texas rollout commitment and the announcement's no-special-packaging language.

Cook result: No special packaging should not be interpreted as no package eligibility. Quote, weight, volume, fit, menu restrictions, late station validation, and provider availability remain required contract points.

### Cook Refresh (2026-07-16)

The UI-stage assumptions are now captured as explicit state and freshness rules in [[1p-drone-delivery-eligibility-evaluation-trigger-and-revalidation-contract-2026-07-16|1P Drone Delivery Eligibility Evaluation Trigger and Revalidation Contract (2026-07-16)]]. The pre-order bag and dimensions feasibility, KDS code evidence, and reusable contract gaps are captured in [[1p-drone-delivery-checkout-package-dimensions-contract-2026-07-16|1P Drone Delivery Checkout Package Dimensions Contract (2026-07-16)]].

### Partner-Confirmed Mass And Single-Zip Contract (2026-07-30)

[[zipline-mvp-partner-confirmed-contract-2026-07-30]] supersedes the earlier assumption that a no-mass Quote can be used for direct-order fulfillment. It does not prohibit the separate RDP discovery Quote.

- `mass_grams` is required for the Wonder Quote used to create a Delivery Intent.
- Zipline advises omitting products without reliable weight and dimension data.
- The approved single-Zip limits from the 2026-07-30 partner QA were `2495 g`, `338 mm L`, `252 mm W`, and `205 mm H`. The current hardware envelope, from the week-of-2026-09-07 Payload Dimensions slide, is `2495 g`, `338 mm L`, `254 mm W`, and `205 mm H`.
- One approved outer package within all limits is guaranteed to use exactly one initial Zip; failure replacement is outside that guarantee.
- Zipline Pack is not required merely to prove one-Zip capacity for this MVP. An Intent-side `expected_number_of_deliveries == 1` check remains useful as a defensive invariant, not an unresolved eligibility contract.

The remaining implementation work is Wonder package-data completeness, gross-mass calculation, rule versioning, Quote freshness, and safe recovery when provider execution violates the confirmed contract.

### Canonical Dual-Unit Eligibility Threshold (2026-07-30)

For Eligibility Service and Quote orchestration, use the exact provider contract values:

```text
gross_mass_g <= 2495
length_mm <= 338
width_mm <= 254
height_mm <= 205
```

The current human-readable pair from the week-of-2026-09-07 slide is `5.50 lb / 13.25 × 10 × 8 in`. The 2026-07-30 partner QA used `5.50 lb / 13.31 × 9.92 × 8.07 in` with width `252 mm`; that width is superseded. Do not substitute the earlier `12.5 × 9.5 × 7.75 in` PRD loader reference. See [[1p-drone-delivery-checkout-package-dimensions-contract-2026-07-16|1P Drone Delivery Checkout Package Dimensions Contract (2026-07-16)]] and [[zipline-mvp-partner-confirmed-contract-2026-07-30]].

### Cook Refresh (2026-09-15)

Reviewed changed sources:
- [[Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Zipline Payload Dimensions Slide - Week of 2026-09-07]] — Zipline hardware slide labeled week of 9/7: `338 × 254 × 205 mm` / `13.25 × 10 × 8 in`. Mass is not shown.

Cook result: Current Eligibility / Quote comparison uses width `254 mm`. The 2026-07-30 partner QA width `252 mm` is retained as historical. Mass stays `2495 g`.

## Sources
- s1 · [[Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Archive/Eligibility and Architecture/1P Drone Delivery System Orchestration Alignment Draft (2026-06-29)]] · @pin · source
- s2 · [[Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Questions for Zipline Team - 1P Drone Delivery (2026-07-01)]] · @pin · source
- s3 · [[zipline-integration-readiness-guide-2026-06-17]] · @pin · record
- s4 · [[zipline-direct-1p-delivery-software-contract-scope-2026-06-15]] · @pin · record
- s5 · [[Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Questions for Zipline - Single-Delivery Guarantee and Multi-Delivery Handling (2026-07-15)]] · @pin · source
- s6 · [[Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Zipline Platform Reference/Status Codes]] · @pin · source
- s7 · [[Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Zipline API Doc/Introduction to Delivery APIs]] · @pin · source
- s8 · [[Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Zipline Sandbox Quote Mass Validation Evidence - 2026-08-11]] · @pin · source
- s9 · human:jay · stated:2026-07-17 · attestation · Conversation alignment on the Quote/eligibility contract (the page does not record the specific content of this conversation)
- s10 · [[zipline-pack-as-eligibility-oracle-direction-2026-08-20]] · @pin · record
- s11 · [[zipline-discovery-vs-fulfillment-quote-mass-contract]] · @pin · record
- s12 · human:jay · stated:2026-08-27 · attestation · Conversation alignment: Create Quote accepts omitted or null mass for the RDP discovery request, while Create Delivery Intent rejects a Quote that lacks usable mass
- s13 · [[Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Zipline Payload Dimensions Slide - Week of 2026-09-07]] · @pin · source

## History
- 2026-09-29 · verified by process:cook
- 2026-09-15 · revised by process:cook · Cook Refresh (2026-09-15)
- 2026-07-30 · revised by process:cook · Canonical Dual-Unit Eligibility Threshold
- 2026-07-30 · revised by process:cook · Partner-Confirmed Mass And Single-Zip Contract
- 2026-07-16 · revised by process:cook · Cook Refresh (2026-07-16)
- 2026-07-15 · revised by process:cook · Single-Delivery MVP Guardrail
- 2026-07-13 · revised by process:cook · Cook Refresh (2026-07-13)
- 2026-07-08 · revised by process:cook · Cook Refresh (2026-07-08)

## Related
- [[1p-drone-delivery-consumer-ccp-oms-alignment-decisions-2026-08-26|1P Drone Delivery Consumer, CCP, and OMS Alignment Decisions (2026-08-26)]]
- [[zipline-integration-readiness-guide-2026-06-17]]
- [[zipline-direct-1p-delivery-software-contract-scope-2026-06-15|Zipline Direct 1P Delivery Software Contract Scope (2026-06-15)]]
- [[Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Questions for Zipline Team - 1P Drone Delivery (2026-07-01)|Questions for Zipline Team - 1P Drone Delivery]]
- [[drone-delivery-integration-strategy|Drone Delivery Integration Strategy]]
