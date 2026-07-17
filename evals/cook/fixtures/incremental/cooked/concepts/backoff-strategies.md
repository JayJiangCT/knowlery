---
title: Backoff Strategies
type: concept
created: 2026-05-02
updated: 2026-05-02
description: Exponential backoff with jitter as the client-side pairing for rate limits
tags: [api]
domain: platform
sources:
  - Projects/limits-decision.md
---

Exponential backoff with full jitter; honor Retry-After when present. The
server-side contract lives in [[Rate Limiting]].
