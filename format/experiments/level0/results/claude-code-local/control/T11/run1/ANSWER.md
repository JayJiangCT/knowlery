# ANSWER: Ground job after a Zipline job — reallocation or post-custody recovery?

## Answer

**It depends on the custody stage, and under the current design the only path that produces a Ground job on the *same order* after a Zipline job is a pre-custody reallocation.** A post-custody failure is handled as refund / remake / new-delivery recovery that, by design, must *not* create a same-order Ground reallocation. The Dispatch Portal view alone cannot tell you which case you are looking at; you need the Zipline job's custody stage.

### Pre-custody: it is a reallocation

Before Zipline takes custody, Wonder still holds the package, and four designed flows end the Zipline job and create a Ground job for the same order:

| Trigger | Source | Key wording |
| --- | --- | --- |
| Ops manual reallocation in Dispatch Portal | [[DELI-4662]] (`Wonder/Wonder Fulfillment/Sprints/2026/SP22/JIRA Tickets/DELI-4662.md`, lines 34–48) | "A valid pre-custody reallocation stops the original Zipline delivery and creates a Ground delivery with the selected eligible provider." |
| KOS-initiated switch after order modification | [[DELI-4673]] (`.../SP22/JIRA Tickets/DELI-4673.md`, lines 44, 52) | "Delivery creates the Ground delivery first, then cancels the Zipline delivery." |
| CX-requested Drone → Courier switch in CCP | [[DELI-4681]] (`.../SP22/JIRA Tickets/DELI-4681.md`, lines 42–43, 52) | "A courier is arranged before the drone delivery is cancelled"; not allowed for "orders already handed over to Zipline." |
| Automatic Ground fallback when the Delivery Intent cannot be created (`QUOTE_EXPIRED` retry fails) | High-Level System Alignment (`.../1P Drone Delivery High-Level System Alignment - MVP.md`, lines 141–153; page is `status: archived`) | "mark and archive the Zipline Job, then let the existing provider allocation loop create a **new Ground Job** with Zipline excluded." Automatic fallback "applies only when the Delivery Intent cannot be definitively established." |

Also pre-custody: if the Ground creation in the KOS-initiated flow fails, Ops may see a *Failed* Ground job plus a Zendesk ticket asking them to reallocate ([[DELI-4673]] line 54).

How to disambiguate in the Portal: the Force Complete design ([[DELI-4663]], `.../SP22/JIRA Tickets/DELI-4663.md`, lines 35, 46) shows failure reasons "matching the current Drone custody stage," so the Portal is designed to know the Zipline job's custody stage; read it from the Zipline job, not from the presence of the Ground job.

Supporting design pages:

- `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Archive/Eligibility and Architecture/1P Drone Delivery High-Level System Alignment - MVP.md`, lines 176–177: "Operations may attempt to cancel the Intent and manually reallocate the order to Ground through the existing Dispatch flow. Ground reallocation creates a new provider Job; it does not reuse the Zipline Job." (page is `status: archived`)
- `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Use Case/1P Drone Delivery Non-Happy Path Cases.md`, Case 2 table (lines 97–98) and Case 3 (line 129): pre-custody failures end in "manual Ground reallocation in Dispatch Portal."
- [[DELI-4660]] (`.../SP20-21/JIRA Tickets/DELI-4660.md`, line 48) explicitly anticipates "A Ground job, including one created after a Zipline fallback" appearing in the Portal.

### Post-custody: by design, no same-order Ground job

- [[DELI-4662]] line 46: "A job that has completed custody transfer cannot be reallocated to Ground as the same order."
- [[DELI-4665]] (`.../SP22/JIRA Tickets/DELI-4665.md`, line 47): "A post-custody Drone failure records the selected reason, ends the current delivery job, and does not make the same order eligible for Ground reallocation."
- High-Level System Alignment, lines 160 and 185–188: "Post-custody recovery creates a refund, remake, or new delivery according to CX policy; it never reuses the original package." / "There is no same-package Ground fallback."
- [[queries/zipline-dropbox-lock-custody-and-failure-disposition-contract-2026-07-28|Zipline Dropbox Lock Custody and Failure Disposition Contract]] (`queries/zipline-dropbox-lock-custody-and-failure-disposition-contract-2026-07-28.md`, lines 58, 60, 68, 175): post-lock → "Block ... original-package Reallocation"; "Approved refund, remake, or new-delivery recovery; never same-package Ground fallback"; "The original package cannot return to Wonder or be Reallocated to Ground."
- Human corroboration: Sprint 22 Meeting Notes (`Wonder/Wonder Fulfillment/Sprints/2026/SP22/Agenda/Meeting Notes.md`, lines 33, 62): "Post-custody return to IKC is unavailable"; Rob "explained that the package cannot be recalled to IKC once it is in the Dropbox." (page is `status: draft`)
- [[queries/oms-cancellation-and-delivery-reallocation-control-gaps-for-drone-mvp-2026-07-27|OMS Cancellation and Delivery Reallocation Control Gaps]] (`queries/oms-cancellation-and-delivery-reallocation-control-gaps-for-drone-mvp-2026-07-27.md`, lines 64, 72, 244–246): same boundary, bound to `DELIVERY_INTENT_STATUS_IN_PROGRESS`.

The vault does **not** establish how a post-custody "new delivery" (e.g. after a remake) would surface in the Portal — whether as a Ground job on the same order ID or on a new order. That orchestration is listed as still open (OMS control-gaps page, line 218: "Wonder orchestration for refund, remake, new delivery ... "). So if a same-order Ground job appears after a Zipline job that had already reached custody, the vault's design says that is either a guardrail violation or an undefined recovery path, not an expected state.

### A conflicting note in the vault

`concepts/zipline-drone-deliveries-in-dispatch-portal.md`, lines 75–77 ("Custody and fallback note (2026-10-30)") states: "a Ground job that appears after it is a post-custody recovery rather than a reallocation of the same delivery." I do not treat this as the current answer:

- It generalizes a conditional ("once ... `IN_PROGRESS`") into a blanket rule, and the pre-custody reallocation flows above contradict the blanket reading.
- It cites DELI-4660, but DELI-4660 line 48 describes the *fallback/reallocation* case — the opposite of what the note claims.
- It leans on the strategy page's custody boundary, which is now marked disputed (next section).
- The page is `retrieval_priority: medium`; `git log` shows the note arrived in the baseline commit (`2150112`) with no new source behind it.

## How much to trust this right now

1. **The custody boundary itself is disputed.** `concepts/drone-delivery-integration-strategy.md` is `freshness_status: disputed` (commit `dc7a2ce`, "Strategy: custody signal disputed"); line 271: "`DELIVERY_INTENT_STATUS_IN_PROGRESS` is the authoritative irreversible custody boundary; **DISPUTED 2026-10-29**: a Zipline engineer reportedly said on 2026-10-27 that `DELIVERY_STATUS_PICKED_UP` marks custody instead; unconfirmed." No other page in the vault records the 2026-10-27 claim (grep for `PICKED_UP` finds only unrelated Grubhub/RCA notes). This moves *where* the pre/post line sits, not whether the reallocation-vs-recovery distinction exists. Every other page still states `IN_PROGRESS` (partner-confirmed contract `queries/zipline-mvp-partner-confirmed-contract-2026-07-30.md` line 51; OMS control-gaps page lines 64, 70; dropbox-lock contract lines 125, 175).
2. **Nothing is deployment-verified.** DELI-4662 and DELI-4665 are drafts "Not yet created in Jira" (2026-09-28). DELI-4673 was "In QA" as of 2026-10-27. DELI-4681 is `todo` (2026-10-23). The Non-Happy Path Cases page is `status: draft`; the High-Level System Alignment page is `status: archived`.
3. **Highest-confidence sources** for the distinction are the two `retrieval_priority: high`, `freshness_status: active` query pages (OMS control gaps, reviewed 2026-10-19; dropbox-lock contract, updated 2026-10-19) plus the SP22 tickets. They agree with each other.

Net: the *design intent* (pre-custody → reallocation; post-custody → no same-order Ground job) is well supported and consistent across sources. The *exact event that marks custody* and the *actual deployed behavior* are not confirmed.

## Vault-relative paths relied on

- `concepts/zipline-drone-deliveries-in-dispatch-portal.md`
- `concepts/drone-delivery-integration-strategy.md`
- `queries/oms-cancellation-and-delivery-reallocation-control-gaps-for-drone-mvp-2026-07-27.md`
- `queries/zipline-dropbox-lock-custody-and-failure-disposition-contract-2026-07-28.md`
- `queries/zipline-mvp-partner-confirmed-contract-2026-07-30.md`
- `queries/zipline-ground-delivery-compatibility-and-synthetic-courier-contract.md`
- `queries/1p-drone-delivery-consumer-ccp-oms-alignment-decisions-2026-08-26.md`
- `Wonder/Wonder Fulfillment/Sprints/2026/SP22/JIRA Tickets/DELI-4662.md`
- `Wonder/Wonder Fulfillment/Sprints/2026/SP22/JIRA Tickets/DELI-4663.md`
- `Wonder/Wonder Fulfillment/Sprints/2026/SP22/JIRA Tickets/DELI-4665.md`
- `Wonder/Wonder Fulfillment/Sprints/2026/SP22/JIRA Tickets/DELI-4673.md`
- `Wonder/Wonder Fulfillment/Sprints/2026/SP22/JIRA Tickets/DELI-4681.md`
- `Wonder/Wonder Fulfillment/Sprints/2026/SP22/Agenda/Meeting Notes.md`
- `Wonder/Wonder Fulfillment/Sprints/2026/SP20-21/JIRA Tickets/DELI-4660.md`
- `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Use Case/1P Drone Delivery Non-Happy Path Cases.md`
- `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Archive/Eligibility and Architecture/1P Drone Delivery High-Level System Alignment - MVP.md`
- `AGENTS.md` (operating rules)

## Unable to establish

- Whether the 2026-10-27 `DELIVERY_STATUS_PICKED_UP` custody claim is true; the vault holds only the one-line disputed flag with no source note.
- Whether any of DELI-4662 / 4665 / 4673 / 4681 is deployed; all are draft, todo, or in QA.
- How a post-custody remake / new delivery appears in the Dispatch Portal (same order ID or new order).
- [[DELI-4661]] (the FE Drone Reallocation story, parent of DELI-4662) is referenced but not present in the vault.
- No `.knowlery/freshness/` sidecars exist, so no detailed freshness findings were available.

## Files changed

None besides this `ANSWER.md`. The task was answer-only; I did not edit the concept page's 2026-10-30 note, only flagged it above. `.knowlery/activity-disabled` exists, so no activity record was written. No `log.md` entry since no knowledge pages were modified.
