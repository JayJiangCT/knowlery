# Answer: Ground job after a Zipline job for the same order — reallocation or post-custody recovery?

## Current answer

It depends on whether Zipline had taken custody of the package when the Ground job was created, and the vault's current (but now disputed) custody marker is the Zipline Delivery Intent reaching `DELIVERY_INTENT_STATUS_IN_PROGRESS`:

- **Before custody** (Intent not yet `IN_PROGRESS`; IKC staff still hold the package): the Ground job is a **Reallocation** of the same delivery — the Zipline Job is terminated, a new Ground Job is created, the Task persists, and the original food is re-used. Reallocation is the Dispatch Portal "Reallocate to Ground with a Drone-specific reason" path. ([[zipline-dropbox-lock-custody-and-failure-disposition-contract-2026-07-28]] Operational State Contract table and MVP SOP step 1; [[Wonder/Glossary/Reallocation]])
- **After custody** (Intent has reached `IN_PROGRESS`): the Ground job is a **post-custody recovery** (remake + new delivery, or refund), not a reallocation. The original package never returns to Wonder; same-package Ground fallback is explicitly ruled out. ([[zipline-drone-deliveries-in-dispatch-portal#^c17]]; [[drone-delivery-integration-strategy#^c35]]; [[drone-delivery-integration-strategy#^c19]]; [[zipline-dropbox-lock-custody-and-failure-disposition-contract-2026-07-28]] "Partner-Confirmed API Boundary (2026-07-30)" and "Webhook Confirmation"; [[zipline-mvp-partner-confirmed-contract-2026-07-30]] custody-transfer row)

The Dispatch Portal itself does not label the distinction: a Ground job "created after a Zipline fallback" is rendered as an ordinary Ground job with the normal Ground timeline ([[zipline-drone-deliveries-in-dispatch-portal#^c12]], from DELI-4660 acceptance criteria), and the portal uses one shared "Assigned" status for Ground and Zipline jobs ([[zipline-drone-deliveries-in-dispatch-portal#^c2]]). So the classification must come from the Zipline Intent status at the moment the Ground job was created, not from how the portal displays it.

Direct quote answering the question — [[zipline-drone-deliveries-in-dispatch-portal#^c17]]:

> Once a Zipline job's Delivery Intent has reached `IN_PROGRESS` the drone has custody, so a Ground job that appears after it is a post-custody recovery rather than a reallocation of the same delivery (src: s3, s2)

## How much it can be trusted right now

**The two-workflow split (pre-custody Reallocation vs post-custody recovery) is well supported. The exact custody *signal* is currently disputed, so the rule "Ground after `IN_PROGRESS` = recovery" should be treated as provisional.**

Trust assessment by claim:

1. **Pre-custody = Reallocation, post-custody = recovery (the split itself)** — high trust. It rests on two independent evidence lines: Rob Knudson's 2026-07-28 attestation after a live Zipline call, PRD V6 (2026-07-29), and Zipline's own partner confirmation on 2026-07-30 ([[drone-delivery-integration-strategy#^c35]], src s22 and s19; [[zipline-dropbox-lock-custody-and-failure-disposition-contract-2026-07-28]], s2 attestation; [[zipline-mvp-partner-confirmed-contract-2026-07-30]]). Both Records are `status: current`; the 2026-07-28 Record was last verified 2026-10-19. Caveat: s22 (PRD V6) is a URL with `no-snapshot` and `fetched:2026-07-29`, so its text is not recoverable from the vault.

2. **`DELIVERY_INTENT_STATUS_IN_PROGRESS` is the custody boundary** — disputed since 2026-10-29. [[drone-delivery-integration-strategy#^c19]] carries `#disputed`, the page is `status: disputed`, and `## Open` ^q8 records that "A Zipline engineer reportedly said on 2026-10-27 that `DELIVERY_STATUS_PICKED_UP`, not `DELIVERY_INTENT_STATUS_IN_PROGRESS`, marks custody; unconfirmed". The Zipline-confirmed answer of 2026-07-30 is the only sourced position; the 2026-10-27 counter-claim has **no Sources line, no attestation, and no Source note anywhere in the vault** (grep for `DELIVERY_STATUS_PICKED_UP` finds only the ^q8 line). It is hearsay recorded as an Open question, exactly per CONVENTIONS §8. Until resolved, which specific webhook marks the cut-over is uncertain; the practical consequence is that a Ground job created between `IN_PROGRESS` and a hypothetical later `PICKED_UP` event might be either a Reallocation or a recovery depending on which signal is right.

3. **The Dispatch-Portal claim [[zipline-drone-deliveries-in-dispatch-portal#^c17]]** — medium trust, and specifically weaker than it looks. Its sources are s3 = `derived` from `[[drone-delivery-integration-strategy#^c19]]` (the disputed claim) and s2 = DELI-4660. Per CONVENTIONS §1 a `derived` citation counts as zero independent evidence, and DELI-4660 only says a Ground job "created after a Zipline fallback" keeps the Ground timeline — it does not mention custody, `IN_PROGRESS`, or recovery. So ^c17 effectively has no independent evidence for the custody-signal part; it inherits the ^c19 dispute but is **not itself marked `#disputed`** and the page is still `status: current` (updated 2026-10-10, before the dispute was raised 2026-10-29). Also, ^c17 is not listed in the page's `## History` (History records only ^c1–^c16 added on 2026-10-10), so its provenance line is missing.

Version checks performed (all match, so the cited evidence is unchanged since citation):
- `tools/digest.py --claim ^c19 concepts/drone-delivery-integration-strategy.md` → `sha256:9db9352c…db59d`, equal to s3 on the Dispatch Portal page (the `#disputed` tag is excluded from the fingerprint by design, so the dispute does not register as an evidence change).
- DELI-4660 digest `sha256:f07bfc96…8a8f17d` and DELI-4641 digest `sha256:6900cada…bef8233` match s2/s1; blob `064502ad…` matches `git rev-parse HEAD:` for DELI-4660.
- Record digests for the 2026-07-28 custody Record (`b89be957…9006a`) and the 2026-07-30 partner contract (`980486cf…8be2a`) match the Strategy page's s19 and s10.
- `git log`: the dispute was committed as `42a3c1f Strategy: custody signal disputed` (process:cook, 2026-10-30), adding only `#disputed`, ^q8 and a History line.

## Bottom line

Current vault answer: a Ground job that appears after a Zipline job is a **Reallocation if it was created before the Zipline Intent reached `IN_PROGRESS`, and a post-custody recovery (new fulfillment for a package Wonder can never get back) if created after**. The split is solid; the `IN_PROGRESS` trigger is under an unsourced dispute (possible `DELIVERY_STATUS_PICKED_UP` instead) and the Dispatch Portal page's ^c17 silently depends on that disputed claim. Confirm with Zipline before building any Dispatch Portal logic or SOP on the exact signal.

## Files relied on (vault-relative)

- `CONVENTIONS.md`, `AGENTS.md`, `.claude/CLAUDE.md`, `log.md`, `tools/digest.py`
- `concepts/zipline-drone-deliveries-in-dispatch-portal.md` (^c2, ^c12, ^c17, s2, s3)
- `concepts/drone-delivery-integration-strategy.md` (^c19 #disputed, ^c35, ^q8, s10, s19, s20, s22, History 2026-10-29)
- `records/zipline-dropbox-lock-custody-and-failure-disposition-contract-2026-07-28.md`
- `records/zipline-mvp-partner-confirmed-contract-2026-07-30.md` (grep of custody lines)
- `Wonder/Wonder Fulfillment/Sprints/2026/SP20-21/JIRA Tickets/DELI-4660.md`
- `Wonder/Glossary/Reallocation.md`
- git history (`git log`, `git show 42a3c1f`, `git rev-parse HEAD:…`), read-only

## Unable to establish

- Any source for the 2026-10-27 `DELIVERY_STATUS_PICKED_UP` claim; it exists only as ^q8 text with no attestation or document.
- PRD V6 text (s22 is `no-snapshot`), so the "two different workflows" wording there is taken from the Record's paraphrase and Rob's attestation.
- Whether `DELIVERY_STATUS_CANCELED` is an equivalent terminal recovery signal, and the in-flight cancellation physical outcome — both still open in the 2026-07-28 Record.
- Any Dispatch Portal data field or label that distinguishes a recovery Ground job from a reallocation Ground job; the vault records none (only `external_id` timestamp suffixing for reallocations in `entities/delivery-task-mappings.md`, which I did not open in full).

## Files changed

- `ANSWER.md` (this file) — created, as required by the task.
- `log.md` — one line appended under `## 2026-10-30` recording the ANSWER.md write (CONVENTIONS §10). No knowledge pages, Records or Sources were modified; the ^c17 dependency problem noted above is reported here rather than fixed, because the task was a question, not an update.
