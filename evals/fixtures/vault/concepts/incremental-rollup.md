---
title: Incremental Rollup
type: concept
created: 2026-05-03
updated: 2026-05-08
tags: [infrastructure, storage]
domain: infrastructure
aliases: [rollup, rollups]
description: Continuous aggregates downsample older data so long ranges stay cheap to query.
sources: [Daily/2026-05-02.md]
---

# Incremental Rollup

Incremental rollup downsamples older metric data into coarser resolutions using
continuous aggregates in [[timescaledb]].

## How it reduces storage cost

Raw points are kept only inside the 30-day window of [[retention-policy]]; beyond that,
one-minute and one-hour aggregates answer trend queries at a small fraction of the raw
footprint. Combined with compression this cut the storage bill by an order of magnitude.

## Notes

- Rollups are computed incrementally as data lands, not by nightly batch jobs.
- The batch writers in the [[ingest-pipeline]] trigger the aggregate refresh.
