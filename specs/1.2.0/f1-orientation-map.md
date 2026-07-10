# F1 (1.2.0) — The Orientation Map: Index.md as a View

- **Status:** Draft — awaiting maintainer spec acceptance
- **Target release:** 1.2.0
- **Branch:** `cursor/12-f1-orientation-map-92eb`
- **Depends on:** 1.2 plan principles 1–4 (view-not-file, mutability rule,
  three renderings, additive contract — binding), 1.0 stability contract

## 1. Problem statement

Karpathy's LLM-wiki pattern leans on an Index.md — a navigation map an LLM
reads to orient itself before diving. Knowlery's rendering of that job,
`INDEX.base`, serves Obsidian only: the engine doesn't read it, MCP doesn't
expose it, the CLI can't render it. On the agent path the job is simply
vacant — `resources/list` offers one entry point per KB (`KNOWLEDGE.md`), so
an agent that wants to *browse* rather than *search* ("what do you know?",
"give me the lay of the land") has nowhere to go. Query answers questions;
nothing answers "what is here."

The file-form Index.md died of staleness everywhere it was tried — it is a
cache with a manual invalidation protocol. We have the tool to not repeat
that: compute the map at read time, persist nothing.

## 2. Goals

One map, two new renderings (the third, `INDEX.base`, already exists):

```
knowlery index --kb work [--json]        # CLI rendering
knowlery://work/index                    # MCP resource rendering (virtual)
```

Both call one pure core function over a fresh `scanVault` snapshot.

## 3. Non-goals

- **No persistence, ever**: nothing writes `index.md`, updates `INDEX.base`,
  or caches the map. The map is a function of the vault at read time.
- No retrieval-behavior changes: the engine neither reads nor ranks by the
  map.
- No pagination/filter options in v1 (`--type`, `--domain` are future minors
  if real vaults prove the need); no content excerpts beyond the one-line
  description.
- No change to bundle `index.md` (the file-index form is *correct* there —
  frozen content, index shipped and swapped atomically with it).
- No `INDEX.base` changes (frozen surface).

## 4. Design

### 4.1 The map, as data

`buildOrientationMap(snapshot, bundles)` in `src/core/query/orientation.ts`
(pure — snapshot in, map out):

```ts
interface OrientationMap {
  kbName?: string;            // from KNOWLEDGE.md's title when present
  generatedAt: string;        // honesty stamp: this is a view, dated
  compiled: Array<{           // one group per type present, in canonical order
    type: 'entity' | 'concept' | 'comparison' | 'query';
    pages: Array<{ path: string; title: string; description?: string; domain?: string; updated?: string }>;
  }>;
  bundles: Array<{ id: string; title: string; version: string; entrypoint: string }>;
  counts: { compiled: number; bundles: number; uncooked: number };
}
```

- Compiled pages only (agent tier) — the map shows the curated surface, the
  same boundary as MCP resource reads. `uncooked` appears as a *count* (an
  honest "there is more, not yet compiled" signal), never as a listing —
  free-form notes stay yours.
- Groups sorted canonically (entities, concepts, comparisons, queries);
  pages sorted by path within a group. `domain` and `updated` come from
  frontmatter when present.
- Bundle entries come from `bundles.json`; deeper navigation is delegated to
  each bundle's own `index.md` (the mutability rule, applied).

### 4.2 CLI rendering

`knowlery index [--dir <path> | --kb <name>] [--json]`:

- Human form: a compact tree — group headers with counts, one line per page
  (`path — title · description`), a bundles section, and a closing line
  naming the uncooked count with the `knowlery stale` pointer.
- `--json`: the `OrientationMap` shape verbatim (a new frozen `--json`
  surface; keys land in the contract).
- Read-only, no init gate beyond scan viability (the `stale` precedent);
  exit 0 even for an empty KB — an empty map is a finding.

### 4.3 MCP rendering

- `resources/list` gains **one more concrete entry per registered KB**:
  `knowlery://<kb>/index` ("Orientation map — what this KB contains"),
  alongside the existing `KNOWLEDGE.md` entry. Listing stays bounded: two
  entries per KB.
- Reading it returns the map as markdown (a rendered document, easier for
  agents to consume as a resource than raw JSON), generated live per read.
  `index` joins the resource router *before* the allowlisted file-read path;
  a real file named `index.md` at the vault root remains reachable — the
  virtual name wins only for the exact path `index` (no `.md`), which cannot
  collide with a markdown file.
- The `knowlery-mcp` skill's tool-selection map gains one row: "get the lay
  of the land → read the `index` resource — browse first, query second."

### 4.4 Contract impact

Additive: one new CLI command with a frozen `--json` shape; one new concrete
resource per KB. The MCP golden regenerates once (resources listing is not
part of the golden — only tools/prompts/templates — so likely no golden
change; the count assertions in resource tests update, sanctioned here).

## 5. Safety properties, restated as tests

1. **Purity**: `buildOrientationMap` is pure (snapshot in, map out);
   `core/query/orientation.ts` joins the purity guard.
2. **View semantics**: calling the CLI/resource twice with a page added
   between calls reflects the addition with **no state written anywhere**
   (workspace file set identical before/after both reads).
3. **The boundary**: user-tier notes appear only in the `uncooked` count —
   never listed; a fixture with `Daily/` and `Projects/` notes proves it.
4. **Bundles section**: installed fixture bundle appears with id/version/
   entrypoint; an empty registry yields an empty section, not an error.
5. **Cross-rendering parity**: the CLI `--json` and the MCP resource render
   from the same map for the same fixture (structural equality of the
   underlying data).
6. **Resource routing**: `knowlery://<kb>/index` serves the map; a real
   root-level `index.md` file still serves its file content; two entries per
   KB in `resources/list`.
7. **Contract**: the new `--json` keys pinned in the CLI contract suite;
   resource-count assertions updated (sanctioned).
8. **Smoke**: the built artifact prints the map for the fixture workspace
   and serves the resource over stdio.

## 6. Acceptance criteria

1. §5 green; `npm test`, lint, build, `docs:build`, eval green.
2. Docs: the map documented in agents-mcp (resources section) +
   cli-workflows (both locales); the knowlery-mcp skill row added.
3. Maintainer §7 passes.

## 7. Maintainer self-test checklist (acceptance round)

1. `knowlery index --kb <real-kb>` on your actual vault — the map reads as
   a genuine orientation (groups, descriptions, bundle section, uncooked
   count).
2. In an MCP client: "give me the lay of the land in <kb>" — the agent
   reads the `index` resource and summarizes from it (browse, not search).
3. Add a note, re-ask — the new state is reflected, and nothing was written
   to the vault.
4. Confirm `Daily/`-style notes are absent from the listing and present in
   the uncooked count.
5. `npm test && npm run eval -- --assert-baseline` — green.
