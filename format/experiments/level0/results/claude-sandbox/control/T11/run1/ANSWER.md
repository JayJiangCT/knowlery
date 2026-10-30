# Answer: Ground job after a Zipline job — reallocation or post-custody recovery?

## Short answer

**The vault does not let you decide from job order alone.** A Ground job appearing in the Dispatch Portal after a Zipline job for the same order can be *either*:

- a **pre-custody reallocation / fallback** (same package, original Zipline Intent cancelled, Ground delivery created), or
- a **post-custody recovery** (a *new* fulfillment — remake plus new Ground delivery — because the original package is irreversibly in Zipline custody and cannot be reallocated).

Which one it is depends on **whether the Zipline Intent had crossed the custody boundary** when the Ground job was created. The vault's confirmed rule is that `DELIVERY_INTENT_STATUS_IN_PROGRESS` marks irreversible custody transfer; before it, Ground is a reallocation of the same package, after it, same-package reallocation is prohibited and any Ground job is customer recovery. **That boundary signal is, as of 2026-10-29, flagged disputed and unconfirmed**, which is the main reason the current answer cannot be fully trusted.

## Evidence

### 1. Both paths exist and both produce a Ground job after a Zipline job

- Pre-custody fallback → Ground job: "Before successful lock | IKC staff controls the package | Correct the load, retain the package, safely cancel the Intent, or manually Reallocate to Ground with a Drone-specific reason" — `queries/zipline-dropbox-lock-custody-and-failure-disposition-contract-2026-07-28.md` (L57). The same page: "IKC staff may use Drone-specific Ground Reallocation only while they still control the package before lock" (L64).
- Pre-custody CX switch → Ground job: DELI-4681 "A courier is arranged before the drone delivery is cancelled ... the drone delivery is cancelled with reason `DELIVERY_OPTION_CHANGED` and a courier delivers the same order" — `Wonder/Wonder Fulfillment/Sprints/2026/SP22/JIRA Tickets/DELI-4681.md` (L42–50); scoped to Drone orders at `PAID`/`ASSIGNED`/`IN_COOKING`, RFP excluded — `queries/oms-cancellation-and-delivery-reallocation-control-gaps-for-drone-mvp-2026-07-27.md` (L92).
- Pre-custody reallocation guardrail: "A valid pre-custody reallocation stops the original Zipline delivery and creates a Ground delivery with the selected eligible provider" and "A job that has completed custody transfer cannot be reallocated to Ground as the same order" — `Wonder/Wonder Fulfillment/Sprints/2026/SP22/JIRA Tickets/DELI-4662.md` (L44, L46).
- Post-custody recovery → new Ground delivery: "CX confirms whether the customer still wants the order, then chooses remake plus a new Ground delivery or refund" — `queries/zipline-dropbox-lock-custody-and-failure-disposition-contract-2026-07-28.md` (L115). "Post-custody handling is customer recovery, not original-package fallback" (L120). The Zendesk draft makes the same split: variant A pre-custody "reallocate the original package to Ground", variant B post-custody "must not be reallocated to Ground ... choose remake/new delivery or refund" — `queries/1p-drone-delivery-zendesk-ticket-templates-draft-2026-10-28.md` (L132–149).
- The Dispatch Portal UI spec itself refers to "A Ground job, including one created after a Zipline fallback" — `Wonder/Wonder Fulfillment/Sprints/2026/SP20-21/JIRA Tickets/DELI-4660.md` (L48) and `concepts/zipline-drone-deliveries-in-dispatch-portal.md` (L51). Nothing in the Portal spec says the portal labels the Ground job as "reallocation" vs "recovery"; the portal uses one shared "Assigned" status for both types (`concepts/zipline-drone-deliveries-in-dispatch-portal.md` L30–35).

### 2. The deciding rule: custody boundary

- "`DELIVERY_INTENT_STATUS_IN_PROGRESS` remains the irreversible custody boundary. The original package cannot return to Wonder or be Reallocated to Ground; any post-custody non-happy path remains a customer-recovery workflow." — `queries/zipline-dropbox-lock-custody-and-failure-disposition-contract-2026-07-28.md` (L175; `retrieval_priority: high`, `freshness_status: active`, updated 2026-10-19).
- "Before custody, Delivery may cancel the current Intent ... and create an approved replacement or Ground path. After custody, the original package cannot be reallocated and same-package Ground fallback is prohibited; recovery uses provider disposition plus refund, remake, or new delivery." — `queries/zipline-drone-dropoff-status-and-fallback-contract-gaps-2026-07-02.md` (L47; active, updated 2026-10-19).
- "pre-custody Reallocation and post-custody refund/remake/new-delivery recovery are different workflows" — `concepts/drone-delivery-integration-strategy.md` (L258).

### 3. A recent vault note gives a narrower (one-sided) answer — treat with caution

`concepts/zipline-drone-deliveries-in-dispatch-portal.md` L75–77, "Custody and fallback note (2026-10-30)", states: "Once a Zipline job's Delivery Intent has reached `IN_PROGRESS` the drone has custody, so a Ground job that appears after it is a post-custody recovery rather than a reallocation of the same delivery."

This is consistent with the rule above **only under its own premise** (the Intent reached `IN_PROGRESS`). It should not be read as "any Ground job after a Zipline job is a recovery": the pre-custody paths in §1 also yield a Ground job after a Zipline job. The note also cites DELI-4660, which says nothing about custody (it only mentions "a Zipline fallback"), and cites the strategy page's Partner-Confirmed contract, which is now disputed (see §4). This note has no `sources` entry of its own and was appended on the same day as this question.

## How much can this be trusted right now

**Medium for the two-way split; low for the exact trigger that decides which case applies.**

1. **The custody signal is disputed.** On 2026-10-29 (git commit `e1a2a5a`, "Strategy: custody signal disputed") `concepts/drone-delivery-integration-strategy.md` was changed to `freshness_status: disputed` and L271 now reads: "`DELIVERY_INTENT_STATUS_IN_PROGRESS` is the authoritative irreversible custody boundary; **DISPUTED 2026-10-29**: a Zipline engineer reportedly said on 2026-10-27 that `DELIVERY_STATUS_PICKED_UP` marks custody instead; unconfirmed". No raw note in the vault records that 2026-10-27 conversation (grep for `DELIVERY_STATUS_PICKED_UP` finds only this line), so the dispute cannot be verified from vault evidence. If `PICKED_UP` rather than `IN_PROGRESS` is the real boundary, a Ground job created between `IN_PROGRESS` and `PICKED_UP` could be a legitimate reallocation that the current rule would misclassify as recovery (or vice versa).
2. **The downstream pages have not been re-reviewed.** `queries/zipline-dropbox-lock-custody-...-2026-07-28.md`, `queries/zipline-drone-dropoff-status-...-2026-07-02.md`, `queries/zipline-ground-delivery-compatibility-and-synthetic-courier-contract.md`, and `queries/oms-cancellation-...-2026-07-27.md` all still state `IN_PROGRESS` as authoritative with `freshness_status: active`; they predate the dispute and inherit it.
3. **Implementation is not verified.** DELI-4662, DELI-4681, and the Zendesk templates are drafts/requirements ("Drafted 2026-09-28 for review. Not yet created in Jira" — DELI-4662 L28; "These are requirements, not verified implementation" — `queries/oms-cancellation-...-2026-07-27.md` L61). The vault does not show that the Portal or Delivery Service actually records which case a given Ground job is.
4. **What is stable regardless of the dispute:** the two-workflow split itself (same-package reallocation vs new-fulfillment recovery), and the rule that the physical custody transfer, not the Portal's job sequence or "Assigned" status, is what distinguishes them.

## Practical reading rule (from the vault)

To classify a Ground job that follows a Zipline job: check the Zipline Intent's last status and the reallocation/cancellation reason. Intent cancelled before custody (station rejection, address change, `DELIVERY_OPTION_CHANGED` switch) → reallocation of the same package. Intent reached the custody boundary (currently `IN_PROGRESS`, under dispute) and then `FAILED`/`CANCELED` → the Ground job is a remake / new delivery, i.e., post-custody recovery, and the original package was disposed of by Zipline.

## Files relied on (vault-relative)

- `AGENTS.md`
- `concepts/zipline-drone-deliveries-in-dispatch-portal.md`
- `concepts/drone-delivery-integration-strategy.md`
- `queries/zipline-dropbox-lock-custody-and-failure-disposition-contract-2026-07-28.md`
- `queries/zipline-drone-dropoff-status-and-fallback-contract-gaps-2026-07-02.md`
- `queries/zipline-ground-delivery-compatibility-and-synthetic-courier-contract.md`
- `queries/oms-cancellation-and-delivery-reallocation-control-gaps-for-drone-mvp-2026-07-27.md`
- `queries/1p-drone-delivery-zendesk-ticket-templates-draft-2026-10-28.md`
- `Wonder/Wonder Fulfillment/Sprints/2026/SP22/JIRA Tickets/DELI-4662.md`
- `Wonder/Wonder Fulfillment/Sprints/2026/SP22/JIRA Tickets/DELI-4681.md`
- `Wonder/Wonder Fulfillment/Sprints/2026/SP20-21/JIRA Tickets/DELI-4660.md`
- `.knowlery/bin/query.mjs` (retrieval), `.knowlery/manifest.json`
- git history (read-only): commits `e1a2a5a`, `f235d81`

## Unable to establish

- The primary source for the 2026-10-27 Zipline engineer statement that `DELIVERY_STATUS_PICKED_UP` marks custody; it exists in the vault only as an "unconfirmed" annotation.
- Whether the Dispatch Portal (or Delivery Service) persists an explicit marker distinguishing a pre-custody reallocation Ground job from a post-custody recovery Ground job; the vault shows requirements (DELI-4662/4681) but no implementation evidence.
- Who appended the 2026-10-30 note to `concepts/zipline-drone-deliveries-in-dispatch-portal.md` and on what source.

## Files changed

- `ANSWER.md` (created) — this file. No other vault files were modified.
