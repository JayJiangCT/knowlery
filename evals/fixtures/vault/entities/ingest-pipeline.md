---
title: Ingest Pipeline
type: entity
created: 2026-04-04
updated: 2026-05-12
tags: [infrastructure]
domain: infrastructure
description: The write path that moves metrics from collectors into storage.
sources: [Projects/ingest-pipeline-runbook.md, Daily/2026-04-20.md]
---

# Ingest Pipeline

The ingest pipeline is the write path of [[pulseboard]]. [[alice-chen|Alice Chen]] owns it.

Metrics flow from the [[collector-daemon]] through a queue into batch writers that land
data in [[timescaledb]].

## Operational notes

- The April 20 incident was caused by unbounded queue growth; the fix added
  [[backpressure]] at the queue boundary.
- Batch writers apply [[incremental-rollup]] before writing older data.
- Transport options were compared in [[kafka-vs-nats]].
