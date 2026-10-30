---
type: concept
title: Zipline Drone Deliveries in Dispatch Portal
description: How Zipline drone deliveries appear to Ops in the Dispatch Portal deliveries list (DELI-4641) and job detail page (DELI-4660), including the shared Assigned status, as of 2026-10-10 ticket drafts; backend status mapping and the IKC setting are not covered.
tags:
  - dispatch-portal
  - drone-delivery
  - frontend
  - ui
status: current
updated: 2026-10-10
updated_by: process:cook
verified: 2026-10-10
verified_by: process:cook
aliases:
  - Dispatch Portal Drone UI
  - Drone Table V1
  - Zipline deliveries in Dispatch Portal
related:
  - "[[dispatch-portal]]"
  - "[[dispatch-portal-feature-overview]]"
  - "[[zipline]]"
  - "[[drone-delivery-integration-strategy]]"
---

# Zipline Drone Deliveries in Dispatch Portal

## Current
How Zipline drone deliveries appear to Ops in the Dispatch Portal: the deliveries list (DELI-4641) and the job detail page (DELI-4660).

Scope and dependencies
- The deliveries-list work (DELI-4641) and the detail-page work (DELI-4660) are both frontend subtasks of DELI-4639 (Support Zipline as a Delivery Provider) and depend on DELI-4642 (src: s1, s2) ^c1

Shared model decision: one "Assigned" status
- The portal does not distinguish provider type in status language: the Delivery Status filter and the table status label use "Assigned" for both Ground and Zipline jobs (src: s1, s2) ^c2
- One Assigned filter option includes both delivery types (src: s1) ^c3

Deliveries list (DELI-4641)
- Zipline appears with its logo and name in the deliveries list and in the provider filter (src: s1) ^c4
- A drone row shows no courier name and no Provider Search column or badge (src: s1) ^c5
- Clicking a drone row opens its detail page (DELI-4660) (src: s1) ^c6

Detail page (DELI-4660)
- Everything on the Zipline detail page not otherwise specified matches the ground detail page (src: s2) ^c7
- The info panel has no Courier column; Provider shows Zipline with a "Drone delivery" tag and no tracking or support link (src: s2) ^c8
- Pick-up enroute and Pick-up arrived are not shown in the timeline for a Zipline job (src: s2) ^c9
- The second timeline event is labeled "Assigned drone" for a Zipline job; ground jobs keep their current label (src: s2) ^c10
- The assignment floating panel is titled "Assigned drone" and shows the same assignment timestamp as the timeline; ground jobs keep "Assigned driver" (src: s2) ^c11
- A Ground job, including one created after a Zipline fallback, keeps showing expected events without updates as empty circles (src: s2) ^c12
- Once a Zipline job's Delivery Intent has reached `IN_PROGRESS` the drone has custody, so a Ground job that appears after it is a post-custody recovery rather than a reallocation of the same delivery (src: s3, s2) ^c17

Design sources
- The deliveries-list design is Figma Drone Table V1 (node 7234:3); the detail-page design is Figma Drone Delivery Detail, with the Delivery Info Panel (Delivery=Drone) and Delivery Mode Tag from the Dispatch 2.0 Component Library (src: s1, s2) ^c13
- The "Drone delivery" tag in the Provider column was chosen by Jay from an HTML prototype dated 2026-09-24 (src: s2) ^c14
- The underlying provider status semantics come from Zipline P2 Pickup Status Mapping (2026-06-26) (src: s1, s2) ^c15

Status
- Both tickets were still open (todo) at their last update: DELI-4641 on 2026-10-09 and DELI-4660 on 2026-10-08; the UI work sits in the SP20–21 post-holiday block (Oct 8–16) (src: s1, s2) ^c16

## Evidence
Design references named by the tickets:
- Figma [Drone Table V1](https://www.figma.com/design/fDa1n1TasKR3ZJE6JQx85N/-Dispatch-2.0--Deliveries?node-id=7234-3) (node 7234:3) — deliveries list.
- Figma [Drone Delivery Detail](https://www.figma.com/design/fDa1n1TasKR3ZJE6JQx85N/-Dispatch-2.0--Deliveries?node-id=7289-110796) — detail page.
- Figma Delivery Info Panel (Delivery=Drone) and Delivery Mode Tag, Dispatch 2.0 Component Library.
- HTML prototype (2026-09-24) with the "Drone delivery" tag in the Provider column, chosen by Jay.

## Sources
- s1 · [[Wonder/Wonder Fulfillment/Sprints/2026/SP20-21/JIRA Tickets/DELI-4641]] · @pin · source
- s2 · [[Wonder/Wonder Fulfillment/Sprints/2026/SP20-21/JIRA Tickets/DELI-4660]] · @pin · source
- s3 · [[drone-delivery-integration-strategy#^c19]] · @pin · derived

## History
- 2026-10-30 · [[#^c17]] added (Level 0 experiment fixture) · src: s2, s3 · by process:build
- 2026-10-10 · verified by process:cook
- 2026-10-10 · [[#^c1]] to [[#^c16]] added · src: s1, s2 · by process:cook

## Related
- [[DELI-4639]] — parent story: Support Zipline as a Delivery Provider
- [[dispatch-portal]] — the Ops surface these views belong to
- [[dispatch-portal-feature-overview]] — the wider portal feature set
- [[zipline]] — the drone provider shown
- [[drone-delivery-integration-strategy]] — the 1P drone integration this UI surfaces
