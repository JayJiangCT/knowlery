# CLI-002 Round 2 — Metric D v1.2: resolution of Owner decisions O1–O8

**Task:** CLI002-R2-D-V12-CLOSURE-01 ([Cloud decision-closure document](../../reviews/O1-O8-DECISION-CLOSURE-2026-11-06.md), §5). **Date:** 2026-11-06. **Input commit:** `530d9e6f5d7a4b9d685bf4e1af3b5f490e2acf9f` on `develop/2.0`.

**Approval evidence:** [`reviews/OWNER-APPROVAL-2026-11-06.md`](../../reviews/OWNER-APPROVAL-2026-11-06.md). In it, the Owner ticked three options of the Cloud document's §6:

- O1(c) as the Gate B evaluation objective;
- the Cloud recommendations O2–O7 "as scoped in §3";
- one bounded O8 private regression.

The "request modifications" option was not chosen.

**What "approved" means here.** These are Owner ratifications of scoped recommendations. They are **not** ACCEPTED entries, and `docs/2.0/DECISIONS.md` is not edited. They do not freeze Metric D and do not authorize Gate B, T2, T3, C, A, paid runs or any KF v1.0 change. The `PLAN.md` §5 amendment for O1(c) stays a proposal until the Owner approves its text ([`V12-QUALITY-EFFICIENCY-AMENDMENT.md`](V12-QUALITY-EFFICIENCY-AMENDMENT.md)).

The earlier packet ([`V12-OWNER-DECISION-PACKET.md`](V12-OWNER-DECISION-PACKET.md)) and proposal ([`V12-CONTRACT-PROPOSAL.md`](V12-CONTRACT-PROPOSAL.md)) are kept unchanged as history. Where they recommended P0 as primary (option (a)), O1(c) supersedes that recommendation.

## Status by decision

| ID | Approved scope (Cloud §1/§3) | Status | Where implemented (candidate files) | Residual issues |
|---|---|---|---|---|
| **O1** | (c) Quality-Gated Efficiency: Strict Correctness and query cost are the co-primary dimensions, compared per task; quality is constrained; P0/P1 become diagnostics; no P2 and no weighted score | **Owner-approved objective**, not a frozen statistical contract | [`V12-QUALITY-EFFICIENCY-AMENDMENT.md`](V12-QUALITY-EFFICIENCY-AMENDMENT.md) (proposed PLAN §5 text); summary key `P1` renamed `P1_exploratory` | The acceptable quality change is an Owner-set parameter, not yet set. The amendment text needs Owner approval |
| **O2** | (i), minimal: compiled-reuse `true` only with an independent, dated, versioned currentness reference bound to the same claim, Source and version; otherwise `unknown`. No new system | **Owner-approved in scope** | `aggregate_v12.py`: rule `R5` and manifest binding check (closure M1); P1 is exploratory | **No approved reference exists**, so compiled-reuse cannot be `true` on any real record. The positive path is exercised only with one invented reference in the synthetic fixtures |
| **O3** | WCC split, as fixed by closure M2: authoritative WCC needs a validated manifest; otherwise the output is provisional; missing bindings and arm or version mismatches are rejected; counts cover all valid records | **Owner-approved in scope** | `validate_manifest`, `_manifest_errors`, `mode: authoritative / provisional`; tests `M2Manifest` (API and CLI) | No real `wcc_vault` reference has been built; the build rule is specified only by its required properties |
| **O4** | Purely historical question ⇒ `wcc_gold = not_applicable`, driven by the manifest (`wcc_gold_scope = historical_only`). Current-state questions need a dated gold | **Owner-approved in scope** | schema allows `not_applicable` for `wcc_gold`; manifest check; tests `O4HistoricalScope` | Writing v3 dated gold is a separate T3 authorization, not part of this task |
| **O5** | History entries relied on: F-008 `unknown` · `F008_HISTORY_ENTRY_SCOPE_OPEN`. A Record without a claim anchor is not a valid source, may be recorded as compiled support (with a note), and never makes compiled-reuse `true` | **Owner-approved in scope**; the **KF questions stay OPEN** for KF governance | `claim_position = record_unanchored` ⇒ `unknown` · `RECORD_WITHOUT_CLAIM_ANCHOR`; `R5` requires a `#^cN` anchor; protocol step 3/4/6 wording | KF governance must still answer: (1) does F-008 apply to superseded History entries; (2) which is their first vault-file Source; (3) where Records sit in KF semantics |
| **O6** | G-c review trigger. Every confirmed `non_compliant` case goes to a pre-registered adverse-case review. `unknown` is never treated as compliant. A blocker is anything that could reverse the main quality conclusion, forged sources, or systematic serious evidence violations | **Owner-approved in scope** | summary fields `f008` (counts) and `f008_review_trigger` (cases); test `test_f008_review_trigger_lists_non_compliant_claims` | The review procedure itself is part of the Gate B preregistration (T3), not built here |
| **O7** | The seven rule families in Cloud §3 O7, approved once | **Owner-approved in scope** | [`v1.2/ADJUDICATION-PROTOCOL-v1.2-DRAFT.md`](v1.2/ADJUDICATION-PROTOCOL-v1.2-DRAFT.md) steps 3–8; validator rules `E1`, `Z1`, `Z2`, three-valued logic | Wording is checked once by the O8 regression; minor disagreements will be recorded as limitations |
| **O8** | One private regression: at most 2 fresh isolated annotators, at most 3 packets, one round, no paid services | **Owner-approved; pre-registered, not yet run** | [`V12-REGRESSION-PLAN.md`](V12-REGRESSION-PLAN.md) (public design); private plan, expectations, inputs and hashes are frozen in the approved private store | Annotators not started yet. Result and verdict follow in `V12-REGRESSION-SUMMARY.md` |

## Fixes from the independent review of `530d9e6`

| Finding | Fix | Evidence |
|---|---|---|
| **M1** — P1 `true` not bound to a claim-specific evidence chain | A recorded compiled-reuse `true` must name an anchored claim (`#^cN`), its Source and Source version, trace events, a currentness basis and `as_of` (rule `R5`). It counts as `true` only if that exact binding matches an approved reference in a validated manifest. Otherwise an authoritative summary rejects it, and a provisional summary counts it as `unknown` | Tests `M1Binding` (7), self-test `reuse-true-*` cases (5) |
| **M2** — WCC manifest optional or bypassable | `validate_manifest` rejects malformed or empty manifests, unknown keys, a bad `arm_kind` or `wcc_gold_scope`, and missing reference bindings. `summarize` rejects records outside the manifest, arm or scope mismatches, and reference mismatches. Without a manifest the output is labelled `provisional`, also on stderr | Tests `M2Manifest` (7, incl. CLI), self-test `malformed manifest *` (5) |
| **M3** — P0-primary misaligned with the product goal | Closed by the O1(c) decision; P0 stays a diagnostic | — |
| **M4** — regression not run; no R-A3 case | Pre-registered. R-A3 uses one invented synthetic packet, because no calibration packet exercises the current-state branch | `V12-REGRESSION-PLAN.md` change note |
| **m1** — "optimistic" label for the determinate-only rate | Renamed `pass_conditional_on_determinate`, with `unknown_share` printed beside it | `SummaryCounts.test_p0_counts_and_both_denominators` |
| **m2** — no `answerability_unknown` fixture; handoff SHA wording | Fixture `legacy-answerability-unknown.jsonl` and test `AnswerabilityUnknown`. A publication note was added at the top of `V12-REPORT.md` | — |

## Not done, by design

No P2 and no weighted score. No lifecycle, currentness or supersession engine. No v3 gold. No change to KF v1.0, the v1.0/v1.1 contract files, Round 1 results or historical `wrong_current_claim`.
