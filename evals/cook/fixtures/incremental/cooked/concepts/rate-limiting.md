---
title: Rate Limiting
type: concept
created: 2026-05-02
updated: 2026-07-16
description: Public APIs return 429 with Retry-After on limit; the earlier 503 approach is superseded
tags: [api, sre]
domain: platform
sources:
  - Projects/limits-decision.md
---

Current policy: 429 + Retry-After on all public APIs.

**Superseded position** (until 2026-07): limits returned 503. Reversed after
the partner integration incident — 503 confused upstream retriers and masked
real outages. Clients implement [[Backoff Strategies]] against the 429.
