# ANSWER — Is Grubhub-mediated delivery in scope for the 1P drone delivery initiative?

## Answer

**The vault's current answer is "no" — but the evidence behind that answer has changed underneath it and the claim should now be treated as disputed, not settled.**

1. **Current recorded position.** `concepts/drone-delivery-integration-strategy.md` (status `disputed`, updated 2026-10-26) states in `## Current`:
   - `[[drone-delivery-integration-strategy#^c2]]`: "The initiative is exclusive to Wonder 1P orders; Grubhub marketplace and Grubhub-mediated delivery are out of scope (src: s3)".
   - Supporting context: `[[drone-delivery-integration-strategy#^c3]]` (Zipline Dropbox capacity scoped to Wonder 1P only; Zipline not expected to partner with Grubhub; src: s4 attestation by Rob Knudson 2026-06-24, s5 record) and `[[drone-delivery-integration-strategy#^c25]]` (the public Zipline announcement does not mention Grubhub, so the "Wonder 1P-only scope continues to come from internal program alignment").
   - The page's `disputed` status comes from `^c24` (launch dates), not from `^c2`.

2. **Evidence behind ^c2.** The sole source is s3 = `Wonder/Wonder Fulfillment/Sprints/2026/SP14/Agenda/Meeting Summary` (2026-06-24 Delivery Bi-Weekly), cited at `sha256:f9c19daa…c070`, `blob:6759d3f5…1b9d`. The page's `## History` records a source check of ^c2 against that same digest, dated 2026-10-20.

3. **The source has changed since citation.** Verified read-only in this vault:
   - `tools/digest.py` on the current SP14 Meeting Summary gives `sha256:8c4c99f10ba6061d2a8baacad66bea02df0c155c5a2db117399776ef17a0dbcc` (cited: `f9c19daa…`); current git blob is `ded03bae08c062d325ba3695b75e8c1298dabf67` (cited: `6759d3f5…`).
   - `git diff 6759d3f5 ded03bae` shows exactly one added line in the source's evidence scope, directly under the exclusivity bullet: **"Correction (2026-10-30, Rob): Grubhub-mediated 1P delivery is back in scope as a Q1 2027 pilot; the exclusivity statement above no longer holds."** Commit `6a9eca2` "SP14 meeting summary: scope correction (owner edit)".
   - The cited s5 record (`queries/zipline-dropbox-grubhub-scope-clarification-2026-06-24.md`) still matches its cited digest `sha256:2ccbeb9b…aea4` and blob `6a35e99e…21e4`.

4. **So, as of today (2026-11-02):** the knowledge page says out of scope; its only source now says the owner has reversed that and Grubhub-mediated 1P delivery is back in scope as a Q1 2027 pilot. Nothing else in the vault corroborates or contradicts the 2026-10-30 correction (no Record, PRD readout, Jira note or later bi-weekly mentions it; the legacy page `queries/sp14-delivery-bi-weekly-outcomes-2026-06-24.md` and `comparisons/delivery-providers.md` still carry the old exclusivity framing). Under CONVENTIONS §8 this is a single late correction against a documented, previously-verified claim with wide downstream impact — a conflict to surface, not to resolve silently.

## What needs changing (not done — task said do not change knowledge pages)

On `concepts/drone-delivery-integration-strategy.md`:
- Append `#disputed` to `^c2` (keep it in `## Current`; do not delete or rewrite).
- Add a `## Sources` line for the new source version, e.g. `s33 · [[Wonder/Wonder Fulfillment/Sprints/2026/SP14/Agenda/Meeting Summary]] · sha256:8c4c99f10ba6061d2a8baacad66bea02df0c155c5a2db117399776ef17a0dbcc · source · blob:ded03bae08c062d325ba3695b75e8c1298dabf67 · 2026-10-30 owner correction: Grubhub-mediated 1P delivery back in scope as Q1 2027 pilot`.
- Add an `## Open` question, e.g. `^q12`: does Rob's 2026-10-30 correction supersede ^c2, what does "Grubhub-mediated 1P delivery" mean operationally (DaaS routing of Wonder 1P drone orders?), and does it change ^c3 (Dropbox readiness-queue assumption) and ^c25 (1P-only scope from internal alignment)? Needs a Record (PRD update, bi-weekly readout or written confirmation) before ^c2 is superseded.
- Add a `## History` line recording the source change detection and the dispute, by the acting agent.
- Housekeeping: the existing `2026-10-20 · [[#^c2]] source-checked` History line sits above the `2026-10-26` line, violating "History is newest first" (§5); and that write (commit `e4588a0`) has no corresponding `log.md` entry (§10). The source-check also predates the 2026-10-30 correction, so it must not be read as confirming ^c2 today.
- Write one `log.md` line for the above.

Why not supersede ^c2 outright: the correction is one appended line in a June meeting summary, not a Record or PRD revision; the claim has a documented verification chain; and downstream claims (^c3, ^c25, the architecture notes, `comparisons/delivery-providers.md`) depend on it. Evidence quality is weak relative to impact, so §8 says mark disputed, open the question, and stop.

## Files relied on (vault-relative)

- `AGENTS.md`
- `CONVENTIONS.md`
- `concepts/drone-delivery-integration-strategy.md` (primary; read in full)
- `tools/digest.py` (read the header/scope logic; run on the two cited files)
- `log.md` (head)
- `Wonder/Wonder Fulfillment/Sprints/2026/SP14/Agenda/Meeting Summary.md` — digest computed; content inspected only as the `git diff` between the cited blob and HEAD (one added line), not opened in full
- `queries/zipline-dropbox-grubhub-scope-clarification-2026-06-24.md` — digest computed; not opened (matches citation)
- Grep hits for context only (frontmatter `description:` lines; "Grubhub-mediated"/"back in scope"/"2026-10-30" matches): `queries/sp14-delivery-bi-weekly-outcomes-2026-06-24.md`, `comparisons/delivery-providers.md`, `concepts/zipline-drone-deliveries-in-dispatch-portal.md`
- git (read-only): `git log`, `git rev-parse HEAD:<path>`, `git diff <blob> <blob>`, `git show e4588a0 6a9eca2`

## Unable to establish

- Whether Rob's 2026-10-30 correction is authoritative or merely a note of intent: no Record, PRD revision, Jira ticket or later bi-weekly in the vault corroborates it.
- What "Grubhub-mediated 1P delivery … as a Q1 2027 pilot" means concretely (Grubhub DaaS carrying Wonder 1P drone orders? a Grubhub-app order flow? which IKCs?) and whether it affects the Dropbox readiness-queue assumption in ^c3.
- Whether the earlier 2026-10-20 source check was performed against the then-current file (its digest matches the pre-correction blob, so it was consistent at that time) — but it cannot vouch for ^c2 today.
- No files were changed other than creating this `ANSWER.md`.
