---
title: Ingest Pipeline Runbook
type: reference
date: 2026-04-22
tags: [operations, runbook]
status: active
---

# Ingest Pipeline Runbook

Operational runbook for the write path. Owner: Alice Chen.

## Restarting the pipeline

1. Drain first: pause scrape shipping on the daemons, wait for queues to empty
   (watch the queue depth panel).
2. Restart batch writers one at a time; each writer re-registers before the next stops.
3. Resume shipping. Never restart writers with full queues — that was the mistake that
   extended the April incident.

## When ingest lags

- Check storage first: a compression job or a slow disk usually shows up here.
- Bounded queues mean lag is expected under storage pressure; daemons slow themselves.
- Only page the owner if lag exceeds 15 minutes with storage healthy.
