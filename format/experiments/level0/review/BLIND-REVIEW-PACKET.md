# Level 0 equivalence — blind review packet

96 items. For each, the 1.x text and, where the matcher found one, the Test text it may correspond to. No decisions or proposals are included; the matcher's candidate is a hint, not a judgment. Item ids are stable; put them in your result file.


## drone-delivery-integration-strategy  (Knowledge page)
1.x: `Knowlery-Pilot/concepts/drone-delivery-integration-strategy.md`  ·  Test: `knowlery/format/experiments/level0/test/concepts/drone-delivery-integration-strategy.md`

### drone-delivery-integration-strategy:A1
Type A — 1.x statement; find where it lives in Test, or decide it may be dropped.
1.x section: Current System Alignment (2026-07-15)
**1.x text:** The earlier DaaS-first and Dexa-pilot sections below remain useful history, but they are not the current implementation scope.
**Test text (best match: claim ^c16):** The current single-Zip provider limit is 2495 g and 338 × 254 × 205 mm (5.50 lb, 13.25 × 10 × 8 in); implementation stays canonical in grams and millimetres (src: s15, s16) ^c16

### drone-delivery-integration-strategy:A2
Type A — 1.x statement; find where it lives in Test, or decide it may be dropped.
1.x section: Current Eligibility Direction Under Evaluation (2026-08-20)
**1.x text:** The active fit direction is now narrower than the earlier Wonder-owned allowlist and KDS-reuse proposals:
**Test text (Test ^c28):** Eligibility uses a Wonder-owned item allowlist precheck and may reuse KDS bag-size recommendation logic (src: s31) · superseded 2026-08-20 by [[#^c13]] · Zipline Pack evaluated as the eligibility oracle · src: s13 · by process:cook

### drone-delivery-integration-strategy:A3
Type A — 1.x statement; find where it lives in Test, or decide it may be dropped.
1.x section: Current Eligibility Direction Under Evaluation (2026-08-20)
**1.x text:** Ops / Packaging measures top-selling packed items → Cookbook stores and serves item-level weight and packed dimensions → Delivery Catalog periodically syncs profiles and applies Kafka updates → Consumer Cart / OMS Order fields define and verify the reusable configuration identity → Delivery Catalog returns the local Cookbook-backed profile or classification fallback and containers[] → Delivery-owned Eligibility calls Zipline Pack → total_deliveries == 1 supplies the proposed affirmative fit result
**Test text (best match: claim ^c12):** Cookbook owns item-level weight and packed-dimension profiles and exposes the API/Kafka sync contract; Delivery Catalog stores the local projection, applies classification fallback per line when no usable profile exists, and owns runtime orchestration (src: s11, s12) ^c12

### drone-delivery-integration-strategy:A4
Type A — 1.x statement; find where it lives in Test, or decide it may be dropped.
1.x section: Current Eligibility Direction Under Evaluation (2026-08-20)
**1.x text:** This preserves the strategic boundary that Wonder owns orchestration while the provider owns provider-specific packing logic.
**Test text (Test ^c13):** Delivery-owned Eligibility calls Zipline Pack and treats `total_deliveries == 1` as the proposed affirmative fit result; Zipline does not mandate Pack, Wonder is evaluating it as the eligibility oracle so it need not maintain its own fit algorithm (src: s13, s10)

### drone-delivery-integration-strategy:A5
Type A — 1.x statement; find where it lives in Test, or decide it may be dropped.
1.x section: Current Eligibility Direction Under Evaluation (2026-08-20)
**1.x text:** Cookbook component signature resolution is not an MVP runtime dependency.
**Test text (Test ^c11):** The MVP does not resolve a Cookbook packaging signature at Checkout: Consumer Cart fields form the configuration identity and OMS Order fields validate it post-order (src: s11, s12)

### drone-delivery-integration-strategy:A6
Type A — 1.x statement; find where it lives in Test, or decide it may be dropped.
1.x section: Current Eligibility Direction Under Evaluation (2026-08-20)
**1.x text:** The July partner confirmation that Pack is not *required* solely for one-Zip proof is not a contradiction.
**Test text (Test ^c13):** Delivery-owned Eligibility calls Zipline Pack and treats `total_deliveries == 1` as the proposed affirmative fit result; Zipline does not mandate Pack, Wonder is evaluating it as the eligibility oracle so it need not maintain its own fit algorithm (src: s13, s10)

### drone-delivery-integration-strategy:A7
Type A — 1.x statement; find where it lives in Test, or decide it may be dropped.
1.x section: New Planning Signal (2026-05-26)
**1.x text:** The SP12 bi-weekly turned drone delivery from a medium-term architecture topic into a nearer-term expansion-planning topic:
**Test text (best match: evidence):** Drone delivery is a fulfillment capability for Wonder 1P orders from IKCs/HDRs. The architecture question is not whether to create a new 1P order flow; it is how [[delivery-fulfillment]] connects to drone delivery after the order reaches Delivery Service and provider allocation.

### drone-delivery-integration-strategy:A8
Type A — 1.x statement; find where it lives in Test, or decide it may be dropped.
1.x section: New Planning Signal (2026-05-26)
**1.x text:** Wonder is planning an early-2027 Texas expansion.
**Test text (Test ^c33):** Wonder plans an early-2027 Texas expansion focused on the Dallas, Houston and Austin/San Antonio triangle with day-one drone delivery as a goal, so drone readiness is part of expansion readiness for 2027–2028 rather than an isolated innovation track (src: s29, s32)

### drone-delivery-integration-strategy:A9
Type A — 1.x statement; find where it lives in Test, or decide it may be dropped.
1.x section: New Planning Signal (2026-05-26)
**1.x text:** The current geographic focus is the Dallas, Houston, and Austin / San Antonio triangle.
**Test text (Test ^c33):** Wonder plans an early-2027 Texas expansion focused on the Dallas, Houston and Austin/San Antonio triangle with day-one drone delivery as a goal, so drone readiness is part of expansion readiness for 2027–2028 rather than an isolated innovation track (src: s29, s32)

### drone-delivery-integration-strategy:A10
Type A — 1.x statement; find where it lives in Test, or decide it may be dropped.
1.x section: New Planning Signal (2026-05-26)
**1.x text:** A major goal is to support drone delivery at new Texas locations from day one if possible.
**Test text (Test ^c33):** Wonder plans an early-2027 Texas expansion focused on the Dallas, Houston and Austin/San Antonio triangle with day-one drone delivery as a goal, so drone readiness is part of expansion readiness for 2027–2028 rather than an isolated innovation track (src: s29, s32)

### drone-delivery-integration-strategy:A11
Type A — 1.x statement; find where it lives in Test, or decide it may be dropped.
1.x section: New Planning Signal (2026-05-26)
**1.x text:** The draft Q3 planning readout also framed 1P drone-delivery discovery as preparation work for a Q1 2027 launch path.
**Test text (best match: claim ^c24):** Rowlett and Frisco are selected for MVP production Partner Site configuration; the Wonder × Zipline tracker shows 2027-01-11 Soft Opening, 2027-01-20 Grand Opening and Q1 2027 hub launch, all planning fields rather than sign-offs (src: s23, s24) #disputed ^c24

### drone-delivery-integration-strategy:A12
Type A — 1.x statement; find where it lives in Test, or decide it may be dropped.
1.x section: New Planning Signal (2026-05-26)
**1.x text:** This means drone readiness should now be treated as part of expansion readiness, not only as an isolated innovation track.
**Test text (Test ^c33):** Wonder plans an early-2027 Texas expansion focused on the Dallas, Houston and Austin/San Antonio triangle with day-one drone delivery as a goal, so drone readiness is part of expansion readiness for 2027–2028 rather than an isolated innovation track (src: s29, s32)

### drone-delivery-integration-strategy:A13
Type A — 1.x statement; find where it lives in Test, or decide it may be dropped.
1.x section: Current Q1 2027 Launch Reference (2026-10-19)
**1.x text:** Both rows currently show **January 11, 2027 Soft Opening**, **January 20, 2027 GRAND OPENING Event**, projected hub launch in **Q1 2027**, and Drone availability at Wonder launch marked **Y**.
**Test text (Test ^c24):** Rowlett and Frisco are selected for MVP production Partner Site configuration; the Wonder × Zipline tracker shows 2027-01-11 Soft Opening, 2027-01-20 Grand Opening and Q1 2027 hub launch, all planning fields rather than sign-offs (src: s23, s24) #disputed

### drone-delivery-integration-strategy:A14
Type A — 1.x statement; find where it lives in Test, or decide it may be dropped.
1.x section: Current Q1 2027 Launch Reference (2026-10-19)
**1.x text:** These are planning fields, not completed production or operational sign-offs.
**Test text (Test ^c24):** Rowlett and Frisco are selected for MVP production Partner Site configuration; the Wonder × Zipline tracker shows 2027-01-11 Soft Opening, 2027-01-20 Grand Opening and Q1 2027 hub launch, all planning fields rather than sign-offs (src: s23, s24) #disputed

### drone-delivery-integration-strategy:A15
Type A — 1.x statement; find where it lives in Test, or decide it may be dropped.
1.x section: Current Q1 2027 Launch Reference (2026-10-19)
**1.x text:** The September 20 snapshot recorded **January 11 Friends & Family / January 14 Grand Opening**.
**Test text (Test ^c26):** Region 2 launch reference: 2027-01-11 Friends & Family and 2027-01-14 Grand Opening per the 2026-09-20 snapshot (src: s30) · superseded 2026-10-19 by [[#^c24]] · tracker Rob shared on 2026-10-19 shows different dates; difference unconfirmed · src: s23 · by process:cook

### drone-delivery-integration-strategy:A16
Type A — 1.x statement; find where it lives in Test, or decide it may be dropped.
1.x section: Current Q1 2027 Launch Reference (2026-10-19)
**1.x text:** The tracker is the current working reference Rob shared, but the January 14 versus January 20 difference still needs launch-owner confirmation; do not assume Friends & Family and Soft Opening are the same milestone.
**Test text (Test ^q1):** The tracker's 2027-01-20 Grand Opening in [[#^c24]] differs from the 2026-09-20 snapshot's 2027-01-14; the launch owner has not confirmed which is right, and Friends & Family and Soft Opening may not be the same milestone (src: s23, s30)

### drone-delivery-integration-strategy:A17
Type A — 1.x statement; find where it lives in Test, or decide it may be dropped.
1.x section: Current Q1 2027 Launch Reference (2026-10-19)
**1.x text:** Software Production Ready in SP23, production Partner Site provisioning, and physical/customer launch in 2027 are separate milestones.
**Test text (best match: claim ^c24):** Rowlett and Frisco are selected for MVP production Partner Site configuration; the Wonder × Zipline tracker shows 2027-01-11 Soft Opening, 2027-01-20 Grand Opening and Q1 2027 hub launch, all planning fields rather than sign-offs (src: s23, s24) #disputed ^c24

### drone-delivery-integration-strategy:A18
Type A — 1.x statement; find where it lives in Test, or decide it may be dropped.
1.x section: Zipline Direct-Integration Shift (2026-06-11)
**1.x text:** SP13 planning and [DELI-4518](https://wonder.atlassian.net/browse/DELI-4518) shift the active discovery posture from a [[entities/grubhub|Grubhub]]-mediated drone path toward direct Zipline integration research.
**Test text (Test ^c1):** The active direction is a direct 1P Zipline provider integration built on the existing Wonder order-to-delivery backbone, with a migration-friendly provider abstraction so it could later sit behind DaaS (src: s1, s2)

### drone-delivery-integration-strategy:A19
Type A — 1.x statement; find where it lives in Test, or decide it may be dropped.
1.x section: Zipline Direct-Integration Shift (2026-06-11)
**1.x text:** This does not erase the earlier DaaS-first architecture frame.
**Test text (best match: history-event):** 2026-05-26 · [[#^c30]] added: DaaS-first recommendation; Texas early-2027 expansion signal · src: s29 · by process:cook

### drone-delivery-integration-strategy:A20
Type A — 1.x statement; find where it lives in Test, or decide it may be dropped.
1.x section: Zipline Direct-Integration Shift (2026-06-11)
**1.x text:** earlier frame: can [[entities/grubhub|Grubhub]] DaaS abstract drone/Dexa support cleanly enough for Wonder?
**Test text (Test ^c30):** Recommendation: a DaaS-first path, with Grubhub DaaS abstracting drone/Dexa support for Wonder (src: s29, s26) · superseded 2026-06-11 by [[#^c1]] · SP13 planning and DELI-4518 shifted discovery to direct Zipline integration · src: s1, s2 · by process:cook

### drone-delivery-integration-strategy:A21
Type A — 1.x statement; find where it lives in Test, or decide it may be dropped.
1.x section: Zipline Direct-Integration Shift (2026-06-11)
**1.x text:** current frame: what does Wonder need to learn to integrate directly with Zipline for 1P drone delivery and possible marketplace-brand flow?
**Test text (best match: evidence):** Drone delivery is a fulfillment capability for Wonder 1P orders from IKCs/HDRs. The architecture question is not whether to create a new 1P order flow; it is how [[delivery-fulfillment]] connects to drone delivery after the order reaches Delivery Service and provider allocation.

### drone-delivery-integration-strategy:A22
Type A — 1.x statement; find where it lives in Test, or decide it may be dropped.
1.x section: Zipline Direct-Integration Shift (2026-06-11)
**1.x text:** The most important knowledge correction is source precedence.
**Test text (Test ^c4):** For near-term Wonder assumptions (payload, Zipping Station flow, charging-station range, receipt-code dependency, station occupancy, pickup-status ambiguity) the Wonder site-visit summary takes precedence over Zipline's public Platform 2 pages (src: s6, s1)

### drone-delivery-integration-strategy:A23
Type A — 1.x statement; find where it lives in Test, or decide it may be dropped.
1.x section: Recommendation
**1.x text:** The earlier DaaS-first recommendation should now be read as a historical target architecture from SP12, not as the current discovery direction.
**Test text (Test ^c30):** Recommendation: a DaaS-first path, with Grubhub DaaS abstracting drone/Dexa support for Wonder (src: s29, s26) · superseded 2026-06-11 by [[#^c1]] · SP13 planning and DELI-4518 shifted discovery to direct Zipline integration · src: s1, s2 · by process:cook

### drone-delivery-integration-strategy:A24
Type A — 1.x statement; find where it lives in Test, or decide it may be dropped.
1.x section: Recommendation
**1.x text:** In the short or medium term, do not assume DaaS can support the Zipline path quickly.
**Test text (best match: history ^c30):** Recommendation: a DaaS-first path, with Grubhub DaaS abstracting drone/Dexa support for Wonder (src: s29, s26) · superseded 2026-06-11 by [[#^c1]] · SP13 planning and DELI-4518 shifted discovery to direct Zipline integration · src: s1, s2 · by process:cook ^c30

### drone-delivery-integration-strategy:A25
Type A — 1.x statement; find where it lives in Test, or decide it may be dropped.
1.x section: Recommendation
**1.x text:** Current discovery should clarify Zipline's direct APIs, delivery lifecycle, checkout eligibility, loading-station workflow, status mapping, operational fallback, and how drone-specific fields should normalize into [[concepts/delivery-fulfillment|Delivery Fulfillment]].
**Test text (best match: claim ^c8):** KOS is strongly supported as the current Delivery Task creation trigger, and Delivery Task Service owns Task and Job lifecycle; the post-order sequence is Place Order → persistence → Assign to Pod → Delivery Task → Delivery Intent, which is compatible with Zipline submit-order guidance (src: s7, s9) ^c8

### drone-delivery-integration-strategy:A26
Type A — 1.x statement; find where it lives in Test, or decide it may be dropped.
1.x section: Evidence
**1.x text:** The pilot proposal explicitly listed two order channels: **Grubhub Marketplace deliveries** and **Wonder 1P deliveries**. It also assigned Delivery Product the work to integrate with DEXA as a delivery service provider and assigned Consumer Product checkout tasks such as drone selection, drop-pin selection, and disabling tips.
**Test text (best match: evidence):** Supporting facts: the original pilot proposal listed Grubhub Marketplace and Wonder 1P as two order channels; Delivery Fulfillment already models provider work as Tasks and Jobs, so drone fits as a provider capability; AG-683 moved Aggregator drone detection to Grubhub's structured `vehicle_type`; HDR-9959 and HDR-10067 added HDR/KOM drone handling; the SP12 bi-weekly anchored the Texas early-2027 expansion with day-one drone as a goal; searches for a DaaS drone roadmap found nothing, a gap rather than proof of absence (src: s26, s27, s28, s29).

### drone-delivery-integration-strategy:A27
Type A — 1.x statement; find where it lives in Test, or decide it may be dropped.
1.x section: Evidence
**1.x text:** [[concepts/delivery-fulfillment|Delivery Fulfillment]] already models provider work through Tasks and Jobs. This supports adding drone as a provider capability without changing the 1P order flow.
**Test text (best match: evidence):** Supporting facts: the original pilot proposal listed Grubhub Marketplace and Wonder 1P as two order channels; Delivery Fulfillment already models provider work as Tasks and Jobs, so drone fits as a provider capability; AG-683 moved Aggregator drone detection to Grubhub's structured `vehicle_type`; HDR-9959 and HDR-10067 added HDR/KOM drone handling; the SP12 bi-weekly anchored the Texas early-2027 expansion with day-one drone as a goal; searches for a DaaS drone roadmap found nothing, a gap rather than proof of absence (src: s26, s27, s28, s29).

### drone-delivery-integration-strategy:A28
Type A — 1.x statement; find where it lives in Test, or decide it may be dropped.
1.x section: Evidence
**1.x text:** Jira AG-683 shows the Aggregator side moved from courier-name regex detection to Grubhub's structured `vehicle_type` field for `ROBOT` and `DRONE` deliveries.
**Test text (best match: evidence):** Supporting facts: the original pilot proposal listed Grubhub Marketplace and Wonder 1P as two order channels; Delivery Fulfillment already models provider work as Tasks and Jobs, so drone fits as a provider capability; AG-683 moved Aggregator drone detection to Grubhub's structured `vehicle_type`; HDR-9959 and HDR-10067 added HDR/KOM drone handling; the SP12 bi-weekly anchored the Texas early-2027 expansion with day-one drone as a goal; searches for a DaaS drone roadmap found nothing, a gap rather than proof of absence (src: s26, s27, s28, s29).

### drone-delivery-integration-strategy:A29
Type A — 1.x statement; find where it lives in Test, or decide it may be dropped.
1.x section: Evidence
**1.x text:** Jira HDR-9959 and HDR-10067 show HDR/KOM support for drone operational handling, including card/receipt treatment and `Drone Delivery is Ready` alerting.
**Test text (best match: evidence):** Supporting facts: the original pilot proposal listed Grubhub Marketplace and Wonder 1P as two order channels; Delivery Fulfillment already models provider work as Tasks and Jobs, so drone fits as a provider capability; AG-683 moved Aggregator drone detection to Grubhub's structured `vehicle_type`; HDR-9959 and HDR-10067 added HDR/KOM drone handling; the SP12 bi-weekly anchored the Texas early-2027 expansion with day-one drone as a goal; searches for a DaaS drone roadmap found nothing, a gap rather than proof of absence (src: s26, s27, s28, s29).

### drone-delivery-integration-strategy:A30
Type A — 1.x statement; find where it lives in Test, or decide it may be dropped.
1.x section: Evidence
**1.x text:** Delivery Bi-Weekly notes record Rob's Green Brook customer-facing drone launch update for March 18, 2026.
**Test text (best match: claim ^c22):** Launch is a checkout-only Drone option for eligible Rowlett orders with one Zipline Delivery Intent per Wonder order and the default mapped delivery site; customer drop pins, multi-stop and multi-drone splitting are out of scope (src: s22) ^c22

### drone-delivery-integration-strategy:A31
Type A — 1.x statement; find where it lives in Test, or decide it may be dropped.
1.x section: Evidence
**1.x text:** The 2026-05-26 SP12 meeting added a stronger business anchor: Texas expansion in early 2027 and the desire for day-one drone capability at those new locations.
**Test text (Test ^c33):** Wonder plans an early-2027 Texas expansion focused on the Dallas, Houston and Austin/San Antonio triangle with day-one drone delivery as a goal, so drone readiness is part of expansion readiness for 2027–2028 rather than an isolated innovation track (src: s29, s32)

### drone-delivery-integration-strategy:A32
Type A — 1.x statement; find where it lives in Test, or decide it may be dropped.
1.x section: Evidence
**1.x text:** Searches for DaaS plus drone/Dexa did not surface a clear DaaS support plan. This is a gap, not proof of absence.
**Test text (best match: history ^c30):** Recommendation: a DaaS-first path, with Grubhub DaaS abstracting drone/Dexa support for Wonder (src: s29, s26) · superseded 2026-06-11 by [[#^c1]] · SP13 planning and DELI-4518 shifted discovery to direct Zipline integration · src: s1, s2 · by process:cook ^c30

### drone-delivery-integration-strategy:A33
Type A — 1.x statement; find where it lives in Test, or decide it may be dropped.
1.x section: Architecture Notes
**1.x text:** Drone should be modeled as a delivery capability at the Delivery Service allocation layer, not as a separate 1P order rail.
**Test text (best match: evidence):** Drone delivery is a fulfillment capability for Wonder 1P orders from IKCs/HDRs. The architecture question is not whether to create a new 1P order flow; it is how [[delivery-fulfillment]] connects to drone delivery after the order reaches Delivery Service and provider allocation.

### drone-delivery-integration-strategy:A34
Type A — 1.x statement; find where it lives in Test, or decide it may be dropped.
1.x section: Architecture Notes
**1.x text:** The order remains a Wonder 1P order; the allocation decision chooses either a standard provider path or a drone-capable path.
**Test text (best match: evidence):** | Direct drone provider in allocation | Faster 1P pilot wanted, or DaaS roadmap unclear | Faster Wonder-controlled rollout, more vendor-specific complexity owned by Wonder |

### drone-delivery-integration-strategy:A35
Type A — 1.x statement; find where it lives in Test, or decide it may be dropped.
1.x section: Architecture Notes
**1.x text:** If implemented directly, keep the provider adapter narrow and migration-friendly:
**Test text (best match: claim ^c1):** The active direction is a direct 1P Zipline provider integration built on the existing Wonder order-to-delivery backbone, with a migration-friendly provider abstraction so it could later sit behind DaaS (src: s1, s2) ^c1

### drone-delivery-integration-strategy:A36
Type A — 1.x statement; find where it lives in Test, or decide it may be dropped.
1.x section: Architecture Notes
**1.x text:** Add drone as a configurable provider/capability in allocation settings only for eligible HDRs.
**Test text (best match: claim ^c5):** Consumer owns the Drone customer journey on Web, iOS and Android and calls only Wonder-owned eligibility and ETA contracts (src: s7) ^c5

### drone-delivery-integration-strategy:A37
Type A — 1.x statement; find where it lives in Test, or decide it may be dropped.
1.x section: Architecture Notes
**1.x text:** Gate by distance, delivery address/drop zone, payload, weather, operational hours, and customer opt-in.
**Test text (best match: evidence):** Architecture notes for a direct integration: model drone as an allocation-layer capability, not a separate order rail; gate by distance, drop zone, payload, weather, hours and opt-in; store provider-specific fields apart from generic Task/Job state; emit normalized statuses into order tracking, Dispatch Portal and analytics; keep fallback to human-courier providers.

### drone-delivery-integration-strategy:A38
Type A — 1.x statement; find where it lives in Test, or decide it may be dropped.
1.x section: Architecture Notes
**1.x text:** Store drone-specific provider fields separately from generic Task/Job state where possible.
**Test text (best match: evidence):** Architecture notes for a direct integration: model drone as an allocation-layer capability, not a separate order rail; gate by distance, drop zone, payload, weather, hours and opt-in; store provider-specific fields apart from generic Task/Job state; emit normalized statuses into order tracking, Dispatch Portal and analytics; keep fallback to human-courier providers.

### drone-delivery-integration-strategy:A39
Type A — 1.x statement; find where it lives in Test, or decide it may be dropped.
1.x section: Architecture Notes
**1.x text:** Emit normalized statuses back into existing order tracking, [[entities/dispatch-portal|Dispatch Portal]], and analytics.
**Test text (best match: evidence):** Architecture notes for a direct integration: model drone as an allocation-layer capability, not a separate order rail; gate by distance, drop zone, payload, weather, hours and opt-in; store provider-specific fields apart from generic Task/Job state; emit normalized statuses into order tracking, Dispatch Portal and analytics; keep fallback to human-courier providers.

### drone-delivery-integration-strategy:A40
Type A — 1.x statement; find where it lives in Test, or decide it may be dropped.
1.x section: Architecture Notes
**1.x text:** Preserve fallback to Grubhub DaaS, Relay, DoorDash, or other human courier providers when drone is unavailable.
**Test text (best match: open ^q2):** Does Grubhub DaaS have a committed roadmap for drone support, and could it expose quote, eligibility, vehicle type, tracking, cancellation, weather and fallback reasons? Bears on [[#^c1]] (src: s26) ^q2

### drone-delivery-integration-strategy:A41
Type A — 1.x statement; find where it lives in Test, or decide it may be dropped.
1.x section: Planning Implication
**1.x text:** The biggest practical question is no longer only architectural cleanliness.
**Test text (best match: claim ^c5):** Consumer owns the Drone customer journey on Web, iOS and Android and calls only Wonder-owned eligibility and ETA contracts (src: s7) ^c5

### drone-delivery-integration-strategy:A42
Type A — 1.x statement; find where it lives in Test, or decide it may be dropped.
1.x section: Planning Implication
**1.x text:** It is whether a DaaS-first path can realistically support the early-2027 Texas timeline.
**Test text (Test ^q2):** Does Grubhub DaaS have a committed roadmap for drone support, and could it expose quote, eligibility, vehicle type, tracking, cancellation, weather and fallback reasons? Bears on [[#^c1]] (src: s26)

### drone-delivery-integration-strategy:A43
Type A — 1.x statement; find where it lives in Test, or decide it may be dropped.
1.x section: Planning Implication
**1.x text:** use Q3 2026 discovery to clarify DaaS roadmap certainty
**Test text (best match: evidence):** | Direct drone provider in allocation | Faster 1P pilot wanted, or DaaS roadmap unclear | Faster Wonder-controlled rollout, more vendor-specific complexity owned by Wonder |

### drone-delivery-integration-strategy:A44
Type A — 1.x statement; find where it lives in Test, or decide it may be dropped.
1.x section: Planning Implication
**1.x text:** identify the minimum direct-provider fallback needed for launch confidence
**Test text (best match: evidence):** Product scope and launch (PRD V6, 2026-07-29 → 2026-10-19)

### drone-delivery-integration-strategy:A45
Type A — 1.x statement; find where it lives in Test, or decide it may be dropped.
1.x section: Open Questions
**1.x text:** If Wonder integrates directly with Dexa, who owns support, SLA, pricing, and incident handling?
**Test text (best match: history ^c30):** Recommendation: a DaaS-first path, with Grubhub DaaS abstracting drone/Dexa support for Wonder (src: s29, s26) · superseded 2026-06-11 by [[#^c1]] · SP13 planning and DELI-4518 shifted discovery to direct Zipline integration · src: s1, s2 · by process:cook ^c30

### drone-delivery-integration-strategy:A46
Type A — 1.x statement; find where it lives in Test, or decide it may be dropped.
1.x section: Slides Readout: From Dexa Pilot To Zipline Scale Path (2026-06-17)
**1.x text:** Alec's May 2026 Drone Delivery Overview adds a broader rollout-readiness frame to this strategy.
**Test text (best match: claim ^c7):** Delivery ETA Service owns Consumer-facing drone ETA; Fulfillment/Delivery supplies normalized Zipline timing inputs rather than raw provider fields (src: s7) ^c7

### drone-delivery-integration-strategy:A47
Type A — 1.x statement; find where it lives in Test, or decide it may be dropped.
1.x section: Slides Readout: From Dexa Pilot To Zipline Scale Path (2026-06-17)
**1.x text:** The Texas serviceable-location plan turns drone readiness into an expansion-readiness workstream for 2027-2028, not a standalone innovation pilot.
**Test text (Test ^c33):** Wonder plans an early-2027 Texas expansion focused on the Dallas, Houston and Austin/San Antonio triangle with day-one drone delivery as a goal, so drone readiness is part of expansion readiness for 2027–2028 rather than an isolated innovation track (src: s29, s32)

### drone-delivery-integration-strategy:A48
Type A — 1.x statement; find where it lives in Test, or decide it may be dropped.
1.x section: Meeting Update: PRD And 1P Scope Confirmation (2026-06-24)
**1.x text:** The SP14 Delivery Bi-Weekly raised drone delivery to a high-priority initiative.
**Test text (best match: claim ^c7):** Delivery ETA Service owns Consumer-facing drone ETA; Fulfillment/Delivery supplies normalized Zipline timing inputs rather than raw provider fields (src: s7) ^c7

### drone-delivery-integration-strategy:A49
Type A — 1.x statement; find where it lives in Test, or decide it may be dropped.
1.x section: Meeting Update: PRD And 1P Scope Confirmation (2026-06-24)
**1.x text:** Rob is drafting a formal PRD to coordinate the cross-functional work and will explore setting up a dedicated Slack channel with the Zipline technical team.
**Test text (best match: claim ^c20):** Zipline validates that a safe delivery area exists but does not expose the exact planned drop-off coordinate, so exact drop-off presentation is a known product limitation (src: s10) ^c20

### drone-delivery-integration-strategy:A50
Type A — 1.x statement; find where it lives in Test, or decide it may be dropped.
1.x section: Dropbox Scope Clarification: No Grubhub Sharing Assumption (2026-06-24)
**1.x text:** Jay's concern was that orders placed through the [[entities/grubhub|Grubhub]] app can also flow into IKCs; if Grubhub also integrated with Zipline, both order sources could compete for the same physical Dropbox and make a Wonder-owned readiness queue hard to maintain.
**Test text (best match: claim ^c3):** Planned Zipline Dropbox capacity near target IKCs is scoped to Wonder 1P orders only; Zipline is not expected to partner with Grubhub, so the readiness-queue design need not assume external demand on Dropbox slots (src: s4, s5) ^c3

### drone-delivery-integration-strategy:A51
Type A — 1.x statement; find where it lives in Test, or decide it may be dropped.
1.x section: Dropbox Scope Clarification: No Grubhub Sharing Assumption (2026-06-24)
**1.x text:** Rob's clarification reduces that risk: Zipline is expected to work only with Wonder for this initiative, and Rob said Zipline is not expected to partner with Grubhub because Zipline also operates as a food-delivery platform and competes with Grubhub.
**Test text (Test ^c3):** Planned Zipline Dropbox capacity near target IKCs is scoped to Wonder 1P orders only; Zipline is not expected to partner with Grubhub, so the readiness-queue design need not assume external demand on Dropbox slots (src: s4, s5)

### drone-delivery-integration-strategy:A52
Type A — 1.x statement; find where it lives in Test, or decide it may be dropped.
1.x section: Dropbox Scope Clarification: No Grubhub Sharing Assumption (2026-06-24)
**1.x text:** It still needs Zipline confirmation on station-level behavior such as Dropbox capacity, loading windows, station availability, queue depth, and the event that means an order is ready for handoff to the Dropbox.
**Test text (best match: claim ^c3):** Planned Zipline Dropbox capacity near target IKCs is scoped to Wonder 1P orders only; Zipline is not expected to partner with Grubhub, so the readiness-queue design need not assume external demand on Dropbox slots (src: s4, s5) ^c3

### drone-delivery-integration-strategy:A53
Type A — 1.x statement; find where it lives in Test, or decide it may be dropped.
1.x section: Official Partnership Confirmation (2026-06-30)
**1.x text:** Wonder's public partnership announcement moves the Texas Zipline program from internal expansion planning to an externally visible launch commitment:
**Test text (Test ^c25):** Wonder's public announcement commits select Texas locations to begin service in January 2027 with Dallas first and most Texas locations offering drone delivery by end of 2027; it does not mention Grubhub or exclusivity (src: s25)

### drone-delivery-integration-strategy:A54
Type A — 1.x statement; find where it lives in Test, or decide it may be dropped.
1.x section: Official Partnership Confirmation (2026-06-30)
**1.x text:** Dallas is the first named market;
**Test text (Test ^c25):** Wonder's public announcement commits select Texas locations to begin service in January 2027 with Dallas first and most Texas locations offering drone delivery by end of 2027; it does not mention Grubhub or exclusivity (src: s25)

### drone-delivery-integration-strategy:A55
Type A — 1.x statement; find where it lives in Test, or decide it may be dropped.
1.x section: Official Partnership Confirmation (2026-06-30)
**1.x text:** the operating model integrates Zipline with Wonder ordering and kitchen workflows and uses Dropbox hardware for store handoff;
**Test text (best match: claim ^c3):** Planned Zipline Dropbox capacity near target IKCs is scoped to Wonder 1P orders only; Zipline is not expected to partner with Grubhub, so the readiness-queue design need not assume external demand on Dropbox slots (src: s4, s5) ^c3

### drone-delivery-integration-strategy:A56
Type A — 1.x statement; find where it lives in Test, or decide it may be dropped.
1.x section: Official Partnership Confirmation (2026-06-30)
**1.x text:** the stated value extends beyond cost to speed, access, food quality, demand growth, and delivery resilience.
**Test text (best match: evidence):** → Delivery Catalog periodically syncs profiles and applies Kafka updates

### drone-delivery-integration-strategy:A57
Type A — 1.x statement; find where it lives in Test, or decide it may be dropped.
1.x section: Official Partnership Confirmation (2026-06-30)
**1.x text:** This strengthens the direct-provider scale case, but the announcement does not mention Grubhub or establish exclusivity.
**Test text (Test ^c25):** Wonder's public announcement commits select Texas locations to begin service in January 2027 with Dallas first and most Texas locations offering drone delivery by end of 2027; it does not mention Grubhub or exclusivity (src: s25)

### drone-delivery-integration-strategy:A58
Type A — 1.x statement; find where it lives in Test, or decide it may be dropped.
1.x section: Official Partnership Confirmation (2026-06-30)
**1.x text:** The current Wonder 1P-only scope therefore continues to come from internal program alignment.
**Test text (Test ^c2):** The initiative is exclusive to Wonder 1P orders; Grubhub marketplace and Grubhub-mediated delivery are out of scope (src: s3)

### drone-delivery-integration-strategy:A59
Type A — 1.x statement; find where it lives in Test, or decide it may be dropped.
1.x section: Official Partnership Confirmation (2026-06-30)
**1.x text:** Technical readiness still depends on quote and package eligibility, loading and custody semantics, station queue behavior, planned drop-off location, and fallback contracts.
**Test text (best match: evidence):** Eligibility and package data (2026-08-20 → 2026-10-26)

### drone-delivery-integration-strategy:A60
Type A — 1.x statement; find where it lives in Test, or decide it may be dropped.
1.x section: Freshness Review (2026-07-17)
**1.x text:** The Fulfillment/Delivery team is now the confirmed builder and operator of the Drone Eligibility Service.
**Test text (Test ^c6):** Fulfillment/Delivery builds and operates the Drone Eligibility Service as Consumer's single internal decision boundary; the final service name and the detailed API contract remain open (src: s7, s8)

### drone-delivery-integration-strategy:A61
Type A — 1.x statement; find where it lives in Test, or decide it may be dropped.
1.x section: Rob PRD V6 MVP Baseline (2026-07-29)
**1.x text:** Rob Knudson PRD V6 establishes a product-scope baseline for the direct [[entities/zipline|Zipline]] 1P pilot.
**Test text (Test ^c22):** Launch is a checkout-only Drone option for eligible Rowlett orders with one Zipline Delivery Intent per Wonder order and the default mapped delivery site; customer drop pins, multi-stop and multi-drone splitting are out of scope (src: s22)

### drone-delivery-integration-strategy:A62
Type A — 1.x statement; find where it lives in Test, or decide it may be dropped.
1.x section: Rob PRD V6 MVP Baseline (2026-07-29)
**1.x text:** The delivery timeline is now: API/architecture alignment by August 17, build by September 28, E2E validation November 16 to December 7, and controlled Rowlett launch starting January 8, 2027.
**Test text (Test ^c23):** PRD V6 timeline: API/architecture alignment by 2026-08-17, build by 2026-09-28, E2E validation 2026-11-16 to 2026-12-07, controlled Rowlett launch from 2027-01-08; eligibility, Quote, status sync, completion evidence and recoverable fallback are P0, telemetry and cancellation are listed P1; the P1 classification is not a closed implementation decision, because live tracking is a stated customer use case and custody-aware cancellation is required for safe recovery (src: s22)

### drone-delivery-integration-strategy:A63
Type A — 1.x statement; find where it lives in Test, or decide it may be dropped.
1.x section: Partner-Confirmed MVP Integration Contract (2026-07-30)
**1.x text:** The final partner QA in [[zipline-mvp-partner-confirmed-contract-2026-07-30]] closes several strategy-level gaps:
**Test text (best match: evidence):** Partner contract (2026-07-28 → 2026-08-03)

### drone-delivery-integration-strategy:A64
Type A — 1.x statement; find where it lives in Test, or decide it may be dropped.
1.x section: Partner-Confirmed MVP Integration Contract (2026-07-30)
**1.x text:** one approved package within `2495 g / 338 × 254 × 205 mm` guarantees one initial Zip;
**Test text (Test ^c16):** The current single-Zip provider limit is 2495 g and 338 × 254 × 205 mm (5.50 lb, 13.25 × 10 × 8 in); implementation stays canonical in grams and millimetres (src: s15, s16)

### drone-delivery-integration-strategy:A65
Type A — 1.x statement; find where it lives in Test, or decide it may be dropped.
1.x section: Partner-Confirmed MVP Integration Contract (2026-07-30)
**1.x text:** The remaining strategy work is Wonder-side data readiness, normalized recovery, cross-surface custody guards, and customer messaging.
**Test text (best match: open ^q6):** Remaining launch gates: Intent timing, mapped delivery-site semantics, webhook reason/state mapping, station occupancy, loading-code rotation and post-custody recovery (src: s22, s10) ^q6

### drone-delivery-integration-strategy:A66
Type A — 1.x statement; find where it lives in Test, or decide it may be dropped.
1.x section: Canonical Package Limit In Both Unit Systems (2026-07-30)
**1.x text:** The 2026-07-30 partner QA used width `252 mm` / `9.92 in`.
**Test text (Test ^c27):** The current single-Zip provider limit is 2495 g and 338 × 252 × 205 mm (5.50 lb, 13.31 × 9.92 × 8.07 in) per the 2026-07-30 partner QA (src: s10) · superseded 2026-09-15 by [[#^c16]] · week-of-2026-09-07 Payload Dimensions slide revised width to 254 mm; mass, length and height unchanged · src: s15, s16 · by process:cook

### drone-delivery-integration-strategy:A67
Type A — 1.x statement; find where it lives in Test, or decide it may be dropped.
1.x section: Canonical Package Limit In Both Unit Systems (2026-07-30)
**1.x text:** Implementation remains canonical in grams and millimeters.
**Test text (Test ^c16):** The current single-Zip provider limit is 2495 g and 338 × 254 × 205 mm (5.50 lb, 13.25 × 10 × 8 in); implementation stays canonical in grams and millimetres (src: s15, s16)

### drone-delivery-integration-strategy:A68
Type A — 1.x statement; find where it lives in Test, or decide it may be dropped.
1.x section: Canonical Package Limit In Both Unit Systems (2026-07-30)
**1.x text:** PRD v16 (2026-08-11) aligned the Weight and Dimension Eligibility PRD to the July envelope; that July width is now itself superseded.
**Test text (best match: evidence):** Eligibility and package data (2026-08-20 → 2026-10-26)

### drone-delivery-integration-strategy:A69
Type A — 1.x statement; find where it lives in Test, or decide it may be dropped.
1.x section: Preferred Outer Package Medium Bag (2026-08-12)
**1.x text:** The provider envelope above is the current hardware maximum.
**Test text (Test ^c17):** The Wonder-side outer package that must fit that envelope is the existing Medium bag, selected by IKC Ops after it fit the 3D-printed Pod sample; bag and guest-packaging samples still need testing (src: s17, s18)

### drone-delivery-integration-strategy:A70
Type A — 1.x statement; find where it lives in Test, or decide it may be dropped.
1.x section: Advisory Loading Window and Summon Trigger (2026-08-03)
**1.x text:** The architecture consequence is intentionally small: keep one provider workflow through delayed kitchen preparation, refresh ETA or operational messaging where needed, and reserve fallback for actual provider, station, or loading failures.
**Test text (best match: claim ^c7):** Delivery ETA Service owns Consumer-facing drone ETA; Fulfillment/Delivery supplies normalized Zipline timing inputs rather than raw provider fields (src: s7) ^c7

### drone-delivery-integration-strategy:A71
Type A — 1.x statement; find where it lives in Test, or decide it may be dropped.
1.x section: Advisory Loading Window and Summon Trigger (2026-08-03)
**1.x text:** This also removes loading-window expiry as a default FIFO-priority signal.
**Test text (best match: claim ^c22):** Launch is a checkout-only Drone option for eligible Rowlett orders with one Zipline Delivery Intent per Wonder order and the default mapped delivery site; customer drop pins, multi-stop and multi-drone splitting are out of scope (src: s22) ^c22

### drone-delivery-integration-strategy:B1
Type B — Test claim; find the 1.x sentence(s) it comes from.
**1.x text:** This means drone readiness should now be treated as part of expansion readiness, not only as an isolated innovation track.
**Test text (claim ^c33):** - Wonder plans an early-2027 Texas expansion focused on the Dallas, Houston and Austin/San Antonio triangle with day-one drone delivery as a goal, so drone readiness is part of expansion readiness for 2027–2028 rather than an isolated innovation track (src: s29, s32) ^c33


## ikc-drone-delivery-setting  (Knowledge page)
1.x: `Knowlery-Pilot/concepts/ikc-drone-delivery-setting.md`  ·  Test: `knowlery/format/experiments/level0/test/concepts/ikc-drone-delivery-setting.md`

### ikc-drone-delivery-setting:B1
Type B — Test claim; find the 1.x sentence(s) it comes from.
**1.x text:** **On:** an eligible order placed with Drone Delivery selects Zipline as its provider.
**Test text (claim ^c6):** - The setting is read at two places: the Drone eligibility check and delivery task creation (src: s1) ^c6


## packaged-size  (Knowledge page)
1.x: `Knowlery-Pilot/concepts/packaged-size.md`  ·  Test: `knowlery/format/experiments/level0/test/concepts/packaged-size.md`

### packaged-size:A1
Type A — 1.x statement; find where it lives in Test, or decide it may be dropped.
1.x section: Grain
**1.x text:** the main dish (often `subcomponent_name` null);
**Test text (best match: claim ^c12):** Packaged Size is not one value per customer menu SKU; KDS attaches it to each Cooking Item or vending task: the main dish (often `subcomponent_name` null), each sauce / side customization as its own row, utensils hardcoded to XS, and bundles collapsed to XL instead of summing components (src: s2, s1) ^c12

### packaged-size:A2
Type A — 1.x statement; find where it lives in Test, or decide it may be dropped.
1.x section: Grain
**1.x text:** each sauce / side customization as its own row;
**Test text (best match: claim ^c12):** Packaged Size is not one value per customer menu SKU; KDS attaches it to each Cooking Item or vending task: the main dish (often `subcomponent_name` null), each sauce / side customization as its own row, utensils hardcoded to XS, and bundles collapsed to XL instead of summing components (src: s2, s1) ^c12

### packaged-size:B1
Type B — Test claim; find the 1.x sentence(s) it comes from.
**1.x text:** each sauce / side customization as its own row;
**Test text (claim ^c12):** - Packaged Size is not one value per customer menu SKU; KDS attaches it to each Cooking Item or vending task: the main dish (often `subcomponent_name` null), each sauce / side customization as its own row, utensils hardcoded to XS, and bundles collapsed to XL instead of summing components (src: s2, s1) ^c12


## zipline-drone-deliveries-in-dispatch-portal  (Knowledge page)
1.x: `Knowlery-Pilot/concepts/zipline-drone-deliveries-in-dispatch-portal.md`  ·  Test: `knowlery/format/experiments/level0/test/concepts/zipline-drone-deliveries-in-dispatch-portal.md`

### zipline-drone-deliveries-in-dispatch-portal:B1
Type B — Test claim; find the 1.x sentence(s) it comes from.
**1.x text:** Clicking a drone row opens its detail page ([[DELI-4660]]).
**Test text (claim ^c7):** - Everything on the Zipline detail page not otherwise specified matches the ground detail page (src: s2) ^c7

### zipline-drone-deliveries-in-dispatch-portal:B2
Type B — Test claim; find the 1.x sentence(s) it comes from.
**1.x text:** The second timeline event is labeled "Assigned drone" for a Zipline job; ground jobs keep their current label.
**Test text (claim ^c17):** - Once a Zipline job's Delivery Intent has reached `IN_PROGRESS` the drone has custody, so a Ground job that appears after it is a post-custody recovery rather than a reallocation of the same delivery (src: s3, s2) ^c17


## zipline-loading-methods  (Knowledge page)
1.x: `Knowlery-Pilot/comparisons/zipline-loading-methods.md`  ·  Test: `knowlery/format/experiments/level0/test/comparisons/zipline-loading-methods.md`

### zipline-loading-methods:A1
Type A — 1.x statement; find where it lives in Test, or decide it may be dropped.
1.x section: Scaling Interpretation
**1.x text:** The package fits with a reliability buffer.
**Test text (best match: claim ^c15):** That Dropbox advantage appears only after four conditions are met: the site is constructed and approved; the package fits with a reliability buffer; Loading Manager clearly exposes station readiness and exceptions; and the store has a defined queue and exception process (src: s2) ^c15

### zipline-loading-methods:A2
Type A — 1.x statement; find where it lives in Test, or decide it may be dropped.
1.x section: Scaling Interpretation
**1.x text:** Loading Manager clearly exposes station readiness and exceptions.
**Test text (best match: claim ^c15):** That Dropbox advantage appears only after four conditions are met: the site is constructed and approved; the package fits with a reliability buffer; Loading Manager clearly exposes station readiness and exceptions; and the store has a defined queue and exception process (src: s2) ^c15

### zipline-loading-methods:A3
Type A — 1.x statement; find where it lives in Test, or decide it may be dropped.
1.x section: Scaling Interpretation
**1.x text:** The store has a defined queue and exception process.
**Test text (best match: claim ^c15):** That Dropbox advantage appears only after four conditions are met: the site is constructed and approved; the package fits with a reliability buffer; Loading Manager clearly exposes station readiness and exceptions; and the store has a defined queue and exception process (src: s2) ^c15

### zipline-loading-methods:A4
Type A — 1.x statement; find where it lives in Test, or decide it may be dropped.
1.x section: Scaling Interpretation
**1.x text:** It still requires more staff time and tighter synchronization.
**Test text (best match: claim ^c16):** Drone Loading is a useful operational fallback or launch bridge when Dropbox installation is incomplete or packaging fit is uncertain, but it still requires more staff time and tighter synchronization (src: s2) ^c16

### zipline-loading-methods:B1
Type B — Test claim; find the 1.x sentence(s) it comes from.
**1.x text:** Loading Manager clearly exposes station readiness and exceptions.
**Test text (claim ^c15):** - That Dropbox advantage appears only after four conditions are met: the site is constructed and approved; the package fits with a reliability buffer; Loading Manager clearly exposes station readiness and exceptions; and the store has a defined queue and exception process (src: s2) ^c15


## zipline-mvp-final-partner-qa-working-draft-2026-07-26  (Record)
1.x: `Knowlery-Pilot/queries/zipline-mvp-final-partner-qa-working-draft-2026-07-26.md`  ·  Test: `knowlery/format/experiments/level0/test/records/zipline-mvp-final-partner-qa-working-draft-2026-07-26.md`

### zipline-mvp-final-partner-qa-working-draft-2026-07-26:add1
Type N — sentence in the Record that is not in 1.x (Summary sentences are allowed only if they restate the page).
**Test text (Test sentence (not in 1.x)):** this page was the working source of truth for the four mvp-blocking (p0) questions in the zipline partner qa as of 2026-07-26.

### zipline-mvp-final-partner-qa-working-draft-2026-07-26:add2
Type N — sentence in the Record that is not in 1.x (Summary sentences are allowed only if they restate the page).
**Test text (Test sentence (not in 1.x)):** the questions asked whether mass grams is required for wonder direct-order quotes, whether an approved standard package guarantees one zip per wonder order, which api event marks dropbox lock and which terminal event starts customer recovery, and which location wonder should display as the planned customer drop-off point.

### zipline-mvp-final-partner-qa-working-draft-2026-07-26:add3
Type N — sentence in the Record that is not in 1.x (Summary sentences are allowed only if they restate the page).
**Test text (Test sentence (not in 1.x)):** partner answers were received on 2026-07-30; zipline-mvp-partner-confirmed-contract-2026-07-30 is the current durable contract and supersedes the unanswered wording here.


## zipline-dropbox-lock-custody-and-failure-disposition-contract-2026-07-28  (Record)
1.x: `Knowlery-Pilot/queries/zipline-dropbox-lock-custody-and-failure-disposition-contract-2026-07-28.md`  ·  Test: `knowlery/format/experiments/level0/test/records/zipline-dropbox-lock-custody-and-failure-disposition-contract-2026-07-28.md`

### zipline-dropbox-lock-custody-and-failure-disposition-contract-2026-07-28:add1
Type N — sentence in the Record that is not in 1.x (Summary sentences are allowed only if they restate the page).
**Test text (Test sentence (not in 1.x)):** this page records the confirmed irreversible p2 custody contract for wonder 1p drone delivery, with delivery intent status in progress as the authoritative transfer event and failed-package disposal at a zipline charging site.

### zipline-dropbox-lock-custody-and-failure-disposition-contract-2026-07-28:add2
Type N — sentence in the Record that is not in 1.x (Summary sentences are allowed only if they restate the page).
**Test text (Test sentence (not in 1.x)):** rob knudson confirmed after a live call with zipline that locking the p2 dropbox is irreversible for the original package: after lock, the package is either delivered to the customer or, on cancellation, failure, or another non-happy path, taken to a zipline charging station for disposal.

### zipline-dropbox-lock-custody-and-failure-disposition-contract-2026-07-28:add3
Type N — sentence in the Record that is not in 1.x (Summary sentences are allowed only if they restate the page).
**Test text (Test sentence (not in 1.x)):** the package is never returned to wonder or placed back in the dropbox, so the zipline api wording that a failed delivery is returned to the partner is misleading for wonder operations.

### zipline-dropbox-lock-custody-and-failure-disposition-contract-2026-07-28:add4
Type N — sentence in the Record that is not in 1.x (Summary sentences are allowed only if they restate the page).
**Test text (Test sentence (not in 1.x)):** dropbox locked means the original package has left wonder recovery control; wonder must not promise that cancellation will stop execution or that reallocation will reuse the original food.


## packaging-signature-configuration-space-for-drone-eligibility-2026-08-13  (Record)
1.x: `Knowlery-Pilot/queries/packaging-signature-configuration-space-for-drone-eligibility-2026-08-13.md`  ·  Test: `knowlery/format/experiments/level0/test/records/packaging-signature-configuration-space-for-drone-eligibility-2026-08-13.md`

### packaging-signature-configuration-space-for-drone-eligibility-2026-08-13:add1
Type N — sentence in the Record that is not in 1.x (Summary sentences are allowed only if they restate the page).
**Test text (Test sentence (not in 1.x)):** this page is a historical bigquery analysis of the menu-item x non food-component signature space.

### packaging-signature-configuration-space-for-drone-eligibility-2026-08-13:add2
Type N — sentence in the Record that is not in 1.x (Summary sentences are allowed only if they restate the page).
**Test text (Test sentence (not in 1.x)):** order-level analysis had shown that 57.46% of 1p delivery orders contain at least one line item with option-level non food components, which broke the mvp dimensions eligibility proposal's assumption that "menu item" is the right grain for physical validation.

### packaging-signature-configuration-space-for-drone-eligibility-2026-08-13:add3
Type N — sentence in the Record that is not in 1.x (Summary sentences are allowed only if they restate the page).
**Test text (Test sentence (not in 1.x)):** the page measures the alternative grain, the packaging signature: the canonical sorted multiset of a line item's non food component item numbers.

### packaging-signature-configuration-space-for-drone-eligibility-2026-08-13:add4
Type N — sentence in the Record that is not in 1.x (Summary sentences are allowed only if they restate the page).
**Test text (Test sentence (not in 1.x)):** the measured variation remains useful evidence, but the cookbook-dependent signature is superseded as an mvp runtime identity; see drone-checkout-cart-profile-identity-and-container-schema-2026-08-31.


## drone-mvp-weight-gate-status-and-discrete-pivot-2026-08-18  (Record)
1.x: `Knowlery-Pilot/queries/drone-mvp-weight-gate-status-and-discrete-pivot-2026-08-18.md`  ·  Test: `knowlery/format/experiments/level0/test/records/drone-mvp-weight-gate-status-and-discrete-pivot-2026-08-18.md`

### drone-mvp-weight-gate-status-and-discrete-pivot-2026-08-18:add1
Type N — sentence in the Record that is not in 1.x (Summary sentences are allowed only if they restate the page).
**Test text (Test sentence (not in 1.x)):** the 2026-08-20 midtown east visit confirmed the robotic arm is out of mvp scope even with a five-second stabilization pause; manual scale capture for top-selling packed items is now the active measurement path.

### drone-mvp-weight-gate-status-and-discrete-pivot-2026-08-18:add2
Type N — sentence in the Record that is not in 1.x (Summary sentences are allowed only if they restate the page).
**Test text (Test sentence (not in 1.x)):** treat this page as the 2026-08-17 to 2026-08-20 status snapshot; rob later dropped discrete item count as an affirmative fallback.
