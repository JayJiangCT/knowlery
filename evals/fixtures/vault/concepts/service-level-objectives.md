---
title: Service Level Objectives
type: concept
created: 2026-04-27
updated: 2026-05-02
tags: [alerting, reliability]
domain: observability
aliases: [SLO, SLOs]
description: Targets for the metrics API — p95 read latency under 400ms, 99.9% availability.
sources: [Projects/pulseboard-prd.md, Daily/2026-05-02.md]
---

# Service Level Objectives

The [[metrics-api]] has two objectives: p95 read latency under 400 milliseconds over a
28-day window, and 99.9 percent availability.

## Practice

- Burn-rate alerts page the rotation only when the error budget is actually at risk,
  which reduced noise per [[alert-fatigue]].
- The latency objective uses percentile definitions from [[response-time-metrics]].
- Objectives are reviewed quarterly with [[bob-martinez|Bob Martinez]].
