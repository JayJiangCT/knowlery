---
title: Rate limit decision update
---

Reversal: after the partner integration incident we now return 429 with
Retry-After on rate limit, NOT 503. The old 503 approach confused upstream
retriers and masked real outages. Effective immediately for all public APIs.
