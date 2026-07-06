# F1 (0.8.0) — Headless Bundle Export: `knowlery bundle export` / `review`

- **Status:** Draft — awaiting maintainer spec acceptance
- **Target release:** 0.8.0
- **Branch:** `cursor/08-f1-headless-export-92eb` (off `main` @ 0.7.0)
- **Depends on:** 0.7 F1 (VaultFs), F2 (CLI shell), F4 (bundle receiving side)

## 1. Problem statement

OKF's receiving side went headless in 0.7.0; the producing side still requires the
Obsidian modal. The blocker was never the compiler — it was the **review gate**:
"nothing ships unreviewed" (0.5.0's core safety property) was implemented as modal UI.

The design insight that unlocks a headless form: the review state already *is* a file.
The plugin persists per-topic scope in `ExportScopeFile`
(`.knowlery/export-scope.json`): seeds, hop depth, and **per-item review statuses with
content hashes** that auto-invalidate approvals when content changes. The modal is one
editor of that file. F1 gives it a second editor — the CLI — and the review state
becomes shared between shells: start reviewing in Obsidian, compile from a terminal,
or the reverse.

## 2. Goals

```
knowlery bundle export <seed-concept-id> [--dir <vault>] [--hops <n>] [--zip]
knowlery bundle review <seed-concept-id> [--dir <vault>] [--list] [--json]
                       [--approve <item-id>...] [--flag <item-id>...]
```

1. **`export`** builds/refreshes the scope closure exactly as the modal does (same
   collect + hash-invalidation + risk-scan core):
   - if any in-scope item is **unreviewed**, it prints the review checklist — each
     item with id, kind, title, risk-scan hints, and status markers for `new`/`changed`
     items — and **exits 1** with instructions. Nothing compiles.
   - if fully reviewed, it compiles **approved** items (flagged items excluded, modal
     semantics) into `.knowlery/exports/<bundle-id>/`, optionally zips, and prints the
     manifest summary + conformance outcome.
2. **`review`** edits statuses from the terminal: `--approve`/`--flag` record the
   status *and the content hash at review* (so later edits re-invalidate, as today);
   `--list` shows the current checklist. Direct edits via the Obsidian modal remain
   equivalent — same file.
3. The compiled bundle is **byte-identical** to what the modal produces for the same
   approvals (shared compile core), and installs cleanly via `bundle install`.

## 3. Non-goals

- **No weakening of the gate.** Per-item explicit statuses, hash invalidation on
  content change, risk hints surfaced at review time — all preserved. The CLI does not
  add an "approve all" convenience flag; approving remains a deliberate, enumerated
  act. (Docs will instruct agents to present the checklist to the user and apply only
  statuses the user states — the same trust model as the modal.)
- No interactive TUI — the file + subcommands are the interface.
- No remote publishing of exported bundles.
- No changes to the Obsidian export modal beyond what the inversion requires
  (call-site plumbing only).

## 4. Design

### 4.1 Inverting the export-side core (the main engineering)

`collect.ts`, `export-scope.ts`, and `compile.ts` move from `App` to `VaultFs` plus a
new **`LinkResolver`** abstraction for the one thing `VaultFs` cannot give: wikilink
target resolution.

```ts
interface LinkResolver {
  resolve(linkTarget: string, fromPath: string): string | null; // vault-relative path
  backlinksOf(path: string): string[];
}
```

- **Obsidian implementation**: wraps `metadataCache.getFirstLinkpathDest` /
  `resolvedLinks` — current behavior, byte-preserved.
- **Headless implementation**: built from one scan pass — parse wikilinks from every
  page (`okf/wikilink.ts` is already pure), resolve by exact path, then by unique
  basename (Obsidian's shortest-path convention; ambiguous basenames resolve to null,
  matching a cache miss). Backlinks are the inverted map.
- `collect`'s activity-ledger read (recency hints for the modal UI) becomes an
  optional input; the CLI path skips it.
- Purity guard extends over the inverted export modules; `risk-scan.ts` and
  `wikilink.ts` are already pure.

### 4.2 CLI flow (the review-gate file protocol)

```
$ knowlery bundle export drone-delivery --dir ~/kb
Scope for "drone-delivery" (7 items, 2 unreviewed):
  [approved]   concept  drone-delivery — Drone Delivery
  [unreviewed] concept  flight-safety — Flight Safety            <- new
  [unreviewed] raw      Daily/2026-06-30.md                      !! risk: contains email address
  ...
Review before export:
  knowlery bundle review drone-delivery --approve flight-safety --flag Daily/2026-06-30.md
(or review in Obsidian: Share knowledge bundle — same saved scope)
→ exit 1
```

- Item ids in `--approve`/`--flag` are the scope item ids (concept ids / raw paths),
  validated with clear errors for unknown ids.
- Approving an item whose content changed since the checklist was printed is safe by
  construction: the recorded hash is read at approval time from the current content,
  and any *later* change re-invalidates.
- `export` with zero unreviewed items compiles and prints:
  manifest id/title/version/concept count, conformance result, output dir, zip path.
- Bundle id/version/creator metadata: reuse the plugin's derivation
  (`sanitizeBundleId(creatorName, kbName)`) with `--bundle-version` defaulting as the
  modal does; details finalized against the modal's exact current defaults during
  implementation, never diverging from them.

### 4.3 The `knowlery-cli` skill (added at spec review)

A new bundled tooling skill, symmetric to `obsidian-cli`, closing the gap that agents
had no systematic reference for the Knowlery CLI (only `query`/`stale` appeared in the
retrieval ladders; `bundle`, `health`, `sync` were untaught):

- Full command surface with syntax and when-to-use guidance: `init`, `sync`, `health`
  (as a post-bulk-change verification step), `query`/`stale` (pointing back to the
  retrieval ladder), `bundle install|list|uninstall`, and the new `export`/`review`.
- **Export review conduct** (the trust model, stated where agents will read it): the
  agent presents the checklist and risk hints to the user, applies only statuses the
  user explicitly states, and never approves items on its own initiative — the exact
  headless equivalent of the modal's per-item human review.
- Ships as a builtin (`kind: 'tooling'`), so both shells deliver it through the normal
  install/auto-sync; `BUILTIN_SKILL_NAMES` and health's skill check pick it up
  automatically.

### 4.4 Safety properties, restated as tests

1. Unreviewed item in scope → `export` exits 1, writes nothing under
   `.knowlery/exports/`.
2. Flagged items never appear in the compiled bundle.
3. Editing an approved page's content → next `export` shows it `changed`/unreviewed
   again (hash invalidation) and refuses to compile.
4. Risk hints (emails, sensitive URLs, person pages, meeting-like notes) appear in the
   checklist output for affected items.
5. Cross-shell: a scope reviewed via the modal file format compiles identically via
   the CLI (fixture-driven), and vice versa.

## 5. Acceptance criteria

1. Inversion lands with zero behavior change for the plugin modal (existing okf tests
   pass with assertions unmodified; the modal's compile path produces byte-identical
   bundles).
2. The §4.3 safety tests all pass.
3. End-to-end round trip in tests: seed → checklist → `review --approve` each item →
   `export --zip` → `bundle install` the zip into a second workspace → `knowlery
   query` retrieves bundle knowledge.
4. Headless `LinkResolver` parity: on the eval fixture vault, closure computed
   headlessly equals the closure computed with a mock metadata cache (same pages, same
   edges).
5. Purity guard covers the inverted export modules; smoke test extends with the
   export → install loop on the built artifact.
6. The `knowlery-cli` skill ships as builtin #14: installed by init in both shells,
   covers every CLI command, and contains the export-review conduct rules
   (content-asserted, like the 0.7 F5 skill tests).
7. `npm test`, lint, build, eval baseline + thresholds green.

## 6. Maintainer self-test checklist (acceptance round)

1. In your real vault (Obsidian closed): `knowlery bundle export <a real topic>` —
   review the checklist, approve items via `bundle review`, export with `--zip`.
2. Install that zip into a scratch workspace via `knowlery bundle install`; query it.
3. Open Obsidian → Share knowledge bundle for the same topic — the modal shows the
   statuses you set from the CLI (shared scope file).
4. Edit one approved page, re-run `export` — it must refuse and show the item as
   changed.
5. `npm test && npm run eval -- --assert-baseline` — green.
