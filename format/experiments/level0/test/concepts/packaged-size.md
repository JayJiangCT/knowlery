---
type: concept
title: Packaged Size
description: What Cookbook's Packaged Size t-shirt tag (XS/S/M/L/XL) is, how packaging SKUs were binned by footprint area, how KDS turns it into Expo units and bag capacities, and which nearby dimension fields it is not, as of 2026-09-03; drone package eligibility is not covered.
tags:
  - architecture
  - backend
  - glossary
status: current
updated: 2026-09-03
updated_by: process:cook
verified: 2026-08-20
verified_by: process:cook
aliases:
  - Cookbook Packaged Size
  - PackagedItemSize
  - packaged_item_size
  - t-shirt size
  - t-shirt-size
  - Expo unit
  - Expo units
  - 包装尺码
related:
  - "[[expo-t-shirt-size-optimization-2026-06-24]]"
  - "[[cookbook-packaged-size-warehouse-landing-2026-08-20]]"
  - "[[kds-bag-recommendation-feature-and-algorithm-2026-07-22]]"
  - "[[kds-pre-order-bag-recommendation-feasibility-2026-07-16]]"
  - "[[cooking-item]]"
  - "[[vending-items]]"
  - "[[kds]]"
---

# Packaged Size

## Current
Packaged Size is a Cookbook tag that KDS consumes as a one-dimensional capacity score. The claims below cover what the tag is, how it was assigned, how it maps to Expo units and bag capacities, its grain, and the physical-dimension fields it is not.

Definition
- Packaged Size is Cookbook's categorical t-shirt size (XS/S/M/L/XL) for how much Expo / bag capacity a kitchen unit occupies; it is a tag, not a measured dimension (src: s1, s2) ^c1
- KDS reads the Cookbook tag group named `Packaged Size` from line-build related-item tags, maps the value into `PackagedItemSize`, and uses the integer `unitSize` as an Expo unit (src: s1, s3) ^c2
- Missing or unrecognized Packaged Size tags default to Medium (src: s1) ^c3
- At runtime KDS only sees the tag and does not measure food or the bag; the tag on packaging SKUs was calibrated from measured footprint area (in²), then copied onto cooking/vending rows through Cookbook line-build tags (src: s1, s4) ^c4

How the tag is assigned
- The assignment rule is Kitchen Design's Expo T-Shirt Size Optimization (Jakob, 2026-06-24), an audit of container SKUs, not a Cookbook formula on the food itself (src: s4, s5, s6) ^c5
- Each packaging SKU's physical footprint area is binned as XS < 10.0 in², S < 35.0 in², M < 65.0 in², L < 100.0 in² (src: s4) ^c6
- Each bin is given a weight with Medium = 1; legacy weights are `0.25 / 0.5 / 1 / 2`; optimized weights from average area ratios are `0.125 / 0.5 / 1 / 1.5` and are not what KDS uses today (src: s4, s1) ^c7
- A menu dish inherits the tag from the packaging on its line-build related items; sauces and sides can carry their own (usually smaller) packaging tag (src: s4, s2) ^c8
- The binned footprint is the 2D base area of a box/bowl/tin, not the 3D volume of the finished packed meal; XL is absent from the 34-SKU audit, and KDS uses XL for bundles and vending bags (src: s4, s1) ^c9

Mapping to Expo units
- Cookbook stores fractional t-shirt weights in the Runner bag-recommendation PRD and KDS multiplies by 4 so every size is an integer Expo unit with Medium as the anchor (`1.00 × 4 = 4`): XS 0.25 → 1, S 0.50 → 2, M 1.00 → 4, L 2.00 → 8, XL 4.00 (bundles) → 16 (src: s7, s1) ^c10
- The same ×4 scale is used for Directed Expo parking spots: a KMS/HDR Portal compartment configured as size `8` becomes `32` Expo units (`8 × 4`), i.e. eight Medium items (src: s8) ^c11

Grain
- Packaged Size is not one value per customer menu SKU; KDS attaches it to each Cooking Item or vending task: the main dish (often `subcomponent_name` null), each sauce / side customization as its own row, utensils hardcoded to XS, and bundles collapsed to XL instead of summing components (src: s2, s1) ^c12
- A Build-Your-Own bowl can therefore be M for the bowl and XS for each sauce, and bag recommendation packs those rows independently (src: s2, s9) ^c13

How bags get a number
- Bag capacities are t-shirt weights from the PRD, then ×4: Small 1.00 → 4 Expo units, Medium 3.75 → 15, Large 8.75 → 35 in `BagSize` (src: s7, s10) ^c14
- Vic / Angela defined bag capacity with example packings, not by measuring bag liters; the code comment says the values are hardcoded from the PRD and updated to match integer unit sizes (src: s7, s10) ^c15
- `KDS-3887` changed the Small bag capacity from 7 to 4 Expo units after the Larchmont / Pleasantville pilot (src: s10) ^c16
- KDS Bag Recommendation first-fit-decreases cooking and vending rows into the three bag bins (src: s9) ^c17

What it is not
- Cookbook `Logistics.dimensions` / ItemUOM L/W/H is a separate physical-packaging model, unused by bag recommendation (src: s11) ^c18
- Product Catalog `wonder_items.dimension` exists as a JSON column and is empty (src: s2) ^c19
- ERP `HEIGHT` / `WIDTH` / `DEPTH` is inventory geometry and was observed zero on relevant `90*` packaging SKUs (src: s2) ^c20
- Order BOM `NON_FOOD` components are the physical containers and wraps on the ticket and have no join to Packaged Size (src: s2) ^c21
- The tag is initialized from packaging footprint and then used as a one-dimensional capacity score; KDS never re-reads L/W/H (src: s1, s4) ^c22
- Jakob's Expo simulation showed the proxy is coarse: under current hot-spot rules, most t-shirt-"fits" still overflowed when packed with real dimensions (src: s4) ^c23
- Directed Expo originally chose t-shirt sizes because live packaging-dimension data was not trusted as a runtime input (src: s7) ^c24
- The Runner bag PRD still lists "use item dimensions instead" as a last-resort follow-up, not as current bag-recommendation behavior (src: s7) ^c25

## Evidence
Footprint bins from the Expo T-Shirt Size Optimization audit (src: s4):

| Size | Footprint |
| --- | --- |
| XS | < 10.0 in² |
| S | < 35.0 in² |
| M | < 65.0 in² |
| L | < 100.0 in² |

Tag → Expo unit mapping (src: s7, s1):

| Cookbook tag | PRD t-shirt weight | KDS Expo units |
| --- | ---: | ---: |
| XS | 0.25 | 1 |
| S | 0.50 | 2 |
| M | 1.00 | 4 |
| L | 2.00 | 8 |
| XL | 4.00 (bundles) | 16 |

Bag capacities (src: s7, s10):

| Bag | PRD t-shirt capacity | Expo units in `BagSize` |
| --- | ---: | ---: |
| Small | 1.00 (was 1.75 until 2026-08-11) | 4 (was 7) |
| Medium | 3.75 | 15 |
| Large | 8.75 | 35 |

Nearby fields that are not Packaged Size:

| Nearby field | Relationship |
| --- | --- |
| Cookbook `Logistics.dimensions` / ItemUOM L/W/H | Separate physical-packaging model; unused by bag recommendation. See [[cookbook-physical-packaging-data-model-and-drone-eligibility-feasibility-2026-07-23]]. |
| Product Catalog `wonder_items.dimension` | Exists as a JSON column and is empty. |
| ERP `HEIGHT` / `WIDTH` / `DEPTH` | Inventory geometry; observed zero on relevant `90*` packaging SKUs. |
| Order BOM `NON_FOOD` components | Physical containers and wraps on the ticket; no join to Packaged Size. |

## Sources
- s1 · <local-repo>/kds/backend/kitchen-cooking-service-v2/src/main/java/app/kcsv2/common/domain/PackagedItemSize.java · unverified · source · `<local-repo>/kds/backend/kitchen-cooking-service-v2/src/main/java/app/kcsv2/common/domain/PackagedItemSize.java`
- s2 · [[cookbook-packaged-size-warehouse-landing-2026-08-20]] · @pin · record
- s3 · <local-repo>/kds/backend/kitchen-cooking-service-v2/src/main/java/app/kcsv2/linebuild/domain/LineBuildProcedure.java · unverified · source · `<local-repo>/kds/backend/kitchen-cooking-service-v2/src/main/java/app/kcsv2/linebuild/domain/LineBuildProcedure.java`
- s4 · [[expo-t-shirt-size-optimization-2026-06-24]] · @pin · record
- s5 · https://wonder.atlassian.net/wiki/spaces/~7120200ee1df0596dc4514b0733807c1362aa9/pages/5407965201/Expo+T-Shirt+Size+Optimization · fetched:2026-08-20 · source · no-snapshot
- s6 · [[Wonder/Other Team/IKC/Expo T-Shirt Size Optimization]] · @pin · source · file not present in the Pilot checkout
- s7 · https://wonder.atlassian.net/wiki/spaces/~712020a23d399f56f34b208584dc6e78d90758/pages/5152079922/Bag+Size+Recommendations+at+Runner+Scanning+-+Product+Requirements+Document+PRD · fetched:2026-08-20 · source · no-snapshot · Runner bag-recommendation PRD
- s8 · <local-repo>/kds/backend/kitchen-cooking-service-v2/src/main/java/app/kcsv2/prescriptiveexpo/domain/PlaceableItem.java · unverified · source · `<local-repo>/kds/backend/kitchen-cooking-service-v2/src/main/java/app/kcsv2/prescriptiveexpo/domain/PlaceableItem.java`
- s9 · [[kds-bag-recommendation-feature-and-algorithm-2026-07-22]] · @pin · record
- s10 · <local-repo>/kds/backend/kitchen-cooking-service-v2/src/main/java/app/kcsv2/runner/domain/enums/BagSize.java · unverified · source · `<local-repo>/kds/backend/kitchen-cooking-service-v2/src/main/java/app/kcsv2/runner/domain/enums/BagSize.java`
- s11 · [[cookbook-physical-packaging-data-model-and-drone-eligibility-feasibility-2026-07-23]] · @pin · record

## History
- 2026-08-20 · verified by process:cook
- 2026-08-20 · [[#^c1]] to [[#^c25]] added · src: s1 to s11 · by process:cook
- Small bag capacity is 1.75 PRD t-shirt capacity, 7 Expo units in `BagSize` (src: s7, s10) · superseded 2026-08-11 by [[#^c14]] · `KDS-3887` changed Small from 7 to 4 after the Larchmont / Pleasantville pilot · src: s10 · by process:cook ^c26

## Related
- [[expo-t-shirt-size-optimization-2026-06-24]] — footprint thresholds, legacy vs optimized weights, Expo shelf simulation
- [[cookbook-packaged-size-warehouse-landing-2026-08-20]] — BigQuery landing tables, grain examples, empty dimension fields
- [[kds-bag-recommendation-feature-and-algorithm-2026-07-22]] — the first-fit-decreasing bag packer that consumes the tag
- [[kds-pre-order-bag-recommendation-feasibility-2026-07-16]] — pre-order bag recommendation feasibility
- [[cooking-item]] — the row grain the tag attaches to
- [[vending-items]] — vending tasks also carry the tag
- [[kds]] — the runtime consumer of the tag
