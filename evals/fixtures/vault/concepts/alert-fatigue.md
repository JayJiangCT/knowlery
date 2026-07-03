---
title: Alert Fatigue
type: concept
created: 2026-04-22
updated: 2026-05-11
tags: [alerting, reliability]
domain: observability
description: Pager overload from noisy alerts erodes trust and slows real incident response.
sources: [Daily/2026-05-10.md, Projects/告警疲劳复盘.md]
---

# Alert Fatigue

Alert fatigue is the state where responders receive so many noisy pages that they stop
trusting alerts, which slows response to real incidents.

## Root causes observed here

The retro note (written in Chinese) identified three causes on our rotation:

1. Threshold alerts on averages that fire during ordinary traffic shifts — replaced by
   percentile alerts per [[response-time-metrics]].
2. Per-host alerts for conditions that only matter in aggregate.
3. No ownership line: pages went to everyone, so they became background noise.

## Follow-ups

- [[dana-kim|Dana Kim]] tracks pager load per rotation in the weekly retro.
- Open question on deduplication lives in [[reduce-alert-noise]].
