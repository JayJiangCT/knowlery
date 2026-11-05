# CLI-002 Round 2 — D evidence metrics (T1)

**Status:** PROPOSED measurement contract for CLI-002 Round 2, task T1. It is not a decision and does not change any Round 1 score, verdict, gold label or E-1 decision. CLI-002 stays OPEN.

**Authority it rests on (not restated here):** KF v1.0 F-008 (`format/KNOWLEDGE-FORMAT-v1.0.md` §7.0 and §8), GR-001, GR-003, GR-008, GR-009, and GR-010 (ACCEPTED FOR PILOT). Plan §3 (`../../PLAN.md`) is the specification.

**Machine form:** [`METRICS-SCHEMA.json`](METRICS-SCHEMA.json). **Annotator instructions:** [`ADJUDICATION-PROTOCOL.md`](ADJUDICATION-PROTOCOL.md). All examples in this folder are invented.

## 1. What this measures and why

Round 1 measured evidence by reading each answer's self-reported `evidence[]` list and checking whether the gold file appeared there (directly, through a cited claim's sources, or through a cited page's sources). That answers "did the agent *cite* the right file?". It cannot answer three different questions that matter for retrieval design:

1. Did the retrieval *show* the agent the predesignated gold file?
2. Did the agent actually *receive the content* of a valid source for the fact, gold or not?
3. Is the fact in the answer actually *supported*, with the right value, unit, scope, date, qualifier and status, by content the agent received?

The fields below separate those questions. Each one is set from **observable trace events**, and each one may be `unknown` when the trace cannot settle it.

**One rule decides every edge case:** "delivered to the agent" means text inside a tool result returned to the model (in the Round 1 harness format: the `content` of a `tool_result` block inside a `user` line). Tool *inputs*, the agent's own text, harness side-channel fields, and the answer's self-reported `evidence[]` are **not** delivered content.

## 2. The levels are not nested

The plan names a workflow L1 → L2 → L3: gold path seen (L1), valid source reached (L2), fact verified (L3). **This is a conceptual order, not a numeric nesting.** No level implies another:

| Pattern (invented example) | L1 `gold_path_hit` | L2 `valid_source_reached` | L3 `fact_verified` |
|---|---|---|---|
| Agent reads a second export of the same note, never sees the gold path | false | true | true |
| Agent sees the gold path in a listing, answers from a compiled claim, never opens a source | true | false | true |
| Agent greps the gold file; the snippet misses the line that carries the fact | true | false | false |
| Agent reads a candidate note nobody has adjudicated | false | unknown | true |

So aggregate counts must be reported per level side by side, never as "L3 ⊆ L2 ⊆ L1" or as a funnel. `aggregate.py` reports the joint pattern (`level_patterns`) so non-nesting stays visible.

## 3. Fields

Every observation object carries `value`, `reason` (a code from §5, required exactly when `value` is `unknown`), `events` (zero-based line numbers in the packet trace that justify the value) and an optional `note`.

Each field is recorded **per required fact**. One required fact is one gold `required_evidence` entry (a path, a line range, a quote and what it supports), numbered `F1`, `F2`, … in packet order.

### 3.1 `gold_path_hit` (L1)

- **Definition.** The required fact's gold path was shown to the agent.
- **Set by.** Either (a) a non-error delivered tool result whose text contains the full vault-relative gold path, with or without `.md`, as a plain string or as a wikilink target (`[[path]]`, `[[path|…]]`, `[[path#…]]`); or (b) a non-error `Read` of that path, since the delivered content is by definition that file's.
- **Path forms.** A path written from the vault root (in packets, `<VAULT>/…` replaces the run's absolute root) is the same path.
- **Does not count.** A basename-only wikilink (record it in `note`). The path appearing only in a tool input or in the agent's own text (`PATH_ONLY_IN_TOOL_INPUT` if that is all there is and the outcome is unclear; otherwise `false`). An error result.
- **Values.** `true` / `false` / `unknown`.

### 3.2 `gold_path_opened` (L1, depth)

- **Definition.** Content *from* the gold file was delivered, not just its name.
- **Set by.** A non-error `Read` of the path, or a `Grep` in content mode that returned lines from the path.
- **`read_extent`** (widest delivered form): `full` (whole file, no offset/limit), `offset_limit` (a read window), `grep_snippet` (matched lines with any context), `preview_only` (a persisted-output preview, see §4), `listing_only` (only the name was shown), `none`, `unknown`.
- **Values.** `true` / `false` / `unknown`. `true` implies `gold_path_hit` is `true`.
- **Why separate from `gold_path_hit`.** A path shown in a 100-file listing and a path whose content was read are different retrieval outcomes.

### 3.3 `required_lines_delivered` (L1, content)

- **Definition.** The gold entry's quoted text was in delivered content from the gold path.
- **Set by.** Matching the gold quote, whitespace-normalised and ignoring line-number prefixes, against delivered text attributable to the gold path. `aggregate.py --trace-check` does this mechanically for a single path; the annotator confirms.
- **Values.** `yes` / `partial` (some of the quoted range was delivered) / `no` / `unknown`.
- **Why it exists.** Opening a file through a narrow search window is not the same as receiving the line that carries the fact.

### 3.4 `valid_source_reached` (L2)

- **Definition.** Content of a **valid, pre-adjudicated source** that states the fact was delivered to the agent. It can be `true` when `gold_path_hit` is `false`.
- **Valid source.** The gold path, or a source listed in the packet as a *pre-adjudicated accepted equivalent* for that fact. Nothing else. Pre-adjudicated *rejected* candidates never count.
- **`source_basis`:** `gold` / `preadjudicated_equivalent` / `none` / `unknown`; **`source_ref`:** the source used.
- **Annotator-proposed equivalents** are recorded in `proposed_equivalents[]` with the six-criterion check (§3.8) and a decision (`accept` / `reject` / `unsure`). A proposal **never** makes this field `true`: if no valid source was reached but the annotator would accept a candidate, the value is `unknown` with `EQUIVALENCE_NOT_ADJUDICATED`. Adjudicating proposals is a separate step with its own authority (protocol §6).
- **Values.** `true` / `false` / `unknown`.

### 3.5 `fact_verified` (L3)

- **Definition.** The reviewer confirms that (a) the final answer states the required fact with the same value, unit, scope, date, qualifier and knowledge status, **and** (b) text that states it in that form was delivered to the agent.
- **Components.** `answer_asserts`: `yes` / `partial` / `no` / `contradicts` / `unknown`. `support_delivered`: `yes` / `no` / `unknown`. `support_kind`: `source` / `compiled_claim` / `both` / `none` / `unknown`.
- **Derivation (deterministic).** `true` if `answer_asserts = yes` and `support_delivered = yes`; `false` if `answer_asserts` is `no`, `partial` or `contradicts`, or `support_delivered = no`; otherwise `unknown`.
- **Not source authority.** Support may come from a compiled claim. Whether the agent then met the source-check rule is a separate field (§3.7), as the plan requires.
- **Not a Round 1 regrade.** It is per fact and evidence-bound. It does not replace the Round 1 correctness verdict.

### 3.6 `navigation_used_as_evidence`

- **Definition.** The answer or its self-reported evidence treats a navigational relation (a `## Related` entry, a plain wikilink or a backlink) as the source of the fact, while the linked note's content was never delivered. GR-001: navigational relations do not prove facts.
- **Values.** `true` / `false` / `unknown`.

### 3.7 F-008 compliance, per compiled claim (`compiled_claims[]`)

Recorded for every compiled Knowledge-page claim whose text was delivered and which the answer relies on. KF v1.0 §7.0 is applied without reinterpretation: *before a claim is given as an answer, the agent reads that claim's first vault-file Source, unless the page's `## History` has a `source-checked` event for that claim at the version listed in `## Sources` and the Source's current digest still equals that version.*

Components: `used_in_answer`, `first_vault_source` (`identified` / `none` / `ambiguous` / `unknown`) and `first_source_ref`, `first_source_read` (an observation), `history_source_checked` (`present_at_listed_version` / `present_other_version` / `absent` / `unknown`), `source_digest_state` (the annotator's own digest comparison: `match` / `stale` / `not_computed` / `not_applicable`), `digest_step_observed` (does the trace show the agent comparing the digest).

`f008.value` is derived, in this order:

| Condition | f008 |
|---|---|
| claim not used in the answer | `not_applicable` |
| use unclear | `unknown` · `F008_USE_UNCLEAR` |
| claim cites no vault-file Source | `not_applicable` |
| first vault-file Source ambiguous or unknown | `unknown` · `F008_FIRST_SOURCE_AMBIGUOUS` |
| first Source read | `compliant` |
| read status unknown | `unknown` · the read's own reason |
| not read; no event, or event at another version | `non_compliant` |
| not read; event state unknown | `unknown` · `F008_HISTORY_NOT_DETERMINED` |
| not read; event at listed version; digest stale | `non_compliant` |
| not read; event at listed version; digest not computed | `unknown` · `F008_DIGEST_NOT_COMPUTED` |
| not read; event at listed version; digest matches; agent's digest step observed | `compliant` |
| not read; event at listed version; digest matches; no digest step in the trace | `unknown` · `F008_DIGEST_STEP_NOT_OBSERVED` |

**Ambiguity listed, not resolved.** F-008 does not say whether the exception holds when the digest happens to match but the agent never compared it. This contract records that case as `unknown` rather than choosing a reading. It also does not say how to order "first" when a claim's `(src: …)` order differs from the `## Sources` order, whether a `record`-kind entry counts as a "vault-file Source" when a `source`-kind entry is also cited, or whether a `derived` entry counts; all three are `F008_FIRST_SOURCE_AMBIGUOUS`. Resolving these is a KF question, outside T1.

### 3.8 Equivalence standard

A candidate source is equivalent to a gold entry only if it supports the same complete proposition on **all six** criteria: **value, unit, scope, date, qualifier and knowledge status** (for example, a goal statement is not a measured result, a design decision is not a deployment). Judgement is at the level of the statement that bears on the fact, not the document. Each criterion is recorded as `same` / `different` / `not_stated` / `unknown`. This is the E-1 standard of Round 1, unchanged.

### 3.9 Evidence-read state (`evidence_reads[]`, the `inspect` semantics)

For each delivered read of a relevant file (gold, equivalent, candidate, compiled page used, or a claim's first source), the annotator records `completeness` (`full` / `partial` / `none` / `unknown`), `partial_cause` (`none` / `offset_limit` / `grep_snippet` / `persisted_preview` / `pagination` / `listing_only` / `tool_error` / `unknown`) and `version_check` (`match` / `stale` / `not_checked` / `not_applicable`). `state` is derived, with this precedence:

`unknown` (a component unknown) > `error` (tool error) > `version_stale` (the trace shows a version check that failed) > `truncated` (partial content) > `unverified` (a cited version exists but the trace shows no check) > `read`.

GR-008: these states are mechanical. **A `read` state never certifies that the content is true or that it supports the answer.** That judgement lives only in `fact_verified`.

### 3.10 Run-level measures

Annotated: `answer_mode` (`answered` / `abstained` / `mixed` / `unknown`); `proper_abstention` (`true` / `false` / `not_applicable` for answerable questions / `unknown`); `wrong_current_claim` (the answer presents a superseded claim as current, or a `#disputed` claim as settled; describing an old value as the past state does not count); graph measures `available`, `calls`, `returned_edges`, `read_from_edge`, `verified_use` (a count, `unknown`, or `NOT_OBSERVABLE_IN_ROUND1`).

Not annotated; computed mechanically from the trace's final result event and the run record by the topic session: tool-call counts by kind, context consumption, total cost, and **final strict correctness, which is always the frozen Round 1 verdict** joined after annotation, never re-judged here. Essential-fact coverage is the per-run share of required facts with `fact_verified = true`, reported with the counts of `false` and `unknown` beside it. Source version validity is the distribution of `evidence_reads[].state`. Output truncation status is the share of relevant reads in `truncated`.

## 4. What Round 1 traces can and cannot show

Round 1 agents had only file listing, file search and file read tools. Consequences:

- **Truncation is observable.** A read window (`offset`/`limit`); search results limited to matching lines; a result replaced by a "persisted output" notice with a short preview (the full text was written to a harness file outside the vault and outside the trace; unless the trace shows the agent reading it, only the preview was delivered); paginated search results; tool errors.
- **Version checks are not observable.** No agent could compute a digest, so `version_check` is `not_checked` or `not_applicable` for every Round 1 read, and `version_stale` occurs only in synthetic fixtures. `digest_step_observed` is `false`.
- **Graph operations did not exist.** There was no `explore`-style tool, so `calls` and `returned_edges` are `NOT_OBSERVABLE_IN_ROUND1`. `read_from_edge` may be counted where a read's target first appeared as a link in delivered content.
- **Harness truncation of a plain read** (a file longer than the reader's default line cap) shows as a shorter result than the file; the annotator compares with the file when it matters.

## 5. Reason codes for `unknown`

| Code | Use when |
|---|---|
| `TRACE_INCOMPLETE` | The trace lacks the events needed (cut off, no result event, a tool call with no result) |
| `PERSISTED_OUTPUT_NOT_IN_TRACE` | The content that would decide the value went to a persisted harness file whose content is not in the trace |
| `PAGINATED_RESULT` | A paginated or limited result may have omitted the deciding content |
| `TOOL_ERROR` | An error result makes the outcome unclear |
| `PATH_ONLY_IN_TOOL_INPUT` | The path appears only in a tool input and the result does not settle delivery |
| `QUOTE_NOT_MATCHABLE` | The gold quote cannot be matched reliably (formatting, tables, normalisation) |
| `LINE_NUMBERS_NOT_IN_OUTPUT` | Delivered text has no line numbers and the quoted range is not identifiable by text |
| `EQUIVALENCE_NOT_ADJUDICATED` | Only a non-pre-adjudicated candidate was reached |
| `SOURCE_AUTHORITY_CONFLICT` | Two authoritative sources in the packet disagree on the fact |
| `ANSWER_AMBIGUOUS` | The answer's wording does not settle whether it asserts the fact |
| `SCOPE_OR_QUALIFIER_UNCLEAR` | One of the six criteria cannot be judged from what is available |
| `F008_USE_UNCLEAR` | It is unclear whether the answer relies on the claim |
| `F008_FIRST_SOURCE_AMBIGUOUS` | The claim's first vault-file Source is not settled mechanically |
| `F008_DIGEST_STEP_NOT_OBSERVED` | Event at the listed version, digest matches, but the agent never compared it |
| `F008_DIGEST_NOT_COMPUTED` | Event at the listed version, and the annotator did not compute the digest |
| `F008_HISTORY_NOT_DETERMINED` | The page's History cannot be read for the event |
| `NOT_OBSERVABLE_IN_ROUND1` | The Round 1 harness had no event of this kind (count fields only) |
| `PROTOCOL_GAP` | The protocol does not cover the case; also list it under `protocol_gaps` |
| `OTHER` | None of the above; a `note` is required |

`unknown` is never a guess and never silently counted as `false` or `true`.

## 6. Rules the schema cannot express (checked by `aggregate.py --validate`)

| Rule | Statement |
|---|---|
| S1 | `reason` is set exactly when the value is `unknown`; `OTHER` needs a `note` |
| S2 | `gold_path_opened = true` ⇒ `gold_path_hit = true` and an opened `read_extent`; `false` ⇒ `listing_only` or `none` |
| S3 | `gold_path_hit = false` ⇒ not opened, `read_extent = none`, `required_lines_delivered = no` |
| S4 | `required_lines_delivered` `yes`/`partial` ⇒ `gold_path_hit = true` |
| S5 | `valid_source_reached = true` ⇒ basis `gold` or `preadjudicated_equivalent` with a `source_ref`; basis `gold` ⇒ `required_lines_delivered = yes`; `false` ⇒ basis `none` |
| S6 | An accepted *proposed* equivalent cannot coexist with `valid_source_reached = false` |
| S7 | `fact_verified` equals its derivation (§3.5); `support_kind` agrees with `support_delivered` |
| S8 | `f008` equals its derivation (§3.7); `first_source_ref` is set exactly when the first source is `identified` |
| S9 | Each read `state` equals its derivation (§3.9); `completeness` agrees with `partial_cause` |
| S10 | Fact ids, claim refs and reads are unique within a record |

Digest-like fields in fixtures use obviously fake tokens such as `sha256:fake0004a`; no real digest appears in this folder.

## 7. How this differs from Round 1's direct, claim and page tiers

| | Round 1 tiers | Round 2 D fields |
|---|---|---|
| Input | The answer's self-reported `evidence[]` | Delivered tool results in the trace |
| Unit | Required file, per run | Required fact (gold entry), per run |
| **Direct** | Gold path cited directly | Closest is `gold_path_opened`, but measured on what was read, not cited; a cited-but-never-read path is not opened |
| **Claim** | Gold reached by following a cited claim's `(src:)` | No equivalent: following a citation is not delivery. If the agent read the source, L1/L2 show it; if it only read the claim, `support_kind = compiled_claim` and F-008 shows whether it should have read the source |
| **Page** | Gold anywhere in a cited page's Sources | Shows up only as `gold_path_hit` (the path was displayed in a Sources line), with `read_extent = listing_only` |
| Equivalents | Added afterwards for three questions (E-1) | Built in: pre-adjudicated equivalents count for L2; new candidates stay `unknown` until adjudicated |
| Line level | File-level only | `required_lines_delivered` checks the quoted line |
| Unknown | Not representable | Explicit, with a reason code |

The two systems answer different questions and are not reconciled numerically. Round 1 figures stay the published result.
