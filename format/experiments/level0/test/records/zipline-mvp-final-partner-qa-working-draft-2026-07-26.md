---
type: record
title: Zipline MVP Final Partner QA - Working Draft
description: The four P0 questions Wonder put to Zipline for the 1P Drone Delivery MVP as drafted on 2026-07-26, with the 2026-07-30 partner answers noted; the durable confirmed contract lives in the superseding page, not here.
date: 2026-07-26
kind: finding
tags:
  - api
  - drone-delivery
  - mvp
status: superseded
superseded_by:
  - "[[zipline-mvp-partner-confirmed-contract-2026-07-30]]"
updated: 2026-09-03
updated_by: process:cook
verified: 2026-08-12
verified_by: process:cook
aliases:
  - Zipline Final QA Working Draft
---

# Zipline MVP Final Partner QA - Working Draft (2026-07-26)

## Summary

This page was the working source of truth for the four MVP-blocking (P0) questions in the Zipline partner QA as of 2026-07-26. The questions asked whether `mass_grams` is required for Wonder direct-order Quotes, whether an approved standard package guarantees one Zip per Wonder order, which API event marks Dropbox lock and which terminal event starts customer recovery, and which location Wonder should display as the planned customer drop-off point. Partner answers were received on 2026-07-30; [[zipline-mvp-partner-confirmed-contract-2026-07-30]] is the current durable contract and supersedes the unanswered wording here.

## Detail

### Confirmed Questions

#### [P0] 1. Is `mass_grams` required for Wonder direct-order Quotes?

The schema marks it optional while Status Codes includes `QUOTE_MASS_REQUIRED`. Please confirm whether a no-mass Quote can later create a Delivery Intent.

#### [P0] 2. Can an approved standard package guarantee one Zip per Wonder order?

Please confirm the approved gross-weight and outer-dimension limits and whether an order inside them is guaranteed one Zip. Operational replacement attempts are outside this guarantee; MVP does not assume Pack API use.

#### [P0] 3. Which API event marks Dropbox lock, and which terminal event starts customer recovery?

Rob confirmed that after lock the original package is either delivered or taken to the Zipline charging station for disposal and never returns to Wonder. Please confirm whether `DELIVERY_INTENT_STATUS_IN_PROGRESS` is the authoritative lock/custody signal. When do `DELIVERY_STATUS_FAILED` and `DELIVERY_STATUS_CANCELED` fire, and which terminal event may Wonder use to begin refund, remake, or a new delivery?

> [!success] Operational outcome confirmed
> Package return location is no longer open. The remaining P0 gap is the machine-readable custody and terminal-event contract.

#### [P0] 4. Which location should Wonder display as the planned customer drop-off point?

Which API field provides the final Zipline-selected location before delivery? Is `recipient.address.location` the actual drop-off point or only the submitted customer address? `deliveries[].zip_location` appears to be in-transit telemetry.

### Partner Answers Received (2026-07-30)

The four P0 questions now have partner answers. [[zipline-mvp-partner-confirmed-contract-2026-07-30]] is the current durable contract and supersedes the unanswered wording above.

- Direct-order Quote requires `mass_grams`; a no-mass Wonder Quote is not supported.
- One approved outer package at or below `2495 g` and `338 × 252 × 205 mm` is guaranteed to use one initial Zip rather than capacity-based multiple Drone deliveries.
- `DELIVERY_INTENT_STATUS_IN_PROGRESS` authoritatively confirms successful loading and irreversible custody transfer.
- After custody, a failed package is discarded near a Zipline charging site and never returns to Wonder.
- Zipline validates that a safe delivery area exists but does not currently expose the exact planned drop-off location in the API.

Remaining follow-up is limited to canceled-event recovery semantics, the manual Customer Support gate, and approved Consumer copy for the location limitation.

## Sources
- s1 · [[Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Zipline API Doc/Create Quote]] · @pin · source
- s2 · [[Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Zipline API Doc/Create Delivery Intent]] · @pin · source
- s3 · [[Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Zipline Platform Reference/Status Codes]] · @pin · source
- s4 · [[Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Zipline API Doc/Webhooks]] · @pin · source
- s5 · human:rob-knudson · stated:2026-07-28 · attestation · Slack clarification to Norbert Xie, shared by Jay Jiang: after Dropbox lock the original package is either delivered or taken to the Zipline charging station for disposal and never returns to Wonder
- s6 · [[zipline-dropbox-lock-custody-and-failure-disposition-contract-2026-07-28]] · @pin · record

## History
- 2026-08-12 · verified by process:cook
- 2026-07-30 · revised by process:cook · Partner Answers Received

## Related
- [[zipline-dropbox-lock-custody-and-failure-disposition-contract-2026-07-28]]
- [[oms-cancellation-and-delivery-reallocation-control-gaps-for-drone-mvp-2026-07-27|OMS Cancellation and Delivery Reallocation Control Gaps for Drone MVP (2026-07-27)]]
- [[zipline-drone-dropoff-status-and-fallback-contract-gaps-2026-07-02|Zipline Drone Dropoff Status and Fallback Contract Gaps (2026-07-02)]]
- [[zipline|Zipline]]
