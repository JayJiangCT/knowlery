---
title: Pulseboard
type: entity
created: 2026-04-01
updated: 2026-05-12
tags: [product]
domain: product
status: reviewed
description: Nimbus Labs' monitoring product for service metrics and alerting.
sources: [Projects/pulseboard-prd.md, Daily/2026-04-01.md]
---

# Pulseboard

Pulseboard is the monitoring product built by [[nimbus-labs|Nimbus Labs]]. It collects
service metrics through the [[collector-daemon]], transports them through the
[[ingest-pipeline]], stores them in [[timescaledb]], and serves them through the
[[metrics-api]].

## Positioning

Pulseboard targets small platform teams that want service dashboards and alerting
without running their own telemetry stack.

## Key decisions

- Latency is reported as median and tail percentiles, not averages: [[response-time-metrics]].
- Metrics are collected with a pull model: [[why-pull-model]].
