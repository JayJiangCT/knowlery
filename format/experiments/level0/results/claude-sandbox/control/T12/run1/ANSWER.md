# Answer: MVP outer package for Zipline drone orders

## Short answer

**What the vault records as the decision:** the MVP default outer package is the **new Medium Wonder bag, nominal 12 × 8.5 × 13 in**, per Rob Knudson's Weight and Dimension Eligibility PRD v26. Small is an IKC-staff operational fallback only; Large is out of scope. Source: [[drone-mvp-medium-bag-outer-package-decision]] (`queries/drone-mvp-medium-bag-outer-package-decision.md`, `updated: 2026-10-19`, `freshness_status: active`, `retrieval_priority: high`):

> "The MVP default is the **new Medium Wonder bag, 12 × 8.5 × 13 in**, per PRD v26. Small may be used at IKC staff discretion when a specific order can safely be packed smaller; Large must not be used for Drone delivery."

**Is it still in force?** The vault does **not** support treating it as settled. Three things cut against it, the most recent being a direct human marker:

1. **Human withdrawal marker (2026-10-30, newest evidence).** The underlying source note `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Slack Clarification - Drone MVP Medium Bag Selection - 2026-08-12.md` carries frontmatter `decision_status: withdrawn`. Git shows this was added by Jay Jiang on 2026-10-30 in commit `37a69d9` ("Medium bag note: decision withdrawn (frontmatter)"), as a one-line frontmatter change with no explanatory body text. This postdates the compiled page's 2026-10-19 freshness review and has not been propagated to `queries/drone-mvp-medium-bag-outer-package-decision.md`, which still says `status: active` / `freshness_status: active`.
2. **Zipline rejection recorded in the PRD plan (updated 2026-10-27).** `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/PRD/Drone Eligibility Check - MVP Plan - 2026-09-17.md` (line 86) states: "Zipline rejected Wonder's medium bag on 2026-09-17 and a replacement is being sourced; the plan assumes the final bag is as close to the dropbox interior as possible and uses the dropbox interior as the envelope until then." Its risk register (line 514, risk 10 "Bag not final") and open-items table (line 534, Stephen Acciaioli: "Replacement bag ... Open") were not revised to reflect PRD v26 even though the file was last updated 2026-10-27, eight days after the compiled page declared the new Medium validated.
3. **Sibling compiled pages still say the bag is pending.** `queries/1p-drone-delivery-checkout-package-dimensions-contract-2026-07-16.md` (`freshness_status: watch`, line 57), `queries/drone-package-recommendation-ownership-and-kds-boundary.md` (line 48), and `queries/1p-drone-delivery-weight-and-dimension-eligibility-current-proposal-2026-08-31.md` (`updated: 2026-10-26`, line 57) all carry a 2026-09-20 callout: "The final outer-bag profile is still pending ... Stephen has requested two new bag sizes expected to be slightly smaller than the Dropbox; both will be sent to Zipline for further testing." The 2026-10-26 refresh of the last page did not remove that caution. `concepts/drone-delivery-integration-strategy.md` (line 284–286) still describes the *existing* Medium bag as the preferred outer package, which the decision page itself already calls historical.

**Net assessment:** the only page asserting the new Medium as a validated default is a single compiled page resting on PRD v26 as read by the agent, with the decision page itself noting "a separate Zipline test report was not inspected." Against it stand a later-edited PRD plan still carrying "bag not final / replacement being sourced," three pages with unretired "pending" cautions, and an explicit human `decision_status: withdrawn` marker dated today on the decision's primary Slack source. The decision should be treated as **withdrawn or at minimum disputed, not in force**, until the compiled page is reconciled with the withdrawal marker and the PRD plan.

## What does not change regardless

- The Zipline provider envelope is a separate fact: `338 × 252 × 205 mm`, `2495 g` ([[zipline-mvp-partner-confirmed-contract-2026-07-30]]; `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Zipline Payload Dimensions Slide - Week of 2026-09-07.md` confirms the Envelope card and says not to treat the 254 mm render label as a change). The decision page's "current" envelope width of 254 mm conflicts with this slide note's 252 mm.
- Zipline Pack remains the order-level fit authority; bag validation does not approve every cart ([[zipline-pack-as-eligibility-oracle-direction-2026-08-20]], decision page "Short Answer").

## Decision timeline (from the vault)

| Date | Event | Source |
| --- | --- | --- |
| 2026-08-12 | IKC Ops / Stephen: use existing Medium bag (fits 3D printed Pod sample) | Slack Clarification note |
| 2026-09-17 | Zipline rejected Wonder's medium bag; replacement being sourced | PRD plan line 86 |
| 2026-09-20 | Stephen requested two new, slightly-smaller bag sizes for Zipline testing | callouts in three query pages |
| 2026-10-19 | PRD v26: new Medium 12 × 8.5 × 13 in validated, default launch bag | decision page |
| 2026-10-27 | PRD plan re-edited but still lists bag as not final | PRD plan frontmatter + lines 514, 534 |
| 2026-10-30 | Jay marks the Slack source `decision_status: withdrawn` | git commit `37a69d9` |

## Files relied on (vault-relative)

- `AGENTS.md`
- `queries/drone-mvp-medium-bag-outer-package-decision.md`
- `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Slack Clarification - Drone MVP Medium Bag Selection - 2026-08-12.md` (plus `git log` / `git show 37a69d9` on it)
- `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/PRD/Drone Eligibility Check - MVP Plan - 2026-09-17.md`
- `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Zipline Payload Dimensions Slide - Week of 2026-09-07.md`
- `queries/1p-drone-delivery-checkout-package-dimensions-contract-2026-07-16.md`
- `queries/drone-package-recommendation-ownership-and-kds-boundary.md`
- `queries/1p-drone-delivery-weight-and-dimension-eligibility-current-proposal-2026-08-31.md`
- `concepts/drone-delivery-integration-strategy.md`
- `Wonder/Wonder Fulfillment/Sprints/2026/SP18/Planning/1P Drone Delivery MVP Sprint Timeline.md`
- `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Order Delivery Bag Specifications (for Jay).md`
- `SCHEMA.md` (checked for `decision_status`; the field is not defined there)

Retrieval ran via `node .knowlery/bin/query.mjs "Zipline drone outer package MVP"`; ranked results 1–12 were used to pick candidates. Grep was used afterwards to find withdrawal/rejection language the ranked list did not surface.

## Unable to establish

- **What exactly was withdrawn.** `decision_status: withdrawn` is a bare frontmatter flag with no body text, no date field, and no link to a replacement. It could mean the 2026-08-12 "existing Medium" preference (already superseded) or the Medium-bag decision as a whole. `SCHEMA.md` does not define `decision_status`, so there is no vault convention to interpret it against.
- **Whether PRD v26 postdates and overrides the 2026-09-17 Zipline rejection**, or whether the decision page misread the PRD. The PRD itself is a Confluence link, not in the vault; the decision page admits the Zipline test report was not inspected.
- **Which bag SKU the "new Medium 12 × 8.5 × 13 in" corresponds to.** It matches neither the current Medium (10.5 × 10.5 × 12 in) nor the August 2026 new Medium (13 × 10 × 13 in) in `Order Delivery Bag Specifications (for Jay).md`.
- Fill line, folded height, tare, orientation rules, and the partner-site payload configuration — all listed as open in every page consulted.

## Files changed

None of the vault's knowledge or user notes were modified. The only file created is this `ANSWER.md`, as the task required. No activity-ledger record was written (the task did not call for vault changes beyond this file).
