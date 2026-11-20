---
type: concept
title: Bad history
description: Tests history validation.
status: current
created: 2026-10-01
updated: 2026-11-18
---
# Bad history

## Current
- Current claim (src: s1) ^c2

## Sources
- s1 · `Finance/orders.csv` · sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa · row 1

## History
- 2026-11-18 · invented · by jay
- 2026-02-30 · created · by jay
- Old claim (src: s1) · superseded 2026-11-18 by ^c99 · replaced ^c1
- Retired without reason (src: s1) · retired 2026-11-18 ^c3
- Just a random history line
- Properly retired claim (src: s1) · retired 2026-11-18 · no longer supported ^c4
