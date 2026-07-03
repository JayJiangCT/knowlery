---
title: Kafka vs NATS
type: comparison
items: [Kafka, NATS]
created: 2026-04-19
updated: 2026-04-21
tags: [infrastructure, transport]
domain: infrastructure
description: Queue evaluation for the ingest transport; NATS JetStream chosen for simplicity.
sources: [Daily/2026-04-20.md]
---

# Kafka vs NATS

| Dimension | Kafka | NATS JetStream |
|-----------|-------|----------------|
| Operational weight | Heavy for a small team | Single lightweight binary |
| Durability | Strong, partitioned log | Sufficient with streams |
| Throughput ceiling | Higher | Adequate at current volume |

## Outcome

NATS JetStream carries traffic between the [[collector-daemon]] and the batch writers of
the [[ingest-pipeline]]. Kafka's ceiling was not worth its operational weight at current
volume; the bounded-queue [[backpressure]] design works the same on either transport.
