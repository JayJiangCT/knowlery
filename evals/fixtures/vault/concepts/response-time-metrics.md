---
title: Response Time Metrics
type: concept
created: 2026-04-06
updated: 2026-05-02
tags: [measurement, observability]
domain: observability
status: reviewed
description: Latency is reported as median (p50) and tail percentiles, never averages.
sources: [Daily/2026-04-05.md, Daily/2026-04-12.md, Projects/pulseboard-prd.md]
---

# Response Time Metrics

Pulseboard reports response time as the median (p50) together with tail percentiles,
never as an average.

## Decision

On April 5 the team compared reporting options against a week of production traffic.
Averages hid a bimodal distribution: a small number of very slow requests pulled the
average up while most users saw fast responses. The median plus p95 described what
users actually experienced. See [[median-vs-average-latency]] for the full analysis.

## Contradiction history

The original PRD specified `avg(response_time)` as the alerting signal. The experiment
notes from April 5 superseded that; the PRD was amended on April 12. The tail side of
the story continues in [[tail-latency]].
