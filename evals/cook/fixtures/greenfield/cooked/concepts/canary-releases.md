---
title: Canary Releases
type: concept
created: 2026-07-15
updated: 2026-07-15
description: Staged rollout policy — 5% canary, 30min default window, auto-rollback on doubled error rate
tags: [sre, process]
domain: operations
sources:
  - Projects/rollout-meeting.md
  - Projects/canary-analysis.md
---

Every service change passes a canary stage at 5% traffic. Default window is
30 minutes; storage services hold 2 hours (slow leaks). Rollback is automatic
when the error rate doubles vs a same-AZ control group.

Related: [[Cache Strategy]] interacts with canary noise; [[Incident Hygiene]]
defines the escalation path when a canary goes bad.
