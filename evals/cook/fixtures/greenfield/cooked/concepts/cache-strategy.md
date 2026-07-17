---
title: Cache Strategy
type: concept
created: 2026-07-15
updated: 2026-07-15
description: Write-back for the feed service, write-through elsewhere; pub/sub invalidation with 15min TTL safety net
tags: [infra, sre]
domain: infrastructure
sources:
  - Projects/cache-debate.md
  - Clippings/sre-article.md
---

Write-back only where writes dominate (feed service); write-through is the
default. Invalidation rides pub/sub with a 15-minute TTL backstop. Stampede
mitigations per the SRE literature: jittered TTLs and request coalescing.
Negative caching kept short.

Rollouts of cache changes follow [[Canary Releases]].
