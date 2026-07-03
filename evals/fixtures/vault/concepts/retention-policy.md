---
title: Retention Policy
type: concept
created: 2026-05-03
updated: 2026-05-12
tags: [infrastructure, storage]
domain: infrastructure
status: reviewed
description: Tiered retention — raw data 30 days, rollups 13 months, compressed after 7 days.
sources: [Daily/2026-05-02.md]
---

# Retention Policy

Pulseboard keeps raw metric data for 30 days, keeps [[incremental-rollup]] aggregates for
13 months, and compresses chunks older than 7 days in [[timescaledb]].

## Rationale

Incident forensics rarely needs raw points older than a month, while capacity planning
needs a full year of trends at coarse resolution. Compression makes the 30-day raw window
affordable.

There is a saved question page with the same name under `queries/`, kept from before this
concept was compiled: [[queries/retention-policy]].
