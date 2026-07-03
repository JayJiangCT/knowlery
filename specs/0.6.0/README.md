# Knowlery 0.6.0 — Release Plan

**Theme:** Deterministic retrieval, measurable quality — upgrade the core retrieval loop from
"described in prompts" to "guaranteed by code and proven by evals".

0.5.0 made knowledge portable (OKF bundles). 0.6.0 makes retrieval quality provable.

## Features

| # | Feature | Spec | Depends on |
|---|---------|------|------------|
| F1 | Retrieval evaluation harness | [f1-retrieval-eval-harness.md](./f1-retrieval-eval-harness.md) | — |
| F2 | Vault-level index projection + `knowlery query` deterministic retrieval + `/ask` slim-down | (spec pending) | F1 |
| F3 | Mechanical staleness dirty-flags (replaces `log.md` timestamp; first tier of freshness) | (spec pending) | F1 |
| F4 | Fixed-context slim-down (`CLAUDE.md` / `opencode.json` imports) | (spec pending) | — |

## Non-goals for 0.6.0

- No embeddings / vector store. Query expansion is handled by `aliases` conventions and
  agent-side synonym expansion.
- No new OKF ecosystem features (no remote registry, no format version bump). Bundles only
  get adapted to the new retrieval entry point.
- No changes to dashboard information architecture, weekly bake, or the activity ledger.

## Process (SDD)

Every feature follows spec-driven development:

1. A feature branch `cursor/f<N>-<name>-92eb` is created per feature.
2. A spec is written under `specs/0.6.0/` **before any implementation code**.
3. The spec is handed to the maintainer for review and acceptance.
4. Implementation starts only after spec acceptance, and must satisfy the spec's
   acceptance criteria verbatim.
5. The implemented feature is handed back to the maintainer for acceptance testing,
   using the self-test checklist included in each spec.
