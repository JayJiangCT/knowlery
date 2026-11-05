# CLI-002 Round 2 — D annotation and adjudication protocol

**Protocol version:** 1.1 (write `"protocol_version": "1.1"` in every record).
**Status:** PROPOSED, task T1. It changes no Round 1 score, verdict, gold label or E-1 decision.
**Changes from 1.0** (Owner rulings on the first D review, 2026-11-05; the calibration sample was annotated under [1.0](ADJUDICATION-PROTOCOL-v1.0.md)): rules A (superseded History entries), B (equivalence uses delivered text only) and C (restating the question asserts nothing), added in step 4 and section 5.

This protocol is for an annotator who has **only** this file, [`METRICS.md`](METRICS.md), [`METRICS-SCHEMA.json`](METRICS-SCHEMA.json), [`aggregate.py`](aggregate.py) and one or more packets. If something you need is not in those, it is a protocol gap: record it (step 9) and do not fill it from elsewhere.

Examples below use an invented vault. Real packets live only in the approved private store.

## 1. Your role and your limits

- You are `annotator-1` or `annotator-2`. Your id is given by whoever started your session. You write only to your own folder, `annotator-<k>/`, next to `packets/`.
- You annotate **what the trace shows**. You do not regrade the answer, change gold, decide whether the agent "should" have done better, or decide anything about CLI design.
- You never see, and must not look for: the other annotator's folder, the sample index (`SAMPLE.json`), Round 1 scores, verdicts, findings, audits, the E-1 ledger, or the run's arm. If you see one by accident, stop and say so in `notes`; the topic session decides whether your record is still independent.
- You never confer with the other annotator. Disagreement is expected and useful; it is resolved later (section 6), not by you.
- All vault files are read-only. Do not edit, move or create anything in a vault.

## 2. What a packet contains

`packets/<n>/`:

| File | What it is |
|---|---|
| `packet.json` | `vault_root`; the question and its category; `answerable` and the unanswerable condition; the expected answer; `required_facts` (F1, F2, … each with a path, a line range, a quote and what it supports); optional evidence (context only, not annotated); `preadjudicated_equivalents`; `openable_paths` and `openable_rule` |
| `trace.jsonl` | The run's tool-call trace, one event per line. Line numbers are preserved, so cite them as `events`. Some machine-identifying fields were removed or replaced by `<VAULT>` / `<harness-tool-results>` |
| `answer.json` | The agent's final answer and its **self-reported** evidence list. It is a claim by the agent, not a measurement |

Open only the files `openable_rule` allows.

## 3. Reading a trace

Each line is a JSON object. The ones that matter:

- `type: "assistant"` with a `tool_use` block: the agent called a tool. `name` is `Read`, `Grep`, `Glob` or `StructuredOutput` (the final answer). `input` holds the arguments: `file_path`, `offset`, `limit` for `Read`; `pattern`, `path`, `glob`, `output_mode`, context flags for `Grep`.
- `type: "user"` with a `tool_result` block: **the text the agent received.** This is the only "delivered" content (METRICS.md §1). Match it to its call by `tool_use_id`.
- `type: "result"` at the end: the run finished. If it is missing, the trace is incomplete.
- Ignore `thinking`, `rate_limit_event`, `task_summary` and sidecar fields such as `tool_use_result` and `tool_result_meta` for delivery decisions. They are not what the model read.

Some agents used absolute paths. In packets the run's vault root is replaced by the placeholder `<VAULT>`, so `<VAULT>/notes/x.md` is the same file as `notes/x.md` under `vault_root`; `--trace-check` treats it that way.

Read results are prefixed with line numbers and a tab (`41\t…`). Grep content results are `N:text` for one file or `path:N:text` across files; context lines use `-` instead of `:`. A result that begins `<persisted-output>` was too large: the agent received only the preview shown, unless a later event in the trace reads the saved file.

## 4. Step by step

Do the steps in order for each packet. Write one JSON object per packet.

**Step 1 — Trace status.** Is there a `result` event, and does every tool call have a result? `trace_status.value` = `complete` / `incomplete` / `unknown`. If incomplete, say what is missing in `note`. Anything that depends on the missing part becomes `unknown` with `TRACE_INCOMPLETE`.

**Step 2 — Mechanical L1, per required fact.** For each fact run:

```bash
python3 -I aggregate.py --trace-check packets/<n>/trace.jsonl --path "<fact path>" --quote "<fact quote>"
```

It reports whether the path was shown (`gold_path_hit`), opened, the widest `read_extent`, whether the quote was delivered, and the event numbers. **Confirm each by opening those events.** The helper is a string matcher. It can miss a quote split by formatting (then use `QUOTE_NOT_MATCHABLE` or judge by reading) and it does not see basename-only links (they do not count; mention them in `note`).

Fill `gold_path_hit`, `gold_path_opened` (with `read_extent`) and `required_lines_delivered` (`yes` / `partial` / `no` / `unknown`). Rules S2–S4 in METRICS.md §6 must hold.

**Step 3 — L2, per fact.** Was content of a **valid** source that states the fact delivered?

1. If the gold quote was delivered (step 2 `yes`): `true`, basis `gold`.
2. Else, for each **accepted** pre-adjudicated equivalent that applies to this fact: was its stated location delivered (by `Read` covering it or a `Grep` returning it)? If yes: `true`, basis `preadjudicated_equivalent`, `source_ref` = its path.
3. Else, did the agent receive another note that might state the same fact? Open it (it is named in a delivered result, so it is openable) and apply the six-criterion check (section 5). Record it in `proposed_equivalents` with your decision. Then `valid_source_reached` is `unknown` with `EQUIVALENCE_NOT_ADJUDICATED` — even if you accept it. Your acceptance is a proposal, not authority.
4. Else: `false`, basis `none`.

Rejected pre-adjudicated candidates never count, and you do not re-propose them.

**Step 4 — L3, per fact.** Two separate judgements, then a mechanical result:

- `answer_asserts`: compare the final answer with the required fact on the six criteria. `yes` (all match), `partial` (some of the fact, or a criterion missing), `no` (not stated), `contradicts` (a different value, date, scope or status is stated), `unknown` (`ANSWER_AMBIGUOUS`).
- `support_delivered`: is there delivered text, from any vault file, that states the fact in the form required? `support_kind` = `source`, `compiled_claim`, `both` or `none`.
- `fact_verified` follows METRICS.md §3.5. Cite the answer event and the support events.
- **Rule C (1.1):** information in the answer that only restates the question's own framing asserts nothing. Invented example: the question asks "what did the early-May kiln review decide?" and the fact is "the 2025-05-06 review set 36 hours"; an answer saying only "in early May" scores `no` on that fact, not `partial`.
- **Rule A (1.1):** a superseded `## History` entry counts as compiled support (`compiled_claim` or `both`) only when the question asks about the state before it was superseded. If the question asks about the current state and the answer relies on a superseded entry, it is not support: record `wrong_current_claim` (step 8).

Context for the six criteria comes from the required fact's `supports` line and the expected answer. The expected answer is context; you judge each required fact separately.

**Step 5 — Navigation used as evidence, per fact.** Does the answer or its self-reported evidence name a note reached only as a link (a `## Related` entry, a wikilink, a backlink) as the support for this fact, while that note's content was never delivered? `true` / `false` / `unknown`.

**Step 6 — Compiled claims and F-008.** List every compiled Knowledge-page claim (a list item ending in `^cN` under `## Current`) whose text was delivered and which the answer relies on for a required fact. Do not list claims that were only displayed and not used, unless use is unclear (then `used_in_answer = unknown`). For each:

1. Open the page in the vault. Find the claim's `(src: …)` ids and the page's `## Sources` lines.
2. `first_vault_source`: the first id in the claim's `(src: …)` list whose Sources line is a vault wikilink of kind `source` or `record`. It is `ambiguous` if (a) the claim's `(src:)` order and the `## Sources` order would give different answers, (b) that first entry is a `record` and a `source`-kind entry also exists (KF does not say whether a Record is a "vault-file Source" here), or (c) the only candidates are `derived`. If the claim cites no vault file at all, `none`.
3. `first_source_read`: did the trace deliver that file's content before the final answer? A read that misses the claim's supporting passage still counts as a read; record its extent in step 7.
4. `history_source_checked`: does `## History` carry `[[#^cN]] source-checked · sK@<version>` for this claim, at the version shown on the `sK` Sources line?
5. Only if the event is at the listed version: `source_digest_state`. Compute the digest with the vault's own documented procedure if you can do it with confidence; otherwise `not_computed`. Otherwise `not_applicable`.
6. `digest_step_observed`: does the trace show the agent computing or comparing a digest? (Round 1 agents had no tool for it, so normally `false`.)
7. Fill `f008` from the table in METRICS.md §3.7. `aggregate.py --validate` will reject a value that does not match the table.

**Step 7 — Evidence reads.** For each delivered read of a gold file, an equivalent, a proposed candidate, a compiled page you listed in step 6, or a first Source from step 6, add an `evidence_reads` entry: the result `event`, `path_ref`, `role`, `completeness`, `partial_cause`, `version_check`, and the derived `state` (METRICS.md §3.9). Round 1 note: `version_check` is `not_checked` for a first Source read on behalf of a compiled claim that lists a version, and `not_applicable` otherwise.

**Step 8 — Run level.** `answer_mode`; `proper_abstention` (`not_applicable` if `answerable` is true; otherwise did the answer correctly say the vault does not hold the requested fact, per `unanswerable_condition`); `wrong_current_claim` (METRICS.md §3.10); `graph` (Round 1: `available` = `no`, `calls` and `returned_edges` = `NOT_OBSERVABLE_IN_ROUND1`; `read_from_edge` = how many reads targeted a file first named as a link in delivered content, or `unknown`; `verified_use` = how many of those supplied support for a verified fact, or `unknown`).

**Step 9 — Gaps and validation.** Add every case the protocol did not settle to `protocol_gaps` (one sentence each) and use `PROTOCOL_GAP` where it forced an `unknown`. Then run:

```bash
python3 -I aggregate.py --validate annotator-<k>/ANNOTATIONS.jsonl
```

Fix every error. A failing record is not finished.

## 5. The equivalence standard

A candidate is equivalent to a required fact only if it states the same complete proposition on all six criteria:

| Criterion | Same means | Invented example of *different* |
|---|---|---|
| value | the same number, name or choice | 36 hours vs 48 hours |
| unit | the same unit, or an exact stated conversion | 1180 C vs 1180 (unitless) |
| scope | the same thing, place, population or system | kiln 2 vs all kilns |
| date | the same date or period, or one the fact explicitly covers | "since March" vs "in March only" |
| qualifier | the same conditions, limits and exceptions | "at full load" dropped |
| knowledge status | the same kind of statement | a goal vs a measured result; a design decision vs a deployment; a draft proposal vs a confirmed constraint |

Judge the statement that bears on the fact, not the document as a whole: a draft document can contain a sentence that restates a confirmed constraint. Record each criterion as `same`, `different`, `not_stated` or `unknown`, give the exact location, and decide `accept` (all six `same`), `reject` (any `different`) or `unsure`.

**Rule B (1.1):** judge the criteria only from text delivered in the trace. Content that is in the file but was not delivered (for example frontmatter a search did not return) counts as `not_stated`. The same holds for `support_delivered` in step 4: do not fill gaps from undelivered content.

## 6. Disagreement and resolution

The annotators never resolve disagreements themselves.

1. **Collect.** When both annotators have finished and validated, the topic session runs `aggregate.py --aggregate annotator-1/ANNOTATIONS.jsonl annotator-2/ANNOTATIONS.jsonl --out AGGREGATE.json`. Every disagreement is listed by packet, item and field.
2. **Record.** The topic session writes `REVIEW-DISAGREEMENTS.md` (private): one row per disagreement with both values, both annotators' cited events and notes, and the class:
   - **Mechanical** (L1 fields, read states, F-008 derivation inputs that the trace settles): resolved by citing the deciding trace event. Whoever resolves it shows the event; no opinion is needed.
   - **Judgement** (`answer_asserts`, `support_delivered`, the six criteria, `navigation_used_as_evidence`, `wrong_current_claim`, `used_in_answer`): goes to the Owner spot-check (T1-R) or a reviewer the Owner names who has not annotated.
   - **Authority** (a proposed equivalent, or `SOURCE_AUTHORITY_CONFLICT`): only the Owner decides. A decision is a new Round 2 adjudication record. It does not edit E-1 or any Round 1 file.
3. **Resolve without editing.** The original annotator files are never changed after aggregation. The resolved values go into a separate consensus file with `annotator_id: "annotator-0"`, which passes the same validation. Each resolved row in `REVIEW-DISAGREEMENTS.md` states the resolution, the rationale, the deciding events and who decided.
4. **Unresolved stays visible.** If a disagreement cannot be settled from the trace, the consensus value is `unknown` with the matching reason code, and the row says why.
5. **Round 1 is untouched.** No resolution changes a Round 1 score, verdict, gold label or E-1 decision. If a resolution suggests one of those is wrong, write that in `REVIEW-DISAGREEMENTS.md` as an observation for the Owner, separately.

## 7. A worked example (invented)

Packet: required fact F1 is "Firing temperature set to 1180 C." at `notes/kiln-log-2031-03.md` line 4. The trace lists `notes/**` (event 2, the path appears), reads `concepts/kiln.md` (event 4, which shows `- Firing temperature is 1180 C (src: s1) ^c2` and `s1 · [[notes/kiln-log-2031-03]] · …`), and answers "1180 C" citing `^c2` (event 5).

- `gold_path_hit` = `true`, events [2, 4]. `gold_path_opened` = `false`, `listing_only`. `required_lines_delivered` = `no`.
- `valid_source_reached` = `false`, basis `none` (a claim is not a source).
- `fact_verified`: `answer_asserts` = `yes`, `support_delivered` = `yes`, `support_kind` = `compiled_claim` → `true`.
- Claim `concepts/kiln.md#^c2`: first vault Source `notes/kiln-log-2031-03.md`, not read, no `source-checked` event → `f008` = `non_compliant`.
- Read event 4: `compiled_page`, `full`, `none`, `not_applicable` → `read`.

So L1 true, L2 false, L3 true, F-008 non-compliant. The full record is `fixtures/annotations/annotator-1.jsonl`, packet `FX02`.
