# F4 — Fixed-Context Slim-Down

- **Status:** Draft — awaiting maintainer spec acceptance
- **Target release:** 0.6.0 (final feature)
- **Branch:** `cursor/f4-context-slimdown-92eb` (stacked on F3)
- **Depends on:** F2/F5 (retrieval no longer needs INDEX.base or SCHEMA.md in fixed context)

## 1. Problem statement

`generateClaudeMd` injects three files into **every** Claude Code session:

```
@../KNOWLEDGE.md
@../SCHEMA.md
@../INDEX.base
```

and `generateOpenCodeJson` mirrors this in `instructions`. Two of the three are the
wrong things to pay for on every conversation:

- **`SCHEMA.md` grows without bound** — the tag and domain taxonomy tables are designed
  to accumulate with every cook cycle. It is a fixed token tax with a monotonically
  rising rate, charged even to conversations that never touch the knowledge base.
- **`INDEX.base` is Base view YAML** — configuration for Obsidian's UI, useless as
  inline prompt context. Its retrieval role is gone: F2/F5 replaced index-driven
  discovery with the deterministic query engine.

First principles: fixed context should be minimal and constant-size; everything else is
retrieved on demand. `KNOWLEDGE.md` is the operating card (ownership boundary, CLI
rules, retrieval procedure, skill table) and stays. The other two become on-demand
reads.

## 2. Goals

1. New vaults: fixed context imports `KNOWLEDGE.md` + rules only, for both platforms.
2. Existing vaults: a non-destructive, once-per-version migration removes exactly the
   two stale import lines / entries, preserving all user content.
3. On-demand discipline is written where agents will see it: `KNOWLEDGE.md` explicitly
   instructs reading `SCHEMA.md` before creating or re-tagging knowledge pages.

## 3. Non-goals

- No rewrite of `KNOWLEDGE.md`'s content beyond the on-demand instruction — its
  ~90 lines are the operating card and earn their place; shrinking it further is not
  worth the churn in this release.
- No skill changes: `/cook` already reads `SCHEMA.md` on demand (Steps 2 and 5);
  `/ask` stopped needing it in F2.
- No change to the managed rule-imports block mechanism (`rule-imports.ts`).

## 4. Design

### 4.1 Templates (`src/assets/templates.ts`)

- `generateClaudeMd`: emit `@../KNOWLEDGE.md` + rule imports; drop `@../SCHEMA.md` and
  `@../INDEX.base`.
- `generateOpenCodeJson`: `instructions: ['KNOWLEDGE.md', '.agents/rules/*.md']`.
- `generateKnowledgeMd`: in Writing Conventions, strengthen the schema line to an
  explicit on-demand instruction: read `SCHEMA.md` (tag/domain taxonomy) before
  creating or re-tagging knowledge pages; keep the `base:query` row in the CLI table
  (INDEX.base remains an on-demand tool, just not inline context).

### 4.2 Migration (`src/core/migration.ts`)

`migrateFixedContextImports(app)`, called from the existing once-per-version sync block
in `main.ts` (next to `migrateSchemaMd`):

- **`.claude/CLAUDE.md`** (if it exists): remove lines that are exactly
  `@../SCHEMA.md` or `@../INDEX.base` (trimmed match), touch nothing else. Idempotent;
  user content and the managed rule-imports block are untouched. Write only when
  changed.
- **`opencode.json`** (if it exists and parses): filter `instructions` entries equal to
  `SCHEMA.md` or `INDEX.base`; keep all other keys byte-for-byte via parse/stringify of
  only this field's change. On parse failure, leave the file alone (user-owned config;
  never risk corrupting it). Write only when changed.

### 4.3 What agents still get, and where

| Content | Before | After |
|---|---|---|
| Operating card (`KNOWLEDGE.md`) | fixed context | fixed context (unchanged) |
| Rules | fixed context | fixed context (unchanged) |
| Taxonomy (`SCHEMA.md`) | fixed context, grows forever | on-demand read in `/cook` + write-time instruction in `KNOWLEDGE.md` |
| Index (`INDEX.base`) | fixed context (raw YAML) | on-demand `base:query` tool; discovery via `knowlery:query` |

## 5. Risks

- **R1 — an agent writes pages without reading SCHEMA.md.** Mitigated by the explicit
  write-time instruction in `KNOWLEDGE.md` and `/cook`'s existing Steps 2/5; residual
  drift is exactly what `/audit`'s taxonomy check and SCHEMA sync exist for.
- **R2 — migration touches a user-edited file.** The CLAUDE.md edit is
  exact-line-match removal only; the opencode.json edit is a single-array filter with
  a parse-failure bail-out. Both follow the 0.3.5 non-destructive precedent.
- **R3 — a user deliberately re-added the imports.** They would be removed once on
  upgrade. Accepted: the removal happens once per version, so re-adding after the
  upgrade sticks; called out in release notes.

## 6. Acceptance criteria

1. Fresh setup (both platforms) produces fixed context without `SCHEMA.md` /
   `INDEX.base`; `syncClaudeRuleImports` keeps working against the new template.
2. Migration on a vault with the 0.5.0-era CLAUDE.md removes exactly the two lines,
   preserves user content and the rule-imports block, and is idempotent (second run:
   no write). Same for `opencode.json`, including the malformed-JSON bail-out.
3. `KNOWLEDGE.md` template contains the read-SCHEMA-before-writing instruction.
4. Unit tests cover: both templates, CLAUDE.md line removal + idempotence + user-content
   preservation, opencode.json filtering + bail-out.
5. `npm test`, `npm run lint`, `npm run build`, `npm run eval -- --assert-baseline` all
   green; baseline and F2 thresholds untouched.

## 7. Maintainer self-test checklist (acceptance round)

1. Build the branch, install the dev build in your real vault (which has the 0.5.0-era
   `.claude/CLAUDE.md`), reload Obsidian.
2. Diff `.claude/CLAUDE.md` — exactly the `@../SCHEMA.md` and `@../INDEX.base` lines
   gone; your own edits and the rule-imports block intact.
3. Start a fresh Claude Code session in the vault; confirm it still follows the
   operating rules (ownership boundary, retrieval via `knowlery:query`) and that
   `/cook` still reads `SCHEMA.md` before tagging.
4. Reload Obsidian again — no further writes to `.claude/CLAUDE.md` (idempotence).
5. `npm test && npm run eval -- --assert-baseline` — green.

## 8. Out of scope, deferred

- Trimming `KNOWLEDGE.md` itself — revisit if session-start telemetry ever justifies it.
- 0.7 backlog unchanged (retrieval-aware `/cook`, `/audit` on CLI primitives).
