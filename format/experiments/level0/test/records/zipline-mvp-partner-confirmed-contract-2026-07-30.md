---
type: record
title: Zipline MVP Partner-Confirmed Contract
description: What Zipline confirmed on 2026-07-30 for the Wonder 1P MVP (Quote mass by lifecycle role, single-Zip package limits, custody transfer, drop-off constraint, Dropbox summon, advisory loading window, environment separation), refreshed through 2026-09-15 for the week-of-2026-09-07 payload envelope; commercial terms and pre-production access details are not covered.
date: 2026-07-30
kind: finding
tags:
  - api
  - drone-delivery
  - mvp
  - webhook
status: current
updated: 2026-09-15
updated_by: process:cook
verified: 2026-09-15
verified_by: process:cook
aliases:
  - Zipline Final Partner QA
  - Zipline Four P0 Answers
  - Zipline 四项 P0 最新确认
  - Payload Dimensions
  - Zipline 有效载荷尺寸
  - 338 254 205
---

# Zipline MVP Partner-Confirmed Contract (2026-07-30)

## Summary

Zipline answered the core partner questions for the Wonder 1P Drone Delivery MVP. A fulfillment-capable direct-order Quote requires valid mass before Delivery Intent creation, while a separate mass-optional RDP discovery Quote is allowed for serviceability and KOETA timing features and is never consumed by Intent. An approved standard package within the confirmed limits is a single-Zip package; `DELIVERY_INTENT_STATUS_IN_PROGRESS` confirms successful loading and custody transfer; the exact planned customer drop-off point is not exposed; Dropbox loading summons the Drone; and `loading_window` is advisory rather than an expiration deadline. Zipline can also provision a separate non-production Partner Site, although the concrete access package is still pending.

> [!important] Source precedence
> These 2026-07-30 partner answers supersede the assumption that a no-mass Quote can be used for direct-order fulfillment. Runtime validation and the confirmed Wonder RDP design refine the boundary: Create Quote accepts an omitted or `null` mass for non-binding discovery, but the resulting Quote must not be used for Delivery Intent. See [[zipline-discovery-vs-fulfillment-quote-mass-contract|Zipline Discovery vs Fulfillment Quote Mass Contract]].

Source: [Questions for Zipline - Wonder 1P Drone Delivery MVP](https://docs.google.com/document/d/1Ow6BDOCsKOY2UUTAYiWklPyMh40OigB_IMHgwwE9wyU/edit).

## Detail

### Confirmed Contract

| Area | Partner-confirmed answer | MVP contract |
| --- | --- | --- |
| Quote mass by lifecycle role | A Quote used for direct-order fulfillment requires valid package mass. Create Quote also accepts omitted or `null` mass for the earlier RDP discovery use case. | RDP may use a non-binding no-mass Quote for serviceability and KOETA timing features. Checkout/execution must obtain a fresh fulfillment-capable Quote with valid positive mass before Intent. |
| Single-Zip package | Maximum gross weight is `2495 g`; the 2026-07-30 dimensions were `338 mm L × 252 mm W × 205 mm H`. | One approved outer package within all four limits uses exactly one initial Zip. The current hardware envelope revises width to `254 mm`; see the week-of-2026-09-07 section below. Operational replacement after a failure is outside this guarantee. |
| Custody transfer | `DELIVERY_INTENT_STATUS_IN_PROGRESS` confirms successful P2 loading and transfer of custody to Zipline. | Persist this as the authoritative irreversible custody boundary and gate cancel, modify, address change, dining-option change, and original-package Reallocation. |
| Failed package disposition | After Dropbox lock, Wonder cannot access the package. A failed delivery is taken near a Zipline charging site and a Zipline employee is notified to discard it. | The original food never returns to Wonder. Customer recovery is refund, remake, or a new delivery, not same-package Ground fallback. |
| Planned drop-off point | Zipline precomputes a safe delivery area and rejects Quote or Delivery Intent when none exists, but does not currently expose the exact selected location. | Consumer, Dispatch, and CX must not promise exact pre-delivery coordinates; the package may arrive in the front or back yard within the safe property area. |
| Dropbox summon trigger | Completing the Dropbox load summons the Drone. | Wonder does not call a separate Drone-summon operation. |
| Loading-window semantics | Missing `loading_window.end` has no automatic consequence; the window is advisory. | Do not expire the workflow or create a replacement Intent solely because the suggested time passed. |
| Environment separation | Zipline can provide a pre-production URL, and production and non-production use different Partner Sites. | Configure base URL, credentials, and `partner_site_id` per environment; do not reuse identifiers across UAT and Production. |
| API documentation authority | The current ReadMe is the latest version shared with Wonder, but its package-return language is known to be incorrect. | Dated direct Zipline answers override the incorrect return-to-partner statement. No separate versioned OpenAPI specification or change log was provided in this response. |

### Eligibility Service Impact

The Checkout and execution portions of [[1p-drone-delivery-eligibility-evaluation-trigger-and-revalidation-contract-2026-07-16|1P Drone Delivery Eligibility Evaluation Trigger and Revalidation Contract (2026-07-16)]] must use a mass-bearing provider request before Delivery Intent. The earlier RDP discovery portion may call Quote without mass because no items exist yet, but that result covers serviceability and timing only. A missing or low-confidence package profile prevents a later fulfillment-capable evaluation; it does not invalidate the RDP discovery request.

The deterministic Wonder package rule is the week-of-2026-09-07 hardware envelope, with mass still from the 2026-07-30 partner QA:

```text
gross_mass_g <= 2495
length_mm <= 338
width_mm <= 254
height_mm <= 205
approved_outer_package = true
```

Passing this rule establishes single-Zip package eligibility for the initial delivery. The MVP does not need Zipline Pack merely to prove one-Zip capacity. Delivery Intent may still assert `expected_number_of_deliveries == 1` as a defensive provider-contract invariant.

### Delivery Lifecycle Impact

The normalized lifecycle now has a confirmed custody point:

```text
Intent opened
→ package prepared and loaded
→ DELIVERY_INTENT_STATUS_IN_PROGRESS
→ custody transferred irreversibly to Zipline
→ delivered, or failed and discarded near a charging site
```

Pre-custody loading failure may retain the original package and use Ground Reallocation. Post-custody failure requires customer recovery and a new physical fulfillment attempt. See [[zipline-dropbox-lock-custody-and-failure-disposition-contract-2026-07-28]] and [[oms-cancellation-and-delivery-reallocation-control-gaps-for-drone-mvp-2026-07-27|OMS Cancellation and Delivery Reallocation Control Gaps for Drone MVP (2026-07-27)]].

### Consumer And PRD Impact

A successful provider response confirms that a safe delivery area exists but does not provide a customer-displayable exact drop-off coordinate. MVP PPX, tracking, CX guidance, and safety copy need a product-approved location limitation instead of an API-field mapping.

This constraint refines [[1p-drone-delivery-consumer-mvp-product-requirements-review-2026-07-17|1P Drone Delivery Consumer MVP Product Requirements Review (2026-07-17)]] and the overall [[drone-delivery-integration-strategy|Drone Delivery Integration Strategy]].

### Remaining Precision Questions

- Which terminal semantics apply to `DELIVERY_STATUS_CANCELED`, and may Wonder use it for the same recovery workflow as `DELIVERY_STATUS_FAILED`?
- Is Customer Support review a required manual gate before remake/reship, or an operational recommendation?
- What product copy is approved when exact planned drop-off coordinates are unavailable?
- When will Zipline deliver the pre-production URL, credentials, non-production `partner_site_id`, and webhook simulation mechanism?
- What exact `grant_type` and `scope` values should Wonder use for Create Token?

### Canonical Dual-Unit Package Limits (2026-07-30)

The provider-confirmed Single-Zip package envelope should be recorded and communicated in both unit systems:

| Limit | Metric contract value | Imperial conversion |
| --- | ---: | ---: |
| Gross package weight | `2495 g` | `5.50 lb` |
| Maximum length | `338 mm` | `13.31 in` |
| Maximum width | `252 mm` | `9.92 in` |
| Maximum height | `205 mm` | `8.07 in` |

The canonical eligibility comparison remains the exact provider values in grams and millimeters. Imperial values are rounded display and planning equivalents.

The earlier `12.5 in × 9.5 in × 7.75 in` value is a superseded PRD loader reference, not a current maximum package envelope. It equals `317.5 × 241.3 × 196.85 mm`. As of PRD v16 (2026-08-11), the [Weight and Dimension Eligibility PRD](https://wonder.atlassian.net/wiki/spaces/~712020f40ba91c0864455e9792d8f51b9f008d/pages/5462392836/PRD+Weight+and+Dimension+Eligibility+for+1P+Drone+Delivery) itself struck through the `12.5` value and adopted `13.31 × 9.92 × 8.07 in`, matching the 2026-07-30 partner answer. That July envelope is now itself historical for width. See [[1p-drone-delivery-checkout-package-dimensions-contract-2026-07-16|1P Drone Delivery Checkout Package Dimensions Contract (2026-07-16)]].

### Current Payload Envelope (Week of 2026-09-07)

Jay supplied a Zipline **Payload Dimensions** slide dated week of 2026-09-07. This is the current hardware envelope for eligibility comparison. Source: [[Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Zipline Payload Dimensions Slide - Week of 2026-09-07]].

| Limit | Slide metric | Slide imperial | 2026-07-30 partner QA |
| --- | ---: | ---: | ---: |
| Gross package weight | not shown | not shown | `2495 g / 5.50 lb` |
| Maximum length | `338 mm` | `13.25 in` | `338 mm / 13.31 in` |
| Maximum width | `254 mm` | `10 in` | `252 mm / 9.92 in` |
| Maximum height | `205 mm` | `8 in` | `205 mm / 8.07 in` |

Width is the only metric change: `252 mm` → `254 mm`. Length and height stay `338 mm` and `205 mm`. The slide's imperial labels (`13.25 × 10 × 8 in`) are its own rounded pairings, not a second physical limit. Mass remains `2495 g` because this slide does not replace the 2026-07-30 weight answer.

The current eligibility comparison is:

```text
gross_mass_g <= 2495
length_mm <= 338
width_mm <= 254
height_mm <= 205
```

### Dropbox Trigger and Advisory Loading Window (2026-08-03)

[[zipline-dropbox-loading-window-contract]] adds two partner-confirmed execution rules:

- Successful Dropbox loading is itself the Drone-summon trigger.
- `loading_window` is planning guidance, not an Intent-expiration or cancellation deadline.

Delayed kitchen preparation therefore continues with the existing Zipline workflow when the package becomes ready. The MVP does not need replacement-Intent, PIN-rotation, retry, re-Quote, or reschedule logic solely for a loading-window miss. Separate provider cancellation, station rejection, downtime, or load failure still follow their own recovery contracts.

### Pre-Production And Documentation Readiness (2026-08-04)

[[zipline-pre-production-access-and-api-documentation-contract|Zipline Pre-Production Access and API Documentation Contract]] separates two states that must not be conflated:

- **Capability confirmed:** Zipline can provision pre-production, with a Partner Site distinct from Production.
- **Engineering access pending:** Wonder still needs the actual URL, credentials, non-production `partner_site_id`, token parameters, and webhook simulation mechanism.

The same answer establishes that the current ReadMe is the latest documentation shared with Wonder while confirming that its failed-package return wording is wrong. The direct partner custody and disposal answers remain authoritative for the MVP.

## Sources
- s1 · https://docs.google.com/document/d/1Ow6BDOCsKOY2UUTAYiWklPyMh40OigB_IMHgwwE9wyU/edit · fetched:2026-07-30 · source · no-snapshot · Questions for Zipline - Wonder 1P Drone Delivery MVP
- s2 · [[Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Zipline Google Doc Alignment Responses - Pre-Production and API Documentation - 2026-08-04]] · @pin · source
- s3 · [[Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Zipline Slack Clarification - Dropbox Loading Window and Drone Summon - 2026-08-03]] · @pin · source
- s4 · [[zipline-discovery-vs-fulfillment-quote-mass-contract]] · @pin · record
- s5 · human:jay · stated:2026-08-27 · attestation · Conversation alignment: Create Quote accepts omitted or null mass for non-binding RDP discovery, but that Quote must not be used for Delivery Intent
- s6 · [[Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Zipline Payload Dimensions Slide - Week of 2026-09-07]] · @pin · source

## History
- 2026-09-15 · verified by process:cook
- 2026-09-15 · revised by process:cook · Current Payload Envelope (Week of 2026-09-07)
- 2026-08-04 · revised by process:cook · Pre-Production And Documentation Readiness
- 2026-08-03 · revised by process:cook · Dropbox Trigger and Advisory Loading Window
- 2026-07-30 · revised by process:cook · Canonical Dual-Unit Package Limits
