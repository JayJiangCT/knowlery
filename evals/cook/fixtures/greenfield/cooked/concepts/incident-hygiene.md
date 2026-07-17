---
title: Incident Hygiene
type: concept
created: 2026-07-15
updated: 2026-07-15
description: Alert dedupe by incident key, runbooks co-located with alerts, latency triage order
tags: [sre, process]
domain: operations
sources:
  - Projects/oncall-retro.md
  - inbox/2026-07-14-100000-latency-runbook.md
---

Alerts dedupe by incident key; only the primary oncall is paged. Runbooks
live next to alert definitions. Latency triage order: cache hit rate →
canary status ([[Canary Releases]]) → downstream saturation; escalate at 15
minutes.
