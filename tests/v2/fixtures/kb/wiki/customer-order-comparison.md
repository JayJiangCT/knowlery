---
type: comparison
title: Customer order comparison
description: Side-by-side comparison of early customer orders in Finance/orders.csv.
status: current
created: 2026-10-12
updated: 2026-11-18
tags: [finance, orders]
related: [company-ltd]
---
# Customer order comparison

## Current
- Order 1 for Company, Ltd is 7.00 while order 2 for Two Lines is 14.00 (src: s1) ^c1
- Order 3 for Customer 3 is 21.00, continuing a 7.00 step increment per order id (src: s2) ^c2

## Evidence
| Order | Customer | Amount |
| --- | --- | --- |
| 1 | [Company, Ltd](company-ltd.md) | 7.00 |
| 2 | Two Lines | 14.00 |
| 3 | Customer 3 | 21.00 |

## Sources
- s1 · `Finance/orders.csv` · sha256:0cba3bf0cb2d6c4762eec5d4f1408cea02d196d6395281d5529fe2953a994830 · rows 1-2
- s2 · `Finance/orders.csv` · sha256:0cba3bf0cb2d6c4762eec5d4f1408cea02d196d6395281d5529fe2953a994830 · row 3

## History
- 2026-10-12 · created · by knowlery-fixture
