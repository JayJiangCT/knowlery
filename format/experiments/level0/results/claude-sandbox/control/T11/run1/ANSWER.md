# Answer: Ground job after a Zipline job — reallocation or post-custody recovery?

## Short answer

**It depends on whether Zipline had taken custody when the Zipline job ended — and the vault does not let the Dispatch Portal row order alone decide it.**

- If the Zipline Delivery Intent **never reached the custody boundary** (currently `DELIVERY_INTENT_STATUS_IN_PROGRESS`), the Ground job is a **Reallocation** of the same delivery: the original package stays with IKC staff, the Intent is cancelled, and a Ground job is created for the same Task (Dropbox load rejection, mechanical failure, delayed prep, allowed pre-custody address change, or a Drone→Courier delivery-option change).
- If the Zipline Intent **had reached the custody boundary**, the Ground job cannot be a reallocation of that package. The original food is unrecoverable (discarded at a Zipline charging site), and any later Ground job is a **post-custody customer recovery** (remake / new delivery after CX confirmation, or refund with no Ground job at all).

The compiled page that asserts this unconditionally — `concepts/zipline-drone-deliveries-in-dispatch-portal.md`, "Custody and fallback note (2026-10-30)": *"a Ground job that appears after it is a post-custody recovery rather than a reallocation"* — is only correct under its own premise ("Once a Zipline job's Delivery Intent has reached `IN_PROGRESS`"). Read without that premise it is wrong, because the vault explicitly documents the pre-custody Ground Reallocation path.

## Evidence

**The two-workflow split (strong, multiply attested):**

- `queries/zipline-dropbox-lock-custody-and-failure-disposition-contract-2026-07-28.md` (status active, retrieval_priority high, freshness_reviewed 2026-10-19), Operational State Contract table: *Before successful lock → "manually Reallocate to Ground with a Drone-specific reason"*; *Non-happy terminal outcome → "Approved refund, remake, or new-delivery recovery; never same-package Ground fallback."* Its PRD V6 section: *"Post-custody handling is customer recovery, not original-package fallback."*
- `queries/zipline-mvp-partner-confirmed-contract-2026-07-30.md` (active, high): *"Pre-custody loading failure may retain the original package and use Ground Reallocation. Post-custody failure requires customer recovery and a new physical fulfillment attempt."*
- `concepts/drone-delivery-integration-strategy.md` line 258: the 2026-07-28 contract *"proves that pre-custody Reallocation and post-custody refund/remake/new-delivery recovery are different workflows."*
- `queries/oms-cancellation-and-delivery-reallocation-control-gaps-for-drone-mvp-2026-07-27.md` lines 46–72, 92–94: pre-custody address change → cancel Drone and switch directly to Ground; Drone→Courier option change (DELI-4681, requirements only) → Ground created first, then Drone cancelled with `DELIVERY_OPTION_CHANGED`; *"After custody, do not perform same-package Ground fallback, physical-address Reallocation…"*
- `Wonder/Wonder Fulfillment/Sprints/2026/SP22/JIRA Tickets/DELI-4665.md` (drafted 2026-09-28, not yet in Jira) line 38: *"A pre-custody failure can end the failed Drone attempt and remain eligible for a later Ground reallocation. A post-custody failure ends the current job but must not make the same order eligible for Ground reallocation."*
- `Wonder/Glossary/Reallocation.md`: Reallocation "terminates the current [[Job]] and creates a new one while the [[Task]] persists" — so a pre-custody Ground job after a Zipline job is literally a reallocation in the vault's own vocabulary.

**What the Dispatch Portal itself shows (weak):** `Wonder/Wonder Fulfillment/Sprints/2026/SP20-21/JIRA Tickets/DELI-4660.md` line 48 only requires that *"A Ground job, including one created after a Zipline fallback, continues to show expected events without updates as empty circles."* It does not say the Portal labels the Ground job as reallocation vs. recovery. `DELI-4663.md` adds a custody-stage-dependent Force-complete reason list (pre-custody vs post-custody reasons), which is the closest thing to a Portal-visible custody indicator — but both tickets were `todo` at last update (2026-10-08/09), so none of this is verified as implemented.

## How much to trust this right now

1. **The classification rule is solid; the custody *signal* is currently disputed.** Commit `a20e4d4` ("Strategy: custody signal disputed", 2026-11-02) flipped `concepts/drone-delivery-integration-strategy.md` to `freshness_status: disputed` and added: *"DISPUTED 2026-10-29: a Zipline engineer reportedly said on 2026-10-27 that `DELIVERY_STATUS_PICKED_UP` marks custody instead; unconfirmed."* That dispute has **no raw source anywhere in the vault** (no note dated 2026-10-27/29 mentions it), and `DELIVERY_STATUS_PICKED_UP` does not exist in the vault's Zipline webhook enumeration (`Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Zipline API Doc/Webhooks.md` lists only `DELIVERY_STATUS_IN_TRANSIT/DELIVERED/FAILED/CANCELED`). Treat it as an unconfirmed flag, not a contract change. The partner-confirmed pages (`...2026-07-28.md`, `...2026-07-30.md`) still say `DELIVERY_INTENT_STATUS_IN_PROGRESS` and are still `active`/`high`. Practical consequence: the *rule* "pre-custody = reallocation, post-custody = recovery" holds either way; only *where* the line falls on the Zipline timeline is in question.
2. **The 2026-10-30 note on the Dispatch Portal concept page is low-provenance.** It was appended after the page's `updated: 2026-10-10`, without updating `updated`/`freshness_reviewed`, is not backed by the page's `sources:` (DELI-4641, DELI-4660 — neither classifies the Ground job), and it states the post-custody conclusion without the pre-custody alternative. The page is `retrieval_priority: medium`. Do not cite it as sole evidence.
3. **Nothing here is confirmed implementation.** DELI-4660/4663 are `todo`; DELI-4665/4681 are requirement drafts; the OMS gaps page warns its code findings describe Ground behavior, not implemented Drone behavior.
4. **Still open in the vault:** which P2 states accept Cancel Delivery Intent, whether `DELIVERY_STATUS_CANCELED` is an equivalent terminal recovery signal, the physical effect of in-flight cancellation (`SP22/Agenda/Meeting Notes.md` line 33), and whether the Portal will ever surface the custody stage on the Ground row itself.

## Files relied on (vault-relative)

- `AGENTS.md`, `pilot/README.md`
- `concepts/zipline-drone-deliveries-in-dispatch-portal.md`
- `concepts/drone-delivery-integration-strategy.md` (frontmatter, lines 250–280; `git show a20e4d4`)
- `queries/zipline-dropbox-lock-custody-and-failure-disposition-contract-2026-07-28.md`
- `queries/zipline-mvp-partner-confirmed-contract-2026-07-30.md` (grep of custody lines)
- `queries/oms-cancellation-and-delivery-reallocation-control-gaps-for-drone-mvp-2026-07-27.md` (grep of ground/reallocation lines)
- `Wonder/Wonder Fulfillment/Sprints/2026/SP20-21/JIRA Tickets/DELI-4660.md`
- `Wonder/Wonder Fulfillment/Sprints/2026/SP22/JIRA Tickets/DELI-4663.md`, `DELI-4665.md` (grep)
- `Wonder/Wonder Fulfillment/Sprints/2026/SP22/Agenda/Meeting Notes.md` (grep)
- `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Zipline API Doc/Webhooks.md` (status enumeration)
- `Wonder/Glossary/Reallocation.md`
- `pilot/questions-agent.md` (grep), `.knowlery/manifest.json`

## Unable to establish

- Any primary source for the 2026-10-27 "PICKED_UP marks custody" claim — it exists only as the unconfirmed annotation in the strategy page.
- Who wrote the 2026-10-30 note on the Dispatch Portal concept page (git history shows it present at the baseline commit; no separate commit).
- Whether the Dispatch Portal UI will distinguish a reallocation Ground job from a recovery Ground job; the vault has no requirement for that.

## Files changed

- `ANSWER.md` (this file) — created as requested. No other vault file was created, edited, or deleted.
