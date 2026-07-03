---
title: Q3 Capacity Planning
type: project
date: 2026-05-13
tags: [planning, infrastructure]
status: draft
---

# Q3 Capacity Planning

Ingest capacity planned for Q3, based on the last 90 days of growth. Not compiled into
the knowledge layer yet.

## Numbers

- Series count grows ~8 percent per month; two new customers land in Q3.
- Planned ingest capacity: 220k samples/second sustained, double the current peak.
- Storage: raw window unchanged; the rollup tier grows linearly and stays cheap.
- Action: add one batch writer and one storage replica before September.
