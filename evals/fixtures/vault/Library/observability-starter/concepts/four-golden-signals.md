---
title: Four Golden Signals
type: Concept
domain: observability
tags: [observability, sre]
timestamp: 2026-06-01T00:00:00.000Z
description: Latency, traffic, errors, and saturation — the four golden signals of observability from the Google SRE book.
---

# Four Golden Signals

The four golden signals of observability, from the Google SRE book:

1. **Latency** — how long requests take, split between successes and failures.
2. **Traffic** — demand on the system, such as requests per second.
3. **Errors** — the rate of failing requests, explicit or implicit.
4. **Saturation** — how full the constrained resource is.

If a service can only afford four signals, measure these four. The request-oriented
subset is the [RED Method](/concepts/red-method.md).
