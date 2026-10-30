# ANSWER — Is the compiled single-Zip width limit (254 mm) correct?

## Answer

The reviewer's concern is well founded, and the vault's sources **conflict**, so I recorded the conflict rather than picking a winner.

**What the compiled pages say.** Nine agent pages (hub: `queries/zipline-mvp-partner-confirmed-contract-2026-07-30.md`) state that the week-of-2026-09-07 Zipline Payload Dimensions slide *revised* the single-Zip width from `252 mm` to `254 mm`, that the current envelope is `338 × 254 × 205 mm / 2495 g`, and that `252 mm` is "superseded"/"historical". They all cite the slide note as evidence.

**What the cited source actually says.** `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Zipline Payload Dimensions Slide - Week of 2026-09-07.md` contains two artifacts, which I verified by viewing the attached images:

- 3D render (`payload-dimensions-3d-wk-of-2026-09-07.png`): labels `13.25" 338mm`, `10" 254mm`, `8" 205mm`.
- Envelope card (`payload-envelope-card-338-252-205.png`): `Envelope 338 × 252 × 205 mm`.

The source note's own conclusion is: "The Envelope card is the numeric payload envelope. It matches the 2026-07-30 partner QA of 338 × 252 × 205 mm. The 3D width label 10 in / 254 mm is a rounded-imperial pairing … **Do not treat 254 mm as a superseding envelope width.**" So the compiled statement is not supported by the citation it gives; the cited note says the opposite.

**Other sources on the envelope.** Every other vault source — before and after the slide week — uses `252 mm`: the 2026-07-30 partner QA; Slack clarification 2026-08-12; Zipline API runtime annotations 2026-08-27 (Pack accepted `252 × 205 × 338 mm`); Research Log 2026-09-07; PRD "Drone Eligibility Check - MVP Plan" 2026-09-17 ("dropbox envelope 338 × 252 × 205 mm", worked example rejects a box for exceeding "envelope width 252 mm"); Cookbook backfill investigation 2026-10-26 ("252 mm envelope axis"). No source other than the render label gives `254 mm`.

**Why I did not simply "fix" the pages to 252 mm.** Two week-of-9/7 Zipline artifacts genuinely differ by 2 mm, and there is no Zipline statement in the vault explaining which is enforceable. The vault's rules say to check for contradictions, never silently overwrite, flag contradictions rather than resolve them, and use `freshness_status: disputed` / the `contradictions` field for conflicting claims. Resolving in favour of 252 mm is the likelier reading (and the conservative one for a gate), but it would be my judgement, not evidence.

## Vault changes

| File | Change | Why |
| --- | --- | --- |
| `queries/zipline-single-zip-width-252-vs-254-conflict-2026-10-30.md` | **New** page, `freshness_status: disputed`, `contradictions` listing all nine affected pages | Durable record of both readings, the evidence table, and what remains unestablished |
| `queries/zipline-mvp-partner-confirmed-contract-2026-07-30.md` | Added `contradictions` link + "Disputed claim (2026-10-30)" callout at "Current Payload Envelope"; `updated` bumped | Hub page asserting the 252→254 revision |
| `queries/zipline-drone-quote-and-package-eligibility-contract-2026-07-02.md` | Same (callout at "Canonical Dual-Unit Eligibility Threshold") | States `width_mm <= 254`, "252 … superseded" |
| `queries/1p-drone-delivery-checkout-package-dimensions-contract-2026-07-16.md` | Same (callout at "Current Payload Envelope"); link added to existing `contradictions` list | States current envelope `338 × 254 × 205` |
| `queries/1p-drone-delivery-eligibility-evaluation-trigger-and-revalidation-contract-2026-07-16.md` | Same (callout at "Exact Eligibility Units") | States thresholds `338 × 254 × 205 mm` |
| `queries/zipline-wonder-weekly-deck-readout-2026-09-15.md` | Same (callout at "Payload Envelope") | "revises … 252 mm to 254 mm" |
| `queries/zipline-integration-readiness-guide-2026-06-17.md` | Same (callout after H1) | Inline `254 mm` claims |
| `queries/1p-drone-delivery-system-responsibility-boundaries-2026-07-15.md` | Same (callout after H1) | Inline `254 mm` claims |
| `queries/drone-mvp-medium-bag-outer-package-decision.md` | Same (callout after H1) | Bag geometry compared against `254 mm` |
| `concepts/drone-delivery-integration-strategy.md` | Same (callout after H1) | "current provider Single-Zip limit is … 338 × 254 × 205 mm" |
| `log.md` | Created; one entry listing the above | Required by `.agents/rules/agent-pages.md` after modifying pages |
| `.knowlery/activity/2026-10-30.jsonl` | One analysis record appended | Required by `.agents/rules/activity-ledger.md` (`activity-disabled` not present) |
| `ANSWER.md` | This file | Requested by the task |

No compiled body text was rewritten or deleted; only frontmatter (`updated`, `contradictions`) and warning callouts were added. No user notes were modified. Nothing was committed.

## Files relied on (vault-relative)

Instructions / rules / schema:
- `AGENTS.md`, `.claude/CLAUDE.md`, `KNOWLEDGE.md`, `SCHEMA.md`
- `.agents/rules/agent-pages.md`, `.agents/rules/activity-ledger.md`, `.agents/rules/citation-required.md`, `.agents/rules/user-notes-readonly.md`, `.agents/rules/obsidian-markdown-writing.md`
- `.agents/skills/vault-conventions/SKILL.md`, `.agents/skills/obsidian-markdown/SKILL.md`, `.agents/skills/explore/SKILL.md` (contradiction handling)
- `.knowlery/config.json`, `.knowlery/manifest.json`, `pilot/questions-agent.md` (G1-26 confirms this is a known open question)

Primary sources:
- `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Zipline Payload Dimensions Slide - Week of 2026-09-07.md`
- `Attachments/zipline-payload-dimensions-wk-of-2026-09-07/payload-dimensions-3d-wk-of-2026-09-07.png`
- `Attachments/zipline-payload-dimensions-wk-of-2026-09-07/payload-envelope-card-338-252-205.png`
- `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/PRD/Drone Eligibility Check - MVP Plan - 2026-09-17.md`
- `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Zipline API Doc/Zipline API Documentation Runtime Annotations - 2026-08-27.md`
- `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Raw/Drone Eligibility Check - Research Log and Plan - 2026-09-07.md`
- `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Raw/Investigation - Cookbook Weight and Dimension Backfill Review - 2026-10-26.md`
- `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Slack Clarification - Drone MVP Medium Bag Selection - 2026-08-12.md`
- `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Archive/Eligibility and Architecture/1P Drone Delivery MVP Dimensions Eligibility Proposal (2026-08-12).md`
- `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Archive/Eligibility and Architecture/1P Drone Delivery Weight and Dimensions MVP Eligibility Proposal (2026-08-19).md`
- `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Archive/Eligibility and Architecture/1P Drone Delivery High-Level System Alignment - MVP.md`

Compiled pages checked (the nine listed above, plus grep hits in `queries/zipline-mvp-final-partner-qa-working-draft-2026-07-26.md`, `queries/1p-drone-delivery-high-level-system-alignment-mvp-2026-08-13.md`, `queries/drone-fit-exclusion-test-and-container-count-limits-2026-08-12.md`, `queries/oms-cancellation-and-delivery-reallocation-control-gaps-for-drone-mvp-2026-07-27.md`, which use 252 mm or are neutral and were left unchanged).

Retrieval: `node .knowlery/bin/query.mjs "Zipline payload envelope single-Zip width"` (headless; Obsidian not running).

## Unable to establish

- Which width Zipline considers enforceable. The vault has no partner statement addressing the 2 mm difference, and the only `254 mm` evidence is a label on an illustrative 3D render.
- The actual value configured in any Wonder Eligibility Service / Pack prescreen; downstream notes imply `252 mm` but no config source is in the vault.
- Whether the `.knowlery/bin/query.mjs` / `knowlery health` tooling expects `log.md` at the vault root; the rule says "append to log.md" and none existed, so I created it there.
