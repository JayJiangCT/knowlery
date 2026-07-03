---
title: RED Method
type: Concept
domain: observability
tags: [observability, sre]
timestamp: 2026-06-01T00:00:00.000Z
description: Rate, errors, duration — a request-oriented subset of the golden signals for service dashboards.
---

# RED Method

The RED method dashboards every service with three request-oriented numbers:

1. **Rate** — requests per second.
2. **Errors** — failing requests per second.
3. **Duration** — the distribution of request time, as percentiles.

RED is the request-oriented subset of the
[Four Golden Signals](/concepts/four-golden-signals.md); it trades saturation for
simplicity, which fits stateless services.
