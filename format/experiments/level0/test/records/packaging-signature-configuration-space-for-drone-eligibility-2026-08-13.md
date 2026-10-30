---
type: record
title: Packaging Signature Configuration Space for Drone Eligibility (2026-08-13)
description: How large the menu-item x NON_FOOD-component packaging-signature configuration space is and what its coverage curve looks like, from BigQuery over orders 2026-07-25 to 2026-08-04 as analysed on 2026-08-13; the signature is superseded as an MVP runtime identity and the page does not cover the Cart-native identity that replaced it.
date: 2026-08-13
kind: finding
tags:
  - analysis
  - bigquery
  - drone-delivery
status: superseded
superseded_by:
  - "[[drone-checkout-cart-profile-identity-and-container-schema-2026-08-31]]"
updated: 2026-09-03
updated_by: process:cook
verified: 2026-09-01
verified_by: process:cook
aliases:
  - Packaging Signature Configuration Space
  - 包装签名配置空间分析
---

# Packaging Signature Configuration Space for Drone Eligibility (2026-08-13)

## Summary

This page is a historical BigQuery analysis of the menu-item x NON_FOOD-component signature space. Order-level analysis had shown that 57.46% of 1P delivery orders contain at least one line item with option-level NON_FOOD components, which broke the MVP dimensions eligibility proposal's assumption that "menu item" is the right grain for physical validation. The page measures the alternative grain, the packaging signature: the canonical sorted multiset of a line item's NON_FOOD component item numbers. The measured variation remains useful evidence, but the Cookbook-dependent signature is superseded as an MVP runtime identity; see [[drone-checkout-cart-profile-identity-and-container-schema-2026-08-31|Drone Checkout Cart Profile Identity and Container Schema (2026-08-31)]].

## Detail

> [!warning] Superseded runtime design
> This page's `menu item number + sorted NON_FOOD component item numbers` signature belonged to the earlier Cookbook-dependent allowlist design. It is **not** the current MVP runtime key and should not be rebuilt inside Delivery Catalog. Under Rob's current proposal, MVP identity should be derived from Consumer Cart and OMS Order fields, then map to a Delivery-owned profile and `containers[]`. The component signature remains only an offline analytical device showing that one menu item can have multiple physical outputs. See [[drone-checkout-cart-profile-identity-and-container-schema-2026-08-31|Drone Checkout Cart Profile Identity and Container Schema (2026-08-31)]].

### Question

Order-level analysis showed 57.46% of 1P delivery orders contain at least one line item with option-level NON_FOOD components — roughly constant across order sizes (~54% even for single-item orders), implying default options rather than user modifications drive most of it (see [[customization-packaging-delta-verification-for-drone-eligibility-2026-08-13|Customization Packaging Delta Verification]]).

This breaks an implicit assumption of the [[1P Drone Delivery MVP Dimensions Eligibility Proposal (2026-08-12)|MVP dimensions eligibility proposal]]: that "menu item" is the right grain for physical validation, with customization as an exceptional state to be excluded. If the majority of shipped line items carry option-level packaging, the plain build is not the representative physical form.

**This note measures the alternative grain: the packaging signature.** A line item's signature is the canonical multiset of its NON_FOOD component **item numbers** (base BOM + option-value BOM, duplicates preserved, sorted; `<none>` when the item has no NON_FOOD rows). Question: how large is the (menu item, signature) configuration space, and what does its coverage curve look like?

### Method

- Window and filters identical to prior analyses: orders 2026-07-25 through 2026-08-04, `order_business_type = 'WONDER_HDR'`, `dining_option = 'DELIVERY'`, `order_channel IN ('APP','WEB')`; 228,208 line items.
- Signature per line item: `STRING_AGG(item_number ORDER BY item_number)` over the union of `order_item_components` and `order_item_option_value_components` rows with `object_type = 'NON_FOOD'`.
- Configuration = (menu `item_number`, signature). Configurations ranked by line-item frequency; whole-order coverage at top-N counts an order only when **every** line item's configuration ranks within top N.

#### Key verification: item numbers on both halves

Per Jakob (Cookbook), the stable identity for a logical item is the **item number** (`item_number`). Verified in the window, on both halves of the configuration key:

**Menu item half:**

- **Complete:** 0 of 228,208 line items missing `item_number`.
- **`menu_item_id` is unusable** as a logical key: instance-scoped, 64,849 distinct values in the window.
- **`menu_item_name` (used in the first draft of this analysis) silently merges distinct items:** 120 names map to more than one item number — 797 logical items were collapsed to 658 names.
- **Only 10 item numbers carry more than one name**, and inspection shows they are renames or recipe substitutions of the same item — `Kids Chicken Tenders` vs `Kids' Chicken Tenders`, `Chocolate Pudding` vs `Tejas Chocolate Pudding`, `Fettuccine` → `Linguine with Shrimp & Hazelnut Pesto`, five pasta items switching `Gluten-Free Casarecce` → `Gluten-Free Fusilli`. Names drift while the number holds — exactly the stability a validation key needs.

**Component half (inside the signature):**

- NON_FOOD component rows also carry `item_number`: 0 of 646,798 window rows missing.
- 147 distinct component numbers ↔ 147 distinct component names, exactly 1:1 in the window (no renames, no collisions), so number-based and name-based signatures produce identical partitions here — confirmed by identical counts (1,836 configurations, 797 items) under both encodings. Numbers are nevertheless the correct production definition: component display names can drift over time just as menu item names demonstrably do.
- Per Cookbook (Jakob, 2026-08-13), **material updates generate a new item number** — a physical packaging revision cannot ride under an existing number, so signature rotation covers physical revisions of packaging items, not only BOM composition changes. (Observed food-side substitutions — Casarecce → Fusilli — kept their numbers, so the versioning applies to an item's material identity rather than to every recipe edit.) The residual drift channel narrows to floor-level substitutions that never touch Cookbook.

All results below are keyed on item numbers throughout. (First-draft name-keyed values, for the record: 658 items, 1,479 configurations, 65.8% single-signature, 90.35% top-1 share; coverage within ~1–2 pp of the corrected values. Direction of every conclusion unchanged.)

### Results

#### The configuration space is small

| Metric | Value |
|---|---|
| Distinct menu items (by item number) | 797 |
| Distinct NON_FOOD packaging components (by item number) | 147 |
| Distinct (item, signature) configurations | **1,836** |
| Average signatures per item | 2.30 |
| Items with exactly 1 signature | 485 (60.9%) |
| Average share of an item's volume on its top-1 signature | 87.68% |

Customization-driven packaging variance is concentrated: roughly 60% of items have exactly one packaging form in practice, and even for the variable items, the top signature carries ~88% of volume.

#### Coverage curves

| Top-N configurations validated | Line-item coverage | Whole-order coverage (all items in top-N) |
|---|---|---|
| 200 | 73.74% | 40.21% |
| 350 | 86.58% | **64.17%** |
| 500 | 92.77% | **79.26%** |
| 1,000 | 98.73% | 95.90% |

#### Benchmark against the item-grain design

Blanket exclusion of customized items caps whole-order coverage at **42.54%** (100% − 57.46%) even if every menu item were physically validated. A signature-grain allowlist passes that ceiling at roughly N≈220 validated configurations and reaches 64.17% at N=350.

### Historical Implication for the 2026-08-13 Allowlist Design

The signature-grain design dominates the item-grain design on every axis measured here:

1. **Customization ceases to be a separate rule.** A configuration either is physically validated or it is not; default options, user modifications, and plain builds are all just configurations. Rule 3 of the proposal dissolves into Rule 1.
2. **The binding key and the drift defense collapse into the same mechanism.** The signature recomputed at order time from the resolved BOM *is* the binding key; any Culinary packaging change alters the signature and automatically drops the configuration out of the validated set — failure lands on the cheap side. Notably, the 10 rename cases show item identity surviving food-side recipe tweaks; the signature guards the packaging side independently.
3. **Validation effort is bounded and the marginal cost is low.** 1,836 total configurations, and an item's secondary signatures typically differ from its primary by small additive delta components (souffle cups, soup cup, 48 oz bowl, labels), so validating them alongside the primary is nearly free.
4. **Validation must target top signatures, not plain builds.** For items whose volume is dominated by option-carrying configurations, physically validating the plain build would certify a form that rarely ships — a correctness gap in the original plan, independent of coverage.

The BYOB stress test reinforces this separation between customization and packaging complexity: the most heavily customized observed lines carried 19 applied option values across seven groups, but their packaging signatures contained only seven or eight entries representing five or six distinct NON_FOOD items. See [[byo-bowl-packaging-signature-worked-example-2026-08-13#Customization breadth does not create a large packaging signature|BYOB customization stress test]].

Current correction: do not use this signature for Checkout lookup or fallback. The MVP candidate path avoids Cookbook/BOM component resolution and instead normalizes the Cart's own item, option, bundle, variation, serving-size, and quantity fields into a configuration identity. Post-order OMS fields are used to validate that identity and bind Ops observations, not to recompute a Cookbook component signature.

## Sources
- s1 · [[Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Archive/Eligibility and Architecture/1P Drone Delivery MVP Dimensions Eligibility Proposal (2026-08-12)]] · @pin · source
- s2 · [[customization-packaging-delta-verification-for-drone-eligibility-2026-08-13]] · @pin · record
- s3 · [[order-packaging-geometry-feasibility-for-drone-dimension-eligibility-2026-08-12]] · @pin · record
- s4 · [[byo-bowl-packaging-signature-worked-example-2026-08-13]] · @pin · record
- s5 · wonder-raw-prod.mysql_batch_order.order_item_components · unverified · source · BigQuery table, as written
- s6 · wonder-raw-prod.mysql_batch_order.order_item_option_value_components · unverified · source · BigQuery table, as written
- s7 · wonder-raw-prod.mysql_batch_order.order_items · unverified · source · BigQuery table, as written
- s8 · wonder-raw-prod.mysql_batch_order.orders · unverified · source · BigQuery table, as written
- s9 · human:jakob · stated:2026-08-13 · attestation · Jakob (Cookbook), via Jay: the item number is the stable identity for a logical item, and material updates generate a new item number
- s10 · human:jay · stated:2026-08-13 · attestation · Conversation between Jay and Claude, 2026-08-13; the page does not isolate what was agreed
- s11 · [[zipline-pack-as-eligibility-oracle-direction-2026-08-20]] · @pin · record
- s12 · [[drone-checkout-cart-profile-identity-and-container-schema-2026-08-31]] · @pin · record

## History
- 2026-09-01 · verified by process:cook

## Related
- [[byo-bowl-packaging-signature-worked-example-2026-08-13|BYO Bowl Packaging Signature Worked Example (2026-08-13)]] — single-item teaching example: Build-Your-Own Bowl's base/option BOM structure, its six measured signatures, and why the plain build (4.32% of volume) is the wrong validation target
- [[drone-checkout-cart-profile-identity-and-container-schema-2026-08-31|Drone Checkout Cart Profile Identity and Container Schema (2026-08-31)]] — current Cart/Order-native identity direction
