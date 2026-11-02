# ANSWER: MVP outer package for Zipline drone orders

## Short answer

**Recorded decision:** the MVP outer package is the **new Medium Wonder bag, nominal 12 × 8.5 × 13 in**, with Small allowed only as an IKC-staff operational fallback and Large out of scope. This is what the compiled page [[queries/drone-mvp-medium-bag-outer-package-decision]] records as of its 2026-10-19 review, attributing it to Rob Knudson's Weight and Dimension Eligibility PRD, version 26.

**Is it still in force?** The vault cannot confirm that it is. Three signals, all newer than or independent of the compiled page's 2026-10-19 status, cut against treating the Medium-bag choice as settled:

1. The user source note that anchors the Medium-bag selection now carries `decision_status: withdrawn`, added by Jay on 2026-11-02 (after the compiled page's last review).
2. The draft eligibility PRD in the vault (last updated 2026-10-27) still says Zipline rejected Wonder's medium bag on 2026-09-17, that a replacement is being sourced, and that the bag is "not final".
3. Nothing in the vault dated after 2026-10-19 reaffirms the Medium-bag validation.

Per `AGENTS.md`, freshness metadata (`freshness_status: active`, `retrieval_priority: high`) is a retrieval signal, not authority. The compiled page's `active` status is older than both contrary user-authored signals and rests on an external Confluence source that is not in the vault. The honest reading is: **a Medium-bag decision was recorded, but the most recent vault evidence marks it as withdrawn / not final, so it should not be relied on as in force without re-confirmation.**

## Evidence, with quotes

### 1. The recorded decision

`queries/drone-mvp-medium-bag-outer-package-decision.md` (frontmatter: `updated: 2026-10-19`, `status: active`, `retrieval_priority: high`, `freshness_status: active`, `freshness_reviewed: 2026-10-19`):

> Rob Knudson's Weight and Dimension Eligibility PRD, version 26, reports that the **new Medium Wonder bag, 12 × 8.5 × 13 in**, has been validated by Zipline across multiple Wonder packaging configurations and is the default bag for MVP launch SOPs. Small is an IKC-staff operational fallback only; Large is out of scope. This supersedes the September 20 candidate-testing status. The source is Rob's PRD; a separate Zipline test report was not inspected in this update.

> The MVP default is the **new Medium Wonder bag, 12 × 8.5 × 13 in**, per PRD v26. Small may be used at IKC staff discretion when a specific order can safely be packed smaller; Large must not be used for Drone delivery.

The page also separates the bag choice from the Zipline provider envelope ("This is a Wonder-side outer-package choice. It does not change the Zipline provider envelope, now `338 × 254 × 205 mm / 2495 g`"), and lists as *Not Confirmed*: the Zipline test evidence, fill line / folded height / orientation, the SKU and tare of the 12 × 8.5 × 13 in bag, and a signed physical profile.

Note that the PRD v26 source is a Confluence URL, not a vault file. The same claim is repeated in `queries/zipline-pack-as-eligibility-oracle-direction-2026-08-20.md` (line 53 and line 134), but that page cites the medium-bag page for its evidence, so it is not independent confirmation.

The original August selection is the user note `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Slack Clarification - Drone MVP Medium Bag Selection - 2026-08-12.md`:

> Stephen Acciaioli replied (about eleven hours before the screenshot), after connecting with IKC Ops:
> - The preferred plan is to use the existing **Medium bag**.
> - The Medium bag fits well into the 3D printed Pod sample provided to them.
> - The next step is to send samples of these bags and guest packaging for testing.

Its own Evidence Boundary says the exchange "does not ... complete the sample-fit test" and does not identify whether "existing Medium" means the then-current `10.5" × 10.5" × 12"` bag or the August 2026 `13" × 10" × 13"` spec (both from `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Order Delivery Bag Specifications (for Jay).md`). Neither of those matches the 12 × 8.5 × 13 in bag named in PRD v26, so the compiled page's "new Medium" is a third specification that the vault's bag-spec note does not describe.

### 2. Signals bearing on whether the decision stands

**(a) `decision_status: withdrawn` on the source note.**
`Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Slack Clarification - Drone MVP Medium Bag Selection - 2026-08-12.md`, frontmatter line 13: `decision_status: withdrawn`.
Git (read-only) shows this was the only change in commit `4a1ec8d`, author Jay Jiang, dated 2026-11-02, message "Medium bag note: decision withdrawn (frontmatter)", one line inserted. The note's `updated: 2026-08-12` field was not bumped, so only git reveals when the flag was added. It postdates the compiled page's 2026-10-19 review, which does not reflect it. Caveats: `decision_status` is not a field defined in `SCHEMA.md` and appears nowhere else in the vault; no reason text accompanies it. The vault therefore does not say whether what was withdrawn is only the August "existing Medium bag" pick, or the Medium-bag outer-package choice as a whole.

**(b) Draft PRD in the vault says the bag was rejected and is not final.**
`Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/PRD/Drone Eligibility Check - MVP Plan - 2026-09-17.md` (frontmatter `status: draft`, `updated: 2026-10-27`, which is later than the compiled page):

- line 86: "Zipline rejected Wonder's medium bag on 2026-09-17 and a replacement is being sourced; the plan assumes the final bag is as close to the dropbox interior as possible and uses the dropbox interior as the envelope until then."
- line 514 (risk 10): "**Bag not final.** Zipline rejected the medium bag; the replacement's inner dimensions and empty weight are unknown."
- line 534 (open items): "Zipline / packaging (Stephen Acciaioli) | Replacement bag as close to the dropbox interior as possible; its inner dimensions and empty weight; partner-site payload configuration updated to the final bag so Pack stays authoritative; orientation rules for Pack | Open"

The compiled page's timeline is consistent with the September rejection (its 2026-09-20 row records Stephen requesting two new bag sizes for Zipline testing) and claims PRD v26 resolved it on 2026-10-19. But the vault's own PRD note, edited on 2026-10-27, still carries the "not final" language. I cannot tell from the vault whether the 10-27 edit touched those lines or left them stale.

**(c) No later reaffirmation.** A sweep of pages mentioning bags with dates from 2026-10-20 onward (including `queries/drone-pkg-grp-001-backfill-and-ess-a-bagel-fallback-decision-2026-10-28.md`, `queries/drone-cookbook-menu-item-profile-sync-decision-2026-10-26.md`, `.../Raw/Investigation - Cookbook Weight and Dimension Backfill Review - 2026-10-26.md`, and sprint SP19 to SP23 agenda notes) found no mention of the Medium-bag decision; the 10-26 investigation still models order mass as "Σ units + outer bag tare" without naming the bag.

## Files relied on (vault-relative)

- `AGENTS.md` (retrieval and freshness rules)
- `queries/drone-mvp-medium-bag-outer-package-decision.md`
- `queries/zipline-pack-as-eligibility-oracle-direction-2026-08-20.md`
- `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Slack Clarification - Drone MVP Medium Bag Selection - 2026-08-12.md`
- `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/PRD/Drone Eligibility Check - MVP Plan - 2026-09-17.md`
- `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Order Delivery Bag Specifications (for Jay).md`
- `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Zipline Payload Dimensions Slide - Week of 2026-09-07.md` (envelope context only)
- `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Raw/Investigation - Cookbook Weight and Dimension Backfill Review - 2026-10-26.md` (checked for later bag references)
- Read-only `git log` / `git show 4a1ec8d` for the date and author of the `withdrawn` flag

## Unable to establish

- The content of PRD v26 itself (Confluence, not in vault; network not used), including any Zipline test report behind the "validated" claim.
- The 2026-09-20 Confluence comment about the two new bag candidates (external URL only).
- What exactly `decision_status: withdrawn` refers to and why; there is no reason text, no SCHEMA.md definition, and no corresponding update to the compiled page.
- Whether the 2026-10-27 edit of the draft PRD reaffirmed or merely left in place the "bag rejected / not final" statements.
- The SKU, tare, fill line, folded height, and orientation rules for the 12 × 8.5 × 13 in bag.
- `log.md` does not exist in this vault, so there is no page-change ledger to consult.

## Files changed

None. This task was answer-only; no vault notes or compiled pages were modified. No Activity Ledger record was written because `.knowlery/activity-disabled` exists.
