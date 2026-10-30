---
type: concept
title: IKC Drone Delivery Setting
description: What the per-IKC Drone Delivery toggle in Dispatch Portal does, where it is checked and what it excludes, as of 2026-10-10 per DELI-4637; provider priority (DELI-4638) and the partner-site mapping are not covered.
tags:
  - backend
  - delivery
  - dispatch-portal
  - drone-delivery
status: current
updated: 2026-10-10
updated_by: process:cook
verified: 2026-10-10
verified_by: process:cook
aliases:
  - IKC Drone feature
  - Drone Delivery setting
  - IKC-level Drone Delivery Setting
related:
  - "[[zipline]]"
  - "[[dispatch-portal]]"
  - "[[dispatch-portal-feature-overview]]"
  - "[[drone-delivery-integration-strategy]]"
---

# IKC Drone Delivery Setting

## Current
A per-IKC toggle that lets Delivery Ops turn drone delivery on or off for each kitchen, so Zipline is used only at kitchens that are ready to load drones.

Definition and behaviour
- The IKC Drone Delivery Setting is defined by DELI-4637, the enablement sibling of the Zipline provider work in DELI-4639; it lets Delivery Ops turn drone delivery on or off per IKC so Zipline is used only at kitchens ready to load drones (src: s1) ^c1
- The setting lives with the other IKC-level delivery configuration in Delivery Settings of the Dispatch Portal (src: s1) ^c2
- The setting is off by default; only kitchens that are ready to load drones get enabled (src: s1) ^c3
- When the setting is on, an eligible order placed with Drone Delivery selects Zipline as its provider (src: s1) ^c4
- When the setting is off, the eligibility check does not contact Zipline and returns the outcome defined in the eligibility contract, and orders follow normal ground allocation (src: s1) ^c5

Check points
- The setting is read at two places: the Drone eligibility check and delivery task creation (src: s1) ^c6
- This matches the 1P Drone Delivery API Integration Overview (2026-09-29), which checks whether Zipline is enabled in the IKC allocation setting before making a provider call and caches the setting state per IKC with a 30-second TTL (src: s2) ^c7

Change semantics
- A setting change applies to new evaluations promptly and does not affect deliveries already in progress (src: s1) ^c8
- Every change records who made it and when (src: s1) ^c9

Out of scope
- The IKC-to-Zipline `partner_site_id` mapping is configured by Dispatcher and is not part of this setting; it is a dedicated 1:1 IKC-to-partner-site collection in the provider service (src: s1, s2) ^c10

Status
- Ticket DELI-4637 is done (epic DELI-4664); provider priority in Allocation Settings is tracked separately as DELI-4638 (src: s1) ^c11

## Sources
- s1 · [[Wonder/Wonder Fulfillment/Sprints/2026/SP20-21/JIRA Tickets/DELI-4637]] · @pin · source
- s2 · [[1p-drone-delivery-api-integration-overview-2026-09-29]] · @pin · record

## History
- 2026-10-10 · verified by process:cook
- 2026-10-10 · [[#^c1]] to [[#^c11]] added · src: s1, s2 · by process:cook

## Related
- [[zipline]] — the drone provider the setting enables per kitchen
- [[dispatch-portal]] — where the setting lives (Delivery Settings)
- [[dispatch-portal-feature-overview]] — the wider portal feature set
- [[drone-delivery-integration-strategy]] — the 1P drone integration this setting gates
- [[DELI-4639]] — the Zipline provider work this setting is the enablement sibling of
