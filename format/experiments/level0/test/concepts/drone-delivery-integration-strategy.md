---
type: concept
title: Drone Delivery Integration Strategy
description: Current architecture, ownership, provider-contract and launch position for Wonder 1P drone delivery with Zipline, as of 2026-10-26; historical DaaS/Dexa frames are in History; commercial terms are not covered.
tags:
  - architecture
  - delivery-service
  - drone-delivery
  - grubhub
status: disputed
updated: 2026-10-26
updated_by: process:cook
verified: 2026-07-17
verified_by: process:cook
aliases:
  - 1P Drone Delivery Strategy
  - Texas Drone Delivery Integration Strategy
related:
  - "[[delivery-fulfillment]]"
  - "[[delivery-providers]]"
  - "[[dispatch-portal]]"
  - "[[zipline-loading-methods]]"
  - "[[packaged-size]]"
  - "[[ikc-drone-delivery-setting]]"
---

# Drone Delivery Integration Strategy

## Current
Drone delivery is a fulfillment capability for Wonder 1P orders from IKCs/HDRs. The architecture question is not whether to create a new 1P order flow; it is how [[delivery-fulfillment]] connects to drone delivery after the order reaches Delivery Service and provider allocation.

Direction and scope
- The active direction is direct Zipline discovery and a direct 1P Zipline provider integration built on the existing Wonder order-to-delivery backbone, keeping the provider adapter narrow and migration-friendly so it could later sit behind DaaS if Grubhub support becomes the preferred operating model; in the short or medium term, do not assume DaaS can support the Zipline path quickly (src: s1, s2) ^c1
- The SP14 Delivery Bi-Weekly raised drone delivery to a high-priority initiative; Rob is drafting a formal PRD to coordinate the cross-functional work and will explore a dedicated Slack channel with the Zipline technical team (src: s3) ^c37
- The initiative is exclusive to Wonder 1P orders; Grubhub marketplace and Grubhub-mediated delivery are out of scope (src: s3) ^c2
- Planned Zipline Dropbox capacity near target IKCs should be treated as scoped to Wonder 1P orders only. Jay's concern was that Grubhub-app orders also flow into IKCs, so if Grubhub also integrated with Zipline both order sources could compete for the same physical Dropbox and make a Wonder-owned readiness queue hard to maintain; Rob's clarification reduces that risk: Zipline is expected to work only with Wonder for this initiative and is not expected to partner with Grubhub because Zipline also operates as a food-delivery platform and competes with Grubhub. The readiness-queue design therefore need not assume external Grubhub demand on Dropbox slots (src: s4, s5) ^c3
- For near-term Wonder assumptions (payload, Zipping Station flow, charging-station range, receipt-code dependency, station occupancy, pickup-status ambiguity) the Wonder site-visit summary takes precedence over Zipline's public Platform 2 / P2 pages, which still provide useful official terminology (src: s6, s1) ^c4
- The Dexa Green Brook pilot validated customer demand and community acceptance but exposed late eligibility checks, manual dispatch, packaging constraints and site/insurance burden; Zipline is the stronger scale candidate because many Dexa rejections came from radius, payload/order-value and hours limits it may absorb (src: s32) ^c31
- Drone delivery is productized as an eligibility-managed flow (address validation, pre-mapped drop zones, restaurant/item/cart eligibility, real-time capacity, weather/hours/provider availability, clean fallback) and its launch stack is cross-functional: Delivery Fulfillment integration, KOM/receipt/loading PIN, packaging and item data, IKC training, landlord packet, lease amendment, insurance, government relations and first-responder engagement (src: s32) ^c32
- Wonder plans an early-2027 Texas expansion focused on the Dallas, Houston and Austin/San Antonio triangle with day-one drone delivery as a goal, and the draft Q3 planning readout framed 1P drone-delivery discovery as preparation for a Q1 2027 launch path, so drone readiness is part of expansion readiness for 2027–2028 rather than an isolated innovation track (src: s29, s32) ^c33

System ownership (2026-07-15 alignment)
- Consumer owns the Drone customer journey on Web, iOS and Android and calls only Wonder-owned eligibility and ETA contracts (src: s7) ^c5
- Fulfillment/Delivery builds and operates the Drone Eligibility Service as Consumer's single internal decision boundary; the final service name and the detailed API contract remain open (src: s7, s8) ^c6
- Delivery ETA Service owns Consumer-facing drone ETA; Fulfillment/Delivery supplies normalized Zipline timing inputs rather than raw provider fields (src: s7) ^c7
- KOS is strongly supported as the current Delivery Task creation trigger, and Delivery Task Service owns Task and Job lifecycle; the post-order sequence is Place Order → persistence → Assign to Pod → Delivery Task → Delivery Intent, which is compatible with Zipline submit-order guidance (src: s7, s9) ^c8
- Fulfillment/Delivery owns all outbound and inbound Zipline protocol concerns through the provider boundary; OMS/CCP owns order state and its `fulfillment-service` does not own provider Task or Job lifecycle (src: s7) ^c9
- Multi-drone delivery is outside the MVP; provider-contract gaps remain active around no-mass direct-order Quote behavior, package-data confidence, single-delivery enforcement, station rejection/custody, and safe fallback (src: s7, s9, s10) ^c10

Eligibility and package data (2026-08-20 → 2026-10-26)
- The MVP does not resolve a Cookbook packaging signature at Checkout: Consumer Cart fields form the configuration identity and OMS Order fields validate it post-order (src: s11, s12) ^c11
- KDS retains its operational recommendation boundary. Cookbook owns item-level source profiles (weight and packed dimensions) and exposes the API/Kafka sync contract; Delivery Catalog stores the local projection, applies classification fallback per line when no usable profile exists, and owns runtime orchestration (src: s7, s11, s12) ^c12
- Delivery-owned Eligibility calls Zipline Pack and treats `total_deliveries == 1` as the proposed affirmative fit result; this preserves the strategic boundary that Wonder owns orchestration while the provider owns provider-specific packing logic, and Zipline Pack owns the provider-specific fit result. Zipline does not mandate Pack; Wonder is evaluating it as the eligibility oracle so it need not maintain its own fit algorithm, and the July partner confirmation that Pack is not required solely for one-Zip proof is not a contradiction (src: s13, s10, s11) ^c13
- The Robotic Arm is out of MVP scope; manual scale capture is the active measurement path (src: s13) ^c14
- The measurement spreadsheet's `Primary Container` field is reference-only; its green weight/dimension cells are direct measurements usable as initial criteria but not a maintained current-pack source of truth; the data still needs currentness checks, packaging-change handling and governed mapping before it is reused for uncovered items or sent to Pack (src: s14) ^c15
- The current single-Zip provider limit, the current hardware maximum, is 2495 g and 338 × 254 × 205 mm (5.50 lb, 13.25 × 10 × 8 in); one approved package within it guarantees one initial Zip; implementation stays canonical in grams and millimetres (src: s15, s16, s10) ^c16
- The Wonder-side outer package that must fit that envelope is the existing Medium bag, not a newly produced drone-specific bag, selected by IKC Ops after it fit the 3D-printed Pod sample; bag and guest-packaging samples still need testing (src: s17, s18) ^c17

Partner contract (2026-07-28 → 2026-08-03)
- A direct-order Quote requires reliable mass, so package-data completeness is a hard eligibility dependency; Pack is not a mandatory single-Zip proof for the MVP; the remaining strategy work is Wonder-side data readiness, normalized recovery, cross-surface custody guards and customer messaging (src: s10) ^c18
- Eligibility requires Wonder weight/dimension checks plus a serviceable Zipline Quote; Zipline lifecycle events are normalized into Wonder states for Consumer and Dispatch Portal (src: s22) ^c34
- Ground fallback is required for recoverable failures, but pre-custody Reallocation and post-custody refund/remake/new-delivery recovery are different workflows (src: s22, s19) ^c35
- `DELIVERY_INTENT_STATUS_IN_PROGRESS` is the authoritative, irreversible custody boundary; food that fails after custody is discarded near a Zipline charging site and never returns to Wonder (src: s10, s19, s20) ^c19
- Zipline validates that a safe delivery area exists but does not expose the exact planned drop-off coordinate, so exact drop-off presentation is a known product limitation (src: s10) ^c20
- Completing the Dropbox load summons the drone; `loading_window` is advisory, and missing its end does not lose the reservation or require a re-Quote, replacement Intent, retry or reschedule. The architecture consequence is small: keep one provider workflow through delayed kitchen preparation, refresh ETA or operational messaging where needed, reserve fallback for actual provider, station or loading failures, and do not use loading-window expiry as a default FIFO-priority signal (src: s21) ^c21

Product scope and launch (PRD V6, 2026-07-29 → 2026-10-19)
- Launch is a checkout-only Drone option for eligible Rowlett orders with one Zipline Delivery Intent per Wonder order and the default mapped delivery site; customer drop pins, multi-stop and multi-drone splitting are out of scope (src: s22) ^c22
- PRD V6 timeline: API/architecture alignment by 2026-08-17, build by 2026-09-28, E2E validation 2026-11-16 to 2026-12-07, controlled Rowlett launch from 2027-01-08; eligibility, Quote, status sync, completion evidence and recoverable fallback are P0, telemetry and cancellation are listed P1; the P1 classification is not a closed implementation decision, because live tracking is a stated customer use case and custody-aware cancellation is required for safe recovery. Durable interpretation: MVP product boundaries are substantially defined while the PRD page remains Draft and provider contracts remain launch gates (src: s22) ^c23
- Rowlett and Frisco are selected for MVP production Partner Site configuration; both rows of the Wonder × Zipline tracker show 2027-01-11 Soft Opening, 2027-01-20 Grand Opening, projected hub launch in Q1 2027 and Drone availability at Wonder launch marked Y, all planning fields rather than completed production or operational sign-offs (src: s23, s24) #disputed ^c24
- Software Production Ready in SP23, production Partner Site provisioning, and physical/customer launch in 2027 are separate milestones (src: s23) ^c36
- Wonder's public partnership announcement moves the Texas Zipline program from internal planning to an externally visible launch commitment: select Texas locations begin service in January 2027 with Dallas the first named market, most Texas locations offer drone delivery by end of 2027, the operating model integrates Zipline with Wonder ordering and kitchen workflows and uses Dropbox hardware for store handoff, and the stated value extends beyond cost to speed, access, food quality, demand growth and delivery resilience. This strengthens the direct-provider scale case, but the announcement does not mention Grubhub or establish exclusivity, so the Wonder 1P-only scope continues to come from internal program alignment (src: s25) ^c25

## Evidence
Decision frame that led to [[#^c1]]:

| Option | When to choose | Trade-off |
| --- | --- | --- |
| DaaS owns drone | Flexible timeline; leadership wants a clean Grubhub logistics abstraction | Cleaner provider model, dependent on DaaS prioritization |
| Direct drone provider in allocation | Faster 1P pilot wanted, or DaaS roadmap unclear | Faster Wonder-controlled rollout, more vendor-specific complexity owned by Wonder |
| Hybrid migration path | Need MVP speed and long-term clean architecture | Direct adapter behind an internal abstraction, migrate to DaaS later |

Supporting facts: the pilot proposal explicitly listed two order channels, Grubhub Marketplace deliveries and Wonder 1P deliveries, assigned Delivery Product the work to integrate with DEXA as a delivery service provider, and assigned Consumer Product checkout tasks such as drone selection, drop-pin selection and disabling tips; Delivery Fulfillment already models provider work through Tasks and Jobs, which supports adding drone as a provider capability without changing the 1P order flow; AG-683 shows the Aggregator side moved from courier-name regex detection to Grubhub's structured `vehicle_type` field for `ROBOT` and `DRONE`; HDR-9959 and HDR-10067 show HDR/KOM support for drone operational handling, including card/receipt treatment and `Drone Delivery is Ready` alerting; Delivery Bi-Weekly notes record Rob's Green Brook customer-facing drone launch update for 2026-03-18; the 2026-05-26 SP12 meeting added a stronger business anchor, Texas expansion in early 2027 and day-one drone capability at those locations; searches for DaaS plus drone/Dexa did not surface a clear DaaS support plan, a gap rather than proof of absence (src: s26, s27, s28, s29, s1).

Architecture notes for a direct integration: drone is modeled as a delivery capability at the Delivery Service allocation layer, not as a separate 1P order rail; the order remains a Wonder 1P order and the allocation decision chooses either a standard provider path or a drone-capable path. Keep the provider adapter narrow and migration-friendly: add drone as a configurable provider/capability in allocation settings only for eligible HDRs; gate by distance, delivery address/drop zone, payload, weather, operational hours and customer opt-in; store drone-specific provider fields separately from generic Task/Job state where possible; emit normalized statuses back into existing order tracking, Dispatch Portal and analytics; preserve fallback to Grubhub DaaS, Relay, DoorDash or other human courier providers when drone is unavailable.

The eligibility pipeline under evaluation (src: s13, s12):
```text
Ops / Packaging measures top-selling packed items
→ Cookbook stores and serves item-level weight and packed dimensions
→ Delivery Catalog periodically syncs profiles and applies Kafka updates
→ Consumer Cart / OMS Order fields define and verify the reusable configuration identity
→ Delivery Catalog returns the local Cookbook-backed profile or classification fallback and containers[]
→ Delivery-owned Eligibility calls Zipline Pack
→ total_deliveries == 1 supplies the proposed affirmative fit result
```

## Open
- The tracker's 2027-01-20 Grand Opening in [[#^c24]] differs from the 2026-09-20 snapshot's 2027-01-14; the launch owner has not confirmed which is right, and Friends & Family and Soft Opening may not be the same milestone (src: s23, s30) ^q1
- Does Grubhub DaaS have a committed roadmap for drone/Dexa support, and could it expose quote, eligibility, vehicle type, tracking, cancellation, weather and fallback reasons? Bears on [[#^c1]] (src: s26) ^q2
- What does Wonder need to learn to integrate directly with Zipline for 1P drone delivery and a possible marketplace-brand flow? Current discovery should clarify Zipline's direct APIs, delivery lifecycle, checkout eligibility, loading-station workflow, status mapping, operational fallback, and how drone-specific fields normalize into Delivery Fulfillment (src: s1) ^q11
- What policy applies when Drone eligibility or provider availability is lost after the customer selects Drone at Checkout? Bears on [[#^c10]] ^q3
- How should drone-specific statuses appear in Dispatch Portal and PPX? Bears on [[#^c9]] ^q4
- Remaining launch gates: Intent timing, mapped delivery-site semantics, webhook reason/state mapping, station occupancy, loading-code rotation and post-custody recovery; technical readiness still depends on quote and package eligibility, loading and custody semantics, station queue behavior, planned drop-off location and fallback contracts (src: s22, s10, s25) ^q6
- Station-level behavior still needs Zipline confirmation: Dropbox capacity, loading windows, station availability, queue depth, and the event that means an order is ready for handoff to the Dropbox (src: s5) ^q8
- Who owns support, SLA, pricing and incident handling if Wonder integrates directly with a drone provider (asked of Dexa in the DaaS-era frame) (src: s26) ^q9
- Can a DaaS-first path realistically support the early-2027 Texas timeline? Plan items from the SP12 frame: use Q3 2026 discovery to clarify DaaS roadmap certainty; identify the minimum direct-provider fallback needed for launch confidence (src: s29) ^q10
- Which Zipline terminology and limits are current integration truth where P2 fact-sheet language, site-visit assumptions and partner API documentation differ? Bears on [[#^c4]] ^q7

## Sources
- s1 · [[sp13-delivery-bi-weekly-outcomes-2026-06-10]] · @pin · record
- s2 · https://wonder.atlassian.net/browse/DELI-4518 · fetched:2026-06-11 · source · no-snapshot
- s3 · [[Wonder/Wonder Fulfillment/Sprints/2026/SP14/Agenda/Meeting Summary]] · @pin · source
- s4 · human:rob-knudson · stated:2026-06-24 · attestation · Dropbox capacity is scoped to Wonder 1P; Zipline not expected to partner with Grubhub
- s5 · [[zipline-dropbox-grubhub-scope-clarification-2026-06-24]] · @pin · record
- s6 · [[Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Site Visit Summary - Zipline Drone + Droid Delivery System Review - Pratik Busi]] · @pin · source
- s7 · [[1p-drone-delivery-system-responsibility-boundaries-2026-07-15]] · @pin · record
- s8 · human:jay · stated:2026-07-17 · attestation · Fulfillment/Delivery confirmed as builder and operator of the Drone Eligibility Service
- s9 · [[1p-drone-delivery-eligibility-evaluation-trigger-and-revalidation-contract-2026-07-16]] · @pin · record
- s10 · [[zipline-mvp-partner-confirmed-contract-2026-07-30]] · @pin · record
- s11 · [[drone-cookbook-menu-item-profile-sync-decision-2026-10-26]] · @pin · record
- s12 · [[drone-checkout-cart-profile-identity-and-container-schema-2026-08-31]] · @pin · record
- s13 · [[zipline-pack-as-eligibility-oracle-direction-2026-08-20]] · @pin · record
- s14 · human:rob-knudson · stated:2026-09-14 · attestation · Spreadsheet Primary Container field is reference-only; green cells are direct measurements, not a maintained source of truth
- s15 · [[Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Zipline Payload Dimensions Slide - Week of 2026-09-07]] · @pin · source
- s16 · [[zipline-wonder-weekly-deck-readout-2026-09-15]] · @pin · record
- s17 · [[Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Slack Clarification - Drone MVP Medium Bag Selection - 2026-08-12]] · @pin · source
- s18 · [[drone-mvp-medium-bag-outer-package-decision]] · @pin · record
- s19 · [[zipline-dropbox-lock-custody-and-failure-disposition-contract-2026-07-28]] · @pin · record
- s20 · human:rob-knudson · stated:2026-07-28 · attestation · After Dropbox lock the package is delivered or disposed at a Zipline charging site; it never returns to Wonder
- s21 · [[Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Zipline Slack Clarification - Dropbox Loading Window and Drone Summon - 2026-08-03]] · @pin · source
- s22 · https://wonder.atlassian.net/wiki/spaces/~712020f40ba91c0864455e9792d8f51b9f008d/pages/5415567391/PRD+1P+Drone+Delivery · fetched:2026-07-29 · source · no-snapshot · PRD V6
- s23 · [[zipline-2027-launch-ikcs-and-production-partner-site-readiness-2026-10-19]] · @pin · record
- s24 · human:rob-knudson · stated:2026-10-19 · attestation · Rowlett and Frisco selected for MVP production Partner Site configuration; team pointed to the Wonder × Zipline location tracker
- s25 · [[Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Wonder Zipline Texas Partnership Announcement - 2026-06-30]] · @pin · source
- s26 · https://wonder.atlassian.net/wiki/spaces/~63331686234d44d406d22f29/pages/4040196488/Drone+Deliveries+from+HDRs+-+Pilot+Proposal · fetched:2026-04-24 · source · no-snapshot
- s27 · https://wonder.atlassian.net/browse/AG-683 · fetched:2026-04-24 · source · no-snapshot
- s28 · https://wonder.atlassian.net/browse/HDR-9959 · fetched:2026-04-24 · source · no-snapshot · also HDR-10067
- s29 · [[Wonder/Wonder Fulfillment/Sprints/2026/SP12/Agenda/Meeting Summary]] · @pin · source
- s30 · [[region-2-latest-expansion-plan-2026-09-20]] · @pin · record
- s31 · [[Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Archive/Eligibility and Architecture/1P Drone Delivery High-Level System Alignment - MVP]] · @pin · source
- s32 · [[drone-delivery-overview-slides-readout-2026-06-17]] · @pin · record

## History
- 2026-10-26 · [[#^c11]] [[#^c12]] added; Cookbook/Delivery Catalog sync boundary · src: s11 · by process:cook
- 2026-10-19 · [[#^c24]] [[#^c36]] added, [[#^c24]] marked disputed; [[#^q1]] opened · src: s23, s24 · by process:cook
- Region 2 launch reference: 2027-01-11 Friends & Family and 2027-01-14 Grand Opening per the 2026-09-20 snapshot (src: s30) · superseded 2026-10-19 by [[#^c24]] · tracker Rob shared on 2026-10-19 shows different dates; difference unconfirmed · src: s23 · by process:cook ^c26
- The current single-Zip provider limit is 2495 g and 338 × 252 × 205 mm (width 9.92 in) per the 2026-07-30 partner QA; PRD v16 (2026-08-11) aligned the Weight and Dimension Eligibility PRD to this envelope (src: s10) · superseded 2026-09-15 by [[#^c16]] · week-of-2026-09-07 Payload Dimensions slide revised width to 254 mm · src: s15, s16 · by process:cook ^c27
- 2026-09-14 · [[#^c15]] added · src: s14 · by process:cook
- Earlier proposals: a Wonder-owned item allowlist precheck, and reuse of KDS bag-size recommendation logic (src: s31) · superseded 2026-08-20 by [[#^c13]] · the active fit direction is now narrower: Zipline Pack evaluated as the eligibility oracle · src: s13 · by process:cook ^c28
- 2026-08-12 · [[#^c17]] added · src: s17, s18 · by process:cook
- 2026-08-03 · [[#^c21]] added · src: s21 · by process:cook
- 2026-07-30 · [[#^c18]] [[#^c19]] [[#^c20]] added · src: s10 · by process:cook
- 2026-07-29 · [[#^c34]] [[#^c35]] added · src: s22 · by process:cook
- 2026-07-29 · [[#^c22]] [[#^c23]] added · src: s22 · by process:cook
- 2026-07-17 · verified by process:cook · [[#^c6]] builder confirmed · src: s8
- 2026-07-15 · [[#^c5]] to [[#^c10]] added · src: s7 · by process:cook
- 2026-07-30 · earlier loader reference of 12.5 × 9.5 × 7.75 in noted as smaller than the partner QA envelope and kept as historical context, not the provider maximum · src: s6, s10 · by process:cook
- 2026-06-30 · [[#^c25]] added · src: s25 · by process:cook
- 2026-06-24 · [[#^c2]] [[#^c3]] [[#^c37]] added; [[#^q8]] opened · src: s3, s4, s5 · by process:cook
- Recommendation: a DaaS-first path, with Grubhub DaaS abstracting drone/Dexa support for Wonder (src: s29, s26) · superseded 2026-06-11 by [[#^c1]] · SP13 planning and DELI-4518 shifted discovery to direct Zipline integration · src: s1, s2 · by process:cook ^c30
- 2026-06-17 · [[#^c31]] [[#^c32]] [[#^c33]] added · src: s32 · by process:cook
- 2026-06-11 · [[#^c4]] added; [[#^q11]] opened · src: s6, s1 · by process:cook
- 2026-05-26 · [[#^c30]] added: DaaS-first recommendation; Texas early-2027 expansion signal; [[#^q10]] opened · src: s29 · by process:cook
- 2026-04-24 · [[#^q9]] opened · src: s26 · by process:cook
- 2026-04-24 · page created from the pilot proposal and Jira evidence · src: s26, s27, s28 · by process:cook

## Related
- [[delivery-fulfillment]] — the order-to-delivery backbone drone attaches to
- [[delivery-providers]] — provider comparison including drone
- [[zipline-loading-methods]] — Drone Loading vs Dropbox Loading at a store
- [[packaged-size]] — package classification used by the eligibility fallback
- [[ikc-drone-delivery-setting]] — per-IKC enablement
- [[dispatch-portal]] — where drone statuses surface for Ops
