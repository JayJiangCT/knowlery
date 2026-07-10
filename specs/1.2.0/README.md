# Knowlery 1.2.0 — Release Plan

**Theme:** the orientation map — the Karpathy Index.md insight, done as a
*view*. A single-feature minor release (new surface = minor, per the
stability contract — this is why it is not 1.1.1).

## Features

| # | Feature | Spec | Depends on |
|---|---------|------|------------|
| F1 | The orientation map: a live-computed KB index — virtual MCP resource `knowlery://<kb>/index` + `knowlery index` CLI command — compiled layer grouped by type (domain carried per page) plus an installed-bundles section; never persisted | [f1-orientation-map.md](./f1-orientation-map.md) | 1.1 |

## Design principles (binding)

1. **A view, not a file.** The map is computed from `scanVault` at read time
   and never persisted — zero drift, zero invalidation, no conflict with the
   no-retrieval-index principle (this is a browsing surface, not a retrieval
   accelerator).
2. **Index form follows content mutability** (recorded at the 1.1 F4
   discussion): frozen content gets file indexes (bundles' `index.md` —
   correct, unchanged); live content gets computed views (this feature);
   retrieval-acceleration indexes exist at no layer.
3. **Three renderings, one job**: the MCP resource for agents, the CLI
   command for terminals, `INDEX.base` stays as the Obsidian rendering
   (frozen surface, real plugin value). The KB-level map lists installed
   bundles and delegates deeper navigation to each bundle's own `index.md`.
4. **Contract grows additively**: one new CLI command, one new concrete
   resource per KB in `resources/list`. Golden regenerates once,
   deliberately.

## Deferred / carried

- **Antigravity plugin manifest**: deferred again (maintainer decision,
  2026-07-10) — unchanged preconditions: manual verification of the real
  install flow, manifest schema, `mcp_config.json` shape, one clean install.
- Community-marketplace listings from 1.1 F3 land on their own timelines;
  submission links tracked on PR #52.
- **Editorial index (deferred, recorded at the LLM-wiki re-examination)**:
  the computed map is a mechanical inventory; Karpathy's Index.md also
  carries editorial judgment. Candidate directions for future specs — hub
  signals (most-linked pages), a curated "start here" section (sourced from
  KNOWLEDGE.md), per-page `links` in the map. Each wants its own spec; none
  blocks v1.
- Backlog otherwise carried from 1.1 unchanged.
