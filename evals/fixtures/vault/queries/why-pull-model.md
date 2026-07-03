---
title: "Question: why did we choose the pull model?"
type: query
status: answered
created: 2026-04-15
updated: 2026-04-16
tags: [collection, infrastructure]
domain: infrastructure
description: Decision record for choosing pull-based metric collection.
sources: [Projects/pulseboard-prd.md, Daily/2026-04-01.md]
---

# Question: why did we choose the pull model?

We chose pull because a failed scrape is itself a health signal, the scrape interval
bounds ingest load, and service owners do not need to configure a destination endpoint.

The tradeoffs we weighed are tabulated in [[push-vs-pull-metrics]]. The known cost is
short-lived batch jobs, which need a small push gateway in front of the
[[collector-daemon]].
