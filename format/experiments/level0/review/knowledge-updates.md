# Knowledge updates surfaced during the equivalence review (not applied to Test)

These came from the reviewer's own knowledge, not from the 1.x pages. The equivalence gate compares Test with 1.x only, so they are **not** applied to `test/`. After the Level 0 runs, the reviewer writes them as a Source note (authored by human:jay) and the Evolve flow updates the Knowledge pages — a real exercise of T04.

| # | Reviewer's note (verbatim) | Affects | 1.x / Test currently say |
|---|---|---|---|
| K1 | "Delivery Catalog periodically syncs profiles and applies Kafka updates" 已经更新为 "Once Fully syncs and applies Kafka updates"; Load profiles with one full pull through Cookbook APIs, then apply incremental Kafka updates. The full pull can be run again on demand to rebuild the table from Cookbook. (A3, A5, A56) | `drone-delivery-integration-strategy` ^c12, Evidence pipeline | periodic sync + Kafka updates |
| K2 | 最新的信息是 Soft Opening 在 1/11 2027，而 Grand Opening 在 11/20 2027 (A15) — reviewer to confirm whether 11/20 is 1/20 | ^c24, ^q1 | tracker: 01-11 Soft Opening, 01-20 Grand Opening; 09-20 snapshot: 01-11 F&F, 01-14 GO |
| K3 | 和 Zipline 进行对接和集成不假，但是后续不会将 Zipline 集成到 Grubhub 的 DaaS 中 (A18) | ^c1 ("so it could later sit behind DaaS") | migration-friendly so it could later sit behind DaaS |
| K4 | 目前 Dexa 项目已经 pilot 失败，Wonder 后续达成了和 Zipline 的合作，但是对方不希望把 Zipline 提供的 Drone Delivery 的能力集成到 Grubhub，因此 Drone 目前仅集成到 Wonder 自己的 Delivery Service 中 (A20) | ^c1, ^c3, ^c31, ^q2, ^q10 | Dexa pilot "validated demand but exposed…"; DaaS roadmap still an Open question |

Suggested Source note: `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Strategy Corrections from Review - 2026-11-02.md`, written by the reviewer after the experiment.
