# Answer: MVP outer package for Zipline drone orders, and whether the decision stands

## Short answer

**What the vault records as the MVP outer package:** a Wonder **Medium bag**. The most recent compiled statement is that the MVP default is the **new Medium Wonder bag, nominal 12 × 8.5 × 13 in**, per Rob Knudson's Weight and Dimension Eligibility PRD v26 (2026-10-19), with Small as an IKC-staff operational fallback and Large out of scope ([[queries/drone-mvp-medium-bag-outer-package-decision]], "Current status (2026-10-19)" and "Short Answer"; echoed in [[queries/zipline-pack-as-eligibility-oracle-direction-2026-08-20]] line 53). This is a Wonder-side bag choice; it does not change the Zipline provider envelope (`338 × 254 × 205 mm / 2495 g` per the compiled page, `338 × 252 × 205 mm` in the MVP Plan PRD).

**Is the decision still in force?** The vault does **not** support an unqualified "yes". The evidence is in conflict and the question should be treated as **disputed / unconfirmed**:

1. **The source note for the original Medium-bag decision has been marked withdrawn by the user.** `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Slack Clarification - Drone MVP Medium Bag Selection - 2026-08-12.md` carries `decision_status: withdrawn` in its frontmatter. Git shows this was added by Jay Jiang on 2026-11-02 (commit `15ce0fd`, "Medium bag note: decision withdrawn (frontmatter)") — i.e. *after* the compiled page's last update (2026-10-19). No other note in the vault uses `decision_status`, and `SCHEMA.md` does not define the field, so its exact scope (the 2026-08-12 "existing Medium" direction only, or the Medium-bag choice as a whole) cannot be established from the vault. The compiled page `queries/drone-mvp-medium-bag-outer-package-decision.md` still shows `status: active`, `freshness_status: active` and has not been updated to reflect the withdrawal.

2. **The most recently updated user note says the bag is not final.** `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/PRD/Drone Eligibility Check - MVP Plan - 2026-09-17.md` (`updated: 2026-10-27`, `status: draft`) states: "Zipline rejected Wonder's medium bag on 2026-09-17 and a replacement is being sourced; the plan assumes the final bag is as close to the dropbox interior as possible and uses the dropbox interior as the envelope until then" (line 86); "**Bag not final.** Zipline rejected the medium bag; the replacement's inner dimensions and empty weight are unknown" (line 514); and the pre-launch checklist keeps "Replacement bag as close to the dropbox interior as possible; its inner dimensions and empty weight; partner-site payload configuration updated to the final bag" as **Open**, owned by Zipline / packaging (Stephen Acciaioli) (line 534).

3. **The compiled page's "current status" rests on an external source not in the vault.** The PRD v26 claim (new 12 × 8.5 × 13 in Medium validated by Zipline) cites a Confluence URL; the page itself notes "a separate Zipline test report was not inspected in this update" and lists the SKU, tare, tested fill/fold limits, partner-site configuration, and the mapping to the September candidate bags as **Not Confirmed**. It is plausible that the "medium bag" Zipline rejected on 2026-09-17 is the older Medium spec and the 12 × 8.5 × 13 in bag is its validated replacement, but no vault note states that reconciliation.

4. **Older compiled pages already downgraded the Medium direction to historical.** [[queries/drone-package-recommendation-ownership-and-kds-boundary]] (line 48), [[queries/1p-drone-delivery-checkout-package-dimensions-contract-2026-07-16]] (lines 59, 320) and [[queries/1p-drone-delivery-weight-and-dimension-eligibility-current-proposal-2026-08-31]] (lines 57–58, updated 2026-10-26) all say the existing-Medium direction is "historical rather than final" and that Stephen requested two new, slightly-smaller-than-Dropbox bag sizes for Zipline testing. [[concepts/drone-delivery-integration-strategy]] (line 286) still describes the existing Medium bag as the outer package, citing the now-withdrawn Slack note.

**Bottom line:** The vault's best-supported statement is that a Medium Wonder bag (latest claimed spec: new 12 × 8.5 × 13 in, PRD v26) is the intended MVP outer package. Whether that decision stands is **not established**: the user withdrew the founding decision note on 2026-11-02, the most recent user-authored PRD note (2026-10-27) records the bag as rejected-and-replacement-pending, and the compiled "active" page has not been reconciled with either. Treat the Medium-bag decision as **disputed**; confirmation would need Rob's PRD (current version) or Stephen's replacement-bag result, neither of which is in the vault beyond the 2026-10-19 summary.

## Timeline as recorded in the vault

| Date | Event | Source |
| --- | --- | --- |
| 2026-07-29 | Catalog comparison: Small closest; Medium/Large likely ineligible against uncompressed dims | `queries/drone-mvp-medium-bag-outer-package-decision.md` table |
| 2026-08-12 | IKC Ops / Stephen Acciaioli: preferred plan is the existing Medium bag (fits 3D printed Pod sample); samples to be sent to Zipline | `Wonder/.../Slack Clarification - Drone MVP Medium Bag Selection - 2026-08-12.md` |
| 2026-09-17 | Zipline rejected Wonder's medium bag; replacement being sourced | `Wonder/.../PRD/Drone Eligibility Check - MVP Plan - 2026-09-17.md` lines 86, 514 |
| 2026-09-20 | Rob: Stephen requested two new bag sizes, slightly smaller than Dropbox, for Zipline testing | `queries/drone-package-recommendation-ownership-and-kds-boundary.md` line 48; `queries/1p-drone-delivery-weight-and-dimension-eligibility-current-proposal-2026-08-31.md` line 58 |
| 2026-10-19 | PRD v26 (external): new Medium 12 × 8.5 × 13 in validated by Zipline; default launch bag | `queries/drone-mvp-medium-bag-outer-package-decision.md` lines 42, 62 |
| 2026-10-27 | MVP Plan PRD note last updated; still says "Bag not final", replacement bag Open | `Wonder/.../PRD/Drone Eligibility Check - MVP Plan - 2026-09-17.md` |
| 2026-11-02 | Jay adds `decision_status: withdrawn` to the 2026-08-12 Slack note | git commit `15ce0fd` |

## Files relied on (vault-relative)

- `AGENTS.md`
- `queries/drone-mvp-medium-bag-outer-package-decision.md`
- `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Slack Clarification - Drone MVP Medium Bag Selection - 2026-08-12.md`
- `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/PRD/Drone Eligibility Check - MVP Plan - 2026-09-17.md` (frontmatter, lines 84–88, 510–536)
- `queries/zipline-pack-as-eligibility-oracle-direction-2026-08-20.md` (grep excerpts, lines 53, 65, 113, 134)
- `queries/drone-package-recommendation-ownership-and-kds-boundary.md` (line 48)
- `queries/1p-drone-delivery-checkout-package-dimensions-contract-2026-07-16.md` (lines 59, 320)
- `queries/1p-drone-delivery-weight-and-dimension-eligibility-current-proposal-2026-08-31.md` (lines 57–58, 159)
- `queries/1p-drone-delivery-eligibility-data-and-pack-contract-2026-08-21.md` (lines 113, 168, 181)
- `concepts/drone-delivery-integration-strategy.md` (lines 36, 284–286)
- `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Raw/Investigation - Cookbook Weight and Dimension Backfill Review - 2026-10-26.md` (grep only; no bag-decision content)
- `SCHEMA.md` (grep for `decision_status`: not defined)
- Read-only git: `git log`, `git show 15ce0fd`

## Unable to establish

- The intended scope of `decision_status: withdrawn` on the Slack note (only the 2026-08-12 "existing Medium" direction, or the Medium-bag MVP decision in general). The field is undocumented in `SCHEMA.md` and appears nowhere else.
- Whether the "medium bag" Zipline rejected on 2026-09-17 is the older Medium spec and the 12 × 8.5 × 13 in bag in PRD v26 is its validated replacement; no vault note reconciles the two.
- The current content of Rob's Weight and Dimension Eligibility PRD (any version after v26) and the Zipline test report; both are external Confluence/Slack sources only summarized in the vault.
- The final bag SKU, tare, tested fill/fold limits, orientation rules, and partner-site payload configuration (listed as Not Confirmed / Open in both the compiled page and the MVP Plan).
- No `.knowlery/freshness/` sidecars exist in this vault, and `.knowlery/bundles.json` is absent, so no additional freshness evidence was available.

## Files changed

- `ANSWER.md` (this file) — created as instructed by the task. No other vault files were created, edited, moved, or deleted. `.knowlery/activity-disabled` exists, so no Activity Ledger record was written.
