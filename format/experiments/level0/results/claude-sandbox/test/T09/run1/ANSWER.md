# ANSWER — Medium Bag Slack note, as cited by `drone-delivery-integration-strategy`

## 1. The version the page cited

`concepts/drone-delivery-integration-strategy.md` cites the note as source `s17` (used by claim `^c17`):

```
- s17 · [[Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Slack Clarification - Drone MVP Medium Bag Selection - 2026-08-12]] · sha256:79548617cec29684b66898ba08d83d74170a15dc2a35b6e75d6f34c0ad67c050 · source · blob:deaef9a7c4df9ae71172ee20e05ba8a8addc3cb1
```

Per CONVENTIONS §7, `blob:` is the git blob of the whole file at citation time and is the only thing that recovers text. `git cat-file -p deaef9a7c4df9ae71172ee20e05ba8a8addc3cb1` returns the file below. The evidence scope (body after the frontmatter) is reproduced exactly; the frontmatter is shown too for completeness.

### Frontmatter (as committed)

```yaml
---
title: Slack Clarification - Drone MVP Medium Bag Selection - 2026-08-12
type: reference
date: 2026-08-12
created: 2026-08-12
updated: 2026-08-12
domain: delivery
tags:
  - drone-delivery
  - mvp
  - slack
source: Slack screenshot shared by Jay in the 2026-08-12 agent session
---
```

### Body — exact text as cited (evidence scope)

````markdown
# Slack Clarification: Drone MVP Medium Bag Selection

Screenshot of a Slack thread supplied by Jay on 2026-08-12. The original image file was not retained in the vault after the session, so this note records the thread text.

## Context

Jay asked [[entities/rob-knudson|Rob Knudson]] whether a drone-specific bag was still planned for MVP.

## Thread

Jay tagged Rob Knudson (about one day before the screenshot):

> we discussed possibly using a drone-specific bag. Is that still planned for MVP?

Rob tagged Stephen Acciaioli, asking for the latest direction on the bag type to use for drone delivery.

Stephen Acciaioli replied (about eleven hours before the screenshot), after connecting with IKC Ops:

- The preferred plan is to use the existing **Medium bag**.
- The Medium bag fits well into the 3D printed Pod sample provided to them.
- The next step is to send samples of these bags and guest packaging for testing.

The reply had two thumbs-up reactions.

## Evidence Boundary

This exchange selects the existing Wonder Medium bag as the preferred MVP outer package and rejects a newly produced drone-specific bag as the current plan. It does not:

- publish a measured folded height, fill line, orientation, or handle/closure rule;
- identify whether "existing Medium" is the current `10.5" × 10.5" × 12"` bag or the August 2026 `13" × 10" × 13"` Medium spec;
- replace the Zipline provider envelope of `338 × 252 × 205 mm / 2495 g`;
- complete the sample-fit test.

## Related

- [[Order Delivery Bag Specifications (for Jay)]]
- [[drone-mvp-medium-bag-outer-package-decision]]
- [[drone-package-recommendation-ownership-and-kds-boundary]]
- [[queries/1p-drone-delivery-checkout-package-dimensions-contract-2026-07-16|1P Drone Delivery Checkout Package Dimensions Contract (2026-07-16)]]
````

(The committed file ends without a trailing newline after the last `Related` line.)

## 2. How I established that this is the cited version

Three independent checks agree:

1. **Blob id match.** The page's `s17` line records `blob:deaef9a7c4df9ae71172ee20e05ba8a8addc3cb1`. `git cat-file -t` confirms that object exists in the vault's repository and is a blob; `git cat-file -p` of it produced the text above. Walking every commit (`git rev-list --all`) and resolving `<commit>:<path>` shows this exact blob is the note's content in commits `cf9e378` (pilot baseline), `ee89224` (Level 0 test arm) and `4f302c3` (`pin source versions`), i.e. in every commit before the edit. There is only one pre-edit version in history, so there is no ambiguity about which earlier text was cited.

2. **Digest match.** Running the vault's own `tools/digest.py` on the recovered blob (source scope: body after frontmatter, normalized per CONVENTIONS §7) yields `sha256:79548617cec29684b66898ba08d83d74170a15dc2a35b6e75d6f34c0ad67c050`, identical to the `sha256:` recorded on the `s17` line. The current working-tree file digests to `sha256:89ef80b2450e8a54906ffdbbe805e54019810ecc4b27e72834da85ab8fcd9161`, which does not match — confirming the citation points to the older version, not the present one.

3. **Citation commit.** `git show 4f302c3 -- concepts/drone-delivery-integration-strategy.md` shows the `s17` line being changed from a `@pin` placeholder to the `sha256:…/blob:deaef9a…` pair in commit `4f302c3`, whose parent-chain contains the note at exactly that blob. So the page pinned the note at the version in force at `4f302c3`, which is the recovered blob.

## 3. What changed after the citation

The current file (HEAD blob `3e52313b0ac30d71f0429d631b030362f91cf63e`, commit `01d08e2`, "Medium bag note: sample testing completed (2026-10-28)", author Jay Jiang) differs from the cited blob only by an appended section after `## Related`:

```markdown
## Update (2026-10-28)

Jay relayed Rob's follow-up: IKC Ops completed the sample testing. The mailed samples (the new August 2026 Medium bag, the PRD v26 default, and the guest packaging) fit the production Pod; the new Medium is confirmed as the MVP outer package and no further bag testing is planned before launch.
```

(plus a newline added at the end of the former last line). Nothing in the cited text was altered or removed. Note that because this is a Source (not a Record), the whole body is evidence scope, so the append does change the digest; claim `^c17` ("bag and guest-packaging samples still need testing") is now backed by a stale source version and would warrant review under §7 "To absorb a changed Source" — that review was not part of this task and was not performed.

## 4. Vault-relative paths relied on

- `AGENTS.md`
- `CONVENTIONS.md`
- `concepts/drone-delivery-integration-strategy.md` (the `s17` Sources line and `^c17`)
- `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Slack Clarification - Drone MVP Medium Bag Selection - 2026-08-12.md` (current version, for the diff)
- `tools/digest.py`
- `log.md`
- git objects, read-only: blob `deaef9a7c4df9ae71172ee20e05ba8a8addc3cb1`, blob `3e52313b0ac30d71f0429d631b030362f91cf63e`, commits `cf9e378`, `ee89224`, `4f302c3`, `01d08e2`

## 5. Not established / caveats

- I did not verify the Slack thread against the original screenshot; the note itself says the image was not retained. What is recovered is the note text as committed, not the Slack message itself.
- The secondary citation `s18` (`records/drone-mvp-medium-bag-outer-package-decision.md`) was not re-verified; the question concerned only the Slack note.
- Whether `^c17` still holds in light of the 2026-10-28 update was not adjudicated (see §3).

## 6. Files changed

- `ANSWER.md` (this file) — created as the task deliverable. No vault pages, Records, Sources or `log.md` were modified; no git commit or push was made.
