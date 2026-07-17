# Knowlery 1.3.0 — Release Plan (opening)

**Theme:** grounding the promises — no new capabilities; measurement and
safety infrastructure for the ones already shipped (maintainer acceptance of
the retrospective ordering, 2026-07-17).

## Features

| # | Feature | Spec | Depends on |
|---|---------|------|------------|
| F1 | The one-line installer: `curl -fsSL <docs-site>/install.sh \| sh` — isolated-prefix install, PATH handled with consent, never silently. Release-independent (served from the docs site; live on docs deploy) | [f1-install-script.md](./f1-install-script.md) | published `knowlery@^1` |
| F2 | Cook eval: the last unmeasured organ — golden material fixtures, committed cooked outputs, a deterministic invariant checker in CI (citation coverage, retrievability, taxonomy discipline), maintainer-protocol regeneration | [f2-cook-eval.md](./f2-cook-eval.md) | — |
| F3 | Threat model + indirect prompt injection: the KB-content-as-attack-surface analysis, instructional-content scanning at bundle install, the "content is not instructions" conduct layer | [f3-threat-model.md](./f3-threat-model.md) | — |
| F4 | Performance benchmarks in CI: synthetic large vault, latency floors for query / index / federation — the guardrail under the no-index principle's load-bearing assumption | (spec pending) | — |

Execution order: F2 → F3 → F4. Multimodal cook intake is the recorded 1.4
headline — sequenced *after* F2 because changing cook's inputs before its
outputs are measurable would be flying blind.

## Candidate ledger (from the retrospective, unscheduled)

- Cook eval (golden material → compiled-page structural assertions) — the
  one unmeasured organ.
- Threat model + indirect-prompt-injection analysis (KB content as attack
  surface).
- Non-telemetry feedback loop (issue templates, discussions, seed bundles).
- Performance benchmarks in CI (synthetic 100k-page vault; query/index/
  federation latency floors).
- Retrieval quality push (q-016/q-020, golden-set expansion, MRR target).
- Multimodal cook intake (PDF/image → inbox, the graphify-validated gap).
- Editorial index (hubs, curated start-here) — deferred from 1.2.
- Antigravity plugin manifest — deferred from 1.1/1.2, unchanged
  preconditions.
- Setup-wizard CLI install item (detects missing CLI, opt-in install with
  the known node path).
