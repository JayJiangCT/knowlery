---
type: entity
title: Skylark
description: Current Skylark API, payload and custody rules for the synthetic drone pilot as of 2026-08-20; does not cover pricing.
tags: [api, drone-delivery]
status: disputed
updated: 2026-08-20
updated_by: claude-code/claude-sonnet-5-5
verified: 2026-08-20
verified_by: human:test-owner
related: ["[[landing-pad]]"]
protected: ["^c2"]
---

# Skylark

## Current
Skylark is the fictional drone operator for the synthetic pilot.
- A single drone carries one order; payload width limit is 300 mm (src: s1, s2) ^c1
- After the landing pad locks, the parcel is delivered or returned to the depot; it never returns to the kitchen (src: s3) ^c2
- `payload_grams` is required on Quotes (src: s1) ^c3
- `FLIGHT_ACTIVE` is the custody signal (src: s1) #disputed ^c4

## Open
- Is `FLIGHT_ACTIVE` authoritative for custody ([[#^c4]]) or only telemetry? (src: s1) ^q1

## Sources
- s1 · [[sources/skylark-api-notes]] · sha256:55163f800987cc5afb039ca21fc766ed33a881845421450236fb3eca3c007ab8 · source
- s2 · [[skylark-pilot-readout-2026-08-15]] · sha256:589455465b1c9377cfe3265cfe72a2f2e06dceeb9dc1318dc9febfce8c932337 · record
- s3 · human:test-owner · stated:2026-08-10 · attestation · Parcel never returns to the kitchen after pad lock

## History
- 2026-08-20 · verified by human:test-owner
- 2026-08-15 · [[#^c1]] added · src: s1, s2 · by claude-code/claude-sonnet-5-5
- 2026-08-10 · [[#^c2]] added, protected by human:test-owner · src: s3

## Related
- [[landing-pad]] — where custody transfers
