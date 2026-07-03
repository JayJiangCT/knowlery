---
title: Push vs Pull Metrics
type: comparison
items: [push, pull]
created: 2026-04-10
updated: 2026-04-15
tags: [collection, infrastructure]
domain: infrastructure
status: reviewed
description: Tradeoffs weighed before choosing the pull model for metric collection.
sources: [Projects/pulseboard-prd.md, Daily/2026-04-01.md]
---

# Push vs Pull Metrics

| Dimension | Push | Pull |
|-----------|------|------|
| Service discovery | Every service must know the endpoint | Collector discovers targets |
| Health signal | Silence is ambiguous | Failed scrape is itself a signal |
| Load control | Bursts arrive uncontrolled | Scrape interval bounds load |
| Short-lived jobs | Natural fit | Needs a gateway workaround |

## Outcome

The team chose the pull model: the [[collector-daemon]] scrapes targets on an interval,
and a failed scrape doubles as a liveness check. The tradeoffs we weighed and the
decision record live in [[why-pull-model]].
