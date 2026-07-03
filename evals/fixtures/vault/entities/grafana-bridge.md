---
title: Grafana Bridge
type: entity
created: 2026-05-01
updated: 2026-05-12
tags: [integration, product]
domain: product
description: Integration project exposing Pulseboard metrics as a Grafana data source.
sources: [Projects/grafana-bridge-kickoff.md]
---

# Grafana Bridge

Grafana Bridge is the integration project that exposes [[pulseboard]] metrics as a
Grafana data source, so customers can keep their existing dashboards.

## Notes

- Owned by [[bob-martinez|Bob Martinez]] on the product side.
- Reads go through the [[metrics-api]]; the bridge adds no direct database access.
