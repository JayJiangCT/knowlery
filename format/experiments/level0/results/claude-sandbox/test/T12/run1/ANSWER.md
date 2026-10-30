# ANSWER — MVP outer package for Zipline drone orders

## Answer

**What the vault says the MVP outer package is.** The Wonder-side outer package for 1P Drone Delivery (Zipline) MVP orders is a **Wonder Medium bag**. The most recent statement is in the Record `records/drone-mvp-medium-bag-outer-package-decision.md` (status `current`, updated/verified 2026-10-19 by `process:cook`), Summary:

> The MVP default is the **new Medium Wonder bag, 12 × 8.5 × 13 in**, per PRD v26. Small may be used at IKC staff discretion when a specific order can safely be packed smaller; Large must not be used for Drone delivery.

That Record's own "What Changed" table traces the lineage: 2026-08-12 IKC Ops / Stephen Acciaioli preferred the *existing* Medium bag because it fit the 3D-printed Pod sample (historical working direction, "not final approval"); 2026-09-20 Rob reported Stephen had requested two new, slightly-smaller bag sizes for Zipline testing (superseded); 2026-10-19 PRD v26 reports the *new* Medium (12 × 8.5 × 13 in) validated by Zipline and set as the default launch bag. The bag's SKU, tare, tested fill/fold limits and the Zipline test report are explicitly "Not Confirmed" on that Record. The provider envelope is a separate fact: `338 × 254 × 205 mm / 2495 g` ([[zipline-mvp-partner-confirmed-contract-2026-07-30]], Payload Dimensions slide week of 2026-09-07).

The Knowledge-page claim is `concepts/drone-delivery-integration-strategy.md` [[drone-delivery-integration-strategy#^c17]]:

> The Wonder-side outer package that must fit that envelope is the existing Medium bag, selected by IKC Ops after it fit the 3D-printed Pod sample; bag and guest-packaging samples still need testing (src: s17, s18) ^c17

## Is the decision still in force? — Not cleanly. Treat it as disputed.

Three things in the vault bear on whether the decision stands, and they do not agree:

1. **The underlying Source has been marked withdrawn by a human (2026-10-30).** `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Slack Clarification - Drone MVP Medium Bag Selection - 2026-08-12.md` now carries frontmatter `decision_status: withdrawn`. Git shows this was added in commit `94b06af` ("Medium bag note: decision withdrawn (frontmatter)", author Jay Jiang, 2026-10-30), changing the blob from `deaef9a7…` (the blob pinned by every citing page as s2/s14/s17) to `d07a7b6a…`. The body of the note is unchanged — its evidence-scope digest is still `sha256:79548617…`, matching the pinned version — so under CONVENTIONS §7 this is "not an evidence change", but it is an explicit human signal that the 2026-08-12 Medium-bag decision has been withdrawn. No Record, no `## History` line, no `log.md` entry, and no explanation accompanies it; the body still reads "This exchange selects the existing Wonder Medium bag as the preferred MVP outer package". Nothing in the vault says *what* replaced the withdrawn decision.

2. **A Source says Zipline rejected the Medium bag.** `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/PRD/Drone Eligibility Check - MVP Plan - 2026-09-17.md` (status `draft`, updated 2026-10-27), §2.1:
   > Zipline rejected Wonder's medium bag on 2026-09-17 and a replacement is being sourced; the plan assumes the final bag is as close to the dropbox interior as possible and uses the dropbox interior as the envelope until then.

   This is consistent with the Record's 2026-09-20 row (new sizes requested for testing) and with the "Bag status update (2026-09-20)" / "Outer Package Status" callouts in `records/1p-drone-delivery-checkout-package-dimensions-contract-2026-07-16.md` ("The earlier existing-Medium direction is no longer a final package decision … Do not treat the earlier Medium dimensions or Pod-fit observation as final approval"). That Record's History notes "2026-09-29 · contradiction recorded in 1.x against [[drone-mvp-medium-bag-outer-package-decision]]". The only thing that overrides the rejection is the Record's 2026-10-19 reading of PRD v26 (source s1, a Confluence URL, `fetched:2026-10-19 · no-snapshot`), which cannot be re-verified from inside this vault.

3. **The Knowledge-page claim is stale relative to its own cited Record.** `^c17` still says "the *existing* Medium bag … samples still need testing", while its source s18 (the Record, digest `fd7e1f24…`, which I recomputed and which still matches) says the default is the *new* 12 × 8.5 × 13 in Medium, validated. The Record's frozen Summary/Detail was "revised by process:cook" on 2026-08-20 and 2026-10-19 (its `## History`), which under CONVENTIONS §6 means every page citing it needs review; `^c17` was never updated (History: "2026-08-12 · ^c17 added"). The concept page is `status: disputed` and was last `verified: 2026-07-17`.

**Net:** the best-supported current statement in the vault is "a Wonder Medium bag — per PRD v26 the new 12 × 8.5 × 13 in Medium — is the MVP default outer package", but (a) a human has flagged the originating 2026-08-12 decision as withdrawn without recording a replacement, (b) a draft planning source records Zipline rejecting the Medium bag on 2026-09-17 and a replacement being sourced, and (c) the compiled claim `^c17` lags its evidence. Under CONVENTIONS §8 (a single human flag against a current Record, with no ranked resolution) this is a conflict to surface, not resolve: the outer-package decision should be treated as **disputed / not confirmed in force** until a human (Jay, Rob Knudson, or Stephen Acciaioli) states the current bag.

## Files relied on (vault-relative)

- `AGENTS.md`, `CONVENTIONS.md`, `log.md`
- `records/drone-mvp-medium-bag-outer-package-decision.md`
- `concepts/drone-delivery-integration-strategy.md`
- `records/1p-drone-delivery-checkout-package-dimensions-contract-2026-07-16.md` (Summary, "Outer Package Status", "PRD v16" sections, History)
- `records/zipline-pack-as-eligibility-oracle-direction-2026-08-20.md` (grep only: PRD v26 callout, lines 43, 94, 115)
- `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Slack Clarification - Drone MVP Medium Bag Selection - 2026-08-12.md`
- `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/PRD/Drone Eligibility Check - MVP Plan - 2026-09-17.md` (frontmatter and §2.1)
- git history (read-only): `git log`, `git show 94b06af`, `git rev-parse HEAD:<Slack note>`; `tools/digest.py` on the Slack note and the Medium-bag Record

## Unable to establish

- Why the 2026-08-12 Source was marked `decision_status: withdrawn` on 2026-10-30, and what the replacement outer package (if any) is — no Record, note or log line explains it.
- Whether PRD v26's "new Medium 12 × 8.5 × 13 in validated by Zipline" (Confluence, `no-snapshot`) is still accurate as of 2026-10-30; it cannot be re-fetched here.
- The relationship between the 2026-09-17 Zipline rejection of "Wonder's medium bag" and the later PRD v26 validation (presumably the rejected bag was the old Medium and the validated one the new Medium, but no vault note states this).
- The new Medium's SKU, tare, fill/fold limits, and the Zipline test report (listed as Not Confirmed on the Record).

## Files changed

- `ANSWER.md` (this file) — created as the task requested. No other vault file was modified; no `log.md` line was added because the task did not ask for a vault change beyond this file.
