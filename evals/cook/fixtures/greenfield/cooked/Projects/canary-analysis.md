---
title: Canary analysis notes
---

Compared canary windows: 30min catches most regressions; 2h catches slow
memory leaks but delays releases. Decision: 30min default, 2h for storage
services. Control group must be same-AZ to avoid network noise.
