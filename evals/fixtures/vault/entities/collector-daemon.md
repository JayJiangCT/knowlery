---
title: Collector Daemon
type: entity
created: 2026-04-04
updated: 2026-05-08
tags: [infrastructure]
domain: infrastructure
description: The agent process that scrapes service metrics on each host.
sources: [Projects/ingest-pipeline-runbook.md]
---

# Collector Daemon

The collector daemon is the process that scrapes service metrics on each host and ships
them to the [[ingest-pipeline]]. It is owned by [[alice-chen|Alice Chen]].

## Notes

- Scraping follows the pull model, see [[why-pull-model]] and [[push-vs-pull-metrics]].
- Head-based sampling is applied at scrape time, see [[sampling-strategy]].
- The daemon exposes its own health endpoint for [[pulseboard]] self-monitoring.
