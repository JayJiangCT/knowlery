---
title: TimescaleDB
type: entity
created: 2026-04-05
updated: 2026-05-02
tags: [infrastructure, tool]
domain: infrastructure
description: The time-series database Pulseboard uses for metric storage.
sources: [Daily/2026-05-02.md, Projects/pulseboard-prd.md]
---

# TimescaleDB

TimescaleDB is the time-series database behind [[pulseboard]]. The team picked it over
ClickHouse mainly for operational familiarity with PostgreSQL; the full analysis is in
[[timescaledb-vs-clickhouse]].

## Notes

- Native compression cut storage cost by roughly 90 percent on older chunks.
- Continuous aggregates power [[incremental-rollup]].
- Retention windows are configured per tier, see [[retention-policy]].
