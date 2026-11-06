# CLI-002 Round 2 — D annotation protocol v1.2 (DRAFT, delta against v1.1)

**Status: PROPOSED DRAFT.** Not ACCEPTED, not in use. Do not annotate with it. [`../ADJUDICATION-PROTOCOL.md`](../ADJUDICATION-PROTOCOL.md) (v1.1) and [`../ADJUDICATION-PROTOCOL-v1.0.md`](../ADJUDICATION-PROTOCOL-v1.0.md) stay in force for every existing record and are not edited.

**If approved:** records carry `"schema_version": "cli002-r2-t1/2"` and `"protocol_version": "1.2"`, validate with [`aggregate_v12.py --validate`](aggregate_v12.py) against [`METRICS-SCHEMA-v1.2.json`](METRICS-SCHEMA-v1.2.json), and this delta is merged with the v1.1 text into a full v1.2 protocol. Rules are explained in [`../V12-DECISION-TABLES.md`](../V12-DECISION-TABLES.md); the numbers in brackets point there.

Everything not listed below is unchanged from v1.1. All examples are invented.

## Changes from v1.1

### Step 3 — L2 (replaces item 3 and adds item 5)

3. Else, did the agent receive another note whose **delivered** text states the fact's value? (A note that only mentions the topic is not a candidate.) [§4 row 2e] Open it and apply the six-criterion check. Record it in `proposed_equivalents` with your decision. Then:
   - if any proposed candidate for this fact is `accept` or `unsure`: `valid_source_reached = unknown`, `EQUIVALENCE_NOT_ADJUDICATED`. Your acceptance is a proposal, not authority;
   - if every proposed candidate is `reject`: continue to item 4. [§4 row 2c, rule `E1`]
4. Else: `false`, basis `none`.
5. Candidates the Owner has already ruled `unsure` stay `unsure`; do not re-decide them.

### Step 4 — L3 (adds three paragraphs)

- **Partial support.** If the required fact has several elements (for example: when, what, and why) and the delivered text states only some of them, `support_delivered = no` and `support_kind = none`, provided the trace is complete and the text was delivered in readable form. Use `unknown` only with `PERSISTED_OUTPUT_NOT_IN_TRACE`, `PAGINATED_RESULT`, `TOOL_ERROR` or `SCOPE_OR_QUALIFIER_UNCLEAR`. `answer_asserts` is judged separately and may still be `partial`. [§4 row 1]
- **Rule A, both branches.** Decide, per required fact, whether the fact describes the current state or an earlier state (`temporal_scope`). A fact about an earlier state, even inside a question about how something evolved, takes the earlier-state branch: a superseded `## History` entry counts as compiled support. A fact about the current state takes the current-state branch: a superseded entry is not support. If it is the only support, `support_delivered = no`. Record the reliance in `compiled_reuse` (step 6b); currentness is judged in the separate passes of step 8. [§4 rows 3a–3c]
- **Dates.** Judge the date criterion of a fact only against the date in that fact's own gold entry. If a date is itself a separate required fact, judge it only there. Rule C still applies. [§4 row 7]

### Step 6 — Compiled claims and F-008 (adds a field and a sub-step)

- Add `claim_position` to every `compiled_claims` row: `current`, `disputed`, `history_superseded` or `unknown`.
- **List superseded History entries the answer relies on** as rows with `claim_position = history_superseded`. Their `f008` is `unknown` with `F008_HISTORY_ENTRY_SCOPE_OPEN`: KF v1.0 does not settle whether F-008 applies to them. Do not decide it. [§3.4]
- **Record pages without claim anchors** get no `compiled_claims` row. How to record `support_kind` for Record text is pending an Owner/KF decision (O-5); until then use the value the Owner sets in the v1.2 final text. [§4 row 5]

**Step 6b — Compiled reuse, per required fact (new).** Fill `compiled_reuse`:

| Field | How |
|---|---|
| `applicable` | `yes` if the answer relies on a delivered compiled claim for this fact; `no` otherwise (then every component is `not_applicable`) |
| `claim_ref`, `claim_position` | The claim relied on and where it sat |
| `temporal_scope` | From step 4 |
| `verification_event` | Same reading as `history_source_checked` in step 6 |
| `digest_comparison` | `observed_match` / `observed_stale` only if the trace shows the agent computing and comparing the digest; otherwise `not_observed` |
| `currentness`, `currentness_basis`, `as_of` | Only from the approved currentness reference given to you for this purpose (pending O-2). Never from a digest match, and never from your own reading of the vault. If none was given: `not_established` |

`value` and `reason` follow the derivation table in [§3.2]; the validator rejects any other value. `f008` is not an input.

### Step 7 — Evidence reads (replaces the Round 1 note)

`version_check = not_checked` only when the read is a compiled claim's first Source (role `first_source`) and that claim's Sources line lists a version; otherwise `not_applicable`. This step governs over METRICS §3.9 where they differ. [§4 row 6]

### Step 8 — Run level (replaces the `wrong_current_claim` item)

- `answerable`: copy from the packet. `proper_abstention` is `not_applicable` exactly when `answerable` is true.
- Do **not** fill `wrong_current_claim`. It is a legacy v1.0/v1.1 field.
- `wcc_gold` and `wcc_vault` are **not judged by the annotator**. The annotator writes both as `unknown` · `REFERENCE_MISSING` with `reference_completeness = absent` (and, for `wcc_gold`, `as_of = null`, `gold_currentness_checked = "unknown"`), so the record validates. The topic session replaces them, in a separate merged file, with the results of two judging passes:
  - **`wcc_gold` pass** (all arms): the judge receives the answer and the dated gold reference only. Records `value`, `reason`, `reference_id`, `reference_version`, `reference_completeness`, `as_of`, `gold_currentness_checked`.
  - **`wcc_vault` pass** (compiled-arm packets only): the judge receives the answer and the vault list only, built by a fixed rule from the frozen compiled vault and versioned before judging. A complete list with no relevant entry gives `false`, not `not_applicable`.
  - The topic session writes `not_applicable` for `wcc_vault` on baseline-arm packets from the arm manifest. No judge chooses it.
  - Neither judge sees the other pass's reference.
- Graph: a `## Sources` wikilink in delivered content counts as a link for `read_from_edge`. [§4 row 4]

### Step 9 — Validation

```bash
python3 -I -B aggregate_v12.py --validate annotator-<k>/ANNOTATIONS.jsonl
```

## Open items this draft cannot close

O-2 (currentness basis), O-4 (dated gold), O-5 (History rows and Records under KF), and the Owner decisions marked "changes pass/fail" in the tables. See [`../V12-OWNER-DECISION-PACKET.md`](../V12-OWNER-DECISION-PACKET.md).
