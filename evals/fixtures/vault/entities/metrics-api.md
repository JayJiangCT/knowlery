---
title: Metrics API
type: entity
created: 2026-04-04
updated: 2026-05-02
tags: [infrastructure, observability]
domain: infrastructure
description: Read path serving queries for dashboards and alert evaluation.
sources: [Projects/pulseboard-prd.md]
---

# Metrics API

The metrics API is the read path of [[pulseboard]]. It serves dashboards and alert
evaluation from [[timescaledb]].

## Notes

- Latency targets for this service are defined in [[service-level-objectives]].
- Slow reads are usually caused by high-cardinality series, see [[cardinality-explosion]].
- Percentile queries follow the definitions in [[response-time-metrics]].
