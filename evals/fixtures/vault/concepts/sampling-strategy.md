---
title: Sampling Strategy
type: concept
created: 2026-04-18
updated: 2026-05-08
tags: [collection, observability]
domain: observability
description: Head-based sampling at the collector keeps volume bounded with predictable bias.
sources: [Projects/性能优化调研.md]
---

# Sampling Strategy

Pulseboard samples high-volume series at collection time using head-based sampling in
the [[collector-daemon]].

## Decision

The performance research note (written in Chinese) compared head-based and tail-based
approaches. Head-based sampling was chosen because the decision is made once at scrape
time, keeps collector memory flat, and its bias is predictable. Tail-based sampling
needs buffering that the daemon cannot afford on small hosts.

## Notes

- Sampling rates are per-series and configured centrally.
- Error series are never sampled, so incident forensics stay complete.
