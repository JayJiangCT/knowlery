# Is Grubhub-mediated delivery in scope for the 1P drone delivery initiative?

## Answer

**The vault's compiled knowledge says no, but that answer is stale. The underlying source note was corrected by the owner on 2026-10-30 and now says Grubhub-mediated 1P delivery is back in scope as a Q1 2027 pilot. The compiled pages have not absorbed this correction.**

### What the compiled pages currently say (out of scope)

Three compiled pages carry the same claim, all tracing back to the SP14 Delivery Bi-Weekly (2026-06-24):

- [[concepts/drone-delivery-integration-strategy|Drone Delivery Integration Strategy]] (`retrieval_priority: high`, `freshness_status: active`, `updated: 2026-10-26`), section "Meeting Update: PRD And 1P Scope Confirmation (2026-06-24)":
  > "The meeting also confirmed an important scope boundary: the current initiative is exclusive to 1P Wonder orders, not Grubhub marketplace or Grubhub-mediated delivery."
  The "Official Partnership Confirmation (2026-06-30)" section adds that the public announcement "does not mention Grubhub or establish exclusivity. The current Wonder 1P-only scope therefore continues to come from internal program alignment."
- [[queries/sp14-delivery-bi-weekly-outcomes-2026-06-24|SP14 Delivery Bi-Weekly Outcomes (2026-06-24)]] (`updated: 2026-09-03`), section 6:
  > "The meeting also confirmed a key scope boundary: this initiative is exclusive to 1P Wonder orders, not Grubhub marketplace or Grubhub-mediated delivery."
- [[queries/zipline-dropbox-grubhub-scope-clarification-2026-06-24|Zipline Dropbox Grubhub Scope Clarification (2026-06-24)]] (`updated: 2026-09-03`): Rob clarified Zipline Dropbox capacity should be scoped to Wonder 1P orders only, because "Zipline is not expected to partner with Grubhub" (Zipline competes with Grubhub as a food-delivery platform). Its "Scope Status (2026-07-24)" says "The internal Wonder 1P-only Dropbox planning boundary remains the operative design assumption."

Supporting context: [[comparisons/delivery-providers|Delivery Providers]] records the SP13 shift "toward direct Zipline integration discovery rather than relying on a Grubhub-mediated path," and the strategy page's "Zipline Direct-Integration Shift (2026-06-11)" section frames the earlier Grubhub-DaaS-mediated drone path as historical.

### What the source note now says (back in scope)

The user note `Wonder/Wonder Fulfillment/Sprints/2026/SP14/Agenda/Meeting Summary.md` (listed in the strategy page's `sources`) has, under "### Drone Delivery", the original line:

> "The team confirmed that this initiative is exclusive to 1P Wonder, not Grubhub."

followed by a new line added in git commit `453d6cc` ("SP14 meeting summary: scope correction (owner edit)", author Jay Jiang, 2026-11-02):

> "**Correction (2026-10-30, Rob):** Grubhub-mediated 1P delivery is back in scope as a Q1 2027 pilot; the exclusivity statement above no longer holds."

No compiled page in `concepts/`, `entities/`, `comparisons/`, or `queries/` mentions this correction (searched for "back in scope", "2026-10-30", "no longer holds"; the only other 2026-10-30 hit is an unrelated custody note in `concepts/zipline-drone-deliveries-in-dispatch-portal.md`).

### Current best answer

Per the most recent evidence in the vault (the owner's 2026-10-30 correction attributed to Rob), **Grubhub-mediated 1P delivery is in scope as a Q1 2027 pilot**, and the "exclusive to 1P Wonder, not Grubhub" boundary from 2026-06-24 should be treated as superseded. The compiled pages that still assert exclusivity are stale on this point, even though their `freshness_status` is `active`.

Caveats on the correction itself: it is a one-line user-note edit with no linked PRD, ticket, Slack thread, or meeting record. It does not say what "Grubhub-mediated 1P delivery" means operationally (Grubhub DaaS carrying a Zipline drone delivery for a Wonder 1P order? Grubhub-app orders flowing into IKCs becoming drone-eligible?), nor whether the Dropbox-capacity sharing concern in the scope-clarification query is reopened.

## Recommended changes (not made; task said do not change knowledge pages)

1. `concepts/drone-delivery-integration-strategy.md` — add a dated section (e.g. "Scope Correction: Grubhub-Mediated 1P Pilot Back In Scope (2026-10-30)") recording Rob's correction, citing the SP14 Meeting Summary source note; mark the 2026-06-24 "exclusive to 1P Wonder" statement as superseded in place rather than deleting it; update `updated`/`freshness_reviewed`; reconsider the "Open Questions" (Grubhub DaaS drone roadmap is live again) and the "Recommendation" (the migration-friendly provider abstraction becomes more important). Why: it is the `retrieval_priority: high` page agents will cite first, and it currently gives a wrong current answer.
2. `queries/sp14-delivery-bi-weekly-outcomes-2026-06-24.md` — append a reconciliation note under section 6 pointing to the correction. Why: it is the direct compilation of the corrected meeting and currently restates the superseded boundary without caveat.
3. `queries/zipline-dropbox-grubhub-scope-clarification-2026-06-24.md` — set `freshness_status` to `watch` or `disputed` and add a note that the "no Grubhub sharing" Dropbox assumption rests on the now-withdrawn exclusivity claim and needs re-confirmation. Why: its design implication (readiness queue scoped to Wonder 1P only) may no longer hold.
4. `comparisons/delivery-providers.md` — soften the "rather than relying on a Grubhub-mediated path" sentence to note the Q1 2027 pilot. Lower priority.
5. Before compiling, confirm with Rob/the owner what "Grubhub-mediated 1P delivery" concretely covers; the correction alone is thin evidence for architectural decisions.

## Vault-relative paths relied on

- `AGENTS.md`
- `Wonder/Wonder Fulfillment/Sprints/2026/SP14/Agenda/Meeting Summary.md` (source note; read the Drone Delivery section and frontmatter, and its git history)
- `Wonder/Wonder Fulfillment/Sprints/2026/SP14/Agenda/Speaking Notes.md` (drone section; no scope statement, only PRD/discovery framing)
- `concepts/drone-delivery-integration-strategy.md`
- `queries/sp14-delivery-bi-weekly-outcomes-2026-06-24.md`
- `queries/zipline-dropbox-grubhub-scope-clarification-2026-06-24.md`
- `comparisons/delivery-providers.md` (drone-integration paragraph only)
- `concepts/zipline-drone-deliveries-in-dispatch-portal.md` (2026-10-30 section only, to rule it out)
- git: `git log`/`git show 453d6cc` on the SP14 Meeting Summary

## Unable to establish

- Any corroborating record (PRD revision, Jira ticket, Slack, later bi-weekly notes) for the 2026-10-30 correction; it exists only as the one-line owner edit.
- What "Grubhub-mediated 1P delivery" means in concrete integration terms, and whether Zipline's expected non-partnership with Grubhub (the basis of the Dropbox scope clarification) has also changed.
- No `.knowlery/freshness/notes/*.json` sidecars exist in this vault, so there is no sidecar-level freshness finding to cite. `log.md` does not exist. `.knowlery/activity-disabled` is present, so no Activity Ledger record was written.

## Files changed

- `ANSWER.md` (this file, created). No knowledge pages or user notes were modified.
