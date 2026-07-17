---
title: Cache strategy debate
---

Long thread on write-through vs write-back. Write-back wins for the feed
service (write-heavy), write-through everywhere else. Invalidation via
pub/sub, TTL 15min as the safety net. Redis stays the only cache layer.
