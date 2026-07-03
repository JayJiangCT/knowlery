---
title: Tail Latency
type: concept
created: 2026-04-13
updated: 2026-04-28
tags: [measurement, observability]
domain: observability
description: Why p95 and p99 percentiles matter more than central tendency for user experience.
sources: [Daily/2026-04-12.md]
---

# Tail Latency

Tail latency is the slow end of the response time distribution, captured by the p95 and
p99 percentiles.

## Why it matters

A user session issues many requests, so even a small tail probability means most sessions
hit at least one slow request. This is why [[response-time-metrics]] pairs the median with
p95 instead of relying on any single central number.

## Practice

- Alerts on the [[metrics-api]] fire on sustained p95 breaches, not single spikes.
- Percentiles are computed from histograms at the edge, then merged server-side.
