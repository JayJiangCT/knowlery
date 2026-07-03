# F5 — CLI Dual Transport: `obsidian knowlery:query`

- **Status:** Draft — awaiting maintainer spec acceptance
- **Target release:** 0.6.0 (promoted from the post-0.6.0 backlog at the maintainer's request)
- **Branch:** `cursor/f5-cli-dual-transport-92eb` (stacked on F2)
- **Depends on:** F2 (retrieval engine); independent of F3/F4
- **Execution order note:** runs before F3/F4 because it stacks directly on F2's engine.

## 1. Problem statement

F2 shipped deterministic retrieval as a headless script (`.knowlery/bin/query.mjs`). Most
Knowlery users run with Obsidian open and the Obsidian CLI enabled — for them, a
first-class `obsidian knowlery:query` command is strictly better on three axes:

1. **No Node dependency for the agent** — the `obsidian` binary is enough.
2. **Obsidian's own metadata** — the in-app snapshot is fed by `metadataCache`
   (frontmatter, aliases, tags as Obsidian resolves them), not a re-parse.
3. **Discoverability** — the command appears in `obsidian help` next to everything else
   the agent already uses.

Obsidian 1.12.2+ exposes exactly the needed API:
`Plugin.registerCliHandler(command, description, flags, handler)` with typed
`CliFlags`/`CliData`/`CliHandler` (verified present in the pinned `obsidian@1.12.3`
typings).

## 2. The constraint that shapes the design

The CLI host captures a handler's return value **only within the current microtask
queue**: once a handler awaits real I/O (file reads, timers), the CLI receives empty
output (confirmed by multiple plugin authors on the Obsidian forum, reproduced with
20ms delays). Reading note bodies through `vault.cachedRead` is asynchronous, so the
handler **cannot scan the vault at query time**.

Therefore: the plugin maintains an **in-memory snapshot** of the vault (the engine's
`ScannedPage[]` plus bundle entries), built once in the background after layout-ready
and updated incrementally from vault events. The handler runs the F2 engine
**synchronously** over that snapshot and returns a string.

This is not the on-disk index projection that F2's spec rejected: the snapshot lives
only in process memory, exists only while Obsidian runs, and is invalidated by
Obsidian's own event stream (which also fires for externally edited files). It cannot
go stale while Obsidian is closed, because it does not exist then — the headless cases
stay on `query.mjs`, which live-scans.

## 3. Goals

1. `obsidian knowlery:query question="..."` returns the same ranked, same-format output
   as `node .knowlery/bin/query.mjs "..."` — one engine, two transports.
2. Query-time work is fully synchronous over the in-memory snapshot (microtask-safe).
3. `/ask` and the `KNOWLEDGE.md` template teach the transport preference order:
   in-app CLI first, headless script second, degraded waterfall last.
4. Graceful behavior everywhere the API is missing or the snapshot is not ready.

## 4. Non-goals

- No removal or demotion of `query.mjs` — it remains the only headless path and the
  reference implementation the eval harness measures.
- No `minAppVersion` bump: on Obsidian < 1.12.2 the plugin simply does not register the
  CLI command (feature-detected), everything else works as today.
- No persistence of the snapshot to disk, ever.
- No other Knowlery CLI commands in this feature (e.g. a staleness command belongs to
  F3's spec if F3 wants it).

## 5. Design

### 5.1 Shared output formatting

Extract the text renderer from `src/query-cli/main.ts` into
`src/core/query/format.ts` (`formatQueryResult(result, { json })`). Both transports
call it, so output parity is structural rather than maintained by hand. The CLI bundle
keeps working since it imports from the same engine directory.

### 5.2 In-memory snapshot (`src/core/query/live-snapshot.ts`)

A plugin-side class owning a `VaultSnapshot` equivalent:

- **Build:** at `onLayoutReady`, read all markdown files via `vault.cachedRead` plus
  frontmatter from `metadataCache`, mapping to the engine's `ScannedPage` shape with the
  same field-group construction (`fieldText`) the fs scanner uses. Bundle entries load
  from `.knowlery/bundles.json` + `agent-index.json` via the adapter. Build is async
  and off the query path.
- **Update:** subscribe to `vault.on('create' | 'modify' | 'delete' | 'rename')` and
  `metadataCache.on('changed')`; re-read only the affected file (async, debounced per
  path). Bundle registry changes re-read the bundle entries.
- **State:** `ready: boolean`. Memory cost is the markdown corpus (a few MB at
  personal-vault scale), accepted and documented.
- Instruction files (`KNOWLEDGE.md`, `SCHEMA.md`) and non-vault dirs are excluded with
  the same rules as the fs scanner.

### 5.3 Handler registration (`src/core/query/cli-handler.ts` + `main.ts` wiring)

```ts
this.registerCliHandler('knowlery:query', 'Deterministic knowledge retrieval', {
  question: { value: '<text>', description: 'The question to answer', required: true },
  k: { value: '<n>', description: 'Max results (default 12)' },
  json: { description: 'Structured JSON output' },
}, handler);
```

- Registration is feature-detected (`typeof this.registerCliHandler === 'function'`)
  and wrapped so a registration failure never breaks plugin load.
- The handler is **synchronous**: parse `CliData`, run `runQuery` over the snapshot,
  return `formatQueryResult(...)`.
- Snapshot not ready yet → return
  `Snapshot warming up — retry in a moment, or run: node .knowlery/bin/query.mjs "<question>"`.
- Missing `question` → usage string (the CLI also enforces `required`).

### 5.4 Skill and template updates

- `/ask` Step 2 becomes a two-step preference:
  1. `obsidian knowlery:query question="<question>"` (Obsidian running — the normal case);
  2. `node .knowlery/bin/query.mjs "<question>"` (Obsidian closed or command missing);
  3. existing degraded waterfall only if both are unavailable.
  Output interpretation guidance is shared — the formats are identical.
- `KNOWLEDGE.md` template's Knowledge Retrieval section gets the same ordering.
- Delivered to existing vaults through the builtin-skill auto-sync, as in F2.

### 5.5 Testing

- Unit tests with the existing obsidian mock: snapshot builder maps a mock file +
  metadata into a `ScannedPage` equivalent to the fs scanner's output for the same
  content (parity at the data-structure level); incremental update on modify/delete;
  handler returns a string synchronously (no pending promise), warming message before
  ready, identical formatting between transports for a fixed snapshot.
- The eval harness is unchanged: it measures the shared engine; F2 thresholds and the
  frozen baseline must still pass untouched.

## 6. Risks

- **R1 — Event-stream gaps.** If Obsidian misses an external edit event, the snapshot
  serves slightly stale content until the next event or reload. Bounded by Obsidian's
  own file watcher; documented; headless script is always available as ground truth.
- **R2 — API evolution.** `registerCliHandler` is new (1.12.2). Feature detection plus
  the try/catch wrapper keeps older/changed hosts safe.
- **R3 — Memory growth on very large vaults.** Bodies in memory scale with corpus size.
  Personal-vault scale is a few MB; if a pathological vault matters later, body storage
  can move to lazy per-page reads with a synchronous LRU — out of scope now.
- **R4 — Handler regressions to async.** A future edit could accidentally introduce an
  await into the handler path and silently break CLI output. Mitigated by the
  synchronous-return unit test in §5.5.

## 7. Acceptance criteria

1. In a real vault with Obsidian 1.12.7+ and CLI enabled: `obsidian knowlery:query
   question="<q>"` prints the same-format ranked list as `node .knowlery/bin/query.mjs
   "<q>"`, and `obsidian help` lists the command with its flags.
2. The handler path contains no awaits; the synchronous-return unit test passes.
3. Before the snapshot finishes building, the command returns the warming message
   (never empty output).
4. Editing a note and re-running the command reflects the edit (incremental update).
5. On an Obsidian build without `registerCliHandler`, the plugin loads cleanly and all
   F2 behavior is unchanged.
6. `/ask` and the `KNOWLEDGE.md` template teach the three-level transport preference.
7. `npm test`, `npm run lint`, `npm run build`, and `npm run eval -- --assert-baseline`
   all green; `baseline.json` and F2 thresholds untouched.

## 8. Maintainer self-test checklist (acceptance round)

1. Build the branch, install the dev build in your real vault, reload Obsidian.
2. `obsidian help` — confirm `knowlery:query` appears with flags.
3. Run the same 5 questions from your F2 acceptance round through
   `obsidian knowlery:query question="..."` and compare with `query.mjs` output —
   expect identical rankings.
4. Immediately after reloading Obsidian, fire the command once — you may catch the
   warming message; confirm it never returns empty.
5. Edit a note title, re-run a query that should now match it — confirm the snapshot
   picked it up.
6. Run `/ask` from your agent client with Obsidian open — confirm it uses
   `knowlery:query` (one call), not the script.
7. `npm test && npm run eval -- --assert-baseline` — green.

## 9. Out of scope, deferred

- F3 (staleness dirty-flags) and F4 (fixed-context slimming) — unchanged, follow F5.
- F6 (0.7 candidate) — retrieval-aware `/cook`: record colloquial synonyms, abbreviations,
  and cross-language titles into `aliases` frontmatter; closes the remaining alias
  (q-016) and bilingual (q-020) eval gaps from the write side.
- `/audit` simplification using `obsidian orphans` / `unresolved` / `deadends` (0.7
  candidate).
