---
title: Backpressure
type: concept
created: 2026-04-21
updated: 2026-05-12
tags: [infrastructure, reliability]
domain: infrastructure
description: Bounded queues push load shedding upstream instead of failing at the storage layer.
sources: [Daily/2026-04-20.md, Projects/ingest-pipeline-runbook.md]
---

# Backpressure

Backpressure is how the [[ingest-pipeline]] protects itself when writes arrive faster
than [[timescaledb]] can absorb them.

## Design

After the April 20 incident, queues between the [[collector-daemon]] and the batch
writers were bounded. When a queue fills, the daemon slows its ship rate and drops
sampled series first, following [[sampling-strategy]] priorities. Error series are
never dropped.

## Rationale

Unbounded queues turn a storage slowdown into an out-of-memory failure of the whole
write path. Bounded queues degrade gracefully and recover without restarts.
