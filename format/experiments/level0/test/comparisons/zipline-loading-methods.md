---
type: comparison
title: Zipline Loading Methods
description: Compares Zipline Drone Loading and Dropbox Loading for Wonder store operations, approvals, staff effort, reliability and scaling, with a decision rule, as of the 2026-09-15 Zipline x Wonder weekly deck; loading-window API semantics and site-specific construction scope are not covered.
tags:
  - delivery-service
  - drone-delivery
  - strategy
status: current
updated: 2026-09-15
updated_by: process:cook
verified: 2026-09-15
verified_by: process:cook
aliases:
  - Drone Loading vs Dropbox Loading
  - Zipline Drone Loading and Dropbox Loading
  - Zipline Loading Manager Methods
related:
  - "[[zipline-wonder-weekly-deck-readout-2026-09-15]]"
  - "[[zipline]]"
  - "[[wonder]]"
  - "[[zipline-dropbox-loading-window-contract]]"
  - "[[drone-delivery-integration-strategy]]"
---

# Zipline Loading Methods

## Current
Two ways a Wonder store hands an order to a Zipline aircraft: Drone Loading (associate loads the aircraft directly) and Dropbox Loading (associate places the order in an installed Dropbox). The comparison table and test evidence are in Evidence.

Summary
- Drone Loading is operationally flexible and more tolerant of large payloads in the September test, but it requires a longer, precisely timed associate handoff (src: s1, s2) ^c1
- Dropbox Loading shortens the associate action and is the intended repeatable infrastructure model, but it adds equipment, approvals, construction dependencies, and a demonstrated large-payload fit risk (src: s1, s2) ^c2

Side-by-side dimensions
- Equipment: Drone Loading lists no permanent loading equipment; Dropbox Loading requires an installed Dropbox (src: s1) ^c3
- Approvals shown in the deck: Drone Loading needs partner approval; Dropbox Loading needs partner, landlord and city approval (src: s1) ^c4
- Associate action: Drone Loading collects the order and loads the aircraft payload directly; Dropbox Loading walks the order to the Dropbox and places it inside (src: s1) ^c5
- Approximate associate loading time is 2–3 minutes for Drone Loading and about 1 minute for Dropbox Loading (src: s1) ^c6
- Timing dependency: in Drone Loading the associate must coordinate with aircraft arrival and the "load now" signal; in Dropbox Loading the associate waits for the Dropbox-ready state and can complete the station handoff quickly (src: s1) ^c7
- Workflow trigger: in Drone Loading the associate requests/calls the drone in Loading Manager; in Dropbox Loading a successful Dropbox loading summons the drone (src: s1) ^c8
- Site construction dependency is lower for Drone Loading in the comparison slide; for Dropbox Loading window, footing, curb, awning, roof and approval work can apply by site (src: s1) ^c9
- Large-payload test signal: Drone Loading succeeded on 12 of 12 deliveries across three payloads; under Dropbox Loading the largest payload failed 3 of 6 pickups (src: s1, s2) ^c10
- Best fit: Drone Loading for early flexibility, unusual or larger payloads, and sites awaiting Dropbox deployment; Dropbox Loading for repeatable steady-state store handoff after site and package validation (src: s1, s2) ^c11

Reliability interpretation
- The packaging test result is specific to the week-of-September-7 payloads and should not be generalized into a universal failure rate (src: s2) ^c12
- The test does establish that the current Wonder bag and large packout need a mitigation before Dropbox can be treated as operationally equivalent to Drone Loading (src: s2) ^c13

Scaling interpretation
- Dropbox has the stronger long-term store-labor model because it reduces the associate's timed interaction to roughly one minute and decouples the employee from direct aircraft loading (src: s1, s2) ^c14
- That Dropbox advantage appears only after four conditions are met: the site is constructed and approved; the package fits with a reliability buffer; Loading Manager clearly exposes station readiness and exceptions; and the store has a defined queue and exception process (src: s2) ^c15
- Drone Loading is a useful operational fallback or launch bridge when Dropbox installation is incomplete or packaging fit is uncertain, but it still requires more staff time and tighter synchronization (src: s2) ^c16

Decision rule
- Prefer Dropbox Loading when the site and bag are validated and the goal is repeatable, low-touch store handoff (src: s2) ^c17
- Prefer Drone Loading during early launch, construction dependency, or payload-fit uncertainty (src: s2) ^c18
- Do not use staff packout discipline as the primary mitigation for a marginal Dropbox fit; address the bag or app eligibility boundary (src: s2) ^c19

## Evidence
![[Attachments/zipline-x-wonder-weekly-2026-09-15/slide-03-loading-methods.png]]

Side-by-side comparison from the deck (src: s1):

| Dimension | Drone Loading | Dropbox Loading |
| --- | --- | --- |
| Equipment | No permanent loading equipment listed | Installed Dropbox |
| Approvals shown in deck | Partner | Partner, landlord, and city |
| Associate action | Collect order and load the aircraft payload directly | Walk order to the Dropbox and place it inside |
| Approximate associate loading time | 2–3 minutes | About 1 minute |
| Timing dependency | Associate must coordinate with aircraft arrival and "load now" signal | Associate waits for Dropbox-ready state and can complete the station handoff quickly |
| Workflow trigger | Associate requests/calls the drone in Loading Manager | Successful Dropbox loading summons the drone |
| Site construction dependency | Lower in the comparison slide | Window, footing, curb, awning, roof, and approval work can apply by site |
| Large-payload test signal | 12 of 12 deliveries succeeded across three payloads | Largest payload failed 3 of 6 pickups |
| Best fit | Early flexibility, unusual or larger payloads, sites awaiting Dropbox deployment | Repeatable steady-state store handoff after site and package validation |

Packaging test results slide (week of 2026-09-07 payloads):

![[Attachments/zipline-x-wonder-weekly-2026-09-15/slide-20-packaging-test-results.png]]

## Sources
- s1 · https://docs.google.com/presentation/d/1h-nr1N4TnNGY2gdSYJaIM1mINbULazzCdpXJidVqv24/edit · fetched:2026-09-15 · source · no-snapshot · Zipline x Wonder weekly deck
- s2 · [[zipline-wonder-weekly-deck-readout-2026-09-15]] · @pin · record

## History
- 2026-09-15 · verified by process:cook
- 2026-09-15 · [[#^c1]] to [[#^c19]] added · src: s1, s2 · by process:cook

## Related
- [[zipline-wonder-weekly-deck-readout-2026-09-15]] — the deck readout this comparison is drawn from
- [[zipline]] — the drone provider whose loading methods are compared
- [[wonder]] — the store operator whose associates perform the handoff
- [[zipline-dropbox-loading-window-contract]] — Dropbox loading-window semantics
- [[drone-delivery-integration-strategy]] — the wider 1P drone integration
