---
type: record
title: Drone MVP Weight Gate Status and Discrete Pivot
description: Where the Drone MVP weight-eligibility track stood between Rob Knudson's 2026-08-17 Robotic Arm status update and the 2026-08-20 Midtown East visit that took the arm out of MVP scope and started manual scale capture, as reviewed 2026-09-01; the later current proposal that dropped item count as an affirmative fallback is not covered here.
date: 2026-08-18
kind: finding
tags:
  - data-analysis
  - drone-delivery
  - mvp
status: current
superseded_by:
  - "[[1p-drone-delivery-weight-and-dimension-eligibility-current-proposal-2026-08-31]]"
updated: 2026-09-03
updated_by: process:cook
verified: 2026-09-01
verified_by: process:cook
aliases:
  - Robotic Arm Weight Data Status
  - Drone Weight Eligibility Discrete Pivot
---

# Drone MVP Weight Gate Status and Discrete Pivot (2026-08-18)

## Summary

Status snapshot as of 2026-08-18. Records where the Drone MVP weight-eligibility track stands after [[rob-knudson|Rob Knudson]]'s 2026-08-17 Slack update, what was independently verified, the candidate paths forward, and the decision timeline. This page exists so the discussion can resume from evidence rather than memory. The 2026-08-20 Midtown East visit confirmed the Robotic Arm is out of MVP scope even with a five-second stabilization pause; manual scale capture for top-selling packed items is now the active measurement path. Treat this page as the 2026-08-17 to 2026-08-20 status snapshot; Rob later dropped discrete item count as an affirmative fallback.

## Detail

> [!warning] Affirmative item-count path superseded
> Treat this page as the 2026-08-17 to 2026-08-20 status snapshot. Rob later dropped discrete item count as an affirmative fallback. Current proposal: [[1p-drone-delivery-weight-and-dimension-eligibility-current-proposal-2026-08-31|1P Drone Delivery Weight and Dimension Eligibility Current Proposal (2026-08-31)]].

> [!important] MVP identity correction (2026-09-01)
> The current MVP candidate does not resolve Cookbook item/components or build a packaging signature. Delivery maps Consumer Cart-native identity to a static physical profile and validates the mapping post-order with OMS fields. Cookbook is a future/advisory option.

### The Event (2026-08-17)

Jay asked Rob for the status of order-weight collection through the Midtown East Robotic Arm. Rob's reply, captured in [[Slack Update - Robotic Arm Weight Data Status and Discrete Pivot - 2026-08-17]]:

- The arm's readings are inconsistent: it is hyper sensitive to vibrations as it moves, which throws off measurements.
- More data may help; certainty expected by end of week (~2026-08-21). Rob visits Midtown East [[ikc|IKC]] on Thursday 2026-08-20 with [[jordan-adelson|Jordan Adelson]], who owns the arm.
- Rob's preliminary direction: plan a discrete-measure approach (e.g. item counts) for MVP, needed as a fallback anyway for items without weights, to protect the project schedule. He suspects a pivot to a discrete approach "soon to be safe".

Jay's constraint, recorded the same evening: the MVP timeline is too tight for any collect-then-aggregate weight program.

### Follow-up (2026-08-18, Confluence)

On the sprint planning page, Jay noted that Weight & Dimensions would likely carry into Sprint 18. [[rob-knudson|Rob Knudson]] agreed and restated the discrete direction more strongly. Captured in [[Confluence Comment - Item Count as Primary MVP - 2026-08-18]]:

- He will have more information this week on alternatives, specifically pulling item data directly from Cookbook.
- In the meantime, plan a fallback item-count approach as the **primary MVP solution**, in case the alternatives do not prove feasible in the next few days.
- This logic is needed anyway.

This does not change the recommendation on this page. Phase 0 remains the discrete design. Pure item counts are still insufficient as a dimensions gate, per [[drone-fit-exclusion-test-and-container-count-limits-2026-08-12|Drone Fit Exclusion Test and Container Count Limits (2026-08-12)]]. Cookbook item data, if it lands this week, is a later input rather than a reason to wait.

### Follow-up (2026-08-18, warehouse verification)

Pre-draft verification for the Weight and Dimensions MVP design confirmed the Cookbook pull is the **only** access path: `NetWeight.quantity_by_g` has no BigQuery sync, packaging dimension and tare fields are zero for all 147 window NON_FOOD components, and a pure count-based mass bound cannot be calibrated from any warehouse data. The arm remains unstable after the unit-regime switch, with a new hypothesis that readings include IK dish tare. Full readout: [[cookbook-weight-and-dimension-warehouse-observability-2026-08-18|Cookbook Weight and Dimension Warehouse Observability (2026-08-18)]].

### Follow-up (2026-08-19, proposal)

The weight track now has its consolidated recommendation: [[1P Drone Delivery Weight and Dimensions MVP Eligibility Proposal (2026-08-19)]], positioned as evidence-based input to the PRD that Rob and Pratik own. It states the rule in Rob's discrete item-count language (at most K units, all from the drone menu), makes the drone menu carry validated max weights so the count rule actually holds 2,495 g, and recommends an under-1% load-failure budget as the primary objective. Cookbook NetWeight is positioned as an upgrade path (cross-check, then per-item refinement) pending Bonnie's weight-rules document and Jakob's export decision from the 2026-08-19 meeting.

### Follow-up (2026-08-20, Midtown East visit and manual capture)

The uncertainty around the arm is resolved for MVP. [[rob-knudson|Rob Knudson]] visited Midtown East with the Automation context in hand and confirmed that readings remain inconsistent and often incorrect even when the arm pauses for five seconds to reduce vibration. Treat the Robotic Arm path as **out of scope for MVP**, not as a pending launch dependency.

Rob used a standalone digital scale instead. The initial summary contains 88 photo-backed observations from 57 orders across 68 distinct `Concept + Item` labels; this is not evidence of approximately 85 unique canonical menu items. The source-photo mapping contains 89 rows, with order `11342894` absent from the summary. He plans additional visits to expand top-selling-item coverage and collect packed dimensions in the same program. Zipline separately confirmed that its Pack endpoint evaluates whether a submitted set of items fits in a Dropbox; the emerging path is therefore reviewed top-item profiles → Zipline Pack, with missing-data fallback still open. See [[zipline-pack-as-eligibility-oracle-direction-2026-08-20]].

The manual extract should be treated as a photo-backed observation layer, not ground truth. Each record is intended to tie to an order label and packed-item photo, but the Markdown already includes OCR correction and highest-reading selection. Several documented ranges are too large to assume scale noise and may represent progressive assembly or multiple components. The value needed by Eligibility is a reviewed, conservative, versioned profile tied to Cart-native identity and reproducible from OMS fields. Ops collects evidence; Delivery owns the static MVP snapshot.

### Verified Evidence

Independent BigQuery verification on 2026-08-17 (details in the capture note):

1. The table Rob shared, [[robot-issues|robot_issues]], has no dedicated mass column. `issue_type` is the original 2026-04-10 create-time STRING, not a later add. The table is primarily the arm's operational fault log (QR-code failures, items stuck on shovel or conveyor, sensor blocks, initializations).
2. The `mongo_batch_kitchen_integration` dataset holds only that table.
3. The fault log's own hygiene problems (`issue_type` values polluted with URL fragments and UUIDs) independently corroborate the capture instability Rob described.

> [!warning] Later finding — 2026-08-18
> The "no weight payload" claim is superseded. Weight is encoded in `issue_type` as `ITEM_WEIGHT;<cooking_item_id>;0;<value>` from 2026-08-14 12:01 ET. The join, unit break, vending gap, and Eligibility implication are on [[robotic-arm-item-weight-cooking-item-mapping-2026-08-18|Robotic Arm ITEM_WEIGHT Cooking-Item Mapping (2026-08-18)]]. A same-day check of Rob's inconsistency claim is also there: five cooking items were reweighed with gaps up to 1.41× (Truffle Fries 991 g → 411 g), and 23 of 29 fixed SKUs with n≥8 have CV ≥ 0.30. The discrete / validation-pass recommendation on this page still stands: the stream is not a checkout-ready order-weight table.

Standing constraint from [[zipline-sandbox-quote-mass-gating-contract|Zipline Sandbox Quote Mass Gating Contract]]: Create Quote tolerates missing mass, but Create Delivery Intent requires positive `mass_grams`. Any MVP design must still produce a mass number per order.

### Implications for the Eligibility Strategy

1. Robotic Arm weight is **not usable for live Eligibility** and is now explicitly out of MVP scope. The arm lands post-cook FOOD [[cooking-item|Cooking Item]] events with an unconfirmed unit switch, high intra-SKU variance, no vending coverage, and incorrect readings even after a five-second stabilization pause. Manual scale capture replaces it as the active MVP measurement path; the arm may become a later calibration source only after a longer-term improvement.
2. Manual packed-item measurement now feeds the leading fit direction: approved weight/dimension profiles → Zipline Pack → `total_deliveries == 1`. The earlier validated-configuration allowlist remains fallback design evidence. See [[zipline-pack-as-eligibility-oracle-direction-2026-08-20]].
3. Pure item counts are insufficient as an affirmative fallback. [[drone-fit-exclusion-test-and-container-count-limits-2026-08-12|Drone Fit Exclusion Test and Container Count Limits (2026-08-12)]] showed that a single heavy or oversized item can pass a count threshold. Count may remain an additional rejection guard, but allowing it to approve uncovered Carts would create a second Wonder-owned fit authority outside Pack.

### Candidate Weight Solutions (for discussion)

#### A. Manual validation-pass weighing (active direction)

Fold weighing into the physical validation/measurement pass: weigh the finished packed item on a standalone scale, retain the order-linked photo as evidence, and publish a conservative approved profile after review. At quote time, mass = sum of per-line approved weights + bag tare; reject above 2,495 g. Rob's 2026-08-20 Midtown East session is the first operational batch of this path.

- Collection volume equals validation volume (350 to 500 configurations), done in the same sessions as fit validation. No separate campaign, no new pipeline, no Robotic Arm dependency.
- Deliberately conservative: overstating mass is safe for flight planning; understating is the dangerous direction.
- Robotic Arm data, if it stabilizes later, becomes a calibration or replacement source without blocking MVP.

#### B. Item-count fallback (under discussion, not an equivalent authority)

Map unit count to a conservative constant mass (for example, K units multiplied by a worst-case per-unit bound). The constant must still come from physical evidence, and the rule cannot safely infer dimensions. If it is used only to reject obviously large uncovered carts, it can coexist with Pack. If it independently approves carts without measurements, it undermines the Pack-as-oracle direction and reintroduces Wonder-owned fit logic.

#### Current ordering

Manual approved measurement profiles plus Pack are the leading path. The open question is not whether count is an equal primary algorithm, but whether it survives as a conservative rejection-only guard or is dropped in favor of fail-closed missing-data behavior.

### Decision Timeline

- 2026-08-20: Midtown East visit completed. Rob confirmed the arm is out of MVP scope and began manual scale capture.
- Early week of 2026-08-24: expected focus on missing-data fallback and additional top-item weight/dimension collection.
- Rob committed to working closely with Jay on this in the coming days. A reply to Rob aligning on the discrete direction is drafted but intentionally deferred.

### Open Questions

1. What measurement convention defines the approved packed-item profile: exact configuration, maximal/heaviest build, or another conservative item-level bound?
2. Where do raw photo observations live, and does Cookbook own the reviewed/versioned measurement profile?
3. What mass does the quote send for orders containing items without an approved measurement record? The safest default remains fail closed.
4. How is Medium-bag tare represented in Pack and Quote mass?
5. Does Product accept the conservatism margin (overstated mass reduces drone eligibility at the margin)?

## Sources
- s1 · [[Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Slack Update - Robotic Arm Weight Data Status and Discrete Pivot - 2026-08-17]] · @pin · source
- s2 · [[zipline-sandbox-quote-mass-gating-contract]] · @pin · record
- s3 · [[Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Archive/Eligibility and Architecture/1P Drone Delivery MVP Dimensions Eligibility Proposal (2026-08-12)]] · @pin · source
- s4 · [[robotic-arm-item-weight-cooking-item-mapping-2026-08-18]] · @pin · record
- s5 · [[robot-issues]] · @pin · source · 1.x entity page `entities/robot-issues.md`
- s6 · [[Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Confluence Comment - Item Count as Primary MVP - 2026-08-18]] · @pin · source
- s7 · [[zipline-pack-as-eligibility-oracle-direction-2026-08-20]] · @pin · record
- s8 · human:rob-knudson · stated:2026-08-20 · attestation · Slack DM thread to Jay Nan, 22:21-22:25 ET: the Robotic Arm remains inconsistent even with a five-second pause and is out of MVP scope; manual scale capture of packed items began at Midtown East
- s9 · <local-download>/weight_capture_data.md · unverified · source · local download, as written; the extracted Markdown table of 88 photo-backed weight observations
- s10 · [[1p-drone-delivery-weight-and-dimension-eligibility-current-proposal-2026-08-31]] · @pin · record
- s11 · [[drone-checkout-cart-profile-identity-and-container-schema-2026-08-31]] · @pin · record

## History
- 2026-09-01 · verified by process:cook
- 2026-09-01 · revised by process:cook · MVP identity correction
- 2026-08-20 · revised by process:cook · Follow-up (2026-08-20, Midtown East visit and manual capture)
- 2026-08-19 · revised by process:cook · Follow-up (2026-08-19, proposal)
- 2026-08-18 · revised by process:cook · Follow-up (2026-08-18, warehouse verification)
- 2026-08-18 · revised by process:cook · Follow-up (2026-08-18, Confluence)
- 2026-08-18 · revised by process:cook · Later finding — 2026-08-18

## Related
- [[robotic-arm-item-weight-cooking-item-mapping-2026-08-18|Robotic Arm ITEM_WEIGHT Cooking-Item Mapping (2026-08-18)]]
- [[robot-issues|robot_issues]]
- [[cooking-item|Cooking Item]]
- [[vending-items|Vending Items]]
- [[Slack Update - Robotic Arm Weight Data Status and Discrete Pivot - 2026-08-17]]
- [[Confluence Comment - Item Count as Primary MVP - 2026-08-18]]
- [[1P Drone Delivery Phase 0 Eligibility Proposal (2026-08-18)]]
- [[1P Drone Delivery MVP Dimensions Eligibility Proposal (2026-08-12)]]
- [[zipline-sandbox-quote-mass-gating-contract|Zipline Sandbox Quote Mass Gating Contract]]
- [[packaging-signature-configuration-space-for-drone-eligibility-2026-08-13|Packaging Signature Configuration Space for Drone Eligibility (2026-08-13)]]
- [[drone-fit-exclusion-test-and-container-count-limits-2026-08-12|Drone Fit Exclusion Test and Container Count Limits (2026-08-12)]]
- [[1p-drone-delivery-weight-and-dimension-eligibility-current-proposal-2026-08-31|1P Drone Delivery Weight and Dimension Eligibility Current Proposal (2026-08-31)]]
- [[rob-knudson|Rob Knudson]]
- [[jordan-adelson|Jordan Adelson]]
