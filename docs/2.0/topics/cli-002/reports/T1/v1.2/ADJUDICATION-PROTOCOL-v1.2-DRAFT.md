# CLI-002 Round 2 — D annotation protocol v1.2 (DRAFT, delta against v1.1)

**Status: PROPOSED DRAFT, not ACCEPTED.** The rules below follow the Owner's 2026-11-06 ratification of the Cloud recommendations O2–O7 as scoped (decision closure, task CLI002-R2-D-V12-CLOSURE-01). That ratification is not an ACCEPTED entry and does not freeze Metric D. [`../ADJUDICATION-PROTOCOL.md`](../ADJUDICATION-PROTOCOL.md) (v1.1) and [`../ADJUDICATION-PROTOCOL-v1.0.md`](../ADJUDICATION-PROTOCOL-v1.0.md) stay in force for every existing record and are not edited.

**How to use it.** Read the v1.1 protocol first. This file replaces or adds the parts listed below; where the two differ, **this file governs**. Everything not listed is unchanged from v1.1. Records carry `"schema_version": "cli002-r2-t1/2"` and `"protocol_version": "1.2"` and validate with `aggregate_v12.py --validate` against `METRICS-SCHEMA-v1.2.json`. All examples are invented.

## Changes from v1.1

### Step 3 — L2 (replaces item 3 and adds item 5)

3. Else, did the agent receive another note whose **delivered** text states the fact's value? A note that only mentions the topic is not a candidate. A Record page (a dated page with `## Summary` / `## Detail` and no claim anchors) is compile output, not a source: never propose it as an equivalent. For a real candidate, apply the six-criterion check and record it in `proposed_equivalents` with your decision. Then:
   - if any proposed candidate for this fact is `accept` or `unsure`: `valid_source_reached = unknown`, `EQUIVALENCE_NOT_ADJUDICATED`. Your acceptance is a proposal, not authority;
   - if every proposed candidate is `reject`: continue to item 4. (The validator rejects `EQUIVALENCE_NOT_ADJUDICATED` when no candidate is `accept` or `unsure`.)
4. Else: `false`, basis `none`.
5. Candidates already decided by an adjudicator stay as decided; do not re-decide them.

### Step 4 — L3 (adds four paragraphs)

- **Partial support.** If the required fact has several elements (for example: when, what, and why) and the delivered text states only some of them, `support_delivered = no` and `support_kind = none`, provided the trace is complete and the text was delivered in readable form. Use `unknown` only with `PERSISTED_OUTPUT_NOT_IN_TRACE`, `PAGINATED_RESULT`, `TOOL_ERROR` or `SCOPE_OR_QUALIFIER_UNCLEAR`. `answer_asserts` is judged separately and may still be `partial`.
- **Rule A, both branches.** Decide, per required fact, whether that fact describes the current state or an earlier state (`temporal_scope` = `current` / `historical`). A fact about an earlier state, even inside a question about how something evolved, takes the earlier-state branch: a superseded `## History` entry counts as compiled support. A fact about the current state takes the current-state branch: a superseded entry is **not** support, even if its text happens to state the fact. If such an entry is the only delivered text stating the fact, `support_delivered = no`, `support_kind = none`.
- **Record pages as support.** Text from a Record page may be support; record `support_kind = compiled_claim` and say in `note` that it came from a Record without a claim anchor.
- **Dates.** Judge the date criterion of a fact only against the date in that fact's own gold entry. If a date is itself a separate required fact, judge it only there; do not lower another fact's `answer_asserts` because of it. Rule C still applies.

### Step 5 — Navigation (adds one sentence)

A `## Sources` wikilink is a link like any other: naming a Sources entry as support while that file's content was never delivered is `navigation_used_as_evidence = true`.

### Step 6 — Compiled claims and F-008 (adds a field and a sub-step)

- Add `claim_position` to every `compiled_claims` row: `current`, `disputed`, `history_superseded` or `unknown`.
- **List superseded `## History` entries the answer relies on** as rows with `claim_position = history_superseded`. Their `f008` is `unknown` with `F008_HISTORY_ENTRY_SCOPE_OPEN`: KF v1.0 does not settle whether F-008 applies to them. Fill the other components as far as the page shows them, but do not decide F-008.
- **Record pages without claim anchors** get no `compiled_claims` row. Never invent a claim id.

**Step 6b — Compiled reuse, per required fact (new).** Fill `compiled_reuse` for every required fact:

| Field | How |
|---|---|
| `applicable` | `yes` if the answer relies on delivered compiled text (a claim, a History entry or a Record) for this fact; `no` otherwise, and then every component below is `not_applicable` and every reference is `null` |
| `claim_ref` | The claim relied on (`page.md#^cN`); `null` for a Record |
| `source_ref`, `source_version` | The claim's first vault-file Source and the version on its Sources line, if the page shows them; otherwise `null` |
| `claim_position` | `current`, `disputed`, `history_superseded`, `record_unanchored` or `unknown` |
| `temporal_scope` | From step 4 |
| `verification_event` | `present_at_listed_version` / `present_other_version` / `absent` / `unknown`: a `source-checked` History event for this claim |
| `digest_comparison` | `observed_match` / `observed_stale` only if the trace shows the agent computing and comparing the digest; otherwise `not_observed` |
| `currentness`, `currentness_basis`, `as_of` | Only from an approved, dated currentness reference given to you for this purpose. None is provided in this round: write `not_established`, `null`, `null` |

`value` and `reason` are derived; `aggregate_v12.py --validate` prints the expected pair if yours differs. In order: not relied on ⇒ `not_applicable`; reliance unclear ⇒ `unknown` · `F008_USE_UNCLEAR`; Record ⇒ `unknown` · `RECORD_WITHOUT_CLAIM_ANCHOR`; disputed claim, superseded entry for a current-state fact, no event or event at another version, stale digest, or established not current ⇒ `false`; otherwise `unknown` with the first missing condition. `f008` is not an input.

### Step 7 — Evidence reads (replaces the Round 1 note)

`version_check = not_checked` only when the read is a compiled claim's first Source (role `first_source`) and that claim's Sources line lists a version; otherwise `not_applicable`. This step governs over METRICS §3.9 where they differ.

### Step 8 — Run level (replaces the `wrong_current_claim` item)

- `answerable`: copy from the packet. `proper_abstention` is `not_applicable` exactly when `answerable` is true.
- Do **not** fill `wrong_current_claim`. It is a legacy v1.0/v1.1 field.
- `wcc_gold` and `wcc_vault` are **not judged by the annotator**. Write both as `unknown` · `REFERENCE_MISSING` with `reference_id = null`, `reference_version = null`, `reference_completeness = absent`, `events = []`; for `wcc_gold` also `as_of = null` and `gold_currentness_checked = "unknown"`. They are judged later, in separate passes with their own references.
- Graph: a `## Sources` wikilink in delivered content counts as a link for `read_from_edge`.

### Step 9 — Validation

```bash
python3 -I -B v1.2/aggregate_v12.py --validate annotator-<k>/ANNOTATIONS.jsonl
```

A failing record is not finished.

## Not settled by this protocol

- Whether F-008 applies to superseded History entries, and what their first vault-file Source is: open for KF governance; recorded as `unknown`.
- Which references may establish currentness for compiled reuse: only an independently adjudicated, dated reference bound to the same claim, Source and version; none exists in this round.
