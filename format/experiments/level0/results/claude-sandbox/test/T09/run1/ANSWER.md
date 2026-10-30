# ANSWER — Medium Bag Slack note as cited by `drone-delivery-integration-strategy`

## 1. The cited version, verbatim

`concepts/drone-delivery-integration-strategy.md` cites the note as source **s17** (used by claim `^c17`):

```
- s17 · [[Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Slack Clarification - Drone MVP Medium Bag Selection - 2026-08-12]] · sha256:79548617cec29684b66898ba08d83d74170a15dc2a35b6e75d6f34c0ad67c050 · source · blob:deaef9a7c4df9ae71172ee20e05ba8a8addc3cb1
```

The whole file as committed at blob `deaef9a7c4df9ae71172ee20e05ba8a8addc3cb1` (`git cat-file -p deaef9a7…`) is:

````markdown
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

(The committed file has no trailing newline after the last line. The evidence scope per CONVENTIONS §7 for a Source is the body after the frontmatter, i.e. everything from `# Slack Clarification: …` onward.)

## 2. How I established this is the cited version (and not another)

Three independent checks, all consistent:

1. **Blob pointer → content.** CONVENTIONS §7 says `blob:` is the git blob of the whole file at citation time and is the only thing that recovers text. `git cat-file -p deaef9a7c4df9ae71172ee20e05ba8a8addc3cb1` returned the text above. A git blob id is the SHA-1 of the content, so the content cannot be any other version.

2. **Content → cited digest.** I ran the vault's own tool on the recovered text (`python3 tools/digest.py` on the blob dump, default `source` scope = body after frontmatter, normalized per §7). Result: `sha256:79548617cec29684b66898ba08d83d74170a15dc2a35b6e75d6f34c0ad67c050`, which is exactly the `version` on the s17 line. The same procedure on the current file (`HEAD` / working tree) gives `sha256:820f7c42284566ac0ea714714e47523ae4348ddf8ef7592b5d0ac5a7a82df431`, which does **not** match — so the page cites the pre-edit version, and the digest confirms the body of that blob is the body that was fingerprinted.

3. **Git history of the note.** `git log -- "<note path>"` shows exactly two commits touching the note:
   - `cf9e378` (2026-10-29, "pilot: split questions from answer keys …") → blob `deaef9a7…` (the cited one)
   - `98ed7e7` (2026-10-30, "Medium bag note: sample testing completed (2026-10-28)") → blob `f427b7f0…` (current; `git hash-object` on the working tree also gives `f427b7f0…`, so there are no uncommitted changes)

   The page's s17 line was pinned to `blob:deaef9a7…` in commit `f4187b9` ("pin source versions (14 pages)"), which sits between `cf9e378` and `98ed7e7` in history; in the prior page version (`0c469a4`) the line read `@pin`, and before that the page did not exist in this arm. So the pin was taken while `deaef9a7…` was the only version of the note that had ever existed in the repo — there is no other candidate version it could refer to.

**What changed in the edit** (`git diff deaef9a7… f427b7f0…`): the frontmatter and everything through `## Related` are unchanged (apart from adding a trailing newline); the edit appended a new section:

```
## Update (2026-10-28)

Jay relayed Rob's follow-up: IKC Ops completed the sample testing. The Medium bag and the guest-packaging samples fit the production Pod; the Medium bag is confirmed as the MVP outer package and no further bag testing is planned before launch.
```

Side finding (not acted on, since the task did not ask me to change the vault): the s17 digest mismatch means claim `[[drone-delivery-integration-strategy#^c17]]` ("bag and guest-packaging samples still need testing") no longer matches its source and is a candidate for supersession under §7 "To absorb a changed Source". The same stale pin (`sha256:79548617…` / `blob:deaef9a7…`) appears as s2 in `records/drone-mvp-medium-bag-outer-package-decision.md`.

## 3. Vault-relative paths relied on

- `AGENTS.md`
- `CONVENTIONS.md`
- `concepts/drone-delivery-integration-strategy.md` (working tree and versions at `f4187b9`, `0c469a4`)
- `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Slack Clarification - Drone MVP Medium Bag Selection - 2026-08-12.md` (working tree, blob `deaef9a7c4df9ae71172ee20e05ba8a8addc3cb1` at `cf9e378`, blob `f427b7f0522370fcd5d7fc071b1c1b53efc0e10a` at `98ed7e7`)
- `tools/digest.py`
- `records/drone-mvp-medium-bag-outer-package-decision.md` (grep only, to find the other citation of the same pin)
- git metadata (read-only): `git log`, `git rev-parse`, `git cat-file`, `git diff`, `git show --stat`, `git hash-object`

## 4. Unable to establish

- Nothing material. The one limit: I cannot verify the Slack screenshot itself (the note says the image was not retained), only the note text as committed. The date in the commit message ("2026-10-28") is the date of the follow-up Rob relayed, not the commit date (2026-10-30); I report both as recorded.

## 5. Files changed

- `ANSWER.md` (this file, new). No other file was created, edited, moved or deleted; nothing was committed.
