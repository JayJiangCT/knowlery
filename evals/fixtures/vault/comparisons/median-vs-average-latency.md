---
title: Median vs Average Latency
type: comparison
items: [median, average]
created: 2026-04-06
updated: 2026-04-13
tags: [measurement, observability]
domain: observability
description: Why the median replaced the average as Pulseboard's headline latency number.
sources: [Daily/2026-04-05.md, Daily/2026-04-12.md]
---

# Median vs Average Latency

| Dimension | Median (p50) | Average |
|-----------|--------------|---------|
| Robust to outliers | Yes | No — a few slow requests dominate |
| Matches user experience | Yes, typical request | No, no user experiences the average |
| Bimodal traffic | Shows the common mode | Lands between modes, describing nobody |
| Alerting stability | Stable | Fires on ordinary traffic shifts |

## Outcome

The median replaced the average in April; the experiment on production traffic showed the
average sat between two modes and tracked neither. The decision is recorded in
[[response-time-metrics]] and the tail side is covered by [[tail-latency]].
