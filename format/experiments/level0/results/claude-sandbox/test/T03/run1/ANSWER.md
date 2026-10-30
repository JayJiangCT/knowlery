# ANSWER — evidence for the Dropbox-load / advisory `loading_window` claim

## The statement
"Completing the Dropbox load summons the drone, and `loading_window` is advisory — missing its end time does not lose the reservation or require a re-Quote."

This is claim `[[drone-delivery-integration-strategy#^c21]]` (`concepts/drone-delivery-integration-strategy.md`, line 64), added 2026-08-03 by `process:cook` (History line "2026-08-03 · [[#^c21]] added · src: s21"). It rests on a single source, **s21**.

## Evidence chain

### 1. Primary source (what the claim actually cites)
`Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Zipline Slack Clarification - Dropbox Loading Window and Drone Summon - 2026-08-03.md`

- Cited on the concept page as: `s21 · [[…/Zipline Slack Clarification - Dropbox Loading Window and Drone Summon - 2026-08-03]] · sha256:d7ccd152010f98353ee64ace40eb73633cd92fa5f15f59b396283ad6e6c905d1 · source · blob:dd2a7955f67ca370060d77367d7b0d81753442ab`
- **Version check (verified today):** `tools/digest.py` over the body yields `sha256:d7ccd152…c905d1` — matches. `git rev-parse HEAD:<path>` yields `dd2a7955f67ca370060d77367d7b0d81753442ab` — matches. The source is unchanged since citation.
- It is a write-up (type `reference`, dated 2026-08-03, created 2026-08-09, "Slack screenshot shared by Jay Jiang") of a Slack thread, with the screenshot embedded: `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Attachments/Zipline Dropbox loading window Slack confirmation - 2026-08-03.png`.

### 2. Who said it, and when (from the screenshot, which I read)
The statement is a partner attestation from two Zipline people, in a Slack thread opened by Rob Knudson (Wonder):

| Part of the statement | Who | When | What they said |
|---|---|---|---|
| Question | Rob Knudson (Wonder) | Fri 2026-07-31, 4:14 PM / 5:20 PM | "If Wonder misses the drone loading window upper bound, what happens next? … Does Wonder proactively need to make a net new delivery intents call? Does Zipline offer a retry option?" — clarified to be about the `loading_window` (start/end) in the `delivery_intents` response, for Dropbox loading. |
| "Completing the Dropbox load summons the drone" | **Sophie Davidson** (Zipline) | Fri 2026-07-31, 4:54 PM | "For Dropbox loading, Wonder would load the order into the Dropbox, and once the order is loaded, that action triggers the drone to be summoned. Since Wonder is planning to use Dropbox loading, they shouldn't separately need to summon the drone or risk missing it, the load itself is the trigger." |
| "`loading_window` is advisory; missing its end has no consequence" | **Muneeb Ahmad** (Zipline) | Mon 2026-08-03, 1:32 PM | "nothing happens if you miss the loading window. Think of the loading window as more of a suggestion." |
| Acknowledgement | Rob Knudson | Mon 2026-08-03, 1:49 PM | "perfect thanks for confirming! … there may be times we miss it when the kitchen is very busy." (cc Pratik Busi) |

(The screenshot shows "Jul 31st" and "Monday"; 2026-07-31 is a Friday, so "Monday" = 2026-08-03, consistent with the note's date.)

### 3. Corroborating Record (same underlying evidence, not independent)
`records/zipline-mvp-partner-confirmed-contract-2026-07-30.md` — rows "Dropbox summon trigger" and "Loading-window semantics" (lines 48–49) and the section "Dropbox Trigger and Advisory Loading Window (2026-08-03)" (lines 134–141), revised 2026-08-03 by `process:cook`. Its own Sources line s3 cites the same Slack note with the same digest/blob, so it is a restatement of source 1, not a second witness. The concept page cites this Record as s10 for other claims (c18–c20), not for c21.

- Version check: digest `sha256:980486cf…be2a` matches the concept page's s10 line. The blob does **not** match (cited `9fef7255…`, HEAD has `e23d5c6f…`); since the evidence-scope digest is identical, this is a non-evidence change (frontmatter/Sources/History only) per CONVENTIONS §7.

### 4. Legacy 1.x pages that say the same thing (snapshots, no claim ids, no versions)
`queries/zipline-dropbox-loading-window-contract.md` (line 33, 42), `queries/zipline-zipping-station-loading-queue-guardrail-2026-07-02.md` (line 133), `queries/zipline-drone-dropoff-status-and-fallback-contract-gaps-2026-07-02.md` (line 188), `queries/zipline-integration-readiness-guide-2026-06-17.md` (line 389), `queries/1p-drone-delivery-system-responsibility-boundaries-2026-07-15.md` (line 260), `queries/1p-drone-delivery-high-level-system-alignment-mvp-2026-08-13.md` (line 181). Treated as `record · unverified`; they all trace back to the same Slack exchange.

### 5. The question's origin
`Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Questions for Zipline Team - 1P Drone Delivery (2026-07-01).md` (line 44) and the archived `1P Drone Delivery System Orchestration Alignment Draft (2026-06-29).md` (lines 148, 431) list "what does `loading_window.end` mean / what happens if IKC misses it" as an open P1 question — the Slack thread above is what closed it.

## Caveats / what I could not establish
- **Single-source claim.** c21 rests on one attestation (a Slack thread, captured as a screenshot). There is no API document, contract, or formal Zipline response confirming it; the Zipline API docs in the vault (`Create Delivery Intent.md` etc.) only define `loading_window` as "the time window during which the drone will be loaded" with required start/end, and say nothing about consequences of missing it.
- **Wording drift.** Neither Zipline speaker used the words "reservation" or "re-Quote". Muneeb said "nothing happens"; Rob's question mentioned a "net new delivery intents call" and "retry". The concept claim's "does not lose the reservation or require a re-Quote, replacement Intent, retry or reschedule" is the compiler's expansion of "nothing happens". The source note's own Evidence Boundary (line 37) warns it "does not establish that an Intent remains valid indefinitely, nor does it override separate provider cancellation, site downtime, operating-hours, or load-rejection behavior."
- **Authority of the speakers.** The vault does not record Sophie Davidson's or Muneeb Ahmad's roles at Zipline; both show the Zipline ("Z") badge in the screenshot. There are no entity pages for them (the note's `[[Sophie Davidson]]` / `[[Muneeb Ahmad]]` links are unresolved).
- The concept page is `status: disputed` overall, but the dispute (`#disputed`) is on c24 (launch dates), not on c21.

## Files relied on (vault-relative)
- `AGENTS.md`, `CONVENTIONS.md`
- `concepts/drone-delivery-integration-strategy.md`
- `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Zipline Slack Clarification - Dropbox Loading Window and Drone Summon - 2026-08-03.md`
- `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Attachments/Zipline Dropbox loading window Slack confirmation - 2026-08-03.png`
- `records/zipline-mvp-partner-confirmed-contract-2026-07-30.md`
- `tools/digest.py` (run, not read)
- grep hits (not fully read) in the `queries/` pages and Zipline API Doc pages listed above

## Files changed
- `ANSWER.md` (this file, created). Nothing else was modified; no commit.
