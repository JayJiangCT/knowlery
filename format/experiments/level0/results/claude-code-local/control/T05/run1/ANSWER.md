# ANSWER — Is the compiled single-Zip width limit wrong?

## Answer

The reviewer's concern is justified: the compiled pages and the source they cite disagree, and the vault's other sources do not support the compiled value. I recorded this as a contradiction and did not pick a winner.

**What the compiled pages say.** Eleven compiled pages state that the current single-Zip envelope is `338 × 254 × 205 mm / 2495 g` and that the week-of-2026-09-07 Payload Dimensions slide "revised" the width from `252 mm` to `254 mm`. They cite `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Zipline Payload Dimensions Slide - Week of 2026-09-07.md` for this.

**What the cited source says.** That note reads the opposite way. It records two week-of-9/7 artifacts: a 3D render whose width label is `10" / 254mm`, and an Envelope card reading `338 × 252 × 205 mm`. It states that the Envelope card is the numeric payload envelope, that `10 in / 254 mm` is a rounded-imperial pairing rather than a 2 mm hardware change, and it ends: "Do not treat `254 mm` as a superseding envelope width." I opened both attached images and they match the note: the render shows 254 mm, the card shows 252 mm.

**What the other vault sources say.** Every other source note that gives a numeric width uses `252 mm`, including notes dated after the slide week:

| Source (vault-relative) | Date | Width |
| --- | --- | --- |
| `Wonder/.../Slack Clarification - Drone MVP Medium Bag Selection - 2026-08-12.md` | 2026-08-12 | 252 mm |
| `Wonder/.../Archive/Eligibility and Architecture/1P Drone Delivery MVP Dimensions Eligibility Proposal (2026-08-12).md` | 2026-08-12 | 252 mm |
| `Wonder/.../Archive/Eligibility and Architecture/1P Drone Delivery Weight and Dimensions MVP Eligibility Proposal (2026-08-19).md` | 2026-08-19 | 252 mm |
| `Wonder/.../Archive/Eligibility and Architecture/1P Drone Delivery High-Level System Alignment - MVP.md` | — | 252 mm |
| `Wonder/.../Zipline API Doc/Zipline API Documentation Runtime Annotations - 2026-08-27.md` | 2026-08-27 / 09-04 | sandbox accepted `252 × 205 × 338 mm` |
| `Wonder/.../Raw/Drone Eligibility Check - Research Log and Plan - 2026-09-07.md` | 2026-09-07 | 252 mm |
| `Wonder/.../PRD/Drone Eligibility Check - MVP Plan - 2026-09-17.md` | 2026-09-17 | 252 mm |
| `Wonder/.../Raw/Investigation - Cookbook Weight and Dimension Backfill Review - 2026-10-26.md` | 2026-10-26 | 252 mm |

The only evidence for `254 mm` anywhere in the vault is the width label on the 3D render. The weekly-deck readout's 254 table cites only the slide note, so it is not an independent source.

**Conclusion.** The sources conflict with the compiled statement, and the two raw artifacts from the same week conflict with each other. Per the vault rules ("check for contradictions — never silently overwrite"), I recorded the dispute on every compiled page that asserts 254 mm as current, using the vault's existing `contradictions:` frontmatter pattern, a `[!warning]` callout, and `freshness_status: disputed` where the envelope is the page's subject. The 254 mm text was left in place. Length `338 mm`, height `205 mm`, and mass `2495 g` are consistent across all sources and are not disputed.

## Paths relied on

Instructions and schema:
- `AGENTS.md`
- `SCHEMA.md`
- `.knowlery/config.json` (`pilot/` is an ignored dir; not used as evidence)
- `.knowlery/activity-disabled` (present, so no ledger record)

Cited source and attachments:
- `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Zipline Payload Dimensions Slide - Week of 2026-09-07.md`
- `Attachments/zipline-payload-dimensions-wk-of-2026-09-07/payload-dimensions-3d-wk-of-2026-09-07.png`
- `Attachments/zipline-payload-dimensions-wk-of-2026-09-07/payload-envelope-card-338-252-205.png`

Other sources on the envelope: the eight `Wonder/...` notes in the table above.

Compiled pages checked: the eleven pages listed under "Files changed".

Existing conflict-recording pattern: `entities/region-2-expansion.md` (`contradictions:` frontmatter), `queries/1p-drone-delivery-checkout-package-dimensions-contract-2026-07-16.md` (same), and `[!warning]` callouts in `concepts/parallel-search.md` and others.

## Unable to establish

- Which width Zipline actually intends. The vault cannot resolve whether `254 mm` on the render is a rounded label or a real hardware change; only Zipline can. I did not pick.
- The external originals behind several `sources:` entries (Google Slides deck, Google Doc partner QA, Confluence PRD) are URLs; no network, so they were not checked.
- Whether any sandbox/production Pack call has been tested at exactly 253 or 254 mm, which would discriminate between the two values. The runtime annotations only show 252 accepted and 500 rejected.
- The `2026-07-30` partner QA itself is not in the vault as a note; its `252 mm` value is known only through the compiled contract page and the later source notes that repeat it.

## Files changed

All edits add one identical `[!warning] Disputed` callout at the first `254 mm` claim, a `contradictions:` entry pointing to the slide note, and bump `updated` / `freshness_reviewed` to 2026-11-02. No sentence was rewritten or removed; aliases such as `338 254 205` were kept.

| File | Why | freshness_status |
| --- | --- | --- |
| `queries/zipline-mvp-partner-confirmed-contract-2026-07-30.md` | Primary page defining the envelope; its "Current Payload Envelope" section asserts the 252→254 revision | active → disputed |
| `queries/zipline-wonder-weekly-deck-readout-2026-09-15.md` | Its Payload Envelope table is the origin of the 254 claim in compiled pages | active → disputed |
| `queries/1p-drone-delivery-checkout-package-dimensions-contract-2026-07-16.md` | Envelope is the page's subject; `width_mm <= 254` rule | watch → disputed |
| `queries/drone-mvp-medium-bag-outer-package-decision.md` | Asserts 254; its geometry argument ("330 × 254 matches width exactly") depends on 254 — extra dependency note added | active → disputed |
| `concepts/drone-delivery-integration-strategy.md` | Canonical Package Limit section asserts 254 as current | unchanged (active) |
| `queries/1p-drone-delivery-system-responsibility-boundaries-2026-07-15.md` | Eligibility requirement cites 254 | unchanged (watch) |
| `queries/1p-drone-delivery-eligibility-evaluation-trigger-and-revalidation-contract-2026-07-16.md` | Checkout precheck cites 254 | unchanged (watch) |
| `queries/zipline-integration-readiness-guide-2026-06-17.md` | States 254 as "authoritative Eligibility Service configuration" | unchanged (watch) |
| `queries/order-packaging-geometry-feasibility-for-drone-dimension-eligibility-2026-08-12.md` | Cites 254 as current envelope | unchanged (active) |
| `queries/zipline-drone-quote-and-package-eligibility-contract-2026-07-02.md` | Cites 254 and `width_mm <= 254` | unchanged (active) |
| `queries/drone-fit-exclusion-test-and-container-count-limits-2026-08-12.md` | Says envelope figures "should use" 254 | unchanged (active) |
| `log.md` | Created (did not exist); one entry listing the above, as the Agent-Maintained Pages rule requires | — |
| `ANSWER.md` | This file | — |

No freshness sidecar was written: `.knowlery/freshness/` does not exist and `.knowlery/` is outside the agent-editable scope that `AGENTS.md` grants. The detailed findings are in the page callouts and `log.md` instead.

No user notes were modified. No git commit or push. No network use.
