---
title: Data Locality
type: concept
created: 2026-05-09
updated: 2026-05-09
tags: [architecture, infrastructure]
domain: infrastructure
description: Keeping computation near the data it reads; drives the edge histogram design.
sources: [Daily/2026-05-02.md]
---

# Data Locality

Data locality is the principle of keeping computation close to the data it reads.

## Where data locality shows up in this architecture

- Percentile histograms are computed at the edge, on the host where the raw samples
  live, and only merged centrally. Shipping raw samples would move the data to the
  computation instead.
- Rollup refreshes run inside the database rather than in an external worker, so
  aggregation reads never cross the network.

This page is intentionally an orphan in the fixture: no other page links to it.
