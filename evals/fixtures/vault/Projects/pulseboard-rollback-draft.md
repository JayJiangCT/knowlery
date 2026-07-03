---
title: Pulseboard Rollback Draft
type: idea
date: 2026-05-14
tags: [draft, infrastructure]
status: draft
---

# Rollback strategy for the storage schema migration (draft)

Draft only — never compiled into a knowledge page. This is the only place the rollback
strategy is written down.

## Plan

1. The schema migration runs in two phases: add the new hypertable, dual-write for one
   week, then cut reads over.
2. Rollback during dual-write: stop the migration job, drop the new hypertable, nothing
   else changes.
3. Rollback after cutover: re-point reads at the old hypertable, replay the write-ahead
   window (max 1 hour of divergence), then investigate before retrying.
4. Hard rule: no rollback path may involve restoring from backup; backups are for
   disasters, not migrations.
