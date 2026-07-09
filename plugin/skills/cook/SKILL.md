---
name: cook
description: >
  The core knowledge compilation skill. Reads raw notes and external sources, then
  distills them into structured, cross-referenced knowledge pages in entities/, concepts/,
  comparisons/, and queries/. Keeps SCHEMA.md tag and domain taxonomy in sync when new
  tags or domains appear. Use this skill whenever the user mentions compiling notes,
  digesting material, updating the knowledge base, running a cook cycle, or says anything
  like "process my notes", "compile this", "add this to the wiki", "what's new in my notes",
  or "update knowledge pages". Also activate when the user pastes external content and wants
  it integrated into the knowledge base.
---

# /cook — Knowledge Compilation

You are a knowledge compiler. Your job is to read raw material (user notes, external sources)
and distill it into structured, cross-referenced knowledge pages.

## Parameters

- **target** (optional): What to cook. Default: incremental (new/modified notes since last cook).
  - `--all` or `full`: Read all user notes in the vault
  - `"Topic Name"`: Read notes matching this keyword
  - `path/to/note.md`: Read a specific note
  - `<URL>`: Fetch external article and digest it

## Input Scope

### Incremental Mode (default)

When user runs `/cook` with no arguments, get the scope from the deterministic
staleness report (first transport available). If the knowlery MCP `stale` tool
is present, call it with the KB name — it is the same report; otherwise:

```bash
obsidian knowlery:stale
# or, with Obsidian closed:
knowlery stale
# or, with only Node available:
node .knowlery/bin/query.mjs --stale
```

The report has three parts:

1. **Stale pages** — compiled pages whose cited sources changed after the page was
   last written. Re-read only the listed changed sources and fold what changed into
   those pages.
2. **Uncooked notes** — user notes cited by no compiled page, most recent first. These
   are candidate new material; use judgment (or ask) about which are worth compiling —
   many notes are legitimately never compiled. Notes under `inbox/` are the exception:
   they were captured from conversations (MCP `capture`) precisely to be compiled —
   treat them as first-priority cook material.
3. **Dangling sources** — pages citing notes that no longer exist. Mention them in the
   report; fixing them is /audit territory.

Note: sync tools can rewrite file mtimes and produce a large stale list at once; that
is expected — cook selectively rather than mechanically.

**Fallback (degraded mode).** Only if neither transport is available: scan for `.md`
files outside agent directories modified since the last entry in `log.md`, and say
scope detection ran in degraded mode.

### Full Mode

When user runs `/cook --all`:
- Read all user notes in the vault (exclude `entities/`, `concepts/`, `comparisons/`, `queries/`)
- Re-evaluate all entities and concepts

### Targeted Mode

When user runs `/cook "Feature A"` or `/cook path/to/note.md`:
- Read only the specified notes or notes matching the keyword

### External URL

When user provides a URL:
1. Fetch content using WebFetch or Obsidian Web Clipper
2. Save as a user note in the vault (ask the user where to save, or use a sensible default like the vault root with a descriptive filename: `<slug>.md`)
3. Add frontmatter: `title`, `source_url`, `fetched` date
4. Process normally — the saved note becomes raw material for /cook

**Note:** No dedicated `raw/` directory. External material is saved as regular user notes, consistent with the brownfield principle.

## Processing Pipeline

### Step 1: Read & Parse
- Read all target notes
- Extract frontmatter, content, wikilinks
- Identify entities (named things), concepts (abstract ideas), decisions, contradictions

### Step 2: Match Against Existing Pages
- Check `INDEX.base` (Bases index in Obsidian) or scan `entities/`, `concepts/` for existing pages; use `obsidian properties` by `type` for a fast listing
- Determine: create new vs. update existing
- Read `SCHEMA.md` (Obsidian CLI) for current tag and domain taxonomy so new pages prefer existing tags when they fit

### Step 3: Create/Update Pages
- **New entities:** Create in `entities/<name>.md`
- **New concepts:** Create in `concepts/<name>.md`
- **Updates:** Add new information, bump `updated` date
- **Contradictions:** Follow Update Policy

**Record aliases (retrieval-aware compiling).** Lexical retrieval can only match what
is written down. On every page you create or update, record into `aliases` frontmatter:

- colloquial or team nicknames ("colld" for the collector daemon)
- abbreviations and acronyms (SLO, p95)
- the **cross-language title** whenever the sources are in a different language than
  the page (a page compiled from Chinese notes gets its Chinese name as an alias, and
  vice versa)

**Create page thresholds:**
- Appears in 2+ notes, OR is central subject of one note
- Do NOT create for: passing mentions, minor details, out-of-domain topics

**Writing tool:** prefer `obsidian create` when Obsidian is running (it keeps the
wikilink graph consistent). In headless environments, write the files directly with
identical frontmatter and naming conventions, and run `knowlery health` (or
`node .knowlery/bin/query.mjs --stale`) after bulk changes to verify the result.

### Step 4: Cross-Reference
- Ensure every new/updated page has at least 2 outbound wikilinks
- Check existing pages link back where relevant

### Step 5: Sync SCHEMA.md
After Step 3–4, reconcile agent pages touched this cycle with `SCHEMA.md`:

- Re-read `SCHEMA.md` if you have not just read it.
- If **any** new or updated agent page uses a `tag` not listed under **Current Tags** (or **Domain Taxonomy** / **Knowledge Domains** for a new `domain` value), **update `SCHEMA.md`** via Obsidian CLI: add the missing tag(s) or domain line(s), keep lists alphabetically sorted where the file already uses lists, and **preserve** unrelated sections and the user's prose.
- If every tag and domain on those pages already appears in `SCHEMA.md`, **do not** rewrite the file.
- Do **not** remove tags or domains from `SCHEMA.md` during /cook unless the user explicitly asked to prune taxonomy.
- Stay consistent with SCHEMA rules: singular tags, 2–5 tags per page on agent pages, new tags documented here before (or as soon as) use.

### Step 6: Update Navigation
- `INDEX.base` stays current in Obsidian via its Base query — suggest **`/wiki`** if views, filters, or columns need tuning after large cooks
- Append entry to `log.md` (human-readable history only — incremental scope comes from the staleness report, never from this file)

### Step 7: Report
Present structured summary (see Output Report Format below). Mention `SCHEMA.md` when you added tags or domains, or say it was unchanged.

## Contradiction Handling

### Detection
- Compare claims across notes about the same entity/concept
- Check dates — newer claims may supersede older
- Look for explicit contradictions (e.g., "we changed from X to Y")

### Resolution Workflow
1. Note both positions with dates and source references
2. Mark in frontmatter: `contradictions: [page-name]`
3. Report to user with specific sources
4. Offer to create a comparison page
5. User decides

### Update Policy
- Newer sources generally supersede older
- If both positions still valid (e.g., A/B testing), note both
- Never silently overwrite — always flag for review

## Output Report Format

```
Cook complete. Here's what changed:

New knowledge:
• [[feature-a]] — Response time monitoring feature
• [[response-time-metrics]] — Why median replaced avg

Updated:
• [[zhang-san]] — Added Feature A assignment

Contradiction found:
⚠ PRD says avg(response_time) > baseline, but experiment notes say median
  Sources: Projects/Feature-A-PRD.md vs Daily/2026-04-05.md
  Want me to create a comparison page?

Log: 1 entry added to log.md
SCHEMA.md: added tags: observability, backend (or: SCHEMA.md — no taxonomy changes)
```

**Design principles:**
- Natural language, no technical jargon
- Structured for quick scanning
- Actionable (asks for decisions on contradictions)
- Wikilinks for easy navigation

## Auto-Trigger Behavior

The Agent should automatically run `/cook` after:
- Writing a note (brief report: "Cooked 1 note. Updated [[x]], created [[y]].")
- User drops new files into the vault

**When NOT to auto-trigger:**
- Rapid-fire note creation (batch and cook once at the end)
- `/cook` was already run in the last 5 minutes

## Agent Page Identification

Agent pages are identified by directory:
| Location | Ownership |
|----------|-----------|
| `entities/**/*.md` | Agent |
| `concepts/**/*.md` | Agent |
| `comparisons/**/*.md` | Agent |
| `queries/**/*.md` | Agent |
| All other `.md` | User (read-only during /cook) |

No `owner` frontmatter field needed.

## Key Principles

- **Evidence-based**: Every knowledge page cites its sources
- **Never modify user notes**: User notes are read-only during /cook
- **Aliases are retrieval**: Record nicknames, abbreviations, and cross-language titles in `aliases` — a name that is not written down cannot be found
- **SCHEMA.md stays accurate**: New tags or domains on agent pages are reflected in `SCHEMA.md` in the same cook cycle when possible
- **Thresholds matter**: 2+ mentions or central subject to create a page
- **Split at 200 lines**: Break large pages into sub-topics
- **Flag contradictions**: Never silently overwrite
