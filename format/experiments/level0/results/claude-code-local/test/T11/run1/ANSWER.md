# ANSWER — Ground job after a Zipline job: reallocation or post-custody recovery?

Answered 2026-11-02 from vault state at commit `7ceff98` (working tree clean). No vault files were changed by this task; this file is the only write.

## Answer

**It depends on custody, not on ordering.** The vault's current rule is:

- If the Zipline job's Delivery Intent reached `DELIVERY_INTENT_STATUS_IN_PROGRESS` before the Ground job appeared, the Ground job is a **post-custody recovery** (refund / remake / new physical delivery), not a reallocation of the same delivery — [[zipline-drone-deliveries-in-dispatch-portal#^c17]].
- If the Zipline job had not reached `IN_PROGRESS`, a following Ground job is a **pre-custody Reallocation** (ground fallback that may still carry the original package) — [[drone-delivery-integration-strategy#^c35]] (not disputed): "pre-custody Reallocation and post-custody refund/remake/new-delivery recovery are different workflows."

Two pre-custody patterns exist in the vault, so "Ground after Zipline" alone cannot be read as recovery: loading failure before custody may retain the original package and use Ground Reallocation (`records/zipline-mvp-partner-confirmed-contract-2026-07-30.md`, Detail line "Pre-custody loading failure may retain the original package and use Ground Reallocation"), and the Drone→Courier change flow creates the Ground job first and then cancels the Drone intent (`queries/oms-cancellation-and-delivery-reallocation-control-gaps-for-drone-mvp-2026-07-27.md`, table row "Change delivery option Drone → Courier (new, 2026-10-23)").

**The Dispatch Portal itself does not tell Ops which case they are in.** The portal shows one shared "Assigned" status for Ground and Zipline jobs ([[zipline-drone-deliveries-in-dispatch-portal#^c2]], [[zipline-drone-deliveries-in-dispatch-portal#^c3]]) and the DELI-4660 ticket only says "A Ground job, including one created after a Zipline fallback, continues to show expected events without updates as empty circles" — it never names custody. To classify the Ground job, look up the Zipline Intent status (did it reach `IN_PROGRESS`?), not the portal row.

## How much it can be trusted right now

Overall: **the pre-/post-custody distinction is solid; the specific signal that marks the boundary (`IN_PROGRESS`) is the documented partner contract but is currently under an unsourced dispute; the portal claim you would naturally cite is an experiment fixture with one effective evidence chain.** Details, separated:

1. **`^c17` is weaker than its two source ids suggest.** Its s3 is a `derived` cite of [[drone-delivery-integration-strategy#^c19]], which per CONVENTIONS §1 counts as zero independent evidence. Its s2 (DELI-4660) only establishes that a Ground job can follow a "Zipline fallback"; it says nothing about custody. The custody rule therefore rests entirely on `^c19`'s sources: `records/zipline-mvp-partner-confirmed-contract-2026-07-30.md` (Zipline confirmed `IN_PROGRESS` = loading complete, custody transferred), `records/zipline-dropbox-lock-custody-and-failure-disposition-contract-2026-07-28.md` (Dropbox lock is irreversible; package never returns to Wonder), and Rob Knudson's 2026-07-28 attestation (strategy page s20). Those are strong as of 2026-07-30, refined through 2026-10-19.

2. **`^c19` is `#disputed` since 2026-10-29** (commit `7ceff98`, "Strategy: custody signal disputed"), via Open item [[drone-delivery-integration-strategy#^q8]]: a Zipline engineer "reportedly said on 2026-10-27" that `DELIVERY_STATUS_PICKED_UP`, not `DELIVERY_INTENT_STATUS_IN_PROGRESS`, marks custody. That statement has **no Source file, Record, or attestation line anywhere in the vault** (grep for `PICKED_UP` across `Wonder/` finds only unrelated Grubhub/refund material). The dispute is parked correctly under §8, but it is unsourced. Note it disputes *which signal* marks the boundary, not *whether* a boundary exists. The whole strategy page is `status: disputed`, `verified: 2026-07-17`.

3. **The portal page has not absorbed the dispute.** `^c17` still shows no `#disputed` and the page is `status: current`, `verified: 2026-10-10`. Its s3 fingerprint still matches (`tools/digest.py --claim ^c19` → `sha256:9db9352c…`, equal to the cited value) precisely because §7 strips `#disputed` from the claim fingerprint. So version pinning cannot detect this kind of staleness: the page is version-current but semantically behind its dependency. Finding, not acted on (task is read-only): `^c17` should inherit `#disputed` or get an `## Open` item pointing at `^q8`.

4. **Provenance of `^c17`.** Its History line says it is an "EXPERIMENT FIXTURE, not from 1.x: inserted by the Level 0 kit … by process:build" on 2026-10-30. It was not produced by a cook pass over sources. That is the single biggest caveat on the claim.

Source-version checks performed: all `sha256:` digests cited for s1, s2 (portal page) and s10, s19 (strategy page) match the current files. Two cited blobs differ from HEAD (s10 `9fef7255…` → `e23d5c6f…`; s19 `751d2bb3…` → `72afb77f…`); `git diff` of each pair shows only `## Sources` lines re-pinned from `@pin` to digests — not an evidence change under §7.

## Vault-relative paths relied on

- `CONVENTIONS.md` — reading contract (§1, §2a, §5, §7, §8)
- `concepts/zipline-drone-deliveries-in-dispatch-portal.md` — `^c2`, `^c3`, `^c12`, `^c17`, Sources s2/s3, History (fixture note); HEAD blob `8d0855a67152bbbf3018a771b87b5e3942b5a26e`
- `concepts/drone-delivery-integration-strategy.md` — `^c19` (#disputed), `^c35`, `^q8`, Sources s10/s19/s20, History 2026-10-29; HEAD blob `7eb7e76192d7541e4f054d44f62ff1c9a7d2fca2`
- `records/zipline-mvp-partner-confirmed-contract-2026-07-30.md` — custody transfer table row and pre-/post-custody failure paragraph; digest `sha256:980486cf…` verified
- `records/zipline-dropbox-lock-custody-and-failure-disposition-contract-2026-07-28.md` — irreversible lock, custody state table, "Automatic Ground fallback should describe only a recoverable pre-custody package"; digest `sha256:b89be957…` verified
- `Wonder/Wonder Fulfillment/Sprints/2026/SP20-21/JIRA Tickets/DELI-4660.md` — acceptance line on Ground job after Zipline fallback; digest `sha256:f07bfc96…` verified, blob `064502ad…` matches HEAD
- `queries/oms-cancellation-and-delivery-reallocation-control-gaps-for-drone-mvp-2026-07-27.md` — legacy 1.x page (no `updated_by`; `type: query`), read as a dated snapshot per §2a; digest computed (`sha256:afc6e7d8…`) and matches the version the custody record cites as its s3; Drone→Courier row and "After custody transfer, no original-package Ground reallocation is allowed"
- `tools/digest.py`, `log.md`, `git log` / `git show 7ceff98`

## Unable to establish

- The source of the 2026-10-27 Zipline engineer statement behind `^q8` (`DELIVERY_STATUS_PICKED_UP` as the custody signal). Nothing in the vault records who said it, where, or to whom.
- Whether DELI-4660's phrase "created after a Zipline fallback" means a pre-custody Reallocation, a post-custody recovery, or both. The ticket does not say.
- Whether the strategy page's `IN_PROGRESS` vs `PICKED_UP` question has been put to Zipline or Rob since 2026-10-29; no later Record or Source exists in the vault.
- Actual production behaviour: the strategy page states these are requirements/contracts, not shipped implementation ("Business-stage-to-code mapping and integration contracts remain unverified" in the OMS gaps page).

## Files changed

- `ANSWER.md` (new, this file). No other vault file was modified; `log.md` was not written: ANSWER.md is a task deliverable, not a Knowledge page or Record, so CONVENTIONS §10 was not applied.
