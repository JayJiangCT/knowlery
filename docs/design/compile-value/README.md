# Compile value: what should the next cook session bring?

Design track for 1.6.1 (evaluation infrastructure) and 1.7.0 (signal store and
public interface). Status: **revision 2, draft for review**. The first review
passed the design on condition that its P0/P1 items were fixed, and this
revision addresses them. Nothing here changes product behaviour yet.

## Positioning

Knowlery should be able to say *what value the next knowledge compilation is
likely to add*, and why. Jev is one judging tool inside that capability, not the
capability itself: with Jev disabled, local signals must still produce a
meaningful, explainable suggestion.

Three signals stay independent and explainable end to end — in the store, in the
staleness report, for the agent, and in the UI. They are never collapsed into a
persisted composite score.

| Signal | Question it answers |
| --- | --- |
| Knowledge Worth | Does the note contain durable knowledge? |
| Knowledge Delta | How much does it add relative to the knowledge base as it stands? |
| User Relevance | How much does it matter for what the user is focused on? |

Pipeline: raw notes → fast screening (Worth; Jev optional) → context enrichment
from Knowlery's own retrieval (never the whole vault) → context-aware
prioritisation (a named, versioned ordering policy computed at read time) →
agent `/cook` (full read, cross-checking, compilation).

## Decisions already taken (2026-10-12)

| Topic | Decision |
| --- | --- |
| Compiled-page summaries to Jev | Allowed in principle, behind a separate consent that is off by default and shows the exact payload. Enabled only after local Delta has been baselined and Jev measurably beats it. |
| Relevance sources | Both `KNOWLEDGE.md` (long-term background) and `.knowlery/focus.md` (current explicit focus); the latter takes precedence. |
| Versions | 1.6.1: evaluation infrastructure only. 1.7.0: signal store, new dimensions, public interface. No persisted schema change in a patch release. |
| Delta evidence | Verifiable knowledge relations and compile provenance first; retrieval similarity and timestamps are weak signals only. Insufficient evidence yields `unknown` or low confidence, never a falsely precise number. |
| Evaluation | Annotators never see Jev scores; the knowledge-base state and focus are frozen at sampling time; reports show ranking gain, low-band miss rate, and per-type behaviour together. 60–80 notes are a first directional check, not proof of long-term reliability. |
| Annotators | A single annotator, plus a blind re-label of a random 20% at least one week later. A second annotator only if qualified to judge the notes; never an unqualified one for formal independence. |
| Local Worth in 1.7.0 | Minimal: only empty files, known template boilerplate, and files that declare themselves generated. Ordinary notes stay `unknown`. No folder-name or "draft" heuristics. |
| `focus.md` expiry | Optional `until: YYYY-MM-DD` frontmatter, inclusive through local 23:59:59. Without it, focus stays in force. After expiry, Relevance falls back to `KNOWLEDGE.md`. Frozen evaluations use `frozenAt` and the recorded time zone. |
| Store file name | `.knowlery/compile-signals.json`. |
| Link-only Delta | A wikilink proves a subject relation, not overlap, so it yields `unknown` with a `target`, never `partial`. |

## Review round 1 → revision 2

| Review item | Where it is addressed |
| --- | --- |
| P0-1 sample vs real queue | Protocol §1.1, §2, §5: a diagnostic tier (sample only) and an operational tier (full frozen queue, pooled top-k labels); ship decisions use operational metrics |
| P0-2 `cook_next` definition | Protocol §6.4: fixed ≤ 10-note session, four criteria, reason codes, `depends_on`/`compile_with`, and a budgeted `selected_next` step |
| P0-3 critical vs actionable critical | Protocol §6.6, §9.3: only `actionable_critical` enters miss rates and gates; the seeded flag lives in a private harness file (§3) |
| P0-4 Delta evidence | Store §2.2: evidence typed by relation (source, version with direction, subject, coverage); only coverage can support `redundant` |
| P0-5 cache dependencies | Store §4.1–4.2: `contentHash` vs per-producer `inputFingerprint`; Jev Worth split from the candidate request (`jev-subject`) |
| P0-6 concurrent writers | Store §4.5: runtime guarantees, options A/B/C compared, lock file + generation check recommended, real multi-process tests; mirror behaviour in §6.2 |
| P1 Jev confidence | Store §2.4: `null` until a calibration record with n ≥ 20 and a Wilson lower bound; protocol §10 rule 3 |
| P1 stale `redundant` | Store §5.3: exposed as `unknown` with `previous`; no signal lets the agent skip a note unread |
| P1 unavailable producers | Protocol §8: reported as `not available`, never filled with placeholder values |
| P1 CLI consent boundary | Store §7.1: consent matrix, no granting flag or environment variable, never on agent-facing paths, each row tested |
| P1 protocol versioning | Protocol §10: a revised rule needs a new protocol version and a fresh freeze |
| `labels.yaml` in the public repo | Replaced by synthetic data in #87, with a history audit; a history rewrite awaits a separate risk assessment |

## Documents

1. [Evaluation protocol and annotation template](./evaluation-protocol.md) — with
   the template at [`evals/compile-value/annotation-template.yaml`](../../../evals/compile-value/annotation-template.yaml).
2. [Signal store v2 design](./signal-store-v2.md).

## Out of scope until both documents are reviewed

- Any change to user-visible ordering.
- Any widening of what is sent to Jev.
- Local Delta implementation and offline experiments (next phase).
