# Knowlery 1.3.0 — Release Plan (opening)

**Theme (working):** grounding the promises — the retrospective's follow-ups.
Features join as they are specced; the ledger below carries the candidates
identified at the 0.5→1.2 retrospective and the graphify comparison.

## Features

| # | Feature | Spec | Depends on |
|---|---------|------|------------|
| F1 | The one-line installer: `curl -fsSL <docs-site>/install.sh \| sh` — isolated-prefix install, PATH handled with consent, never silently. Release-independent (served from the docs site; live on docs deploy) | [f1-install-script.md](./f1-install-script.md) | published `knowlery@^1` |

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
