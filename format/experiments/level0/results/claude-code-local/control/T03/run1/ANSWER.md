# Evidence: Dropbox load summons the Drone; `loading_window` is advisory

Statement under review: "Completing the Dropbox load summons the drone, and `loading_window` is advisory — missing its end time does not lose the reservation or require a re-Quote."

## Short answer

The statement is supported by one primary source in the vault: a Slack thread between Rob Knudson (Wonder) and the Zipline team, captured as a screenshot and transcribed into a user note. It is two separate claims from two different Zipline people on two different days:

| Claim | Who said it | When | Exact words (from the screenshot) |
| --- | --- | --- | --- |
| Completing the Dropbox load summons the Drone | Sophie Davidson (Zipline) | Fri 2026-07-31, 4:54 PM (absolute date shown in screenshot; timezone not recorded) | "once the order is loaded, that action triggers the drone to be summoned. Since Wonder is planning to use Dropbox loading, they shouldn't separately need to summon the drone or risk missing it, the load itself is the trigger." |
| `loading_window` is advisory; missing its end has no consequence | Muneeb Ahmad (Zipline) | Mon 2026-08-03, 1:32 PM (screenshot shows only "Monday at 1:32 PM"; 2026-07-31 is a Friday, so the date is inferred) | "nothing happens if you miss the loading window. Think of the loading window as more of a suggestion." |

Rob Knudson asked the question on 2026-07-31 (4:14 PM and 5:20 PM), confirmed on 2026-08-03 (1:49 PM) that it concerned Dropbox loading and the Delivery Intent `loading_window` field, and cc'd Pratik Busi.

The wording of the statement itself comes almost verbatim from the compiled concept page `concepts/drone-delivery-integration-strategy.md`, section "Advisory Loading Window and Summon Trigger (2026-08-03)": "Zipline confirmed that completing the Dropbox load summons the Drone and that `loading_window` is advisory. Missing its end time does not create a lost reservation or require re-Quote, replacement Intent, retry, or reschedule."

## Evidence boundary (important)

- **"Reservation" and "re-Quote" are Wonder's words, not Zipline's.** Rob asked whether Wonder would need "a net new delivery intents call" or whether Zipline offers "a retry option". Muneeb answered "nothing happens". Neither "reservation" nor "re-Quote" appears in the exchange. The compiled pages extend "nothing happens" into the specific negatives (no lost slot, no re-Quote, no replacement Intent, no retry, no reschedule). That extension is a reasonable reading of "nothing happens", but it is an inference by the compiler, not a partner quote.
- The user note's own "Evidence Boundary" section says the exchange does not establish that an Intent stays valid indefinitely, and does not override separate provider cancellation, site downtime, operating-hours, or load-rejection behavior. The compiled query page repeats this under "Not Confirmed".
- The Zipline API doc is neutral: `Create Delivery Intent.md` defines `loading_window` as a required `TimeWindow` ("The time window during which the drone will be loaded at the partner site") and says nothing about expiry either way.
- A later user note, `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Use Case/1P Drone Delivery Non-Happy Path Cases.md` (date 2026-09-30, updated 2026-10-20), still lists "Confirm Zipline's loading-window expiry/cancellation policy" as an open decision and notes the saved API doc "does not guarantee that missing the loading window always cancels the Intent." This does not contradict Muneeb's reply (its Case 3 explicitly says preparation delay alone does not establish cancellation), but it shows the use-case doc had not closed the loop on this point.
- `Discussion - RFP-Based FIFO for Dropbox Loading (2026-07-30).md` (Jay's draft proposal) calls loading-window semantics "not yet confirmed as hard deadlines". It predates the confirmation, so it is consistent, not contradictory.

## Sources and the version each rests on

The vault records no explicit version numbers. Git in this copy has a single bulk-import commit (`c7daf22`) touching these files, so there is no per-change history. The only version signals are frontmatter dates:

**Primary (source layer)**

1. `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Attachments/Zipline Dropbox loading window Slack confirmation - 2026-08-03.png` — the Slack screenshot. The actual words quoted above come from here.
2. `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Zipline Slack Clarification - Dropbox Loading Window and Drone Summon - 2026-08-03.md` — user note transcribing the screenshot. Frontmatter: `date: 2026-08-03`, `created: 2026-08-09`, `updated: 2026-08-09`, `source: Slack screenshot shared by Jay Jiang`. Transcription was made six days after the exchange.

**Compiled (agent layer)**

3. `queries/zipline-dropbox-loading-window-contract.md` — dedicated contract page. `date: 2026-08-03`, `created: 2026-08-09`, `updated: 2026-08-10`, `freshness_reviewed: 2026-08-12`, `status: active`, `retrieval_priority: high`. Lists sources 2, 4 and the FIFO discussion.
4. `queries/zipline-mvp-partner-confirmed-contract-2026-07-30.md` — rows "Dropbox summon trigger" and "Loading-window semantics", plus section "Dropbox Trigger and Advisory Loading Window (2026-08-03)". `created: 2026-07-30`, `updated: 2026-09-15`, `freshness_reviewed: 2026-09-15`, `retrieval_priority: high`.
5. `concepts/drone-delivery-integration-strategy.md` — origin of the statement's wording. `created: 2026-04-24`, `updated: 2026-10-26`, `freshness_reviewed: 2026-10-26`, `retrieval_priority: high`.
6. `queries/1p-drone-delivery-high-level-system-alignment-mvp-2026-08-13.md` — restates "loading_window is advisory" and lists "A loading-window miss ... automatically permits Ground fallback" as a forbidden assumption.

**Corroborating / context**

7. `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Zipline API Doc/Create Delivery Intent.md` — schema definition of `loading_window` (neutral on expiry).
8. `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Discussion - RFP-Based FIFO for Dropbox Loading (2026-07-30).md` — pre-confirmation context.
9. `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Use Case/1P Drone Delivery Non-Happy Path Cases.md` — later note still carrying the question as open.

## Unable to establish

- The wikilinks `[[entities/rob-knudson]]`, `[[Sophie Davidson]]`, `[[Muneeb Ahmad]]` and `[[entities/zipline]]` in the Slack note do not resolve to any file in this vault (the `entities/` folder contains no pages for these people or for the Zipline organization). Sophie's and Muneeb's Zipline affiliation rests on the "Z" avatar badge in the screenshot and the note's "Partner Replies" framing, not on an entity page.
- The timezone of the Slack timestamps is not recorded. The 2026-08-03 date for Muneeb's reply is inferred from "Monday" following a Friday 2026-07-31 message.
- Whether the Zipline team's reply was later formalized in a Zipline document or API doc revision. The vault contains no such record; the API doc remains silent on expiry.
- A partner statement using the words "reservation" or "re-Quote" — none exists in the vault; these are compiled-page inferences.

## Files changed

- `ANSWER.md` (this file, new). No compiled pages were modified, so no `log.md` entry was required. `.knowlery/activity-disabled` exists, so no Activity Ledger record was written.
