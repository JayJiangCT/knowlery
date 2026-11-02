# Answer — evidence for the Dropbox-load summon / advisory `loading_window` statement

## Statement under review

"Completing the Dropbox load summons the drone, and `loading_window` is advisory — missing its end time does not lose the reservation or require a re-Quote."

## Where the claim lives in the wiki

The statement is (almost verbatim) claim `[[drone-delivery-integration-strategy#^c21]]` on the migrated Knowledge page `concepts/drone-delivery-integration-strategy.md` (status `disputed` at page level, but the `#disputed` marker is on `^c24`, not `^c21`; `^c21` is not `protected`). The claim was added 2026-08-03 by `process:cook` (History line) and cites exactly one source, `s21`.

## The source document

**`Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Zipline Slack Clarification - Dropbox Loading Window and Drone Summon - 2026-08-03.md`** — a Source note (type `reference`, dated 2026-08-03, created 2026-08-09) that captures a Slack thread with the Zipline team; it embeds the screenshot `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Attachments/Zipline Dropbox loading window Slack confirmation - 2026-08-03.png` (source: "Slack screenshot shared by Jay Jiang").

Version the claim rests on (from the `s21` Sources line on the concept page, and identically `s3` on the Record below):

- `sha256:d7ccd152010f98353ee64ace40eb73633cd92fa5f15f59b396283ad6e6c905d1`
- `blob:dd2a7955f67ca370060d77367d7b0d81753442ab`

Both verified against the vault as it stands now: `python3 tools/digest.py` on the file returns the same sha256, and `git rev-parse HEAD:<path>` returns the same blob. The cited version is therefore the current text; nothing has drifted.

## Who said it, and when (from the embedded screenshot)

1. **Rob Knudson** (Wonder) — Fri 2026-07-31, 4:14 PM — asked Sophie Davidson and Casey Sheldon: "If Wonder misses the drone loading window upper bound, what happens next? ... Does Wonder proactively need to make a net new delivery intents call? Does Zipline offer a retry option?"
2. **Sophie Davidson** (Zipline) — 2026-07-31, 4:54 PM — the Dropbox-summon half of the statement: "For Dropbox loading, Wonder would load the order into the Dropbox, and once the order is loaded, that action triggers the drone to be summoned. Since Wonder is planning to use Dropbox loading, they shouldn't separately need to summon the drone or risk missing it, the load itself is the trigger."
3. **Rob Knudson** — 2026-07-31, 5:20 PM — confirmed the question is about Dropbox loading and the `loading_window` (start/end) field in the `delivery_intents` response.
4. **Muneeb Ahmad** (Zipline) — "Monday at 1:32 PM", i.e. Mon 2026-08-03 — the advisory half: "nothing happens if you miss the loading window. Think of the loading window as more of a suggestion."
5. Rob Knudson acknowledged the same day (1:49 PM), cc'ing Pratik Busi.

The source note's own "Evidence Boundary" section states the limit: the exchange confirms that missing `loading_window.end` does not itself expire the workflow or require replacement, retry, or rescheduling; it does **not** establish that an Intent stays valid indefinitely, nor override provider cancellation, site downtime, operating-hours, or load-rejection behavior.

## Corroborating pages (same underlying source, not independent evidence)

- `records/zipline-mvp-partner-confirmed-contract-2026-07-30.md` — Record (date 2026-07-30, status current). Its table rows "Dropbox summon trigger" and "Loading-window semantics" and the section "Dropbox Trigger and Advisory Loading Window" restate the two rules, citing the same Slack note as `s3` with the same sha256/blob. Caveat: its History shows the frozen part was "revised by process:cook" on 2026-08-03, 2026-08-04 and 2026-09-15, which under CONVENTIONS §6 means pages citing this Record need review; the concept claim `^c21` does not cite this Record, so this does not weaken `^c21`.
- `queries/zipline-dropbox-loading-window-contract.md` — legacy 1.x compiled page (no `updated_by`), dated 2026-08-03, lists the Slack note first in its frontmatter `sources` (unversioned). Treat as a dated snapshot; its "Not Confirmed" list mirrors the source's evidence boundary.
- `comparisons/zipline-loading-methods.md` `^c8` ("a successful Dropbox loading summons the drone") rests on a different source: the 2026-09-15 Zipline x Wonder weekly deck (`s1`, a Google Slides URL, `fetched:2026-09-15`, no snapshot). This is the only partially independent corroboration of the summon half; it says nothing about `loading_window`.
- `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Zipline API Doc/Create Delivery Intent.md` — defines `loading_window` only as "The time window during which the drone will be loaded at the partner site" (required object with `start`/`end`). The API doc does not say what happens when it is missed; the advisory semantics come solely from Muneeb's Slack reply.

## What the vault does not establish

- The phrase "does not lose the reservation" and "re-Quote" are the wiki's wording (claim `^c21`, and the legacy query page's "replacement Intent, re-Quote, retry, or reschedule"). The partner's actual words are "nothing happens if you miss the loading window ... more of a suggestion." Rob's question mentioned a new Delivery Intent call and a retry option; neither Zipline person said the words "reservation" or "re-Quote". The inference is reasonable but is an interpretation layered on the quote.
- The advisory-window half rests on a single Slack message from one Zipline engineer (Muneeb Ahmad), with no written documentation confirming it (the API doc is silent). It has a "100" reaction, no further Zipline corroboration in the vault.
- Whether an Intent remains valid indefinitely after the window, and how this interacts with provider cancellation, station downtime or load rejection, is explicitly unconfirmed (source "Evidence Boundary"; query page "Not Confirmed").
- The Slack note's `source:` field says the screenshot was shared by Jay Jiang; the vault does not record who wrote the note or whether the transcription was checked against the image beyond what I did here (I read the PNG; the quotes in the note match it, with one nuance: the note's wording "After Rob confirmed ... Muneeb replied" is correct in order).

## Files relied on (vault-relative)

- `AGENTS.md`
- `CONVENTIONS.md`
- `log.md`
- `concepts/drone-delivery-integration-strategy.md`
- `comparisons/zipline-loading-methods.md`
- `queries/zipline-dropbox-loading-window-contract.md`
- `records/zipline-mvp-partner-confirmed-contract-2026-07-30.md`
- `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Zipline Slack Clarification - Dropbox Loading Window and Drone Summon - 2026-08-03.md`
- `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Attachments/Zipline Dropbox loading window Slack confirmation - 2026-08-03.png`
- `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Zipline API Doc/Create Delivery Intent.md` (grep of `loading_window` only)
- `tools/digest.py` (run, not read)

## Files changed

- `ANSWER.md` — created (this answer, requested by the task).
- `log.md` — one line appended per CONVENTIONS §10 recording the `ANSWER.md` write.
