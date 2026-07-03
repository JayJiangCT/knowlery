# 08 · Knowlery 0.5.0 Spec — OKF Bundle Export

**Status:** Spec rev 2 · 2026-07-01. Rev 1 (2026-06-29) was the initial draft;
rev 2 incorporates an external agent review and a product-form review — every
adopted change is itemized in §0. Implementers: §0 wins over any residual
rev 1 phrasing.
**Scope decision:** Export-only (Phase 0.5). Runs inside the Obsidian plugin.
No install/compose (install is sketched for 0.6 in §15, and one invariant is
pre-seeded for it in §5.1), no CLI, no MCP. Commercial before/after validation
is arranged separately and is **not** a release gate for 0.5.0.
**Goals (locked, rev 2):** (1) Knowlery emits OKF-conformant bundles; (2) users
can share a personal knowledge base in a controlled, reviewed way. Defaults are
**share-safe everywhere**; personal/portable use is served by explicit opt-in
switches (§5.2, §5.5), not by a separate "profile" mechanism (D7).
**Conformance target:** [OKF v0.1](okf-spec-v0.1.md)
**Supersedes for 0.5.0 planning:** the "generate index.md" wording in
[07-feasibility-review.md](07-feasibility-review.md) §9 Phase 0.5 — see §3 below.

---

## 0. Rev 2 decision log

Decisions adopted in rev 2, each with the section that now specifies it. When
a rev 1 phrasing elsewhere appears to conflict with one of these, this table
and the referenced section win.

| # | Decision | Where |
| --- | --- | --- |
| D1 | Type mapping extended (`person→Person`, `reference→Reference`); missing/unrecognized `type` falls back to **directory inference** before defaulting to `Concept`; frontmatter/directory mismatch is a warning. | §5.2 |
| D2 | `log.md` defaults to a minimal Initialization-only log; full activity projection is an explicit opt-in (`includeFullLog`). Rationale: every `ActivityRecord.source.visibility` is `'private-summary'` by schema. | §5.5 |
| D3 | `sources` frontmatter is **stripped by default** from emitted pages; `includeSources: true` keeps it verbatim. Closure traversal still reads `sources` internally either way. | §5.2, §13.3 |
| D4 | Raw-note inclusion mechanics resolved (was open decision §13.7 #8): approved raw notes are copied to `_sources/` with injected `type: Source` frontmatter; links to them resolve; they are listed separately in `agent-index.json` and the root index. | §5.9 |
| D5 | Index projection wording unified: "regenerate an equivalent index from page frontmatter" — never "evaluate `INDEX.base`". | §2, §5.4 |
| D6 | Warning-only **risk scanner** over closure items (emails, sensitive-domain URLs, person pages, meeting-like raw paths); risky items sort first in review; never auto-flags, never blocks. | §5.10, §13.5 |
| D7 | No personal/shareable "profile" mechanism. One product, share-safe defaults; the sensitive knobs are plain export options. | header, §2 |
| D8 | Named bundles are first-class: `.knowlery/export-scope.json` is keyed by bundle id from day one (0.5.0 UI manages a single bundle; the schema is multi-bundle). | §13.6 |
| D9 | Entry points move to content and dashboard: Dashboard "Bundles" card, command palette, file-menu "Share this topic…" seeding. Settings holds only export defaults. | §8.1 |
| D10 | Flow compressed from four wizard steps to **two phases**: a resumable scope workspace (list primary, graph as toggle view) and a confirm & export phase. | §8.2, §13.5, §14.1 |
| D11 | The review detail panel MUST render the item's content (page body / raw-note body). A "safe to share" judgment is impossible from a title and a word count. | §8.2, §13.5 |
| D12 | Bundle ships a human `README.md` (`type: Reference`); the result screen offers one-click `.zip` packaging. | §5.9, §8.2 |
| D13 | UI copy never says "OKF"; user-facing language is "knowledge bundle". The format name appears once, as a technical line in the result report. | §8.1 |
| D14 | Frontmatter mapping interprets the **canonical 0.4.x schema only**; unknown keys pass through unmapped; no alias/heuristic engine. The conformance report becomes a per-field **quality report** (incl. near-miss key detection); fixing is an agent/SCHEMA.md loop, not a compiler feature. | §5.2, §5.7 |
| D15 | The §5.1 exclusion invariant is **generalized**: collection and backlink scans exclude any subtree containing a `knowlery-bundle.json`. This makes 0.6 in-vault bundle installs structurally unable to pollute exports. | §5.1, §15 |
| D16 | The result report leads with **safety facts** (what was approved/excluded, sources stripped, log minimal); the conformance badge is secondary. | §8.2 |
| D17 | Default bundle id/title no longer derive from `<creator>.<kbName>` alone — that collided across unrelated exports from the same vault (e.g. two different topic-scoped exports would silently share one saved scope and one installed identity). A new pre-scope **bundle picker** phase lets the user resume an existing named bundle or start a new one; a seed-triggered entry point (e.g. "Share this topic…") derives the default id from the seed instead of the vault name. Found during 0.6-install-phase design review, fixed directly in 0.5.0's `export-bundle.tsx` since it is a real collision in the shipped code, not a future concern. | §8.2, §13.6 |

---

## 1. Goal

Add one new capability to Knowlery: **compile a Knowlery vault into a portable,
OKF-conformant knowledge bundle** that any agent client can read from a plain
folder, without Obsidian running.

The deliverable is a one-shot **export**, triggered from the plugin UI, that
writes a self-contained bundle directory next to (never into) the user's raw
notes. The bundle contains the maintained knowledge pages, a static navigable
index projected from `INDEX.base`, a machine-readable `agent-index.json`, an
update `log.md`, and a bundle manifest — all passing an OKF conformance check.

This is the smallest move that makes Knowlery's knowledge **leave Obsidian
intact**, and it is the prerequisite artifact for every later phase (install,
compose, adapters, MCP). None of those are in 0.5.0.

The value narrative, in order of how broadly it applies to existing users
(rev 2):

1. **Data freedom** — "my maintained knowledge can leave with me at any time
   as a plain, standard folder." Applies to every user, including those who
   never share. This is the local-first trust promise from 07 §2 made
   concrete.
2. **Controlled sharing** — a reviewed, desensitized slice of a personal KB
   handed to another person (§13). Episodic but high-value; no competing tool
   does this today.
3. **OKF conformance** — insurance and interop, not a user-facing selling
   point. It never appears as UI vocabulary (D13).

---

## 2. Scope

### In scope

1. **Bundle compiler** that reads the four knowledge directories
   (`entities/`, `concepts/`, `comparisons/`, `queries/`) and emits an OKF bundle.
2. **Frontmatter mapping** Knowlery → OKF (§5.2).
3. **Wikilink conversion** `[[…]]` → standard markdown links, in the compiled
   copy only (§5.3).
4. **Index projection**: regenerate an equivalent static index from page
   frontmatter (D5) — root `index.md`, per-directory `index.md`, and
   `agent-index.json` (§5.4).
5. **Log projection**: minimal `log.md` by default; opt-in full projection of
   `.knowlery/activity/*.jsonl` (§5.5, D2).
6. **Bundle manifest** with content hash (§5.6).
7. **OKF v0.1 conformance check** with a pass/fail report (§5.7).
8. **Export UI** + result report (§8).
9. **Pure, Obsidian-free compiler functions** with unit tests (§6, §9).
10. **Seed-driven export scope selection**: graph-closure dependency
    detection over `metadataCache.resolvedLinks` and a per-item
    unreviewed/approved/flagged review gate, so bundle membership is
    user-controlled rather than "everything in the four dirs" (§13).
11. **Share-safe defaults**: `sources` stripped, minimal log — both reversible
    via explicit export options (§5.2, §5.5; D3, D2).
12. **Approved raw-note inclusion** via `_sources/` (§5.9, D4).
13. **Warning-only risk scanner** feeding the review UI (§5.10, D6).
14. **Bundle `README.md` for human recipients + one-click `.zip`** (§5.9,
    §8.2; D12).

### Out of scope (explicit non-goals for 0.5.0)

- Installing or composing a second bundle (registry, provenance merge,
  conflict surfacing across bundles). → 0.6+, sketched in §15; 0.5.0 only
  pre-seeds the exclusion invariant that install depends on (§5.1, D15).
- A personal/shareable "profile" mechanism (rejected — D7). Share-safe
  defaults plus explicit per-export options cover both uses without a second
  abstraction whose defaults could silently drift.
- A frontmatter alias/field-mapping engine for non-canonical vaults (rejected
  — D14). Non-canonical pages degrade gracefully and are surfaced in the
  quality report (§5.7); normalization is an agent/SCHEMA.md workflow, never
  compiler smartness.
- A headless CLI or any Obsidian decoupling of *existing* modules
  (`vault-io`, `vault-health`, `skill-manager`, …). The compiler is authored as
  pure functions so it *can* be extracted later, but 0.5.0 does not extract it.
- MCP server, vector/hybrid search, file watcher/daemon.
- New platform adapters. Platform type stays `'claude-code' | 'opencode'`.
- Payment, licensing, marketplace.
- Modifying raw notes in any way. **Raw stays raw.**
- The commercial "agent is materially better" before/after test. Deferred by
  decision; tracked elsewhere, not blocking this release.

---

## 3. Relationship to the feasibility review (correction)

The review's Phase 0.5 (07 §9) lists "Generate `index.md`" and "Convert
`[[wikilinks]]`" as if Knowlery had no index. The current codebase is already
ahead of that:

- Knowlery **already ships `INDEX.base`** — an Obsidian Bases file, generated by
  `generateIndexBase` (`src/assets/templates.ts:162`). It is strictly richer than
  a static `index.md`: live `type_label`, `days_since_update`, `backlink_count`
  formulas and six grouped views.
- The frontmatter schema already carries the LLM-Wiki-v2-lite layer the review
  wanted "added lightweight": `sources` (provenance), `updated` + `/audit`
  staleness (freshness), `contradictions` (supersession/conflict).

So for an existing Knowlery vault, Phase 0.5 is **not** "create an index." It is
**"generate a portable static index + `agent-index.json`, from the same
frontmatter `INDEX.base` reads, that non-Obsidian agents can navigate."** That
index generation is the technical centerpiece of 0.5.0. The frontmatter the
review wanted is already present; the compiler's job is to *map and carry it*,
not invent it.

> **Precise about "projection":** 0.5.0 does **not** parse the `.base` YAML and
> evaluate arbitrary views (that is the "general Bases engine" §5.4 deliberately
> refuses). It regenerates an *equivalent* OKF index from the page frontmatter —
> the same fields `INDEX.base` groups on. Consequence/known limitation: if the
> user customizes `INDEX.base` (new view, changed grouping), the bundle index does
> **not** track that change. For 0.5.0 this is the right trade; revisit only if
> base-fidelity becomes a real requirement.

---

## 4. Compile model & data flow

```
RAW NOTES (Idea/, Tech News/, …)        ← never read, never written
                │
KNOWLEDGE PAGES (entities/ concepts/    ← read-only source
  comparisons/ queries/, + SCHEMA.md)
                │  (Obsidian-facing collector: vault + metadataCache)
                ▼
        PageRecord[]  +  ActivityRecord[]  +  linkResolver
                │  filtered to `approved` scope items only (§13) ◄── seed +
                │  graph-closure selection, run in the export modal before
                │  this point — NOT everything in the four dirs by default
                ▼  (PURE compiler — no Obsidian)
   ┌───────────────────────────────────────────────┐
   │  compiled OKF bundle (new directory)            │
   │  ├── index.md                (root, §6 OKF)     │
   │  ├── log.md                  (§7 OKF, minimal   │
   │  │                            by default §5.5)  │
   │  ├── README.md               (human intro §5.9) │
   │  ├── agent-index.json        (neutral index)    │
   │  ├── knowlery-bundle.json    (manifest, §5.6)   │
   │  ├── SCHEMA.md               (type: Reference)  │
   │  ├── entities/  index.md + <concept>.md …       │
   │  ├── concepts/  index.md + <concept>.md …       │
   │  ├── comparisons/ index.md + …                  │
   │  ├── queries/   index.md + …                    │
   │  └── _sources/  approved raw notes (§5.9)       │
   └───────────────────────────────────────────────┘
                │
        OKF conformance check → CompileResult report
```

The boundary in the middle is deliberate: everything below the collector takes
plain data and returns file contents (strings/objects). That keeps the compiler
unit-testable without Obsidian mocks and extractable in a later phase.

---

## 5. Component specifications

### 5.1 Page collection (Obsidian-facing layer)

`src/core/okf/collect.ts` — the *only* OKF module allowed to touch Obsidian.

For each markdown file under the four knowledge dirs (and `SCHEMA.md`), build a
`PageRecord`:

```ts
interface PageRecord {
  conceptId: string;      // path minus .md, bundle-relative (e.g. "entities/anthropic")
  sourcePath: string;     // vault path
  frontmatter: Record<string, unknown>;  // parsed via gray-matter
  body: string;           // markdown after frontmatter
  outlinks: WikiLink[];   // [[target]] / [[target|alias]] / [[target#heading]] found in body
  backlinks: string[];    // conceptIds linking here (from metadataCache)
}
```

- Wikilink targets are resolved with `metadataCache.getFirstLinkpathDest` (mirror
  of `vault-health.ts` behavior) to produce a **link resolution map**
  `Map<rawLink, conceptId | null>`. `null` = unresolved (kept, see §5.3).
- Backlinks come from `metadataCache` resolved links, filtered to the four dirs.
- `cachedRead` for body; never `modify`/`create` on source files.

The collector returns `{ pages: PageRecord[], activity: ActivityRecord[], linkMap }`.
`activity` is read via existing `readRecentActivityRecords` but with no day limit
(full history) for the log projection — add an optional `sinceDays?: number`
param to that function rather than duplicating it.

**Bundle-subtree exclusion invariant (must-have, generalized in rev 2 —
D15).** Page collection and the `metadataCache` backlink scan **MUST exclude**
(a) the export target directory, and (b) **any subtree containing a
`knowlery-bundle.json` manifest** — which covers prior exports wherever they
live *and* any bundle installed into the vault by a future version (§15). The
manifest file itself is the exclusion marker; there is no path-list
configuration. Otherwise a second export sees a previous export's copied
pages: their outlinks register as backlinks on the originals (inflating
`backlink_count` / `agent-index.json`), and the copies can match
`INDEX.base`'s `file.inFolder("entities")` filters and pollute the live index the
user tuned. The pure functions stay deterministic; this guards their *input* from
drifting. The default target lives under a dot-folder (`.knowlery/exports/`),
which Obsidian does not index — that is a *relied-upon* behavior, not an accident,
so it is recorded here; the explicit exclusion is required regardless because the
"Choose folder…" option (§8) can point at an indexed in-vault folder, and 0.6
installs will live in an indexed folder by design (§15).

### 5.2 Frontmatter mapping (Knowlery → OKF)

`src/core/okf/frontmatter-map.ts` (pure). OKF requires a non-empty `type`; all
else is optional and unknown keys MUST be preserved (OKF §4.1, §9).

| OKF field | Source (Knowlery) | Rule |
| --- | --- | --- |
| `type` *(required)* | `type` enum, else directory | Map to label: `entity→Entity`, `concept→Concept`, `comparison→Comparison`, `query→Query`, `person→Person`, `reference→Reference` (D1). `SCHEMA.md`→`Reference`. Missing/unrecognized `type` → **infer from the page's directory** (`entities/→Entity`, `concepts/→Concept`, `comparisons/→Comparison`, `queries/→Query` — mirroring `vault-health.ts`'s `dirToType`) + warning; only if both signals fail → `Concept` + warning. A recognized frontmatter `type` that contradicts the directory keeps the frontmatter mapping + a mismatch warning (§5.7). |
| `title` | `title`, else filename | carry through; derive from filename if absent. |
| `description` | `description` | carry if present. |
| `tags` | `tags` | carry as-is. |
| `timestamp` | `updated`, else `date`, else `created` | normalize to ISO 8601. Freshness anchor. All three fields verified present on 150/150 real pages, so the fallback rarely triggers — but keep the order for partial pages. |
| *(extension)* `knowlery_type` | original `type` | preserve lossless original enum. |
| *(extension)* `domain` | `domain` | preserve. |
| *(extension)* `status` | `status` | preserve. |
| *(extension)* `created` | `created` | preserve. |
| *(extension)* `sources` | `sources` | **Stripped by default (D3).** Verified on real pages: a single `sources` list mixes raw-note paths (leaking vault structure), external URLs (often private team tools), and conversation/meeting traces — provenance metadata a shared bundle must not carry implicitly. With `includeSources: true` (export option, default `false`) the list is preserved **verbatim as metadata only** — never rewritten or emitted as bundle links, so out-of-bundle and URL entries never become broken links. Either way the scope closure still reads `sources` internally for compiled→raw traversal (§13.3); stripping is output-side only. See §11 Q1 (resolved). |
| *(extension)* `contradictions` | `contradictions` | preserve; also surfaced in `agent-index.json` (§5.4) and the report. |
| `references` | `references` | converted with the wikilink rule (§5.3). |

Producers MAY add keys; consumers preserve them — so carrying Knowlery-specific
fields as extensions is OKF-legal and lossless.

**Canonical schema only (D14).** This mapping interprets the canonical 0.4.x
frontmatter schema (the fields in the table above) and nothing else. Vaults
predating 0.4.0 conventions, or pages not maintained by the agent, may use
arbitrary keys (`modified`, `desc`, `summary`, …): those keys **pass through
unmapped** (OKF-legal, lossless) but are never interpreted — no alias table,
no heuristics. The consequences are graceful, not fatal: the bundle stays
conformant (the mapper always emits a `type`, via the directory fallback
above), but affected pages lose index descriptions, freshness hints, and
grouping quality. The quality report (§5.7) makes every such gap visible and
countable, and the recommended fix is the agent-side normalization loop
(align pages with `SCHEMA.md`, e.g. via `/audit`), then re-export — never a
smarter compiler.

### 5.3 Wikilink conversion

`src/core/okf/wikilink.ts` (pure; takes the link map from §5.1).

- `[[Target]]` → `[Target](../path/to/target.md)` using **standard relative
  markdown links** (OKF §5.2 — not §5.1's bundle-root-absolute recommended
  form, deliberately: §5.1's leading `/` is interpreted relative to
  Obsidian's *vault* root once a bundle is installed under `Library/<id>/`
  per §15, not the bundle's own root, so absolute links silently
  misresolve — found during §15 manual acceptance testing. §5.1's stated
  advantage, stability under internal reorganization, doesn't apply here
  since the compiler always emits a fixed layout that is never manually
  reorganized.
- `[[Target|Alias]]` → `[Alias](../path/to/target.md)`.
- `[[Target#Heading]]` → `[Target](../path/to/target.md#heading)` (slugify heading).
- Embeds `![[…]]` of knowledge pages → standard links (not transclusion);
  embeds of attachments/images → leave as-is or relative copy is out of scope,
  flag in report.
- **Filenames with spaces / parentheses** are common in real vaults (verified:
  `Bruce Chen.md`, `Delivery Providers.md`, `Post-Purchase Experience (PPX).md`).
  Markdown link targets containing spaces or `()` MUST be URL-encoded (`%20`, etc.)
  or wrapped in `<…>` so the emitted link is valid; conceptIds in
  `agent-index.json` keep the raw (decoded) path.
- **Approved raw-note targets** resolve to `/_sources/<vault-relative-path>`
  (§5.9, D4). Only `approved` raw dependencies (§13.4) get this treatment;
  links to unapproved or flagged raw notes stay best-effort unresolved (next
  rule).
- **Unresolved targets** (not in the four dirs and not an approved raw note):
  OKF tolerates broken links (§5.3). Emit a best-effort relative link and record
  it in `CompileResult.unresolvedLinks`. Do not fail the compile.
- Applies to `body` and any `references` frontmatter list. **Source files are not
  touched** — conversion happens on the in-memory copy written to the bundle.

### 5.4 Index projection (the centerpiece)

`src/core/okf/index-project.ts` (pure). Reproduce the *semantics* of
`INDEX.base` — do **not** build a general Bases engine.

`INDEX.base` defines (verified in the live file): group All Pages by `type`;
Entities & Concepts grouped by `domain`; flat Comparisons/Queries; a Recently
Updated view (limit 10 by `updated`); formulas `type_label`,
`days_since_update = (today − updated).days`, `backlink_count`.

Emit three artifacts:

**(a) Root `index.md`** — OKF §6 (no frontmatter except the single allowed
`okf_version` line per OKF §11). Sections grouped by type:

```markdown
---
okf_version: "0.1"
---
# Entities
* [Anthropic](/entities/anthropic.md) - AI safety company behind Claude. _(updated 12d ago)_
…
# Concepts
…
# Comparisons
…
# Queries
…
# Recently Updated
* [LLM Wiki](/concepts/llm-wiki.md) - 2026-06-20
…(max 10)
```

- Each entry: `* [title](/conceptId.md) - description`. Append a freshness hint
  `_(updated Nd ago)_` derived from `days_since_update`.
- Descriptions come from frontmatter `description` (OKF §6 recommends this).

**(b) Per-directory `index.md`** — `entities/index.md` and `concepts/index.md`
grouped by `domain` (mirroring the base's `groupBy: domain`);
`comparisons/index.md` and `queries/index.md` flat.

**(c) `agent-index.json`** — the neutral, machine-readable index (the artifact
the review calls for). Derived purely from `PageRecord[]`:

```json
{
  "schemaVersion": 1,
  "okfVersion": "0.1",
  "generatedAt": "<stamped by caller>",
  "concepts": [
    {
      "id": "entities/anthropic",
      "type": "Entity",
      "title": "Anthropic",
      "description": "…",
      "domain": "ai",
      "tags": ["ai", "labs"],
      "status": "active",
      "timestamp": "2026-06-17T…",
      "daysSinceUpdate": 12,
      "backlinks": ["concepts/llm-wiki"],
      "outlinks": ["concepts/okf"],
      "sources": ["Idea/anthropic-notes.md"],
      "contradictions": []
    }
  ],
  "groups": { "byType": { "Entity": ["entities/anthropic", …] },
              "byDomain": { "ai": [...] } },
  "stale": ["concepts/old-thing"],
  "unresolvedLinks": [{ "from": "concepts/x", "raw": "[[Deleted Note]]" }],
  "rawSources": [
    { "id": "_sources/Idea/anthropic-notes.md",
      "title": "anthropic-notes",
      "citedBy": ["entities/anthropic"] }
  ]
}
```

- `daysSinceUpdate` computed against a `now` passed in by the caller (keep the
  pure function deterministic — no `Date.now()` inside it).
- `stale` uses the same threshold as `/audit` (default 90 days) so behavior is
  consistent with existing health semantics; threshold is a parameter.
- `rawSources` (D4) lists approved raw notes shipped under `_sources/` (§5.9)
  — kept **outside** `concepts` and `groups` so type/domain grouping stays
  clean. Sections in the root `index.md` follow the mapped type labels
  present (order: Entity, Person, Concept, Comparison, Query, Reference),
  then `# Recently Updated`, then a final `# Sources` section listing the
  `rawSources` entries (title + link).

### 5.5 Log projection

`src/core/okf/log-project.ts` (pure; reuse `activity-model.ts` helpers).

**Default: minimal log (D2).** Every `ActivityRecord.source.visibility` is
`'private-summary'` by schema (`src/types.ts`) — the activity ledger is the
one data set the system explicitly marks private, and record fields
(`summary`, `topics`, `relatedFiles`, `thinking`, `followups`) describe the
user's private work and vault structure. A shared bundle must not carry that
implicitly. So by default `log.md` contains exactly one entry, dated to the
manifest `releasedAt`:

    # Knowledge Update Log

    ## <releasedAt YYYY-MM-DD>
    * **Initialization**: Bundle exported from Knowlery.

…which keeps the reserved file OKF §7 conformant.

**Opt-in: full projection (`includeFullLog: true`, default `false`).** When
explicitly enabled in the export options:

- Input: full `ActivityRecord[]`.
- Filter out system records exactly as `buildCounterSummary` does
  (`source.surface === 'system'` or `type === 'maintenance'` → excluded), so the
  log reflects knowledge work, not plumbing.
- Group by `time`'s `YYYY-MM-DD`, newest first (OKF §7).
- Each entry: `* **<Verb>**: <summary>` where `<Verb>` maps activity `type` to an
  OKF-style verb (`creation→Creation`, `implementation→Update`,
  `analysis|research→Update`, `reflection→Reflection`, else `Update`).
- Header: `# Knowledge Update Log`.
- Disabled/empty activity under this option falls back to the minimal log
  above.

### 5.6 Bundle manifest + content hash

`src/core/okf/manifest.ts` (pure given the final file list).

Write `knowlery-bundle.json` at the bundle root (OKF ignores non-`.md` files):

```json
{
  "schemaVersion": 1,
  "okfVersion": "0.1",
  "id": "jay.jay-workspace",
  "title": "Jay WorkSpace",
  "version": "0.1.0",
  "creator": { "name": "Jay Jiang", "url": "" },
  "releasedAt": "<ISO, stamped by caller>",
  "entrypoint": "index.md",
  "contentHash": "sha256-…",
  "license": "personal",
  "knowleryVersion": "0.5.0",
  "conceptCount": 150
}
```

- `contentHash`: sha256 over knowledge files — concept files **and
  `_sources/` files (§5.9)** — sorted by `conceptId`/path, content joined
  with `\n`. Excludes `log.md`, the manifest, `agent-index.json`, and
  `README.md` (all volatile: timestamps/release date) so the hash reflects
  knowledge content, not stamping. Bundle `version` is the **bundle's**
  semver and is independent of the plugin's `0.5.0`.
- `id` default: `<sanitized creator>.<sanitized kbName>` from
  `.knowlery/manifest.json`; editable in the export modal.
- The manifest doubles as the **bundle-subtree exclusion marker** (§5.1,
  D15): any directory containing a `knowlery-bundle.json` is invisible to
  page collection and backlink scans — and, in 0.6, marks an installed
  bundle (§15).

### 5.7 OKF conformance check

`src/core/okf/conformance.ts` (pure; takes the in-memory bundle before writing,
or re-reads after — prefer in-memory). Implements OKF §9:

1. Every non-reserved `.md` has a parseable YAML frontmatter block.
2. Every frontmatter has a non-empty `type`.
3. `index.md` / `log.md` follow §6 / §7 structure when present.

Returns `ConformanceReport { conformant: boolean, errors: Issue[], warnings: Issue[], fieldQuality: FieldQualitySummary }`.
Warnings (non-blocking, OKF §9 "soft guidance"): missing `description`, missing
`title`, unresolved links, pages with `daysSinceUpdate > threshold`,
`contradictions` present, frontmatter-type/directory mismatch (D1). Errors
block the "conformant" badge but **the export still writes** (so the user can
inspect and fix) — surfaced in the UI report.

**Quality report (D14).** Beyond pass/fail, `fieldQuality` aggregates
per-field counts so non-canonical vaults see exactly what degrades and where
(a conformant-but-hollow bundle must never be a silent outcome):

- `missingDescription` (count + page list) — these pages render as bare links
  in `index.md`, degrading agent drill-down.
- `missingTimestamp` (count + page list), with **near-miss detection**: if a
  page has none of `updated`/`date`/`created` but does have one of
  `modified | last-updated | last_updated | updated_at | date-modified`, the
  issue names the found key ("found `modified` — not interpreted, see
  SCHEMA.md"). Detection is report-only; the mapper never reads these keys.
- `missingDomain` (count) — these pages fall out of by-domain grouping.
- `typeMismatch` (count) — frontmatter type contradicts the directory.

The UI presents this as the fix loop's worklist: "align these pages with
SCHEMA.md (e.g. run /audit), then re-export." The compiler itself never
mutates source pages (§5.8 invariant).

### 5.8 Output layout & raw-notes safety

- Default export target: `<vault>/.knowlery/exports/<bundle-id>-<version>/`.
  The modal also offers "Choose folder…" (any path, incl. outside the vault, via
  the Electron path picker — desktop-only, consistent with existing CLI features).
- The compiler writes a **fresh directory**; if the target exists, prompt to
  overwrite or pick a new version. Never write above the target dir.
- Hard invariant, asserted in code and tested: **no write path ever resolves into
  the four source dirs or any raw note.** Source files are opened read-only.
- **`INDEX.base` is NOT copied into the bundle.** It is Obsidian-only and would be
  inert noise in a portable, any-agent bundle; the generated `index.md` (§5.4)
  replaces it. Likewise `KNOWLEDGE.md` and the `.knowlery/` system dir are not
  copied.
- The export target and any bundle subtree (marker: `knowlery-bundle.json`)
  are excluded from collection per the invariant in §5.1.

### 5.9 Raw-note inclusion (`_sources/`), human README, zip (D4, D12)

Resolves former open decision §13.7 #8.

**`_sources/` layout.** Every `approved` raw dependency (§13.4) is copied to
`_sources/<vault-relative-path>` inside the bundle, preserving directory
structure (e.g. `Idea/anthropic-notes.md` →
`_sources/Idea/anthropic-notes.md`). The copy — never the source — gets
frontmatter injected/merged so the bundle stays OKF §9 conformant (every
non-reserved `.md` needs a non-empty `type`):

```yaml
---
type: Source
title: <existing title, else filename without extension>
knowlery_raw_path: "Idea/anthropic-notes.md"
---
```

- Existing raw frontmatter keys are preserved; an existing `type` value is
  moved to `knowlery_raw_type` before `type: Source` is set.
- The body is copied **verbatim**: wikilinks inside raw bodies are NOT
  converted (raw content is not curated, and §13.3 deliberately never
  traverses raw→anything). Wikilinks found in raw bodies are recorded in
  `CompileResult.unresolvedLinks`.
- Link resolution from compiled pages to approved raw notes follows §5.3
  (resolves to `/_sources/<path>`).
- `agent-index.json` lists them under the top-level `rawSources` array
  (§5.4c) — never inside `concepts` or `groups`.
- The root `index.md` gains a final `# Sources` section (§5.4).
- `_sources/` files are **included** in the manifest `contentHash` — they are
  knowledge content.

**Human `README.md` (D12).** Written at the bundle root with
`type: Reference` frontmatter (so it is conformant), containing: bundle
title, creator, a one-paragraph "this is a portable knowledge bundle — point
your agent at `index.md` and it can navigate everything", concept count,
released date, and a "Generated by Knowlery" footer. This is the recipient's
first-contact document; it is excluded from `agent-index.json` and from index
sections.

**Zip packaging (D12).** The result screen (§8.2) offers "Save as .zip",
producing `<bundle-id>-<version>.zip` next to the bundle directory, via a
bundled `jszip` dependency (pure JS, mobile-compatible, CJS-bundleable per
the esbuild rules). This is a post-export action — `compileBundle` never
zips.

### 5.10 Risk scanner (warning-only, D6)

`src/core/okf/risk-scan.ts` (pure). Runs over the computed closure (compiled
page bodies + frontmatter, and raw-note bodies) **before** review, feeding
the scope workspace UI (§8.2, §13.5). Heuristics, each yielding
`RiskHint { itemId, kind, evidence }` where `evidence` is the matched snippet:

- `email` — an email-address pattern in body or frontmatter.
- `sensitive-url` — a URL whose host matches a built-in list
  (`atlassian.net`, `jira.`, `slack.com`, `docs.google.com`, `notion.so`):
  links into private team tools rarely belong in a shared bundle.
- `person-page` — pages with `type: person` (personal contacts).
- `meeting-like-path` — raw dependencies whose vault path contains
  `meeting | 1on1 | 1-1 | interview | standup` (case-insensitive).

Hard rules: hints are **warnings only** — they never auto-flag, never block
export, and never change a review status (the §13.4 gate stays the sole
membership authority). Their only UI effects: risky items sort to the top of
the review list and carry a visible hint chip with the matched evidence. The
heuristic list is a constant in 0.5.0, not user-configurable.

---

## 6. Architecture & file layout

```
src/core/okf/
  collect.ts          # Obsidian-facing: PageRecord[], activity, linkMap   (impure)
  export-scope.ts     # §13: seed closure over resolvedLinks + review-state (impure)
  frontmatter-map.ts  # Knowlery FM → OKF FM                                (pure)
  wikilink.ts         # [[..]] → markdown links                            (pure)
  index-project.ts    # frontmatter → index.md(+per-dir) + agent-index     (pure)
  log-project.ts      # activity → log.md (minimal default, §5.5)          (pure)
  manifest.ts         # manifest + contentHash                             (pure)
  conformance.ts      # OKF §9 checker + field-quality report (§5.7)       (pure)
  risk-scan.ts        # §5.10 warning-only risk heuristics                 (pure)
  bundle-docs.ts      # §5.9 human README + _sources frontmatter merge     (pure)
  zip.ts              # §5.9 post-export zip packaging via jszip           (impure)
  compile.ts          # orchestrator: collect → pure pipeline → write      (thin impure shell)
```

- `compile.ts` exports `compileBundle(app, opts): Promise<CompileResult>`. It
  calls `collect`, runs the pure pipeline, writes files via existing
  `vault-io.ts` helpers (or the Electron fs path for out-of-vault targets), runs
  conformance, and returns the report. `opts` now includes the resolved scope
  (`approved` conceptIds/raw paths from `export-scope.ts`, §13) — `collect`'s
  output is filtered to that set before it reaches the pure pipeline.
- `export-scope.ts` exports `buildClosure(app, seeds, maxCompiledHops)` (reads
  `metadataCache.resolvedLinks`, §13.3) and the `.knowlery/export-scope.json`
  read/write + content-hash invalidation logic (§13.4/§13.6; the file is
  keyed by bundle id — D8). Called by the
  seed/scope and review UI steps, ahead of `compileBundle`, not from inside it
  — the modal drives closure computation live as the user edits seeds, only
  calling `compileBundle` once at the final export step.
- All pure modules take plain data + a `now: Date` and return strings/objects.
  No `obsidian`, no `Date.now()` inside pure functions (caller injects `now`)
  — determinism is a hard rule for this package.
- `src/core/` must not import React/DOM (existing rule) — honored; UI lives in a
  modal that calls `compileBundle`.

---

## 7. Types (add to `src/types.ts`)

Zod schemas + inferred types (validated, per project convention):

- `OkfFrontmatterSchema` — `{ type: string (nonempty), title?, description?, tags?, timestamp?, … passthrough }`.
- `BundleManifestSchema` — §5.6 shape.
- `AgentIndexSchema` — §5.4(c) shape.
- `ConformanceIssueSchema` / `ConformanceReportSchema`.
- `CompileOptionsSchema` — `{ targetDir, bundleId, title, version, license, creator, staleThresholdDays?, includeSchema?, includeFullLog? (default false, D2), includeSources? (default false, D3) }`.
- `CompileResultSchema` — `{ manifest, conformance, conceptCount, rawSourceCount, wikilinksConverted, unresolvedLinks, staleCount, targetDir }`.
- `ExportScopeFileSchema` — §13.6 shape: `schemaVersion`, `bundles` keyed by
  bundle id (D8), each `{ seeds, maxCompiledHops, items }` with per-item
  `status`/`contentHashAtReview`.
- `RiskHintSchema` — §5.10 shape (`itemId`, `kind`, `evidence`).
- `FieldQualitySummarySchema` — §5.7 per-field counts + page lists.

Knowlery's existing `KnowledgePageFrontmatter` (the `entity|concept|…` enum,
`sources`, `contradictions`, etc.) is the *input* side; reuse it as the typed
view of `PageRecord.frontmatter` where possible. No change to `PlatformSchema`.

---

## 8. UI

### 8.1 Entry points (D9)

Sharing starts from content or from the dashboard — not from settings:

- **Dashboard "Bundles" section** (primary home). Placement and form are
  specified against the real `DashboardHome.tsx` layout: a new section with
  the standard `knowlery-section-label` + card pattern, inserted **after
  "This week" and before the stats row** — the weekly report and the bundle
  are siblings in the page's narrative ("attention → action → context →
  history → artifacts"). Card content is one bundle with three states:
  - *never exported*: "Pick a topic to share" + **Share knowledge…** button;
  - *scope in progress*: "5 approved · 3 need review" + **Continue review**
    (the §13.6 resumability entry);
  - *exported*: "v0.1.0 · Nd ago · 2 changed since last export" +
    **Share knowledge…** / **Open bundle folder**.
  Status loads inside `DashboardHome`'s existing `refresh()` callback
  (reading `.knowlery/export-scope.json` + the last manifest) on the same
  `dashboard-refresh` event chain — no new refresh mechanism. Styling:
  `knowlery-home__bundle*` BEM classes modeled on the week card, existing
  `knowlery-btn` variants. Rev 1 kept the dashboard export-free ("calm
  review surface"); rev 2 deliberately overrides that — but the card stays
  calm: one status line, buttons, nothing inline.
  **Density constraint (hard):** the dashboard is a dual-width surface (it
  also runs in sidebar splits — see the `.mod-left-split`/`.mod-right-split`
  selectors in `styles.css`), so the Bundles section MUST stay a single
  compact card in every state — one status line + one action row, never
  taller than the week card, never a list. When 0.6 install adds installed
  bundles, the correct expansion is a dedicated `DashboardScreen` (the
  existing `all-moves`/`move-detail` navigation pattern), with the home
  card remaining a summary row — not a growing home section.
- **"This note" card conditional action**: when the active file is under
  one of the four knowledge dirs, the existing This-note card
  (`DashboardHome` already tracks the active file) gains an outline button
  **"Share this topic…"** that opens the scope workspace seeded with that
  page. Raw notes and non-knowledge files do not show it.
- **File context menu** on any page under the four knowledge dirs: **"Share
  this topic…"** — same behavior as the This-note button, for users who
  live in the file explorer ("I'm looking at this page and want to share it
  and whatever belongs with it").
- **Explicit non-entry — Suggested moves.** Share is NOT added to
  `RECIPE_BOOK`: moves are agent requests by contract (prompt + skillTag →
  move-detail → send), and Share is a local UI flow. Any future narrative
  nudge ("this domain looks mature — share it?") belongs in
  `today-model.ts` heuristics, post-0.5.0.
- **Command palette**: "Knowlery: Share knowledge bundle…".
- **Settings** keeps only export defaults (creator name/url, default
  license); it is no longer the feature's entry point.

UI copy rule (D13): user-facing text says "knowledge bundle" / "share" —
never "OKF". The format name appears exactly once, as a technical line in
the result report ("Conforms to OKF v0.1").

### 8.2 Two-phase flow (D10)

`ExportBundleModal` (React-in-Modal, matching existing modal patterns) has
two phases — not four wizard steps — reached through a pre-phase, **bundle
picker** (D17), shown only when the modal opens with no specific seed
already in hand (dashboard card, command palette). It lists existing named
bundles from `.knowlery/export-scope.json` to resume, or takes a name to
start a new one; either choice sets the bundle id used for the rest of the
flow. A seed-triggered entry point (e.g. a future "Share this topic…"
command) skips the picker and derives the bundle id from the seed directly,
since the topic is already known. This exists because the bundle id is
reused as both the saved-scope key (§13.6) and the exported identity — two
different topic exports from the same vault must never land on the same
default id.

**Phase 1 — Scope workspace** (§13.5). One resumable surface combining:

- Seed chips + in-modal search to add/remove seeds; the closure recomputes
  live on every seed / `maxCompiledHops` change.
- **List view (primary)**: the §13.5 search + status-filter review list with
  the "N/Total approved" progress indicator. Risk-hinted items (§5.10) sort
  first and show a hint chip.
- **Graph view (toggle)**: the same closure as a graph per §14.1's
  interaction model, with a legend. A view switch inside the phase — not a
  separate step.
- **Detail panel (D11)**: selecting an item (in either view) shows its
  **rendered content** — page body for compiled pages, raw body for raw
  dependencies — plus metadata, risk hints, and Approve/Flag actions.
  Without content in view, users either blind-approve (defeating the §13.4
  gate) or bounce out to Obsidian tabs; this panel is a must-have, not
  polish.
- **Incremental callouts**: on reopen, "3 new items since last export, 2
  approvals invalidated by edits" (from §13.6's hash invalidation). Repeat
  exports should feel like a two-minute delta review, not a fresh start.
- Closing the modal loses nothing: seeds, hops, and review state persist in
  `.knowlery/export-scope.json` (§13.6).

**Phase 2 — Confirm & export.** Reached via "Continue"; a non-zero
`unreviewed` count is allowed (those items simply won't ship — the button
states how many will):

- Metadata as prefilled editable fields: bundle id, title, version, license,
  creator (from `.knowlery/manifest.json`); target folder (default
  `.knowlery/exports/…`, with "Choose folder…"); stale threshold; "include
  SCHEMA.md as Reference" toggle; `includeFullLog` and `includeSources`
  opt-ins — both default off, each with a one-line explanation of what it
  adds and why it is off by default.
- **Safety summary** above the export button (D16): "Will include 14
  approved pages + 6 approved raw notes. Excluded: 3 unreviewed, 2 flagged.
  Sources metadata: stripped. Activity log: minimal."
- Export runs `compileBundle` against only the `approved` items (progress
  state), then the **result report**, safety facts first: what shipped and
  what was excluded, then counts (links converted, unresolved links, stale
  pages, contradictions), the quality-report worklist (§5.7), the
  conformance line, and actions: "Reveal in Finder / open folder" and
  "Save as .zip" (§5.9).

All Vault/fs errors caught at the modal and shown via `new Notice` (existing
error-handling convention). Core lets errors propagate.
Styling: reuse existing `knowlery-` classes, Obsidian CSS variables only, no
hardcoded colors/sizes, logical properties (project rules). Report list reuses
the health-check row pattern (`knowlery-health__…` variants) rather than a new
lookalike.

---

## 9. Testing plan (Vitest)

> Conventions note for implementers: there is no separate test-conventions
> document — follow the patterns in the existing `tests/core/*.test.ts` files
> and `vitest.config.mjs` (which aliases `obsidian` to
> `tests/mocks/obsidian.ts`). `createMockApp` is currently a per-file local
> helper in those tests, not a shared factory; either follow that per-file
> pattern or extract one shared helper into `tests/mocks/` — do not invent a
> new mocking approach.

The pure pipeline is the high-value, easily-tested surface — this is a direct
benefit of the architecture in §6.

- `frontmatter-map.test.ts`: each `type` maps correctly incl. `person→Person`
  and `reference→Reference` (D1); missing/unrecognized type infers from
  directory, then `Concept` + warning; frontmatter/directory mismatch warns
  but keeps the frontmatter mapping; unknown keys preserved; timestamp
  fallback order `updated→date→created`; `sources` absent from output by
  default and verbatim with `includeSources: true` (D3).
- `wikilink.test.ts`: alias, heading, embed, absolute-vs-relative, unresolved link
  recorded not thrown.
- `index-project.test.ts`: grouping by type and by domain **reproduces
  `INDEX.base`'s grouping logic** (the test encodes the expected reproduction, not
  fidelity to an arbitrary edited `.base` — see §3 limitation); Recently Updated
  capped at 10 and sorted; `agent-index.json` groups/stale correct against an
  injected `now`.
- `log-project.test.ts`: default output is exactly the minimal Initialization
  log regardless of input records (D2); full projection only with
  `includeFullLog: true` — then system/maintenance records excluded, date
  grouping newest-first, verb mapping, empty-activity fallback to minimal.
- `manifest.test.ts`: contentHash stable under reordering of input; excludes
  volatile files; changes when a concept body changes.
- `conformance.test.ts`: passes a good bundle; flags missing `type` as error;
  flags missing `description` as warning only; quality-report counts correct
  (missing description/timestamp/domain, type mismatch) and near-miss
  detection names the found key (§5.7, D14); a bundle containing `_sources/`
  files passes (`type: Source` present).
- `risk-scan.test.ts`: each §5.10 heuristic fires on a crafted fixture and
  stays silent on a clean one; output never contains a status mutation (D6).
- `bundle-docs.test.ts`: `_sources` frontmatter injection preserves existing
  keys and relocates an existing `type` to `knowlery_raw_type` (§5.9);
  README carries `type: Reference` frontmatter.
- `compile.test.ts`: uses a `createMockApp` helper (see conventions note
  above) to feed a tiny vault
  fixture through `compileBundle`; asserts the **raw-notes-untouched invariant**
  (no write/modify call targets a source path) and that the reserved/output files
  exist. Mock at the `App` boundary only. Also asserts the **generalized
  exclusion invariant** (§5.1, D15): a fixture containing a prior export
  under the target dir, **and** a fixture containing an installed-bundle
  subtree (any folder with a `knowlery-bundle.json`), contribute zero pages
  and zero backlinks to the new compile. Also asserts §10's criterion 6: a
  fixture with `unreviewed`/`approved`/`flagged` items produces a bundle
  containing only the `approved` ones. Also asserts approved raw notes land
  under `_sources/` and that a compiled page's link to one resolves (§5.9).
- `export-scope.test.ts` (§13): compiled↔compiled traversal stops at
  `maxCompiledHops`; compiled→raw traversal stops at 1 hop and does not
  continue from a raw note's own links; shared-tag edges are never
  traversed; raw→compiled backlinks do not affect inclusion. Separately,
  against a fixture `ExportScopeFile`: an item whose stored
  `contentHashAtReview` no longer matches current content hash reverts to
  `unreviewed`; a new item entering the closure defaults to `unreviewed`;
  the scope file itself is excluded from `collect.ts`'s page scan (§5.1
  invariant extended per §13.6); the scope file is keyed by bundle id and
  two bundles hold fully independent seeds/review state (D8).

Target ≥80% line coverage on `src/core/okf/` (a target set by this spec — no
coverage threshold is configured in `vitest.config.mjs` today; do not add a
global one, just meet the target on the new package).

---

## 10. Acceptance criteria (functional)

0.5.0 ships when, on a real vault (Jay WorkSpace as the working fixture):

1. Export produces a bundle directory with `index.md`, per-dir `index.md`s,
   `log.md`, `agent-index.json`, `knowlery-bundle.json`, and `README.md`,
   containing exactly the `approved` concepts (four typed dirs) and
   `approved` raw notes (under `_sources/`, §5.9) from the scope step (§13)
   — a deliberately narrow-scoped export (e.g. one seed) is a valid, correct
   result, not a failure; a whole-vault export with all seeds approved
   should still reach all ~150 concepts.
2. `conformance.conformant === true` on a healthy vault.
3. No source file under the four knowledge dirs or any raw note is modified
   (verified by the §9 invariant test + a manual git-status check on the vault).
4. Opening the bundle's `index.md` in a plain editor lets a human navigate to any
   concept via the links (drill-down works without Obsidian).
5. Unit tests for `src/core/okf/` pass without Obsidian mocks beyond `createMockApp`.
6. No `unreviewed` or `flagged` item ever appears in the compiled bundle
   output, verified against a fixture with a mix of all three statuses
   (§13.4) — this is the desensitization safeguard and is exercised as a
   hard test assertion, not just a UI-level default.
7. Share-safe defaults hold: with no options touched, the emitted `log.md`
   is the minimal Initialization log and no emitted page carries a `sources`
   key (fixture-verified; D2/D3).
8. A vault containing an installed/prior bundle subtree (marker:
   `knowlery-bundle.json`) exports identically to the same vault without it
   (D15).
9. Risk hints appear for a seeded risky fixture and change nothing about
   bundle membership (D6).

> Note: the **commercial** exit criterion from review §9 Phase 0.5 ("Claude Code
> can answer from the exported bundle via index drill-down", before/after value)
> is intentionally **out of this release's gate** per the scope decision. It is
> tracked as separate validation, not a blocker for shipping the export feature.

---

## 11. Decisions (rev 1 open → rev 2 status)

(§13.7's #6 remains open; #7 is confirmed; #8 is resolved by §5.9.)

1. **`sources` provenance in the bundle.** → **Resolved (D3):** stripped by
   default; verbatim under `includeSources: true`. No `# Provenance` body
   section.
2. **Include `KNOWLEDGE.md`?** → **Confirmed:** excluded. `SCHEMA.md` ships
   as `Reference` (toggle); `KNOWLEDGE.md` is Obsidian-orientation.
3. **Manifest filename.** → **Confirmed:** `knowlery-bundle.json` at root —
   now also load-bearing as the bundle-subtree exclusion marker (D15).
4. **Default export location.** → **Confirmed:** `.knowlery/exports/` with a
   "Choose folder…" override.
5. **Bundle `id` scheme.** → **Confirmed:** `<creator>.<kbName>`; revisit
   when install/registry lands (§15).

Still open (pre-implementation task):

9. **Vault frontmatter audit.** Before locking the §5.2 mapping table,
   enumerate the actual `type` values and stray frontmatter keys on Jay
   WorkSpace (and any other available vault). The external review reported
   `person`, `reference`, and missing-type pages in the wild; D1 covers
   those known cases — the audit confirms there are no others and feeds the
   near-miss key list in §5.7.

---

## 12. Manual verification checklist (before release)

- [ ] Run export on Jay WorkSpace; `git status` in the vault shows **no changes**
      to source notes (only new files under the export target).
- [ ] Open generated root `index.md` and a per-dir `index.md` in Obsidian and in
      a plain text editor; links resolve.
- [ ] Spot-check 3 converted concepts: wikilinks became valid bundle-relative
      links; extensions (`domain`, `status`, `sources`, `contradictions`) preserved.
- [ ] `agent-index.json` parses; `stale` and `groups` look right.
- [ ] Conformance report matches a hand check on one deliberately broken page
      (remove `type`) → error; (remove `description`) → warning only.
- [ ] Export UI checked in Obsidian default light, default dark, and one
      community theme (theme-adaptivity follows from the AGENTS.md
      CSS-variables rule).
- [ ] Default export: open `log.md` (minimal Initialization entry only) and
      grep the bundle for `sources:` in frontmatter (must be absent).
- [ ] Approve one raw note; verify it lands under `_sources/` with
      `type: Source` + `knowlery_raw_path`, and the citing page's link
      resolves to it.
- [ ] `README.md` reads correctly as a recipient's first contact; "Save as
      .zip" produces an archive that unzips to an identical bundle.
- [ ] Place a dummy installed bundle (folder + `knowlery-bundle.json`) in
      the vault; re-export; verify byte-identical output vs without it.
- [ ] Trigger "Share this topic…" from a knowledge page's context menu;
      verify the page arrives as a seed in the scope workspace.

---

## 13. Export scope selection (seed → graph closure → review)

### 13.1 Problem this section solves

§1-12 as originally scoped assume "export = pick a target folder, dump
everything in the four knowledge dirs." Three gaps surfaced during review of
a real 150-page vault (Jay WorkSpace):

1. No mechanism distinguishes which of the four page types are safe/intended
   to leave the vault — bundling is currently all-or-nothing.
2. §5.2 already documents that `sources` may point to raw notes outside the
   bundle, and §5.1/§5.8 deliberately keep raw notes out. But raw notes are
   not always optional context — an audit of Jay WorkSpace found **139/152
   pages (91%) cite at least one raw-note source**, and **13 pages (all under
   `entities/`, all single-person stub pages, 10–134 words with most under
   60) are both thin (<150 words) and raw-dependent** — exporting them
   without their raw source produces an
   empty pointer, not knowledge.
3. No desensitization step. A page or raw note can be a structurally
   required dependency and still be unfit to share (private, sensitive).
   Nothing today lets the user say "don't include this."

The user's position, which this section encodes: **bundle export must be
scoped and reviewed by the user, not implicit.** This does not change the
compiler, frontmatter mapping, index projection, or conformance check
described above — it adds a **scoping stage that runs before
`compileBundle`**, restricting the `PageRecord[]` (and a set of raw-note
paths) that reach the pipeline in §4.

### 13.2 Why this is not "LLM Wiki v2"

07-feasibility-review §3's "LLM Wiki v2" layer (confidence/provenance/
supersession/audit/…) addresses **knowledge trustworthiness and lifecycle**,
not **export visibility**. A page's schema being fully v2-lite (Knowlery
0.4.x already carries `sources`/`contradictions`/`updated`) says nothing
about whether that page is safe to hand to someone else. This section is
additive to the bundle compiler, not a wiki-schema change — no existing
frontmatter is touched, and no migration of existing pages is required
(§13.6).

### 13.3 Scope model: seed + graph closure

Replaces the plain "target folder" framing in §8 for *which pages* enter the
bundle. Membership is computed, not manually enumerated:

1. **Seeds.** The user selects one or more pages (any of the four knowledge
   dirs) as seeds via an in-modal search box + removable chips (not
   Obsidian's native `FuzzySuggestModal` — keeping the whole flow inside one
   modal avoids a jarring context switch). Seeds can be a single topic page
   or, at the limit, an entire domain's pages added one by one — the
   mechanism does not distinguish "topic export" from "domain export," it
   generalizes both.
2. **Closure traversal**, run against `metadataCache.resolvedLinks` (the
   same primitive `vault-health.ts` and §5.1's collector already use — no
   new Obsidian API surface):
   - **Compiled ↔ compiled edges** (any of the four knowledge dirs, wikilink
     resolution): traversed **multi-hop, capped at `maxCompiledHops`
     (default 2, configurable in the scope UI)**. Uncapped traversal risks
     the closure silently expanding to most of the vault in a densely
     cross-linked personal wiki — this cap is a hard requirement, not a
     tuning nicety.
   - **Compiled → raw edges** (a compiled page's outlinks/`sources` entries
     pointing outside the four dirs): traversed **exactly 1 hop, outlink
     direction only**. Do not continue from a raw note to *its* links
     (raw-to-raw fan-out is unbounded and not curated). Do not follow
     raw → compiled backlinks (a raw note happening to link back to a
     compiled page is not a reason to expand inclusion — inclusion already
     came from the compiled-page side).
   - **Shared-tag edges are never traversed.** Two pages sharing a `#tag`
     are not a content dependency; including them would defeat the cap
     above.
   - The closure recomputes from the seed set each time seeds change; it is
     not persisted as a frozen list (see §13.6 for what *is* persisted).
3. **Output of closure**: two disjoint sets — `included` (compiled pages
   reached, incl. the seeds themselves) and `rawDependencies` (raw notes
   reached at the 1-hop boundary, each annotated with which included
   page(s) cited it).

This reuses and extends §5.1's `collect.ts` responsibilities: the collector
already resolves wikilinks and builds backlink data for the four dirs;
closure computation is a graph traversal over that same resolved-link map,
scoped by seeds before `PageRecord[]` is handed to the pure pipeline
(§4/§6). Raw notes never need their own wikilinks resolved — only 1-hop
membership is needed.

**Empirical calibration** (Jay WorkSpace audit, 152 pages): a single-topic
seed's closure typically includes 1–3 additional compiled pages and 10–20
raw dependencies (audited example: "Parallel Search Trigger Mechanism" — 2
compiled, 12 raw). A domain-wide seed set (dozens of seeds) scales the
raw-dependency side proportionally — one page alone (`Refund Automation.md`)
cited 9 raw sources. The UI must handle both ends of this range (§13.5).

### 13.4 Review-status gate (desensitization safeguard)

Closure membership answers "does this need to travel together to avoid a
knowledge gap." It does **not** answer "is this safe to share." Every item
in `included` and `rawDependencies` carries an independent status:

```ts
type ReviewStatus = 'unreviewed' | 'approved' | 'flagged';
```

- Default for every item, every time it first appears in a computed
  closure: `unreviewed`.
- Only `approved` items are written into the bundle by `compileBundle`
  (§4/§6). `unreviewed` and `flagged` items are excluded — `unreviewed` is a
  safe default (nothing ships without an explicit look), `flagged` is a
  durable "no" so the same item does not re-prompt every export.
- Approval is cached against the item's current content hash (reuse the
  hashing approach from §5.6's `contentHash`, applied per-file rather than
  bundle-wide). If the underlying page/raw note changes after approval, the
  cached approval is invalidated back to `unreviewed` on the next scope load
  — an edited page must be re-looked-at before it can ship again.
- Bulk actions (e.g., "approve all in this domain") are allowed as a UI
  convenience but still write individual per-item `approved` entries —
  there is no domain-level or type-level approval flag that could silently
  cover a page added later.

### 13.5 UI

Rev 2 (D10) folds the rev 1 "two sequential steps" into one **scope
workspace** phase inside `ExportBundleModal` (§8.2), followed by the
confirm & export phase. The two presentations survive as two switchable
*views* of the same phase:

**List view (primary).** Search + status-filter list (flat "Included" /
"Raw dependencies" sections, filterable by title and by
`unreviewed | approved | flagged`, with an "N/Total approved" progress
indicator). This is the operational surface where Approve/Flag actions
happen — chosen over a grouped-tree or graph presentation for review work
because the audited scale range (10–20 items for a single-topic export,
50–100+ for a domain-wide one, §13.3) makes flat/tree layouts unwieldy at
the top end; search+filter is the only one of the compared layouts that
stays usable across that whole range. Risk-hinted items (§5.10) sort first
and carry a hint chip.

**Graph view (toggle).** The same closure as a graph, for *comprehension*:
nodes are exactly the computed closure (compiled pages + raw dependencies),
edges are the traversal edges from §13.3 (no tag edges), node border color
reflects review status. Its job is to confirm the seed choice produced a
sensible, correctly-bounded set (e.g., spot an unrelated node that slipped
in and remove that seed) before committing time to per-item review. It needs
a legend (status colors, node-size-by-type) since an unlabeled graph is not
self-explanatory on first view — validated against a working prototype,
where "what does this graph mean" was the first reaction without narration.

**Detail panel (both views, D11).** Selecting an item shows its rendered
content (page body / raw-note body), metadata, risk hints, and Approve/Flag
actions. Content-in-view is a hard requirement: the review decision is "is
this safe to share," which cannot be made from a title and a word count.

Both views reuse existing Knowlery visual patterns (per the repo's AGENTS.md
styling rules — there is no separate design-system document):
`knowlery-btn` variants for actions, `knowlery-badge` for status pills, row
structure modeled on `knowlery-health__integrity-row`. No new colors —
status colors map to existing semantic tokens (approved→success,
flagged→error, unreviewed→warning), consistent with how HealthTab already
signals state.

### 13.6 Persistence & migration

Stored in a new file, `.knowlery/export-scope.json` — **not** in page
frontmatter. This is the load-bearing decision for zero-migration: an
existing vault's ~150 pages need no schema change, no batch rewrite, and no
risk of a bulk-write touching content the compiler otherwise treats as
read-only (§5.1's existing invariant).

```ts
interface ExportScopeFile {
  schemaVersion: 1;
  bundles: Record<
    string, // bundle id (matches manifest id; 0.5.0 UI manages exactly one)
    {
      seeds: string[]; // conceptIds
      maxCompiledHops: number; // default 2
      items: Record<
        string, // conceptId or raw-note vault path
        {
          status: 'unreviewed' | 'approved' | 'flagged';
          contentHashAtReview: string | null; // null while still unreviewed
        }
      >;
    }
  >;
}
```

Keyed by bundle id from day one (D8) so multiple named bundles — different
audiences, different scopes — need no schema migration when the 0.6+ UI
exposes them. Review status is **per-bundle**: approving an item for one
audience says nothing about another.

`items` keys mix two different path formats and implementations must not
conflate them: compiled-page keys are bundle-relative conceptIds without
extension (§5.1's `"entities/anthropic"` form — always rooted at one of the
four lowercase knowledge dirs), raw-note keys are full vault-relative paths
with extension (e.g. `"Idea/anthropic-notes.md"`). In practice these never
collide (raw notes live outside the four dirs by definition), but the
distinction matters for `compileBundle` to know which lookup (`PageRecord`
vs. raw-note read) an `approved` key resolves to.

- First export on an existing vault: no file exists → seed selection in the
  scope workspace (§8.2 Phase 1) is mandatory, nothing defaults to included.
- Subsequent exports: file loads, closure recomputes from the saved `seeds`
  (picking up any new pages/links added since last time), and any item
  whose `contentHashAtReview` no longer matches current content reverts to
  `unreviewed` (§13.4). New items entering the closure start `unreviewed`
  and are called out in the UI ("3 new items since last export").
- This file is itself excluded from page collection (already required by
  §5.1's bundle-subtree exclusion invariant, extended to cover this file too).

### 13.7 Open decisions added by this section

6. **`maxCompiledHops` default.** → **Resolved (2026-07-02, real-vault
   calibration):** default is **1**, not the rev 1 guess of 2. Measured on
   Jay WorkSpace: a single-topic seed at 2 hops reached **138 items / 100
   raw dependencies** — the vault's compiled pages are far more densely
   cross-linked than the §13.3 estimate assumed, and a 138-item first
   review is exactly the fatigue failure mode §13.5 warns about. The scope
   UI still exposes 2-3 hops for deliberate widening.
7. **Bulk-approve granularity.** → **Confirmed (rev 2):** "approve all in
   this domain" is allowed as a UI convenience, still writing individual
   per-item `approved` entries — no group-level flag that could silently
   cover a page added later (§13.4).
8. **Raw-note inclusion mechanics.** → **Resolved (rev 2, D4):** see §5.9 —
   approved raw notes are copied to `_sources/` with injected `type: Source`
   frontmatter, listed separately in `agent-index.json` (`rawSources`) and
   the root index's `# Sources` section.

---

## 14. Reference prototype (for implementers)

Two standalone Vite/React prototypes accompany this spec (sibling
directories — see each `README.md` to run them). Neither is Knowlery plugin
code.

- [`export-flow-ui-prototype/`](export-flow-ui-prototype/) — **the rev 2
  end-to-end reference**: dashboard entry ("Bundles" card + "Share this
  topic…"), the two-phase flow (§8.2), risk-first list, graph view with
  legend, content-preview detail panel, share-safe confirm screen,
  safety-first result report, and the hash-invalidation reopen experience.
  Implementers should walk this first; its `README.md` maps each screen to
  the D-decisions it demonstrates. Its mock closure (`mockData.js
  buildClosure`) is a real link-graph traversal shaped like §13.3, but is
  still mock data — production uses `metadataCache.resolvedLinks`. Its
  dashboard shell (sidebar file list + generic cards) is a **stand-in**:
  the real dashboard integration is specified against `DashboardHome.tsx`
  in §8.1 (Bundles section after "This week", This-note conditional
  button) and §8.1 governs. Its demo toolbar (Light/Dark toggle) is
  scaffolding for browser-only preview — the real plugin ships no theme
  switch: Obsidian owns theming, and adaptivity comes entirely from using
  Obsidian CSS variables (AGENTS.md rule 1).
- [`export-scope-ui-prototype/`](export-scope-ui-prototype/) — the earlier
  layout-comparison study that §13.5's choice came from; kept for design
  history. The guidance below about what is authoritative vs. illustrative
  was written against it and still applies (interaction models per view).

### 14.1 What is authoritative (implement to match)

- **The two presentations and their division of labor**: graph for scope
  comprehension, search+filter list for review. Rev 2 (D10) folds them into
  one scope-workspace phase as switchable views (list primary, graph toggle)
  rather than two sequential steps — see §8.2/§13.5; the interaction models
  below still apply verbatim to each view.
- **The graph tab's interaction model** for the scope-confirmation step:
  nodes = closure items, edges = outlink relationships only (no tags), node
  border color = review status (orange/green/red mapping to
  unreviewed/approved/flagged), hovering a node dims everything except it
  and its direct neighbors, clicking selects it and opens a detail panel
  with Approve/Flag actions. Re-layout only when the node *set* changes
  (seed/scope edits) — never on a status change; approving or flagging a
  node must not make it jump position.
- **The filter tab's interaction model** for the review step: search box +
  status filter chips (All/Unreviewed/Approved/Flagged) + an "N/Total
  approved" progress indicator, flat list, no forced grouping.
- **Status semantics**: `unreviewed` (default, excluded from bundle) →
  `approved` (included) / `flagged` (excluded, durable — does not re-prompt
  next export). See §13.4; the prototype's `StatusControl`/`StatusBadge`
  components (`src/components/Row.jsx`) show the exact 3-state behavior.

### 14.2 What is illustrative only (do not port as-is)

- **Mock data** (`src/mockData.js`) and the **hub-heuristic edge builder**
  (`src/graph.js`'s `buildEdges`, which infers edges from a `seedIds` field
  that only exists in the mock). Production code must build the closure and
  its edges from real `metadataCache.resolvedLinks` traversal per §13.3
  (multi-hop compiled↔compiled capped at `maxCompiledHops`, 1-hop
  outlink-only into raw, no tag edges) — there is no equivalent of the
  mock's `seedIds` shortcut in real data.
- **`src/forceLayout.js`**: a hand-rolled force simulation. Fine to reuse the
  *approach* (no new npm dependency needed at this scale) but re-tune
  constants against real closure sizes (§13.3's 10–20 / 50–100+ item range)
  rather than assuming the prototype's defaults are load-bearing.
- **`src/theme.css`**: hardcoded approximations of Obsidian's CSS variables,
  used only so the standalone Vite app renders something theme-like.
  Production code MUST use Obsidian's real CSS variables directly — no
  hardcoded colors (AGENTS.md rule 1) — and must add
  the graph's legend/status-color explanation the prototype is missing
  (§13.5 notes this gap explicitly: the prototype was confusing on first
  view without narration).
- **Tabs A and B** (flat list, grouped-collapsible-tree): rejected
  alternatives, kept in the prototype only for comparison history. Do not
  implement either as a shipped feature.
- **The overall app shell** (`App.jsx`'s scope-size/light-dark toggles, the
  4-tab switcher): demo scaffolding for comparing options side by side, not
  a UI to replicate. The real `ExportBundleModal` has the two phases from
  §8.2 — a scope workspace with a two-way list/graph view switch and a
  persistent detail panel, then confirm & export — not the prototype's
  4-tab switcher. Note also that the prototype's detail panel shows only
  domain/word-count; the real one MUST render item content (D11).

### 14.3 Where this lands in the real codebase

Per the repo's file-organization conventions (AGENTS.md project structure —
there is no separate coding-standards document): the seed/closure/review
UI is a React-in-Modal component (e.g. `src/modals/export-scope-picker.tsx`,
following the `setup-wizard.tsx`/`skill-browser.tsx` pattern of a thin
`Modal` class + a React content component), rendered as Phase 1 of
`ExportBundleModal` (§8.2), ahead of the confirm & export phase. Closure
computation is `export-scope.ts`'s `buildClosure` (§6) — Obsidian-facing
(touches `metadataCache`), not inside a React component. Visual styling
goes in `styles.css` following the existing
`knowlery-health__*` / `knowlery-btn` / `knowlery-badge` conventions
referenced in §13.5, not new one-off classes.

---

## 15. Bundle install (0.6 — NOT in this release)

Recorded so 0.5.0 decisions are made with the consumer side in view. Nothing
here is 0.5.0 work except the invariant already pre-seeded in §5.1 (D15).
Reviewed and hardened after an external design pass (2026-07-02); every
addition below is a direct response to a gap that review found.

### 15.0 Guiding principle

**Install mounts external knowledge — it does not merge it.** A bundle
becomes a read-only, physically separate subtree the agent can also read,
never a set of pages folded into `entities/`/`concepts/`/`comparisons/`/
`queries/`. Every rule below is a consequence of this one sentence: no
merge means no content-level conflict to resolve at install time (0.7's
job), a clean structural exclusion invariant (§5.1/D15) instead of a fuzzy
provenance-tracking system, and "fork" — not "edit in place" — as the only
path from foreign content to owned content.

### 15.1 Location, identity & update policy

- **Location: in-vault, visible** — `Library/<bundle-id>/`. Obsidian
  browses it natively (standard markdown links render and navigate), it
  syncs with the vault (multi-device for free), and an agent running at the
  vault root can read it. Not a dot-folder (invisible in Obsidian) and not
  a `~/.knowlery` central store (07 §7.2's store belongs to the later
  headless/CLI era).
- **Never merged into the four knowledge dirs.** Foreign pages stay
  physically separate — for provenance, and because the user's own export
  closure must never traverse into someone else's content. Guaranteed
  structurally by §5.1's generalized exclusion invariant: any subtree with
  a `knowlery-bundle.json` is invisible to collection and backlink scans.
- **Update policy, keyed on `(id, version)` from the incoming manifest
  against the registry (§15.3):**
  - same `id`, **newer** `version` → update allowed; still a confirmation
    dialog (shows old → new version and what changes, from the two
    manifests), not silent, since a wholesale directory replace is
    destructive to any local fork-in-progress left inside `Library/<id>/`
    (there shouldn't be any, per read-only semantics, but confirm anyway).
  - same `id`, **same or older** `version` → block by default; require an
    explicit "Reinstall anyway" / "This will downgrade — continue?"
    confirmation. This is almost always either a duplicate install attempt
    or a genuine mistake, not a legitimate update.
  - **Multiple versions coexisting side by side is out of scope for 0.6.**
    One `Library/<id>/` slot per id, always the latest confirmed install.
    State this as a known limitation, not a silent gap.

### 15.2 Install flow & security invariants

Flow: pick zip/folder → **validate paths (below) before touching disk** →
preview the manifest and run the §5.7 conformance check → copy, register,
wire → "Open bundle index".

**P0 — path-traversal guard.** A bundle is an artifact from outside the
vault (someone else's export, a downloaded zip); it must be treated as
untrusted input before it is trusted as content. Before any file is
written under `Library/<bundle-id>/`:

1. Normalize every entry path from the zip/folder listing.
2. Reject the entire install (not just the offending entry) if any
   normalized path: contains a `..` segment, is absolute, or — after being
   joined to `Library/<bundle-id>/` and re-normalized — does not still
   start with `Library/<bundle-id>/`.
3. This is a hard invariant, asserted in code and covered by a test with a
   deliberately hostile fixture (an entry like `../../SCHEMA.md` or an
   absolute path), mirroring §5.8's export-side "never write outside the
   target dir" invariant and §10 criterion 6's pattern of a hard test
   assertion, not just a UI-level check.

**Conformance gate**: run §5.7's check against the incoming bundle before
install. Errors **block by default**; the install screen shows the report
and offers an explicit "Install anyway" override (mirrors D16's
safety-facts-first framing, applied to the receiving side). The chosen
outcome — `passed` / `failed` / `skipped` (user overrode) — is written to
the registry (§15.3) so an already-installed non-conformant bundle stays
visibly flagged, not silently forgotten.

### 15.3 Registry: `.knowlery/bundles.json`

```ts
interface InstalledBundlesFile {
  schemaVersion: 1;
  bundles: Record<string, {         // key = bundle id
    version: string;
    title: string;
    source: string;                 // original zip/folder path, for reference only
    installedAt: string;            // ISO
    libraryPath: string;            // "Library/<id>/"
    manifestContentHash: string;    // the bundle's own §5.6 contentHash, as shipped
    installedContentHash: string;   // re-hashed from the files actually written to Library/<id>/
    conformance: 'passed' | 'failed' | 'skipped';
    conformanceErrorCount: number;
  }>;
}
```

`manifestContentHash` and `installedContentHash` are deliberately two
fields, not one: the first answers "what did the exporter ship," the
second "what is actually sitting in `Library/<id>/` right now." They
should be equal immediately after install. If a user edits inside
`Library/<id>/` despite the read-only convention (nothing technically
prevents it — it's still just markdown in their vault), recomputing
`installedContentHash` on demand and comparing it to `manifestContentHash`
is how the dashboard would eventually surface "this installed copy has
drifted from what was installed" — a diagnostic, not an enforcement
mechanism, in 0.6.

Drives: the dashboard Bundles card ("installed" section, with a
non-conformant or drifted badge where applicable), update detection
(§15.1), and uninstall (§15.6).

### 15.4 Agent wiring: `KNOWLEDGE.md` marker block

Per the brainstorm's Option B: `KNOWLEDGE.md` is **not** regenerated on
every install/uninstall (it's already a one-shot template write per
`generateKnowledgeMd`, called only from setup/migration/manual-regenerate —
see `setup-executor.ts`, `legacy-byoao-migration.ts`, `settings.tsx`).
Install/uninstall must not add a fourth call site that rewrites the whole
file on every bundle change.

Instead, the retrieval-protocol addition is a **static instruction**,
inserted once (next time the template is regenerated after 0.6 ships) and
never content-dependent:

```md
<!-- KNOWLERY:INSTALLED_BUNDLES:BEGIN -->
9. If the question might be answered by an installed knowledge bundle,
   check `.knowlery/bundles.json` and read the relevant bundle's
   `Library/<id>/index.md`.
<!-- KNOWLERY:INSTALLED_BUNDLES:END -->
```

The HTML-comment markers exist so this region is **programmatically
identifiable and replaceable** without fragile prose-diffing against the
rest of the (user-editable-in-spirit) document — install never needs to
touch it (the instruction is generic, not per-bundle), but uninstalling
the *last* bundle needs to remove the block entirely (§15.6), and a future
template migration needs a safe re-insertion point. Marker-delimited
blocks for machine-owned regions inside otherwise-prose files are the same
pattern already implied by `generateKnowledgeMd`'s fully-templated
sections; this just makes one region independently addressable.

### 15.5 Fork to my knowledge

Copies one concept page from `Library/<id>/` into the user's own knowledge
dirs. **First version does not rewrite links.** The forked copy's
markdown links that point at sibling pages still inside `Library/<id>/`
are left as-is (still resolve, just point at the foreign bundle) —
attempting to detect "which other pages should also be forked" or convert
those links back to `[[wikilinks]]` is real complexity with real ways to
get it wrong, and isn't needed for a v1: a user who wants a linked page
too can fork it explicitly.

The forked file gains provenance extension keys (OKF-legal passthrough,
same pattern as §5.2's other extensions):

```yaml
forked_from_bundle: jay.1p-drone-delivery
forked_from_path: concepts/foo.md
forked_at: 2026-07-02T00:00:00.000Z
```

### 15.6 Uninstall

Nothing was merged, so uninstall is structurally complete — no reverse-diff
against the four knowledge dirs is possible or needed:

1. Delete `Library/<bundle-id>/`.
2. Remove the bundle's entry from `.knowlery/bundles.json` (§15.3).
3. If that was the **last** installed bundle, remove the entire
   `KNOWLERY:INSTALLED_BUNDLES` marker block (§15.4) from `KNOWLEDGE.md`
   rather than leaving an "Installed knowledge bundles: (none)" instruction
   pointing at an empty registry. Re-inserted fresh on the next install.

Pages the user forked (§15.5) are untouched — they are the user's own
content at that point, tracked only by the (now possibly dangling)
`forked_from_bundle` provenance key, which is left as historical record,
not cleaned up.

### 15.7 Explicitly deferred to 0.7+

Composition — provenance merge across multiple installed bundles, conflict
surfacing when two bundles disagree, coexisting versions of the same
bundle id — remains 0.7+, per 07 §9. Recipients who don't use Knowlery
need none of the above: the bundle folder + `index.md` + `README.md`
(§5.9) is directly consumable on its own — that is the point of OKF as the
distribution substrate.
