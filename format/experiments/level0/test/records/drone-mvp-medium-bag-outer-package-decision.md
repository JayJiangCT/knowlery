---
type: record
title: Drone MVP Medium Bag Outer Package Decision (2026-08-12)
description: Which Wonder outer bag the 1P Drone Delivery MVP uses, from the 2026-08-12 IKC Ops Medium-bag direction to PRD v26's validated new 12 x 8.5 x 13 in Medium as of 2026-10-19; the bag SKU, tare, tested fill/fold limits and the Zipline test report are not covered.
date: 2026-08-12
kind: decision
tags:
  - architecture
  - drone-delivery
  - mvp
status: current
updated: 2026-10-19
updated_by: process:cook
verified: 2026-10-19
verified_by: process:cook
aliases:
  - Drone MVP Medium Bag Decision
  - Drone Delivery Envelope Bag Choice
  - Approved Outer Package Medium Bag
  - 无人机 MVP Medium 袋外包装选择
---

# Drone MVP Medium Bag Outer Package Decision (2026-08-12)

## Summary

The MVP default is the **new Medium Wonder bag, 12 × 8.5 × 13 in**, per PRD v26. Small may be used at IKC staff discretion when a specific order can safely be packed smaller; Large must not be used for Drone delivery.

Validation of the bag does not approve every cart. The PRD still requires item-level weight and dimensions to be submitted to Zipline Pack for order-specific evaluation. It does not specify the bag SKU, tare, tested fill/fold limits, or partner-site configuration. KDS/KOM remains an operational instruction surface rather than the physical fit authority.

This is a Wonder-side outer-package choice. It does not change the Zipline provider envelope, now `338 × 254 × 205 mm / 2495 g` in [[zipline-mvp-partner-confirmed-contract-2026-07-30]].

## Detail

> [!important] Current status (2026-10-19)
> Rob Knudson's [Weight and Dimension Eligibility PRD](https://wonder.atlassian.net/wiki/spaces/~712020f40ba91c0864455e9792d8f51b9f008d/pages/5462392836/PRD+Weight+and+Dimension+Eligibility+for+1P+Drone+Delivery), version 26, reports that the **new Medium Wonder bag, 12 × 8.5 × 13 in**, has been validated by Zipline across multiple Wonder packaging configurations and is the default bag for MVP launch SOPs. Small is an IKC-staff operational fallback only; Large is out of scope. This supersedes the September 20 candidate-testing status. The source is Rob's PRD; a separate Zipline test report was not inspected in this update.

### What Changed

| Date | Claim | Status as of 2026-10-19 |
| --- | --- | --- |
| 2026-07-22 | Explore a standardized Wonder bag as an MVP simplification. | Still the family of options; now narrowed. |
| 2026-07-29 | Catalog comparison: Small is the closest candidate; Medium and Large are likely ineligible. | Superseded for **bag selection**. Keep as historical uncompressed-dimension analysis. |
| 2026-08-04 | Open choice between an existing Wonder bag and one drone-specific bag; Packaging to define fill line and folded height. | Drone-specific bag is no longer the preferred plan. Fill line and folded height remain open. |
| 2026-08-11 | Launch package still unconfirmed among existing bag, standardized existing bag, or new drone-specific bag. | Preferred plan is the existing Medium bag. |
| 2026-08-12 | IKC Ops / Stephen Acciaioli: use existing Medium bag because it fits the 3D printed Pod sample. | Historical working direction; not final approval. |
| 2026-09-20 | Rob: Stephen requested two new bag sizes, both expected to be slightly smaller than the Dropbox, for Zipline testing. | Historical candidate/testing status, superseded by PRD v26. |
| 2026-10-19 | PRD v26: new Medium, 12 × 8.5 × 13 in, validated by Zipline across multiple packaging configurations. | Current default launch bag; Small operational fallback only, Large out of scope. |

Sources: [[Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Slack Clarification - Drone MVP Medium Bag Selection - 2026-08-12|Slack thread captured 2026-08-12]], the September 20 comment listed in frontmatter, and Rob's PRD v26 (2026-10-19).

### Provider Envelope Versus Wonder Bag

Keep these two facts separate:

```text
Zipline envelope (current, week of 2026-09-07)
  338 × 254 × 205 mm
  2495 g
  one approved outer package → one initial Zip

Wonder outer package (PRD v26, 2026-10-19)
  new Medium: nominal 12 × 8.5 × 13 in
  Zipline validation reported for multiple packaging configurations
  loaded/folded dimensions are not specified by this nominal tuple
```

The August preference and September candidate-testing updates are historical. PRD v26 confirms the new Medium as the default bag; it does not announce a provider-envelope change or replace order-specific Pack evaluation.

### Historical Catalog Comparison Versus Pod Fit

The specifications below explain earlier decisions. They are not the new `12 × 8.5 × 13 in` Medium specification in PRD v26.

[[Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Order Delivery Bag Specifications (for Jay)|Order Delivery Bag Specifications]] records current Medium as `10.5" × 10.5" × 12"` (`267 × 267 × 305 mm`). Those uncompressed published dimensions exceed the envelope on width (`267 > 254`) and height (`305 > 205`). That is why [[1p-drone-delivery-checkout-package-dimensions-contract-2026-07-16|1P Drone Delivery Checkout Package Dimensions Contract (2026-07-16)]] said Medium was likely ineligible against the earlier loader reference.

The 2026-08-12 direction treats **packed-and-folded fit in the 3D printed Pod** as the selection evidence, not the uncompressed catalog size. Bags fold. Norbert's 2026-08-04 point still holds: width and depth are hard constraints, while height depends on fill, fold, and tape. See [[Wonder/Wonder Fulfillment/Sprints/2026/SP17/Agenda/Meeting Notes|Sprint 17 Bi-Weekly]].

> [!warning] Do not treat published Medium dimensions as the loaded envelope
> The nominal `12 × 8.5 × 13 in` bag size is not a loaded-envelope measurement. PRD v26 calls for item-level Pack inputs derived from packaging groups or approved fallback data; it does not instruct DES to submit the nominal bag tuple as a Pack item.

### Historical Medium Specifications and August Interpretation

The August sources used "existing Medium bag" without pinning a SKU. These historical specifications must not be substituted for the new PRD v26 dimensions:

| Spec | Dimensions | Handle |
| --- | --- | --- |
| Current Medium | `10.5" × 10.5" × 12"` (`267 × 267 × 305 mm`) | rope |
| August 2026 new Medium | `13" × 10" × 13"` (`330 × 254 × 330 mm`) | paper twist |

#### Jay's working interpretation (2026-08-20): mailed samples are the new August Medium

Jay's read of the timeline: Stephen replied on 2026-08-12, the new Medium spec deploys in August 2026, and mailing a soon-to-be-retired bag spec for a launch later in the year would waste the test. So the samples Stephen is sending to Zipline are most plausibly the **new August Medium**. This is an inference pending confirmation from Stephen or the Zipline test result, not a stated fact.

Geometry supports the interpretation. Against the current `338 × 254 × 205 mm` envelope:

| Axis | Envelope | New Medium | Delta |
| --- | --- | --- | --- |
| Length | 338 mm | 330 mm | 8 mm margin |
| Width | 254 mm | 254 mm | exact match |
| Height | 205 mm | 330 mm | 125 mm over (resolved by fill-and-fold) |

The new Medium footprint (`330 × 254`) now matches envelope width exactly, with 8 mm of length margin, so in practice only height exceeds, and height is the foldable axis. Against the earlier 2026-07-30 envelope (`338 × 252 × 205 mm`) the same bag was 2 mm over on width. The current Medium is worse: its `267 × 267` square base exceeds envelope width by 13 mm on one axis in every orientation. The paper twist handle also flattens more easily than the rope handle, which matters because PRD v16 flags handles as a potential ineligibility factor.

Two distinct test objects should not be conflated:

1. The completed IKC Ops Pod-fit check ("fits nicely") most likely used bags on hand at IKC, which on 2026-08-12 would still be the current Medium.
2. The samples mailed to Zipline, per Jay's interpretation the new Medium, are what the formal endorsement will attach to.

If the interpretation holds, the approved filled/folded profile and any Pack API item dimensions should be built on new-Medium numbers, and the launch risk inverts: instead of "re-test if production switches," the requirement becomes "IKC must have new-spec Medium bags in stock at launch."

### Eligibility And KDS Implications

- The default launch SOP uses the **new Medium, 12 × 8.5 × 13 in**, per PRD v26. Small is an operational fallback at IKC staff discretion; Large is out of scope. The PRD does not identify the new Medium's SKU.
- A fixed bag removes the need for [[kds-bag-recommendation-feature-and-algorithm-2026-07-22|KDS]] to select Small, Medium, or Large for Drone eligibility. Its Medium Bin capacity of `15` remains calibrated to ordinary bagging, not the folded Pod profile, and is not physical fit proof.
- The operational role proposed for KDS/KOM is to make the default Medium instruction and any allowed Small-bag exception clear to IKC staff; implementation and rollout are not established by bag validation.
- The leading 2026-08-20 direction places the fit decision with Zipline Pack using approved packed-item weight/dimension profiles; the Eligibility Service orchestrates the request. The earlier configuration allowlist is fallback design evidence. See [[zipline-pack-as-eligibility-oracle-direction-2026-08-20]].
- PRD v26 retains item-level Pack objects derived from packaging-group dimensions and max weights, with special groups and fallback data where needed. It does not document how the partner-site configuration accounts for the outer bag.
- Checkout and Runner still must not diverge: eligibility assumptions must match the bag, fill, fold, orientation, and closure used by IKC staff. Validation of the new Medium is reported; the detailed tested packing limits are not included in PRD v26.
- Rigid-container exclusion against the **provider envelope** in [[drone-fit-exclusion-test-and-container-count-limits-2026-08-12|Drone Fit Exclusion Test and Container Count Limits (2026-08-12)]] remains valid. A 16×16 in pizza box still cannot enter the Pod, regardless of bag type.

See [[drone-package-recommendation-ownership-and-kds-boundary|Drone Package Recommendation Ownership and KDS Boundary]].

### Not Confirmed

- Separate Zipline test evidence identifying the tested configurations and limits; PRD v26 reports new-Medium validation but does not include the test report or establish the outcome for both September candidates.
- Maximum fill line, folded height, allowed orientation, or handle/closure treatment.
- The SKU corresponding to the new 12 × 8.5 × 13 in Medium, its empty-bag tare, and the mapping to the September candidates.
- A signed physical profile that Checkout can compare in millimeters.
- KDS/KOM implementation and rollout for the one-Medium-bag Runner instruction.
- That uncompressed Medium catalog dimensions fit the Zipline envelope.

## Sources
- s1 · https://wonder.atlassian.net/wiki/spaces/~712020f40ba91c0864455e9792d8f51b9f008d/pages/5462392836/PRD+Weight+and+Dimension+Eligibility+for+1P+Drone+Delivery · fetched:2026-10-19 · source · no-snapshot · Weight and Dimension Eligibility PRD, v26 as read on 2026-10-19
- s2 · [[Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Slack Clarification - Drone MVP Medium Bag Selection - 2026-08-12]] · @pin · source
- s3 · [[Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Order Delivery Bag Specifications (for Jay)]] · @pin · source
- s4 · [[Wonder/Wonder Fulfillment/Sprints/2026/SP17/Agenda/Meeting Notes]] · @pin · source
- s5 · [[1p-drone-delivery-checkout-package-dimensions-contract-2026-07-16]] · @pin · record
- s6 · [[drone-package-recommendation-ownership-and-kds-boundary]] · @pin · record
- s7 · [[zipline-mvp-partner-confirmed-contract-2026-07-30]] · @pin · record
- s8 · [[Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Zipline Payload Dimensions Slide - Week of 2026-09-07]] · @pin · source
- s9 · https://wonder.atlassian.net/wiki/spaces/~712020f40ba91c0864455e9792d8f51b9f008d/pages/5462392836/PRD+Weight+and+Dimension+Eligibility+for+1P+Drone+Delivery?focusedCommentId=5580029984 · fetched:2026-09-20 · source · no-snapshot · the September 20 PRD comment: Stephen requested two new bag sizes, slightly smaller than the Dropbox, for Zipline testing
- s10 · human:rob-knudson · stated:2026-08-13 · attestation · Slack follow-up screenshot on the Medium bag selection, supplied by Jay; the page does not isolate what this follow-up added
- s11 · human:stephen-acciaioli · stated:2026-08-20 · attestation · Slack thread screenshot (Jay Nan, Rob Knudson, Stephen Acciaioli) supplied by Jay: Stephen is sending bag samples to Zipline for testing
- s12 · human:jay · stated:2026-08-20 · attestation · SKU interpretation: the samples mailed to Zipline are most plausibly the new August Medium (13 × 10 × 13 in, paper twist handle), an inference pending confirmation
- s13 · [[zipline-pack-as-eligibility-oracle-direction-2026-08-20]] · @pin · record
- s14 · https://wonder.atlassian.net/wiki/spaces/~5f811730e31b69006feed38a/pages/5706907865/Drone+Eligibility+Check+-+MVP+Plan?focusedCommentId=5707792556 · fetched:2026-08-12 · source · no-snapshot · Drone Eligibility Check - MVP Plan comment

## History
- 2026-10-19 · verified by process:cook
- 2026-10-19 · revised by process:cook · Current status (2026-10-19)
- 2026-08-20 · revised by process:cook · Jay's working interpretation (2026-08-20)

## Related
- [[1p-drone-delivery-checkout-package-dimensions-contract-2026-07-16|1P Drone Delivery Checkout Package Dimensions Contract (2026-07-16)]]
- [[drone-package-recommendation-ownership-and-kds-boundary]]
- [[zipline-mvp-partner-confirmed-contract-2026-07-30]]
- [[kds-pre-order-bag-recommendation-feasibility-2026-07-16|KDS Pre-Order Bag Recommendation Feasibility (2026-07-16)]]
- [[order-packaging-geometry-feasibility-for-drone-dimension-eligibility-2026-08-12|Order Packaging Geometry Feasibility for Drone Dimension Eligibility (2026-08-12)]]
- [[ikc|IKC]]
- [[rob-knudson|Rob Knudson]]
