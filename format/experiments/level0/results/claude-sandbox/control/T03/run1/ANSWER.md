# Evidence: Dropbox load summons the Drone; `loading_window` is advisory

## Answer

The statement rests on a single primary source: a Slack thread between Wonder and the Zipline team, captured in the vault as a user note with the original screenshot attached.

**Primary source (user note + screenshot)**
`Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Zipline Slack Clarification - Dropbox Loading Window and Drone Summon - 2026-08-03.md`
Screenshot: `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Attachments/Zipline Dropbox loading window Slack confirmation - 2026-08-03.png`
(frontmatter: `type: reference`, `date: 2026-08-03`, `source: Slack screenshot shared by Jay Jiang`)

Who said what, and when (from the screenshot):

| Speaker | Role | When | What was said |
| --- | --- | --- | --- |
| Rob Knudson (Wonder) | asked the question | Fri 2026-07-31, 4:14 PM | "If Wonder misses the drone loading window upper bound, what happens next? ... Does Wonder proactively need to make a net new delivery intents call? Does Zipline offer a retry option?" |
| Sophie Davidson (Zipline) | part 1 of the statement — summon trigger | Fri 2026-07-31, 4:54 PM | "For Dropbox loading, Wonder would load the order into the Dropbox, and once the order is loaded, that action triggers the drone to be summoned. Since Wonder is planning to use Dropbox loading, they shouldn't separately need to summon the drone or risk missing it, the load itself is the trigger." |
| Rob Knudson | scoped the question to the Delivery Intent `loading_window` field (start/end) | Fri 2026-07-31, 5:20 PM | "This would be for Dropbox loading! ... So what happens if we miss this loading end time?" |
| Muneeb Ahmad (Zipline) | part 2 of the statement — advisory window | Mon 2026-08-03, 1:32 PM | "nothing happens if you miss the loading window. Think of the loading window as more of a suggestion." |
| Rob Knudson | acknowledgement | Mon 2026-08-03, 1:49 PM | "perfect thanks for confirming! this is great news as well." (cc Pratik Busi) |

So: the "completing the Dropbox load summons the drone" half is Sophie Davidson's statement of 2026-07-31; the "`loading_window` is advisory" half is Muneeb Ahmad's statement of 2026-08-03. Both are Zipline-side people answering Rob Knudson of Wonder.

**Compiled page that states the claim in the exact wording asked about**
`queries/zipline-dropbox-loading-window-contract.md` (`status: active`, `retrieval_priority: high`, `freshness_status: active`, `freshness_reviewed: 2026-08-12`, `updated: 2026-08-10`). Its Short Answer: "completing the Dropbox load summons the Drone. Wonder does not need a separate summon call. The Delivery Intent `loading_window` is advisory: missing its end time does not by itself cancel the Intent, fail the Job, or require a replacement Intent, re-Quote, retry, or reschedule." It lists the Slack note above as its first source.

The near-verbatim phrasing in the question ("does not create a lost reservation or require re-Quote ...") comes from `concepts/drone-delivery-integration-strategy.md`, section "Advisory Loading Window and Summon Trigger (2026-08-03)", which cites `[[zipline-dropbox-loading-window-contract]]`.

**Supporting/field-definition source**
`Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Zipline API Doc/Create Delivery Intent.md` — the Zipline OpenAPI definition (`"version": "0.1.0"`) defines `loading_window` as a required `TimeWindow`: "The time window during which the drone will be loaded at the partner site." It does not itself say the window is advisory; that semantics comes only from the Slack thread. The same field appears in `Zipline API Doc/Get Delivery Intent By Id.md`, `Cancel Delivery Intent.md`, and `Webhooks.md`.

**Corroborating compiled pages (all derive from the same Slack note, not independent evidence)**
- `queries/zipline-mvp-partner-confirmed-contract-2026-07-30.md` (row "Loading-window semantics")
- `queries/zipline-zipping-station-loading-queue-guardrail-2026-07-02.md` (line 133)
- `queries/zipline-drone-dropoff-status-and-fallback-contract-gaps-2026-07-02.md` (line 188)
- `queries/zipline-integration-readiness-guide-2026-06-17.md` (line 389)
- `queries/1p-drone-delivery-system-responsibility-boundaries-2026-07-15.md` (line 260)
- `queries/1p-drone-delivery-high-level-system-alignment-mvp-2026-08-13.md` (line 181)

The original open question that this answered is recorded in `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Questions for Zipline Team - 1P Drone Delivery (2026-07-01).md` (line 44) and the archived `1P Drone Delivery System Orchestration Alignment Draft (2026-06-29).md` (lines 148, 431: "Is `loading_window.end` a hard latest-load deadline, an operational target, or an ETA modeling output?").

## Versions

- The Slack thread has no version; the vault records it as a screenshot dated 2026-08-03 (note `created`/`updated` 2026-08-09).
- The Zipline API doc backing the `loading_window` field definition records OpenAPI `info.version: 0.1.0`.
- The compiled contract page is `updated: 2026-08-10`, freshness-reviewed 2026-08-12, status active; no `superseded_by`.
- Git history for both files shows a single commit (`cf9e378`, shallow clone), so no earlier vault versions are recoverable.

## Caveats / what could not be established

- **"Re-Quote" and "lose the reservation" are Wonder-side paraphrases, not Zipline's words.** Rob asked about a "net new delivery intents call" and a "retry option"; Muneeb answered "nothing happens." Neither Zipline person mentioned Quotes or reservations. The extension to "no re-Quote needed" is an inference made in `queries/zipline-dropbox-loading-window-contract.md`; its own "Not Confirmed" section notes it does not establish that an Intent remains valid indefinitely, nor override provider cancellation, site downtime, operating-hours, or load-rejection behavior.
- No entity pages exist for Rob Knudson, Sophie Davidson, or Muneeb Ahmad (`entities/` has none; the wikilinks in the Slack note are unresolved), so roles are inferred from context: Sophie and Muneeb appear with the Zipline "Z" badge in the screenshot and are referred to as Zipline contacts elsewhere (e.g. `Slack Sync - Webhook HMAC Eligibility Direction and MVP Timeline - 2026-08-17.md`).
- The year in the screenshot is not shown; 2026 is taken from the note's date and the surrounding project timeline (Jul 31, 2026 is a Friday and the following Monday is Aug 3, consistent with "Monday" timestamps).
- The vault has no `.knowlery/freshness/notes/` sidecar for this page.

## Files relied on (vault-relative)

- `AGENTS.md`
- `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Zipline Slack Clarification - Dropbox Loading Window and Drone Summon - 2026-08-03.md`
- `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Attachments/Zipline Dropbox loading window Slack confirmation - 2026-08-03.png`
- `queries/zipline-dropbox-loading-window-contract.md`
- `concepts/drone-delivery-integration-strategy.md`
- `queries/zipline-mvp-partner-confirmed-contract-2026-07-30.md`
- `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Zipline API Doc/Create Delivery Intent.md`
- grep hits (not read in full): `queries/zipline-zipping-station-loading-queue-guardrail-2026-07-02.md`, `queries/zipline-drone-dropoff-status-and-fallback-contract-gaps-2026-07-02.md`, `queries/zipline-integration-readiness-guide-2026-06-17.md`, `queries/1p-drone-delivery-system-responsibility-boundaries-2026-07-15.md`, `queries/1p-drone-delivery-high-level-system-alignment-mvp-2026-08-13.md`, `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Questions for Zipline Team - 1P Drone Delivery (2026-07-01).md`, `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Archive/Eligibility and Architecture/1P Drone Delivery System Orchestration Alignment Draft (2026-06-29).md`, `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Slack Sync - Webhook HMAC Eligibility Direction and MVP Timeline - 2026-08-17.md`

## Files changed

- `ANSWER.md` (this file) — created to hold the answer, as the task required. No other vault files were modified.
