---
title: Event Sourcing
type: concept
created: 2026-04-25
updated: 2026-04-30
tags: [architecture, infrastructure]
domain: infrastructure
description: Considered and rejected for metric storage; kept for the audit trail only.
sources: [Daily/2026-04-20.md]
---

# Event Sourcing

Event sourcing stores state as an append-only sequence of events and derives current
state by replay.

## Where it applies here

The team considered event sourcing for metric storage and rejected it: metric points are
already immutable observations, and replaying billions of points to answer a range query
is strictly worse than the aggregates [[timescaledb]] provides.

It was kept for the configuration audit trail of [[pulseboard]], where "who changed which
alert rule when" is exactly a replay question.
