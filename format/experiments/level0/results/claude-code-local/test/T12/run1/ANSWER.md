# ANSWER — MVP outer package for Zipline drone orders

Question: what is the MVP outer package for Zipline drone orders, and is that decision still in force?

## Short answer

**As recorded, the MVP outer package is the new Medium Wonder bag, 12 × 8.5 × 13 in**, per Rob Knudson's Weight and Dimension Eligibility PRD v26 as read on 2026-10-19. Small may be used at IKC staff discretion for an order that packs safely smaller; Large must not be used for Drone delivery. It is a Wonder-side bag choice and does not change the Zipline single-Zip envelope (338 × 254 × 205 mm / 2495 g). Validation of the bag does not approve every cart: item-level weight and dimensions still go to Zipline Pack for order-specific fit.

**Whether the decision still stands is contested by material the vault has not absorbed.** The Record that holds it is `status: current`, verified 2026-10-19, but three newer or unpropagated signals bear on it (section 3). None of them is reconciled in any Knowledge page, Record, or `log.md`. Per CONVENTIONS §8 this is a conflict to surface, not one for an agent to resolve. A human (Rob Knudson or Stephen Acciaioli) must confirm.

## 1. The recorded answer, with citations

- Knowledge-page claim (tier 3): `[[drone-delivery-integration-strategy#^c17]]` — "The Wonder-side outer package that must fit that envelope is the existing Medium bag, not a newly produced drone-specific bag, selected by IKC Ops after it fit the 3D-printed Pod sample; bag and guest-packaging samples still need testing (src: s17, s18)". Added 2026-08-12; never superseded. Page `status: disputed` (because of `^c24`, unrelated to the bag).
- Record (tier 4/5): `records/drone-mvp-medium-bag-outer-package-decision.md` — `kind: decision`, `status: current`, `updated`/`verified` 2026-10-19 by `process:cook`. Summary: "The MVP default is the **new Medium Wonder bag, 12 × 8.5 × 13 in**, per PRD v26. Small may be used at IKC staff discretion ... Large must not be used for Drone delivery." Its "What Changed" table marks the 2026-08-12 "existing Medium" direction and the 2026-09-20 "two new candidate sizes for Zipline testing" as historical, superseded by PRD v26.
  - s1: PRD v26 URL, `fetched:2026-10-19`, `no-snapshot`.
  - s2: `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Slack Clarification - Drone MVP Medium Bag Selection - 2026-08-12.md`, `sha256:79548617…`, `blob:deaef9a7…`.
- Same statement repeated in `records/zipline-pack-as-eligibility-oracle-direction-2026-08-20.md` (Detail callout, line 43) and relied on by `records/1p-drone-delivery-checkout-package-dimensions-contract-2026-07-16.md` (lines 30, 200, 224, 299).

Note the lag inside the vault: the Knowledge claim `^c17` still says "existing Medium bag ... samples still need testing" (the August state), while the Record it cites as s18 now says "new Medium 12 × 8.5 × 13 in, validated". The Knowledge layer was not updated when the Record was.

## 2. Digest and blob checks (verified with `tools/digest.py` and `git rev-parse`)

| Cited resource | Cited version | Current digest | Current blob | Result |
|---|---|---|---|---|
| Slack Clarification Source (s2 / concept s17) | `sha256:79548617…` · `blob:deaef9a7…` | `sha256:79548617…` (match) | `d07a7b6a…` (changed) | Body unchanged; frontmatter changed (see 3a) |
| Record `drone-mvp-medium-bag-outer-package-decision` (cited as s18 / s7 / s15 by three pages) | `sha256:fd7e1f24…` · `blob:f89d270b…` | `sha256:fd7e1f24…` (match) | `0ba37b95…` (changed) | Evidence scope unchanged; cited blob verified present at commit f4a31b8 (`git log --find-object`), file changed in commit 4baf67a "pin source versions" |

## 3. What bears on whether the decision stands

### 3a. A human marked the bag-selection Source `decision_status: withdrawn` (2026-11-02)

- Commit `01140d4` (2026-11-02 01:57 -0500, author Jay Jiang, "Medium bag note: decision withdrawn (frontmatter)") added one line, `decision_status: withdrawn`, to the frontmatter of `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Slack Clarification - Drone MVP Medium Bag Selection - 2026-08-12.md`. Nothing else changed.
- Per CONVENTIONS §7 a frontmatter-only change is not an evidence change, and the body digest still matches every citation. So the vault's change-detection procedure would not flag it. No Record, no `## History` line, and no `log.md` entry reflects it. The field `decision_status` appears on no other page in the vault, so its meaning is not defined by convention.
- Scope is ambiguous. The annotation sits on the 2026-08-12 "existing Medium" direction, which the Record already calls historical. It may simply confirm that the August direction is withdrawn (consistent with the Record), or it may withdraw the whole Medium-bag choice including the PRD v26 new Medium. The vault cannot distinguish these. Because it is a human-authored signal placed on the very Source that `^c17` cites, it should be treated as casting doubt on `^c17` until the author clarifies.

### 3b. A later-updated draft PRD says Zipline rejected the medium bag and the bag is not final

- `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/PRD/Drone Eligibility Check - MVP Plan - 2026-09-17.md` (`status: draft`, `updated: 2026-10-27`, eight days after the Record's verification). Line 86: "Zipline rejected Wonder's medium bag on 2026-09-17 and a replacement is being sourced; the plan assumes the final bag is as close to the dropbox interior as possible and uses the dropbox interior as the envelope until then." Risk 10 (line 514): "**Bag not final.** Zipline rejected the medium bag; the replacement's inner dimensions and empty weight are unknown." Open-items table (line 534): Stephen Acciaioli owes the replacement bag, its inner dimensions and empty weight, and the partner-site payload configuration.
- Possible reconciliation: the rejected "medium bag" may be the old Medium, and the 12 × 8.5 × 13 in new Medium may be the replacement (the Record's 2026-09-20 row shows two new sizes requested for testing). But the 2026-10-27 update of this draft still calls the bag not final, which conflicts with the Record's "validated by Zipline" as of 2026-10-19. Two current sources, neither ranked above the other in the vault. Flagged, not resolved.
- This Source is cited only by legacy pages (`queries/1p-drone-delivery-mvp-iteration-plan-sp20-sp23.md`, `queries/drone-pkg-grp-001-backfill-and-ess-a-bagel-fallback-decision-2026-10-28.md`), not by the bag Record or the concept page.

### 3c. The Record's frozen scope was rewritten after it left draft

- `## History` of the bag Record: "2026-10-19 · revised by process:cook · Current status (2026-10-19)" and "2026-08-20 · revised by process:cook · Jay's working interpretation (2026-08-20)". Its `date` is 2026-08-12 but its Summary describes the 2026-10-19 state.
- CONVENTIONS §6: once a Record is not `draft`, Summary and Detail are never rewritten; if an owner has edited them anyway, every page citing it needs review. So the Record is not a clean dated snapshot, and the pages citing it (`concepts/drone-delivery-integration-strategy.md`, `records/zipline-pack-as-eligibility-oracle-direction-2026-08-20.md`, `records/1p-drone-delivery-checkout-package-dimensions-contract-2026-07-16.md`) are formally due for review.

### 3d. Vault state otherwise

- `log.md` has a single build line (2026-10-30); none of the above is logged.
- No `superseded_by`, `stale_after`, or `protected` on the bag Record. No `#disputed` on `^c17`.
- `records/1p-drone-delivery-checkout-package-dimensions-contract-2026-07-16.md` History (line 342) records a "contradiction ... against [[drone-mvp-medium-bag-outer-package-decision]]" on 2026-09-29. Reading its Detail (lines 195-203, 299), the contradiction is the one the bag Record itself acknowledges: published uncompressed Medium catalog dimensions exceed the provider envelope, while the bag was chosen on packed-and-folded Pod fit. It is a known, documented tension, not a new signal that the decision was reversed.

## 4. Verdict

As recorded (status current, verified 2026-10-19): new Medium 12 × 8.5 × 13 in, Small at IKC discretion, Large excluded, order fit still decided by Zipline Pack. Standing is uncertain: a human marked the underlying bag-selection Source "withdrawn" on 2026-11-02 without saying what was withdrawn, a draft PRD updated 2026-10-27 still says the bag is not final, and the Record carrying the decision was revised after freezing. Treat the decision as **unconfirmed pending human review**, not as settled.

The §8 maintenance step this implies (not performed, because this task asked only for an answer): append `#disputed` to `[[drone-delivery-integration-strategy#^c17]]`, add an `## Open` question citing commit `01140d4` and the 2026-09-17 PRD draft, and log it.

## 5. Paths relied on

- `CONVENTIONS.md`, `AGENTS.md`, `.claude/CLAUDE.md`, `log.md`, `tools/digest.py`
- `records/drone-mvp-medium-bag-outer-package-decision.md`
- `concepts/drone-delivery-integration-strategy.md`
- `records/zipline-pack-as-eligibility-oracle-direction-2026-08-20.md`
- `records/1p-drone-delivery-checkout-package-dimensions-contract-2026-07-16.md`
- `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Slack Clarification - Drone MVP Medium Bag Selection - 2026-08-12.md` (and its git history, commit `01140d4`)
- `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/PRD/Drone Eligibility Check - MVP Plan - 2026-09-17.md`
- `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Meeting Notes - Weight and Dimensions Alignment with Rob (2026-08-19).md`
- `queries/drone-package-recommendation-ownership-and-kds-boundary.md`, `queries/kds-pre-order-bag-recommendation-feasibility-2026-07-16.md`, `queries/order-packaging-geometry-feasibility-for-drone-dimension-eligibility-2026-08-12.md` (legacy pages, read as dated snapshots)
- Read-only git: `git log`, `git show 01140d4`, `git show 4baf67a --stat`, `git rev-parse HEAD:<path>`

## 6. Unable to establish

- The PRD v26 "validated by Zipline" statement itself: s1 is a URL with `no-snapshot`, so the text is not recoverable from the vault and the network was not used.
- What `decision_status: withdrawn` refers to (the August direction only, or the Medium-bag choice as a whole), and who decided; the commit carries no body text.
- Whether the "medium bag" Zipline rejected on 2026-09-17 is the old Medium (10.5 × 10.5 × 12 in), the August new Medium (13 × 10 × 13 in), or the PRD v26 Medium (12 × 8.5 × 13 in).
- The bag SKU, empty-bag tare, tested fill/fold limits, orientation rules, Zipline test report, and partner-site payload configuration. The Record itself lists these as not confirmed.
- The original 2026-08-12 Slack screenshot image (not retained in the vault; only the transcribed text exists).

## 7. Files changed

- `ANSWER.md` — created (this file).
- `log.md` — one line appended per CONVENTIONS §10 recording the ANSWER.md write.

No Knowledge page, Record, or Source was modified.
