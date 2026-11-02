# ANSWER — Owner edit on the 2026-07-30 Zipline partner-contract page

## What changed

Commit `6627297` (author Jay Jiang, 2026-11-02, "Partner contract: dimensions also required (owner edit)") changed exactly one line of `queries/zipline-mvp-partner-confirmed-contract-2026-07-30.md`, in the **Short Answer**:

- before: "A fulfillment-capable direct-order Quote requires valid mass before Delivery Intent creation"
- after: "A fulfillment-capable direct-order Quote requires valid mass **and outer dimensions** before Delivery Intent creation"

Nothing else changed: `updated` stayed at 2026-09-15, no source was added, and the page's own Confirmed Contract table ("A Quote used for direct-order fulfillment requires valid package mass") was left as it was. The edit therefore made the page internally inconsistent and unsourced on this point.

## What it means for the vault

1. **The vault has no partner evidence that a Zipline Quote requires dimensions.** The 2026-07-30 P0 question and answer concern `mass_grams` only (`queries/zipline-mvp-final-partner-qa-working-draft-2026-07-26.md`). The Create Quote request has fields `partner_site_id`, `prep_time_minutes`, `recipient`, `mass_grams` and no dimension fields (`Wonder/.../Zipline API Doc/Create Quote.md`); the 2026-07-15 questions note states Create Quote "does not accept item dimensions". Dimension validation observed at runtime is on **Pack**, not Quote (`Findings.md`, `Zipline API Documentation Runtime Annotations - 2026-08-27.md`).
2. **What the vault does support** is a Wonder-side precondition: the package must pass the full envelope (`2495 g`, `338 × 254 × 205 mm`, approved outer package) before Quote/Intent — already stated in the same page's "Eligibility Service Impact" and in `queries/1p-drone-delivery-eligibility-evaluation-trigger-and-revalidation-contract-2026-07-16.md`.
3. **Resolution adopted:** keep the owner's sentence (not undone), and annotate it so readers interpret it as Wonder's pre-Intent envelope gate rather than a new Zipline Quote API field, with the partner evidence for a Zipline-side requirement marked pending. The page's `freshness_status` moves to `watch`. Four neighboring pages that restate the 2026-07-30 contract as "mass only" received a short cross-reference so retrieval does not surface a silent contradiction.

## Files changed and why

| File | Change |
| --- | --- |
| `queries/zipline-mvp-partner-confirmed-contract-2026-07-30.md` | Added `[!warning]` reconciliation callout under Short Answer; note appended to the "Quote mass by lifecycle role" table row; `updated` → 2026-11-02; `freshness_status` active → watch; `freshness_reviewed` → 2026-11-02. Owner's wording preserved. |
| `queries/zipline-discovery-vs-fulfillment-quote-mass-contract.md` | `[!note]` cross-reference in "Fulfillment Boundary"; `updated`/`freshness_reviewed` → 2026-11-02. |
| `queries/zipline-sandbox-quote-mass-gating-contract.md` | Annotation on item 3 of "Documentation Conflict"; `updated`/`freshness_reviewed` → 2026-11-02. |
| `queries/1p-drone-delivery-eligibility-evaluation-trigger-and-revalidation-contract-2026-07-16.md` | `[!note]` in "Historical RDP Capability Correction (2026-07-30)"; `updated`/`freshness_reviewed` → 2026-11-02. |
| `concepts/drone-delivery-integration-strategy.md` | Annotation on the "direct-order Quote requires reliable mass" bullet; `updated`/`freshness_reviewed` → 2026-11-02. |
| `log.md` | Created (did not exist); entry for this reconciliation. |
| `ANSWER.md` | This file. |

No user notes were modified. No activity-ledger record was written because `.knowlery/activity-disabled` exists. Nothing was committed.

## Paths relied on

- `AGENTS.md`, `SCHEMA.md`, `.claude/CLAUDE.md`, `KNOWLEDGE.md`, `.agents/rules/*.md`
- `queries/zipline-mvp-partner-confirmed-contract-2026-07-30.md` (and `git show 6627297`)
- `queries/zipline-mvp-final-partner-qa-working-draft-2026-07-26.md`
- `queries/zipline-discovery-vs-fulfillment-quote-mass-contract.md`
- `queries/zipline-sandbox-quote-mass-gating-contract.md`
- `queries/1p-drone-delivery-eligibility-evaluation-trigger-and-revalidation-contract-2026-07-16.md`
- `concepts/drone-delivery-integration-strategy.md`
- `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Zipline API Doc/Create Quote.md`
- `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Zipline API Doc/Create Delivery Intent.md`
- `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Zipline API Doc/Zipline API Documentation Runtime Annotations - 2026-08-27.md`
- `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Zipline API and Webhook Validation/Findings.md`
- `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Zipline Sandbox Quote Mass Validation Evidence - 2026-08-11.md`
- `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Questions for Zipline - Single-Delivery Guarantee and Multi-Delivery Handling (2026-07-15).md`

## Unable to establish

- Whether Zipline has actually (since 2026-09-15) told Wonder that a Quote needs dimensions. The commit message and the edit carry no source, and the Google Doc that the page cites is outside the vault. If such a confirmation exists, it should be added to `sources` and the Confirmed Contract row updated; the `watch` status can then return to `active`.
- Other pages that paraphrase the 2026-07-30 contract as "mass only" (e.g. `queries/zipline-drone-quote-and-package-eligibility-contract-2026-07-02.md`, `queries/zipline-integration-readiness-guide-2026-06-17.md`, `queries/1p-drone-delivery-high-level-system-alignment-mvp-2026-08-13.md`) were left untouched; they link to the annotated page, which now carries the reconciliation.
