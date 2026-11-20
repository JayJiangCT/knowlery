---
type: concept
title: Bad claims
description: Tests claim and open item validation.
status: current
created: 2026-10-01
updated: 2026-11-18
---
# Bad claims

## Current
- Claim without source list ^c1
- Claim without id (src: s1)
- Claim with bad tag (src: s1) #urgent ^c2
- First valid claim (src: s1) ^c3
- Duplicate id claim (src: s1) ^c3
Not a list item in Current
- Claim citing missing source (src: s9) ^c4

## Open
- Open item without id (src: s1)

## Sources
- s1 · `Finance/orders.csv` · sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa · row 1

## History
- Reused id in history (src: s1) · retired 2026-11-18 · obsolete ^c3
