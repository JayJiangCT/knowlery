---
title: "Question: how do we reduce alert noise?"
type: query
status: active
created: 2026-05-11
updated: 2026-05-12
tags: [alerting, reliability]
domain: observability
description: Open research thread on deduplicating and grouping noisy pages.
sources: [Daily/2026-05-10.md, Projects/告警疲劳复盘.md]
---

# Question: how do we reduce alert noise?

Open thread from the May on-call retro. Done so far:

- Switched threshold alerts to burn-rate alerts on [[service-level-objectives]].
- Replaced average-based signals per [[response-time-metrics]].

Still open: grouping related pages into one notification, and whether per-host alerts
can be dropped entirely. Background analysis lives in [[alert-fatigue]].
