---
title: TimescaleDB vs ClickHouse
type: comparison
items: [TimescaleDB, ClickHouse]
created: 2026-04-08
updated: 2026-05-02
tags: [infrastructure, storage]
domain: infrastructure
description: Storage engine evaluation; TimescaleDB won on operational familiarity.
sources: [Daily/2026-05-02.md, Projects/pulseboard-prd.md]
---

# TimescaleDB vs ClickHouse

| Dimension | TimescaleDB | ClickHouse |
|-----------|-------------|------------|
| Query language | PostgreSQL SQL, known to the team | Its own SQL dialect |
| Operations | Runs like Postgres | New operational surface |
| Raw ingest speed | Good enough with batching | Faster at very high volume |
| Aggregates | Continuous aggregates built in | Materialized views |

## Outcome

The team picked [[timescaledb]]: operational familiarity with PostgreSQL outweighed
ClickHouse's raw ingest advantage at Pulseboard's volume. Continuous aggregates also
mapped directly onto [[incremental-rollup]].
