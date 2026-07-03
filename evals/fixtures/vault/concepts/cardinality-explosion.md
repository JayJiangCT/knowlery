---
title: Cardinality Explosion
type: concept
created: 2026-05-04
updated: 2026-05-12
tags: [infrastructure, observability]
domain: observability
description: Unbounded tag values multiply series counts and slow reads on the metrics API.
sources: [Daily/2026-05-02.md]
---

# Cardinality Explosion

Cardinality explosion happens when metric tags carry unbounded values — user ids, request
ids, container hashes — multiplying the number of distinct series.

## Impact here

High-cardinality series inflate the index in [[timescaledb]] and slow reads on the
[[metrics-api]]; several Grafana panels timed out in early May because one service tagged
requests with a session id.

## Mitigations

- The [[collector-daemon]] drops tags that exceed a per-metric value budget.
- New tags on high-volume metrics require review.
