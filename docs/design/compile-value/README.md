# Compile value: what should the next cook session bring?

Design track for 1.6.1 (evaluation infrastructure) and 1.7.0 (signal store and
public interface). Status: **draft for review** — nothing here changes product
behaviour yet.

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

## Documents

1. [Evaluation protocol and annotation template](./evaluation-protocol.md) — with
   the template at [`evals/compile-value/annotation-template.yaml`](../../../evals/compile-value/annotation-template.yaml).
2. [Signal store v2 design](./signal-store-v2.md).

## Out of scope until both documents are reviewed

- Any change to user-visible ordering.
- Any widening of what is sent to Jev.
- Local Delta implementation and offline experiments (next phase).
