# Answer: Ground job after a Zipline job — reallocation or post-custody recovery?

## Current answer

**It depends on whether the Zipline Delivery Intent had already reached `DELIVERY_INTENT_STATUS_IN_PROGRESS` (custody transfer).** The vault's current claim is:

> Once a Zipline job's Delivery Intent has reached `IN_PROGRESS` the drone has custody, so a Ground job that appears after it is a post-custody recovery rather than a reallocation of the same delivery
> — [[zipline-drone-deliveries-in-dispatch-portal#^c17]] (src: s3, s2)

The two cases the vault distinguishes:

| Zipline Intent state when the Ground job appears | What the Ground job is | Evidence |
|---|---|---|
| Before `IN_PROGRESS` (package still under IKC control, e.g. load failure, Dropbox weight rejection, mechanical failure) | **Reallocation** to Ground of the same delivery/package, with a Drone-specific reason | [[drone-delivery-integration-strategy#^c35]]; `records/zipline-dropbox-lock-custody-and-failure-disposition-contract-2026-07-28.md` ("Operational State Contract" table and "Pre-lock loading failure" SOP) |
| After `IN_PROGRESS` (Dropbox locked, Zipline custody) | **Post-custody customer recovery** (refund / remake / new delivery). The original package never returns to Wonder; the Ground job carries a *new* delivery, not the original one | [[zipline-drone-deliveries-in-dispatch-portal#^c17]]; [[drone-delivery-integration-strategy#^c19]]; same Record, "Partner-Confirmed API Boundary (2026-07-30)" and "Terminology and metric correction" |

The Dispatch Portal itself does not label the difference: both Ground and Zipline jobs share one "Assigned" status ([[zipline-drone-deliveries-in-dispatch-portal#^c2]], [[#^c3]]), and the only UI statement about a Ground job created after a Zipline fallback is that it keeps rendering expected-but-missing events as empty circles ([[zipline-drone-deliveries-in-dispatch-portal#^c12]], src: s2 = DELI-4660 acceptance criteria). So the portal shows *that* a Ground job followed; the reallocation-vs-recovery classification must come from the custody state, not from the portal row.

## How much it can be trusted right now: **low-to-moderate; treat as disputed**

1. **The claim rests on a single `derived` dependency that is now `#disputed`.** `^c17` cites s3 = `[[drone-delivery-integration-strategy#^c19]]` as `derived` (zero independent evidence per CONVENTIONS §1) plus s2 = DELI-4660, which only says a post-fallback Ground job shows empty circles — it does not itself say anything about custody or recovery. The reasoning substance comes entirely from `^c19`.
2. **`^c19` was marked `#disputed` on 2026-10-29** (git commit `8de8ecc`, History line `2026-10-29 · [[#^c19]] marked disputed; [[#^q8]] opened`). The open question reads: "A Zipline engineer reportedly said on 2026-10-27 that `DELIVERY_STATUS_PICKED_UP`, not `DELIVERY_INTENT_STATUS_IN_PROGRESS`, marks custody; unconfirmed" ([[drone-delivery-integration-strategy#^q8]]). The page-level `status` of `drone-delivery-integration-strategy` is `disputed`.
3. **The dispute has no source in the vault.** `^q8` carries no `(src: …)` and there is no attestation line for a 2026-10-27 Zipline statement in `## Sources`; a grep for `PICKED_UP` / `2026-10-27` finds nothing supporting it. It is an unsourced report, so it cannot be ranked against the partner-confirmed 2026-07-30 contract — which is exactly the §8 situation where the agent should surface, not resolve.
4. **What is *not* disputed:** the *shape* of the rule — a custody boundary exists, pre-custody = Reallocation, post-custody = refund/remake/new-delivery recovery, the original package never returns to Wonder ([[drone-delivery-integration-strategy#^c35]], not disputed; Record `zipline-dropbox-lock-custody-and-failure-disposition-contract-2026-07-28.md`, status `current`, verified 2026-10-19, digest matches the cited `sha256:b89be957…`; Record `zipline-mvp-partner-confirmed-contract-2026-07-30.md`, digest matches `sha256:980486cf…`). What *is* disputed is only **which Zipline webhook event marks that boundary** (`DELIVERY_INTENT_STATUS_IN_PROGRESS` vs `DELIVERY_STATUS_PICKED_UP`). If the engineer's statement is right, a Ground job appearing between `IN_PROGRESS` and `PICKED_UP` could still be a true Reallocation, so the exact wording of `^c17` ("has reached `IN_PROGRESS`") may be wrong at the margin.
5. **Provenance caveat:** `^c17` is flagged in its own History as an "EXPERIMENT FIXTURE, not from 1.x: inserted by the Level 0 kit … by process:build" (2026-10-30). Its sources s1–s3 digests all re-verify (`tools/digest.py` output matches the recorded `sha256:` for DELI-4641, DELI-4660 and the `^c19` claim fingerprint), so the citation chain is intact, but the claim was added by a build process rather than by compiling new evidence.
6. **`^c17` has not yet been propagated as disputed.** Under CONVENTIONS §7/§8, a `derived` claim whose upstream is disputed should itself be marked `#disputed` with an `## Open` question. That has not been done on `zipline-drone-deliveries-in-dispatch-portal.md` (still `status: current`, no `#disputed` on `^c17`). I did not change the page, since the task only asked for an answer; this is the recommended follow-up.

**Bottom line:** The current vault answer is "post-custody recovery if the Zipline Intent was already `IN_PROGRESS`, otherwise a Reallocation." The pre/post-custody split is well supported by two current Records and a partner confirmation; the *specific trigger* `IN_PROGRESS` that `^c17` hinges on is under an unconfirmed, unsourced dispute since 2026-10-29 and must be confirmed with Zipline before being relied on operationally.

## Files relied on (vault-relative)

- `AGENTS.md`
- `CONVENTIONS.md`
- `log.md`
- `tools/digest.py`
- `concepts/zipline-drone-deliveries-in-dispatch-portal.md`
- `concepts/drone-delivery-integration-strategy.md`
- `records/zipline-dropbox-lock-custody-and-failure-disposition-contract-2026-07-28.md`
- `records/zipline-mvp-partner-confirmed-contract-2026-07-30.md` (grep for `IN_PROGRESS` only; digest verified)
- `Wonder/Wonder Fulfillment/Sprints/2026/SP20-21/JIRA Tickets/DELI-4660.md`
- `Wonder/Wonder Fulfillment/Sprints/2026/SP20-21/JIRA Tickets/DELI-4641.md` (digest verified only)
- git history (read-only): `git log`, `git show 8de8ecc`

## Unable to establish

- Any vault source for the 2026-10-27 Zipline engineer statement that `DELIVERY_STATUS_PICKED_UP` marks custody; `^q8` is unsourced.
- Whether Zipline has since confirmed or retracted the `IN_PROGRESS` custody boundary (no Record newer than 2026-10-19 on custody).
- Whether the portal exposes any field that distinguishes a Reallocated Ground job from a recovery Ground job (DELI-4641/DELI-4660 say nothing about such a field).

## Files changed

- `ANSWER.md` (new) — this answer. No other vault file was modified; `log.md` not appended because no knowledge page or Record was written.
