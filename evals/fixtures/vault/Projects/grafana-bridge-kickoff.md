---
title: Grafana Bridge Kickoff
type: project
date: 2026-05-06
tags: [integration, product]
status: active
---

# Grafana Bridge Kickoff

Kickoff notes for the Grafana data source integration.

- Goal: customers keep their existing Grafana dashboards while Pulseboard supplies the
  data.
- All reads go through the public API; the bridge gets no direct database access.
- Bob owns the product side; engineering owner to be assigned next sprint.
- Open question: how the bridge should express percentile queries against the API.
