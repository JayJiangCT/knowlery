# F3 — Mechanical Staleness Dirty-Flags

- **Status:** Accepted 2026-07-03 — implemented, awaiting maintainer acceptance testing (§7)
- **Target release:** 0.6.0
- **Branch:** `cursor/f3-staleness-dirty-flags-92eb` (stacked on F5)
- **Depends on:** F2 (scanner/snapshot data structures), F5 (dual-transport pattern)

## 1. Problem statement

Two staleness problems are currently handled by the wrong layer:

1. **`/cook` incremental scope** relies on a single timestamp in `log.md`, maintained by
   prompt. One failed or interrupted cook loses the marker; a coarse global timestamp
   cannot say *which* compiled pages are affected by *which* changed notes; and the
   whole mechanism depends on an LLM remembering to append a log entry.
2. **Compiled-page freshness** has no mechanical tier at all. The freshness workflow
   described in the docs is LLM-driven and approval-gated — appropriate for *semantic*
   staleness (a claim got superseded), wasteful for the dominant, purely mechanical
   case: *a source note changed after the page that cites it was last written.*

Both reduce to the same deterministic computation over data the vault already has:
every agent page lists its `sources`; files have mtimes. No model needed.

Codebase note: the dashboard currently has no knowledge-health surface (the Freshness
Review described in the docs is not present in `src/`), so F3 creates one.

## 2. Goals

1. A **pure staleness computation**: which agent pages have a cited source that changed
   after the page was last written (*stale*), and which user notes are cited by no
   agent page at all (*uncooked* — new material).
2. The same **dual transports** as retrieval: `obsidian knowlery:stale` (in-app, sync)
   and `node .knowlery/bin/query.mjs --stale` (headless), with structurally shared
   output.
3. A **Knowledge health section** on the dashboard home showing both counts with a
   capped detail list.
4. `/cook` incremental mode consumes the stale/uncooked report; **`log.md` is demoted
   to an append-only history log** and no longer drives scope.

## 3. Non-goals

- No semantic staleness (superseded claims, contradicted facts) — that remains the
  LLM-driven freshness workflow's job, wherever it lives; F3 is the mechanical tier
  beneath it and has no code coupling to it.
- No automatic re-cooking: F3 detects and reports; acting stays with the agent and user.
- No new on-disk state. Staleness is computed from mtimes and frontmatter on demand —
  there is nothing to persist and therefore nothing to go stale.
- No changes to retrieval ranking (a stale page still retrieves normally; retrieval
  consumers can see `evidence via source` regardless).

## 4. Design

### 4.1 Data: mtimes on scanned pages

`ScannedPage` gains `mtimeMs: number` and both builders populate it: the fs scanner
from `statSync` (already called for directory walking), the live snapshot from
`TFile.stat.mtime`. `buildPageFromContent` gains an `mtimeMs` argument so the shared
constructor stays the single path (F5's parity property is preserved).

### 4.2 Pure computation (`src/core/query/staleness.ts`)

```ts
computeStaleness(snapshot: VaultSnapshot): StalenessReport
```

- **Stale page:** an `agent`-tier page where any entry of `sources`, resolved to a page
  in the snapshot (exact vault-relative path; `\` normalized), has
  `source.mtimeMs > page.mtimeMs`. Each finding records the page, the changed sources,
  and both timestamps.
- **Uncooked note:** a `user`-tier page outside `Library/` whose path appears in no
  agent page's `sources`. Sorted by mtime descending. The list is a *candidate* feed —
  plenty of notes are legitimately never cooked; judgment stays with the agent/user.
- Source entries that resolve to nothing (deleted or renamed notes) are reported
  separately as `danglingSources` — they are a data-quality signal for `/audit`, not
  silently dropped.
- Pure module: no `obsidian` imports, no I/O (added to the engine-purity unit test).

### 4.3 Transports (F5 pattern)

- **In-app:** `obsidian knowlery:stale [json]` registered next to `knowlery:query`
  (same feature detection and try/catch). The handler is synchronous over
  `LiveQuerySnapshot` — mtimes ride along in the snapshot, so the microtask constraint
  is satisfied with no extra machinery. Warming message before the snapshot is ready.
- **Headless:** `node .knowlery/bin/query.mjs --stale [--json]` runs the same
  computation over the fs scan.
- Shared renderer `formatStalenessReport` in `src/core/query/format.ts`; identical
  output across transports is asserted by a unit test, as in F5. Text format:

```
Stale pages (2):
1. concepts/response-time-metrics.md — sources changed after last compile:
   Daily/2026-04-05.md (source 2026-07-01 14:02 > page 2026-06-28 09:11)
Uncooked notes (most recent first, 3 of 17):
1. Projects/new-idea.md (2026-07-02)
...
Dangling sources (1):
- concepts/backpressure.md cites missing note: Daily/2026-03-30.md
```

### 4.4 Dashboard: Knowledge health section

A new section on the dashboard home (between "This note" and "Recent activity"),
following the existing section pattern:

- One summary line: "N pages have changed sources · M notes never compiled".
- Capped list (top 3 stale pages with their changed sources; "View all" drill-in
  listing the full report, consistent with the existing drill-in screens).
- A "Copy re-cook prompt" action on the section that produces a `/cook` prompt scoped
  to the stale pages, using the existing request-actions helper.
- Computed on render from the live snapshot (already memory-resident); refreshes with
  the dashboard's existing auto-refresh.

### 4.5 `/cook` skill update

Incremental mode (default, no arguments) becomes:

1. Run the staleness report (transport preference as in `/ask`:
   `obsidian knowlery:stale`, else `node .knowlery/bin/query.mjs --stale`).
2. Scope = stale pages' changed sources (re-read, fold changes into those pages) plus
   recent uncooked notes the user plausibly wants compiled (agent judgment, ask when
   unsure).
3. `log.md` keeps receiving one append per cook cycle as human-readable history, but is
   **no longer read to determine scope** — the "last cook timestamp" instruction is
   removed.
4. Fallback if neither transport is available: previous timestamp behavior, stated as
   degraded mode.

Full/targeted/URL modes are unchanged. Delivered via builtin-skill auto-sync.

## 5. Risks

- **R1 — mtime false positives.** Sync tools, `git checkout`, or bulk operations
  rewrite mtimes and can mark pages stale en masse. Cost is bounded: the flag is a
  re-read hint for `/cook`, not an automatic action. Documented in the skill ("a large
  stale list after a sync is expected; cook selectively").
- **R2 — false negatives from manual page edits.** Touching an agent page after its
  source changed marks it fresh even if the change was cosmetic. Accepted: mtime
  ordering is the definition of the mechanical tier; semantic verification belongs to
  the LLM tier.
- **R3 — `sources` hygiene.** Pages citing notes by wikilink or basename instead of
  vault-relative path resolve to nothing and land in `danglingSources`. That is
  deliberate visibility — SCHEMA.md already specifies relative paths; F3 surfaces
  violations instead of guessing.

## 6. Acceptance criteria

1. `src/core/query/staleness.ts` has no `obsidian` imports (covered by the purity
   test) and full unit coverage: stale detection, tie handling (equal mtimes are not
   stale), uncooked filtering (Library/ excluded, cited notes excluded), dangling
   sources, deterministic ordering.
2. Both transports emit identical reports for the same vault state (unit-asserted via
   the shared renderer, as in F5).
3. Manual flow works end-to-end: editing a source note cited by a compiled page makes
   the page appear in `knowlery:stale` and in `--stale`; rewriting the page clears it.
4. Dashboard home shows the Knowledge health section with both counts, the capped
   list, drill-in, and the copy-prompt action.
5. `/cook` incremental mode reads scope from the staleness report; the `log.md`
   timestamp instruction is gone; log append as history remains.
6. `npm test`, `npm run lint`, `npm run build`, `npm run eval -- --assert-baseline`
   all green; `baseline.json`, F2 thresholds, and retrieval behavior untouched.

## 7. Maintainer self-test checklist (acceptance round)

1. Build the branch, install the dev build in your real vault, reload Obsidian.
2. Edit any source note cited by a compiled page (e.g. touch a daily note listed in a
   page's `sources`). Run `obsidian knowlery:stale` — the page appears with that
   source; `node .knowlery/bin/query.mjs --stale` prints the same report.
3. Open the dashboard — Knowledge health shows the same finding; drill in; use "Copy
   re-cook prompt" and run it through your agent.
4. After the agent recompiles the page, re-run `knowlery:stale` — the finding is gone.
5. Create a brand-new note — it appears under uncooked notes.
6. Run `/cook` with no arguments from your agent client — confirm it starts from the
   staleness report, not from `log.md`.
7. `npm test && npm run eval -- --assert-baseline` — green.

## 8. Out of scope, deferred

- F4 (fixed-context slim-down) — next after F3.
- Semantic freshness workflows — unchanged by F3.
- `/audit` consuming `danglingSources` — natural follow-up, 0.7 backlog with the other
  audit items.
