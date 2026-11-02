# Agent review notes (beyond the 96 packet items)

Reviewer: independent agent. I did not open any decisions file. Judged 1.x (Knowlery-Pilot @ cf9e378) against Test only.

Totals: 50 ok, 10 drop-ok, 36 fix. 35 of the 36 fixes are on `drone-delivery-integration-strategy`, mostly content in the 1.x sections that Test drops entirely (Meeting Update, Official Partnership, Planning Implication, Evidence, Advisory Loading Window).

## Packet quality

- The matcher's "best match" is often unrelated (e.g. A25→^c8, A49→^c20, A30→^c22, A44, A56). For those I searched Test myself, so "fix" means nothing in Test carries the content, not only that the hint was wrong.
- B items show the matcher's 1.x/Test pair, which is sometimes mismatched (`ikc:B1` pairs the 1.x "On:" bullet with ^c6; real claim is ^c4; `dispatch:B1` pairs "Clicking a drone row" with ^c7; real origin of ^c7 is "Everything not listed here…"). I judged the Test claim's origin, not the displayed pair.

## Test content with no 1.x origin (additions)

- `zipline-drone-deliveries-in-dispatch-portal` ^c17 (post-custody Ground job is recovery, not reallocation) and source s3 have no 1.x origin; History labels it "Level 0 experiment fixture". Item B2 covers it.
- Strategy ^c29 (History): "The earlier loader reference of 12.5 × 9.5 × 7.75 in is the package limit (src: s6)". 1.x only says that reference "is smaller and remains historical context"; it never states it was once taken as the package limit. Invented prior claim.
- Strategy ^c28 (History) asserts "Eligibility uses … may reuse KDS bag-size recommendation logic". 1.x names these only as earlier *proposals*.
- Strategy ^c27: "13.31 × 9.92 × 8.07 in" and "mass, length and height unchanged" are not in 1.x (inches for 338/205 mm are computed; "unchanged" is inferred from 252→254 only).
- Strategy ^q5 ("Will live tracking and custody-aware cancellation stay P1, or move to P0?") is a new question; 1.x only cautions that P1 is not a closed decision.
- Page-level `status: disputed` (1.x: `status: active`, `freshness_status: active`) is driven by the #disputed ^c24. 1.x never says the page is disputed; confirm this is intended.

## 1.x statements lost that the packet did not list

In `drone-delivery-integration-strategy`:
- "KDS retains its operational recommendation boundary" (Current System Alignment bullet).
- Freshness Review: "Provider-contract gaps remain active around no-mass direct-order Quote behavior, package-data confidence, single-delivery enforcement, station rejection/custody, and safe fallback" (only single-delivery and fallback survive, in ^c10).
- PRD V6 section: "durable interpretation: MVP product boundaries are substantially defined, while the page remains Draft".
- Top callout: "Zipline Pack owns the provider-specific fit result" (see A4).
- Zipline Direct-Integration Shift: Zipline's public P2 pages "provide useful official terminology" (^c4 keeps only the precedence).
- Outer package section: Medium bag is "not a newly produced drone-specific bag"; "provider envelope … is the current hardware maximum" (A69 judged ok on the limit; "hardware maximum" wording is gone).
- Small softenings: "reusable" and "local" in the pipeline; ^c6 drops "dependency" from "detailed dependency/API contract"; "Hybrid migration path" table row kept, but "migration-friendly so it can later sit behind DaaS if Grubhub catches up" lost its condition.
- Open questions: "Is a DaaS-first path still realistic…" and "who owns support, SLA, pricing, incident handling" have no Open item (A42, A45).

## Not reviewed

- The packet covers 5 Knowledge pages and 4 of the 9 Test Records. I did not review the other 5 Records (checkout-package-dimensions, medium-bag, quote-and-package-eligibility, partner-confirmed-contract, pack-as-oracle) in depth. A line diff against 1.x shows only heading-level and Summary/Detail structure changes there, but I did not read them for meaning.
- For the 4 Records in the packet, I checked only the N (added Summary) sentences. Each restates a 1.x frontmatter `description`, callout or section, so I marked them ok. Note this moves `description` text (outside 1.x's evidence scope) into the frozen Summary; semantically equal, but it does change the digest scope.
- I did not verify Sources/History lines, digests or frontmatter fields beyond what the items required.
