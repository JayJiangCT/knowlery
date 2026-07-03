# F1 (0.7.0) — Core Extraction: `VaultFs` Inversion of the Lifecycle Modules

- **Status:** Draft — awaiting maintainer spec acceptance
- **Target release:** 0.7.0
- **Branch:** `cursor/07-f1-core-extraction-92eb` (off `main` @ 0.6.1)
- **Depends on:** nothing (prerequisite for every other 0.7.0 feature)

## 1. Problem statement

The standalone CLI needs Knowlery's lifecycle logic — init, skill/rule sync,
migrations, health checks, bundle install — but that logic currently does I/O through
Obsidian's `App` object. The logic itself is platform-neutral; only the I/O is bound.

0.6.0 already proved the pattern on the hardest subsystem: the retrieval engine
(`src/core/query/`) has zero `obsidian` imports, is guarded by a purity unit test, and
is consumed by three shells without forks. F1 applies the same inversion to the
lifecycle modules, as a **pure refactor with zero behavior change** — the release's
riskiest step taken first, while the 0.6.x behavior is freshly verified.

## 2. Goals

1. A minimal `VaultFs` interface abstracting vault-relative file I/O, with two
   implementations: `obsidianVaultFs(app)` (wraps the vault API, preserving today's
   exact write semantics) and `nodeVaultFs(root)` (plain `node:fs`, for the CLI and
   for tests).
2. The modules the CLI needs are inverted to depend on `VaultFs` instead of `App`
   (list in §4.2); everything else is untouched.
3. Zero behavior change, mechanically verified: full test suite, eval baseline, and F2
   thresholds pass unmodified; the plugin's user-visible behavior is identical.
4. The engine-purity guard generalizes: inverted modules must never import `obsidian`
   (type-only imports excluded), enforced by a unit test over the file list.

## 3. Non-goals

- No CLI entry point, no npm packaging (F2).
- No inversion of modules the CLI does not need (§4.3) — inverting speculatively is
  exactly the premature abstraction this plan forbids.
- No signature redesign beyond swapping `App` for `VaultFs`; no renames, no logic
  edits, no error-handling changes while moving.
- No test rewrites beyond mechanically replacing mock-`App` construction with the
  in-memory/node `VaultFs` (assertions stay identical).

## 4. Design

### 4.1 The interface (`src/core/vault-fs.ts`)

```ts
export interface VaultFs {
  exists(path: string): Promise<boolean>;
  read(path: string): Promise<string>;
  readBinary(path: string): Promise<ArrayBuffer>;
  write(path: string, content: string): Promise<void>;
  writeBinary(path: string, data: ArrayBuffer): Promise<void>;
  mkdir(path: string): Promise<void>;
  remove(path: string): Promise<void>;
  list(path: string): Promise<{ files: string[]; folders: string[] }>;
}
```

- Paths are vault-relative with `/` separators, exactly as today.
- `obsidianVaultFs(app)` lives in `src/platform/obsidian-fs.ts`: `write` keeps
  vault-io's current preference (vault API for indexed files, adapter fallback for
  hidden paths) so Obsidian's metadata cache sees changes exactly as it does now;
  `list` wraps `adapter.list`.
- `nodeVaultFs(root)` lives in `src/platform/node-fs.ts`: direct `node:fs/promises`.
  Used by the future CLI and by unit tests (replacing hand-rolled `App` mocks with a
  real implementation over temp dirs, or the existing in-memory stubs re-shaped to the
  much smaller `VaultFs` surface).
- `readBinary`/`writeBinary` exist for bundle zips (okf install path).

### 4.2 Modules inverted in F1 (the CLI's dependency closure)

| Module | Used by (0.7 feature) |
|---|---|
| `vault-io.ts` (absorbed into the `VaultFs` implementations) | all |
| `setup-executor.ts` | F2 `init` |
| `skill-manager.ts`, `rule-manager.ts`, `rule-imports.ts` | F2 `init`/`sync` |
| `migration.ts` | F2 `sync` |
| `platform-adapter.ts` | F2 `init` |
| `query-script.ts` | F2 `init`/`sync` |
| `okf/registry.ts`, `okf/install.ts`, `okf/uninstall.ts`, `okf/knowledge-md-bundles.ts` | F4 `bundle` |
| `vault-health.ts` — config-integrity half only | F2 `health` |

Call sites (plugin `main.ts`, modals, views) construct `obsidianVaultFs(this.app)`
once and pass it down; where a module also needs non-fs `App` facilities, it keeps an
`App` parameter alongside (`vault-health`'s content stats use `metadataCache` and stay
plugin-only, split from the config-integrity function).

### 4.3 Explicitly not inverted

`weekly-bake`, `activity-ledger`, `agent-review`, `claudian-*`, `environment-*`,
`cli-detect`, `node-detect`, `skill-executor`, `legacy-byoao-migration`, `okf`
export-side modules (`collect`, `compile`, `export-scope`, `fork`), and all views —
they serve Obsidian-shell features that 0.7.0 does not port. `okf/collect`
and friends also read via `metadataCache`; porting them is the 0.8 export question.

### 4.4 Purity guard

`tests/core/core-purity.test.ts` extends the engine-purity pattern: every §4.2 module
plus everything under `src/core/query/` must not contain a value import from
`'obsidian'` (type-only imports are erased and allowed, matching how `cli-handler.ts`
works today).

## 5. Risks

- **R1 — behavior drift during the move.** Mitigation: no logic edits allowed in the
  same commits as signature changes; the full suite (178 tests), eval baseline, F2
  thresholds, and a manual plugin smoke test gate the PR.
- **R2 — Obsidian write-semantics regressions** (vault API vs adapter writes affect
  metadata-cache freshness). Mitigation: `obsidianVaultFs.write` reproduces vault-io's
  current branching verbatim; the F4-acceptance mtime-churn test keeps guarding
  write-on-change behavior.
- **R3 — hidden `App` couplings** discovered mid-move (e.g. `normalizePath` imports).
  `normalizePath` is trivial and already duplicated locally in two modules; the core
  keeps a local implementation, only shells use Obsidian's.

## 6. Acceptance criteria

1. All §4.2 modules pass the purity guard; the guard test exists and fails if any of
   them gains an `obsidian` value import.
2. `nodeVaultFs` round-trips the full init flow in a temp directory: a unit test runs
   `executeSetup` against it and asserts the same file tree the plugin produces today
   (KNOWLEDGE.md, SCHEMA.md, INDEX.base, dirs, skills, rules, platform config,
   `.knowlery/bin/query.mjs`, manifest, lock).
3. Zero behavior change: `npm test` (all existing assertions unmodified),
   `npm run lint`, `npm run build`, `npm run eval -- --assert-baseline` all green;
   `main.js` builds and the plugin loads (maintainer smoke test).
4. No new features, no CLI entry, no packaging changes in this PR.

## 7. Maintainer self-test checklist (acceptance round)

1. `npm install && npm test && npm run eval -- --assert-baseline` — green, no test
   assertions changed (check the diff: `tests/` changes are constructor swaps only).
2. Build the branch, install the dev build in your real vault, reload — confirm
   normal operation: dashboard, Knowledge health, `knowlery:query`, a `/ask` round,
   and (on a scratch vault) a fresh setup-wizard run.
3. Reload twice — confirm no unexpected writes (mtime churn guard still holds).
4. Skim `src/platform/` — the two `VaultFs` implementations should be the only places
   that know about their platform.

## 8. Out of scope, deferred

- F2 CLI skeleton (`init`/`sync`/`health`), npm packaging — next spec.
- Bundle-export inversion — 0.8.
