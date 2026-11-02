# Evidence: Dropbox load summons the Drone; `loading_window` is advisory

## Answer

The statement rests on a single primary source: a Zipline Slack thread, captured as a screenshot and transcribed in the user note [[Zipline Slack Clarification - Dropbox Loading Window and Drone Summon - 2026-08-03]]. The compiled pages [[zipline-dropbox-loading-window-contract]] and [[zipline-mvp-partner-confirmed-contract-2026-07-30]] both derive from it.

### Who said it, and when (from the Slack screenshot)

Thread in the Wonder x Zipline Slack channel, 2026-07-31 (Fri) to 2026-08-03 (Mon; the screenshot shows "Monday", which the note dates as 2026-08-03):

1. **Rob Knudson (Wonder), Jul 31, 4:14 PM** — asked Sophie Davidson and Casey Sheldon: "If Wonder misses the drone loading window upper bound, what happens next? ... Does Wonder proactively need to make a net new delivery intents call? Does Zipline offer a retry option? etc"
2. **Sophie Davidson (Zipline), Jul 31, 4:54 PM** — "For Dropbox loading, Wonder would load the order into the Dropbox, and once the order is loaded, that action triggers the drone to be summoned. Since Wonder is planning to use Dropbox loading, they shouldn't separately need to summon the drone or risk missing it, the load itself is the trigger."
   → This is the evidence for **"completing the Dropbox load summons the drone."**
3. **Rob Knudson, Jul 31, 5:20 PM** — confirmed the question was about Dropbox loading and the `loading_window` (start/end) field in the `delivery_intents` response; attached `zipline_loading_window.png` showing the API field "loading_window object required — The time window during which the drone will be loaded at the partner site."
4. **Muneeb Ahmad (Zipline), Monday [2026-08-03], 1:32 PM** — "nothing happens if you miss the loading window. Think of the loading window as more of a suggestion."
   → This is the evidence for **"`loading_window` is advisory — missing its end time does not lose the reservation."**
5. **Rob Knudson, Monday, 1:49 PM** — "perfect thanks for confirming! ... there may be times we miss it when the kitchen is very busy." (cc Pratik Busi)

### Supporting API definition

`Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Zipline API Doc/Create Delivery Intent.md` defines `loading_window` (OpenAPI "Zipline APIs" **version 0.1.0**) as "The time window during which the drone will be loaded at the partner site." It says nothing about expiry or consequences of a miss, which is why the Slack clarification was needed.

### Versions recorded in the vault

- Slack clarification note: `date: 2026-08-03`, `created/updated: 2026-08-09`; source listed as "Slack screenshot shared by Jay Jiang". No Slack permalink or message IDs are recorded.
- `queries/zipline-dropbox-loading-window-contract.md`: `updated: 2026-08-10`, `freshness_reviewed: 2026-08-12`, `status: active`, `retrieval_priority: high`.
- `queries/zipline-mvp-partner-confirmed-contract-2026-07-30.md`: `updated: 2026-09-15`, section "Dropbox Trigger and Advisory Loading Window (2026-08-03)".
- Zipline API doc: OpenAPI `info.version: 0.1.0`; the vault does not record a fetch date for the page itself (a runtime annotation dated 2026-08-21/2026-08-27 exists but concerns Quote/409 behavior, not `loading_window`).
- Git history: the vault's git log holds only two repo-level commits (baseline/pilot split), so no per-note revision history is available.

## What the sources do and do not establish

- **Established by a named person:** load-triggers-summon (Sophie Davidson, Zipline, 2026-07-31); missing the window has no consequence / window is a suggestion (Muneeb Ahmad, Zipline, 2026-08-03).
- **"Does not require a re-Quote":** Rob's question covered "net new delivery intents call" and "retry option"; Muneeb's "nothing happens" answers that no replacement Intent or retry is needed. The word "re-Quote" does not appear in the Slack thread. It appears only in the compiled pages ([[zipline-dropbox-loading-window-contract]] Short Answer; [[zipline-mvp-partner-confirmed-contract-2026-07-30]] § 2026-08-03) as Wonder's inference from "nothing happens". So that specific clause is a compiled-page interpretation, not a verbatim partner statement.
- **Not established** (per the note's own "Evidence Boundary" and the contract page's "Not Confirmed" list): that an Intent remains valid indefinitely; behaviour under provider cancellation, site downtime, operating-hours changes, or load rejection; that any attempted load will succeed.
- Not verified from outside the vault (no network); the Slack screenshot is the only primary artifact.

## Files relied on (vault-relative)

- `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Zipline Slack Clarification - Dropbox Loading Window and Drone Summon - 2026-08-03.md`
- `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Attachments/Zipline Dropbox loading window Slack confirmation - 2026-08-03.png`
- `queries/zipline-dropbox-loading-window-contract.md`
- `queries/zipline-mvp-partner-confirmed-contract-2026-07-30.md`
- `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Zipline API Doc/Create Delivery Intent.md`
- Also consulted: `AGENTS.md`, `KNOWLEDGE.md`, `.claude/CLAUDE.md`, `.agents/rules/*.md`, `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Discussion - RFP-Based FIFO for Dropbox Loading (2026-07-30).md` (grep only), `queries/1p-drone-delivery-high-level-system-alignment-mvp-2026-08-13.md` (grep only)

## Files changed

- `ANSWER.md` (this file, new). No other vault files were created or modified. Activity ledger not written: `.knowlery/activity-disabled` is present.
