---
title: Pulseboard PRD
type: project
date: 2026-04-03
tags: [prd, product]
status: active
---

# Pulseboard PRD

Product requirements for Pulseboard, the Nimbus Labs monitoring product.

## Users

Small platform teams that want service dashboards and alerting without operating their
own telemetry stack.

## Requirements

- Collect service metrics with a pull model; the collector discovers targets.
- Store metrics with tiered retention and cheap long-range trend queries.
- Alerting: ~~fire when `avg(response_time) > baseline`~~ **Amended 2026-04-12:** fire on
  sustained p95 breach; average-based signals are retired.
- Read path exposes an HTTP API for dashboards and alert evaluation, with p95 read
  latency under 400ms.
