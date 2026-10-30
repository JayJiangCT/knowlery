---
type: record
title: Zipline Dropbox Lock Custody and Failure Disposition Contract (2026-07-28)
description: What happens to a Wonder package after the Zipline P2 Dropbox locks, as confirmed on 2026-07-28 and refined through 2026-10-19 (IN_PROGRESS as the authoritative custody event, failed-package disposal at a Zipline charging site, best-effort cancellation, no cancellation reason exposed); the physical effect of an in-flight cancellation and the DELIVERY_STATUS_FAILED reason contract remain unconfirmed.
date: 2026-07-28
kind: finding
tags:
  - delivery-service
  - drone-delivery
  - mvp
  - webhook
status: current
updated: 2026-10-19
updated_by: process:cook
verified: 2026-10-19
verified_by: process:cook
aliases:
  - Zipline Dropbox Lock Contract
  - Drone Post-Custody Failure Recovery
---

# Zipline Dropbox Lock Custody and Failure Disposition Contract (2026-07-28)

## Summary

This page records the confirmed irreversible P2 custody contract for Wonder 1P Drone Delivery, with `DELIVERY_INTENT_STATUS_IN_PROGRESS` as the authoritative transfer event and failed-package disposal at a Zipline charging site. Rob Knudson confirmed after a live call with Zipline that locking the P2 Dropbox is irreversible for the original package: after lock, the package is either delivered to the customer or, on cancellation, failure, or another non-happy path, taken to a Zipline charging station for disposal. The package is never returned to Wonder or placed back in the Dropbox, so the Zipline API wording that a failed delivery is returned to the Partner is misleading for Wonder operations. Dropbox locked means the original package has left Wonder recovery control; Wonder must not promise that cancellation will stop execution or that Reallocation will reuse the original food.

## Detail

### SP22 Cancellation Follow-up — Compiled 2026-10-13

Rob reiterated that post-Dropbox packages cannot return to IKC and will ask Zipline whether an in-flight cancellation sends the package to a charging station. Preserve the earlier confirmed failed-package disposal contract; a failed delivery is not the same as a successfully canceled active execution. The physical effect of cancellation and Amy’s proposed post-custody Cancel Order cutoff remain unconfirmed. Source: [[Wonder/Wonder Fulfillment/Sprints/2026/SP22/Agenda/Meeting Notes|SP22 Meeting Notes]]. See [[sp22-bi-weekly-outcomes-2026-10-13|SP22 outcomes]] for pending owners and evidence boundaries. Jay confirmed the meeting date as October 13, 2026.

### Confirmed Contract

Rob Knudson confirmed after a live call with [[zipline|Zipline]] that locking the P2 Dropbox is irreversible for the original package. After lock, only two physical outcomes remain:

1. Successful delivery to the customer.
2. Cancellation, failure, or another non-happy path sends the package to a Zipline charging station for disposal.

The package is never returned to [[Wonder]] or placed back in the Dropbox. The Zipline API wording that a failed delivery is returned to the Partner is therefore misleading for Wonder operations.

> [!important] MVP custody rule
> Dropbox locked means the original package has left Wonder recovery control. Wonder must not promise that cancellation will stop execution or that Reallocation will reuse the original food.

### Operational State Contract

| Phase | Physical control | Allowed Wonder recovery |
| --- | --- | --- |
| Before successful lock | IKC staff controls the package | Correct the load, retain the package, safely cancel the Intent, or manually Reallocate to Ground with a Drone-specific reason |
| Locked / post-custody | Zipline controls the package irreversibly | Block ordinary cancel, modify, address change, dining-option change, and original-package Reallocation |
| Delivered | Customer received the package | Normal completion |
| Non-happy terminal outcome | Zipline takes the package to its charging station and discards it | Approved refund, remake, or new-delivery recovery; never same-package Ground fallback |

### MVP User Story Impact

- IKC staff may use Drone-specific Ground Reallocation only while they still control the package before lock.
- CCP/CX agents must see the post-custody state and cannot select actions implying recall, return, modification, or reassignment of the original package.
- Delivery must persist an authoritative custody state and enforce server-side guards rather than rely only on OMS status.
- Consumer post-lock messaging must describe customer recovery without promising physical recall.
- Operations treats a failed post-lock order as refund/remake/new-delivery recovery, not original-package fallback.

### MVP SOP Impact

1. **Pre-lock loading failure:** retain the package, select a Drone-specific reason, safely cancel the Intent, and initiate Ground Reallocation.
2. **Lock confirmation:** persist the custody time/status and disable incompatible actions across CCP, OMS, Dispatch Portal, and Delivery.
3. **Post-lock cancellation request:** do not promise recall; route to the approved CX/refund policy while preserving provider execution state.
4. **Post-lock failed/canceled event:** treat the package as unrecoverable and start refund/remake/new delivery only through the approved recovery flow.
5. **Audit:** retain provider event, reason, custody time, recovery action, and replacement linkage to prevent double fulfillment.

### Remaining P0 API Contract

- Which API status/event is the authoritative Dropbox-lock and custody-transfer signal?
- Does `DELIVERY_INTENT_STATUS_IN_PROGRESS` exactly represent that boundary?
- When do `DELIVERY_STATUS_FAILED` and `DELIVERY_STATUS_CANCELED` fire?
- Which terminal event may Wonder use to begin customer recovery?

### MVP Acceptance Criteria

- One server-side custody state gates cancel, modify, address change, dining-option change, and Reallocation.
- Pre-lock Ground fallback and post-lock customer recovery use separate workflows and reason taxonomies.
- A replacement delivery cannot create parallel fulfillment for the original package.
- IKC, Dispatch, CCP/CX, OMS, Delivery, Consumer, Payments, and Support SOPs share the same lock boundary.

### PRD V6 Failure Scenario Matrix (2026-07-29)

Rob Knudson PRD V6 independently codifies the custody split and expands it into named recovery scenarios. Source: [PRD: 1P Drone Delivery](https://wonder.atlassian.net/wiki/spaces/~712020f40ba91c0864455e9792d8f51b9f008d/pages/5415567391/PRD+1P+Drone+Delivery).

#### Pre-Dropbox / Wonder custody

- Delayed kitchen preparation: retry the Zipline Intent when supported; otherwise Reallocate to Ground through [[dispatch-portal|Dispatch Portal]]. Hold/retry behavior is still a provider question.
- Dropbox weight rejection: staff removes the retained package and Reallocates to Ground through the approved Dispatch or CX flow.
- Dropbox mechanical failure: staff retains the package and uses the same Ground recovery path.
- FIFO conflict: Operations needs queue-priority visibility and an SOP because a Station has one active slot.

#### Post-Dropbox / Zipline custody

- Failure after lock but before takeoff, mid-flight weather grounding, and delivery-zone obstruction all make the original food unrecoverable.
- The PRD recommends an urgent Zendesk ticket. CX confirms whether the customer still wants the order, then chooses remake plus a new Ground delivery or refund.
- Delivered-but-missing or damaged orders use the existing post-delivery CX path.

#### Terminology and metric correction

Automatic Ground fallback should describe only a recoverable pre-custody package or a safely terminated execution. Post-custody handling is customer recovery, not original-package fallback. The PRD target of 100% fallback success therefore needs separate definitions for pre-custody Reallocation success and post-custody customer-recovery completion. [[oms-cancellation-and-delivery-reallocation-control-gaps-for-drone-mvp-2026-07-27|OMS Cancellation and Delivery Reallocation Control Gaps for Drone MVP (2026-07-27)]] remains the implementation evidence for why one blended metric is unsafe.

### Partner-Confirmed API Boundary (2026-07-30)

Zipline confirmed that `DELIVERY_INTENT_STATUS_IN_PROGRESS` is the authoritative event that the P2 package was successfully loaded and custody transferred to Zipline. This closes the earlier open lock-event mapping. See [[zipline-mvp-partner-confirmed-contract-2026-07-30]].

After this event:

- Wonder cannot access or recover the original package.
- If `DELIVERY_STATUS_FAILED` occurs, the package is delivered near a Zipline charging site and a Zipline employee is notified to discard it.
- The package is not returned to Wonder.
- When Zipline is at fault, Zipline absorbs its delivery cost.
- Wonder follows Customer Support investigation and then uses remake/reship or another approved customer-recovery action.

The remaining contract precision is whether `DELIVERY_STATUS_CANCELED` is an equivalent terminal recovery signal and whether Customer Support review is a mandatory system gate or an operational recommendation.

### Dispatch Force State and Zipline Cancellation Contract (2026-07-31)

[[dispatch-portal|Dispatch Portal]] allows Operations to force a Delivery Job to `FAILED` or `COMPLETED`. These are Wonder-local operational decisions and must remain distinct from Zipline's provider execution state.

Zipline does expose:

```http
POST /v1/delivery_intents/{delivery_intent_id}/cancel
```

However, cancellation is best effort rather than guaranteed. The endpoint page documents a `200` response and a `422` validation response, while the shared status-code contract also defines:

- `409 INVALID_DELIVERY_INTENT_STATE_FOR_CANCELATION`
- `409 INVALID_DELIVERY_STATE_FOR_CANCELATION`

The API documentation does not define the exact P2 lifecycle states in which partner cancellation is accepted. A post-custody request may therefore succeed, be rejected because of the current state, time out, or have an ambiguous result.

#### Force Failed

When Ops selects Force Failed after custody transfer:

1. Wonder records the manually forced local failure with operator, reason, and time.
2. Delivery makes a best-effort Cancel Delivery Intent request.
3. A local `FAILED` Job or a submitted cancel request does not prove that Zipline stopped execution.
4. Wonder continues consuming and reconciling Zipline webhooks until the provider state is confirmed.

The provider cancellation state should be tracked separately as `REQUESTED`, `CONFIRMED`, `REJECTED`, or `UNKNOWN`. A `409`, timeout, or other failure must not be converted into cancellation success.

#### Force Completed

Force Completed is also a Wonder-local administrative override. It does not cancel the Zipline execution and, by itself, does not prove that the customer received the package. The action requires an audit reason, and provider webhooks should continue to be retained for reconciliation.

#### Webhook Confirmation

- `DELIVERY_INTENT_STATUS_CANCELED` confirms that the overall Delivery Intent was canceled by Zipline or the partner.
- `DELIVERY_STATUS_CANCELED` confirms only that one Delivery attempt was canceled. Zipline may create another Delivery under the same Intent.
- `DELIVERY_INTENT_STATUS_CLOSED` confirms that all Deliveries under the Intent have delivered or otherwise terminated.

Regardless of the cancellation result, `DELIVERY_INTENT_STATUS_IN_PROGRESS` remains the irreversible custody boundary. The original package cannot return to Wonder or be Reallocated to Ground; any post-custody non-happy path remains a customer-recovery workflow.

#### Cancellation Reason Exposure — Partner Confirmed 2026-10-19

Jason Hu confirmed that when Zipline sends a Delivery Intent cancellation signal, the webhook uses `DELIVERY_INTENT_STATUS_CANCELED`. Zipline currently does not expose a cancellation reason.

For MVP:

- treat the status as authoritative evidence that the Intent was canceled;
- map the provider cause to a generic provider-cancellation classification;
- do not infer weather, capacity, mechanical failure, operational action, or another specific cause;
- preserve a Wonder-originated cancellation reason separately when Wonder initiated the action; and
- retain the raw webhook, provider identifiers, and timestamps for reconciliation and Support investigation.

This answer closes the cancellation-reason question only. It does not establish whether `DELIVERY_STATUS_FAILED` includes a reason code or description. That failure-reason contract remains open. See [[zipline-drone-dropoff-status-and-fallback-contract-gaps-2026-07-02|Zipline Drone Dropoff Status and Fallback Contract Gaps]] and [[oms-cancellation-and-delivery-reallocation-control-gaps-for-drone-mvp-2026-07-27|OMS Cancellation and Delivery Reallocation Control Gaps]].

#### Remaining Partner Precision

- Which P2 states accept or reject Cancel Delivery Intent?
- Does a `200` mean synchronous cancellation or acceptance of a cancellation request?
- After post-custody cancellation, which sequence of Delivery and Intent webhooks is guaranteed?
- Does `DELIVERY_STATUS_FAILED` expose a stable machine-readable failure reason or any human-readable context?

### Current-Documentation Correction (2026-08-04)

Zipline confirmed that the ReadMe currently available to Wonder is its latest documentation, while also stating that the documented return-to-partner behavior is incorrect. This resolves the evidence precedence rather than changing the custody flow: the package never returns to Wonder after Dropbox lock, and the direct partner answer overrides the known ReadMe error. See [[zipline-pre-production-access-and-api-documentation-contract|Zipline Pre-Production Access and API Documentation Contract]].

## Sources
- s1 · [[Wonder/Wonder Fulfillment/Sprints/2026/SP22/Agenda/Meeting Notes]] · @pin · source
- s2 · human:rob-knudson · stated:2026-07-28 · attestation · Slack clarification to Norbert Xie, shared by Jay Jiang: locking the P2 Dropbox is irreversible; after lock the package is delivered or taken to a Zipline charging station for disposal and never returns to Wonder
- s3 · [[oms-cancellation-and-delivery-reallocation-control-gaps-for-drone-mvp-2026-07-27]] · @pin · record
- s4 · [[zipline-drone-dropoff-status-and-fallback-contract-gaps-2026-07-02]] · @pin · record
- s5 · [[Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Zipline API Doc/Cancel Delivery Intent]] · @pin · source
- s6 · [[Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Zipline Platform Reference/Status Codes]] · @pin · source
- s7 · [[Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Zipline API Doc/Webhooks]] · @pin · source
- s8 · [[Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Zipline Google Doc Alignment Responses - Pre-Production and API Documentation - 2026-08-04]] · @pin · source
- s9 · human:jay · stated:2026-07-31 · attestation · Conversation alignment: Dispatch Portal Force Failed / Force Completed are Wonder-local overrides distinct from Zipline execution state; cancellation is best effort
- s10 · https://docs.google.com/document/d/1Ow6BDOCsKOY2UUTAYiWklPyMh40OigB_IMHgwwE9wyU/edit?disco=AAACJFLk0N0 · fetched:2026-07-30 · source · no-snapshot

## History
- 2026-10-19 · verified by process:cook
- 2026-10-19 · revised by process:cook · Cancellation Reason Exposure — Partner Confirmed 2026-10-19
- 2026-10-13 · revised by process:cook · SP22 Cancellation Follow-up — Compiled 2026-10-13
- 2026-08-04 · revised by process:cook · Current-Documentation Correction
- 2026-07-31 · revised by process:cook · Dispatch Force State and Zipline Cancellation Contract
- 2026-07-30 · revised by process:cook · Partner-Confirmed API Boundary
- 2026-07-29 · revised by process:cook · PRD V6 Failure Scenario Matrix

## Related
- [[oms-cancellation-and-delivery-reallocation-control-gaps-for-drone-mvp-2026-07-27|OMS Cancellation and Delivery Reallocation Control Gaps for Drone MVP (2026-07-27)]]
- [[zipline-drone-dropoff-status-and-fallback-contract-gaps-2026-07-02|Zipline Drone Dropoff Status and Fallback Contract Gaps (2026-07-02)]]
- [[1p-drone-delivery-system-responsibility-boundaries-2026-07-15|1P Drone Delivery System Responsibility Boundaries (2026-07-15)]]
- [[1p-drone-delivery-consumer-mvp-product-requirements-review-2026-07-17|1P Drone Delivery Consumer MVP Product Requirements Review (2026-07-17)]]
- [[zipline-mvp-final-partner-qa-working-draft-2026-07-26]]
