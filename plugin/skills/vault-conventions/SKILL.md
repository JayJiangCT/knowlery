---
name: vault-conventions
description: Use when creating or modifying notes in a Knowlery-structured vault (formerly BYOAO). Enforces frontmatter requirements, wikilinks, and naming conventions.
---

# Vault Document Conventions

You MUST follow these conventions when creating or modifying any note in this vault.

## Pre-Flight Checklist

Before creating any note:

1. Read `AGENTS.md` — check the knowledge base structure (user notes vs agent-maintained pages)
2. Decide where the note belongs: **user notes** stay in their existing areas (e.g. `Projects/`, `Daily/`); **agent knowledge pages** live only under `entities/`, `concepts/`, `comparisons/`, or `queries/`
3. Pick the writing tool by the operation (see Creating Notes below), following every convention in this skill

## Creating Notes

Choose the writing tool **by the operation, not by whether Obsidian is running**:

| Operation | Preferred tool | Why |
|-----------|----------------|-----|
| New page with long or complex content (frontmatter + body, code blocks, quotes) | Write the `.md` file directly at the exact path | Obsidian indexes new files automatically; no shell escaping can corrupt content |
| Short new note, or appending a line or two | `obsidian create path="dir/note.md" content="..."` / `obsidian append` | Cheap when the content is small; `\n` escapes newlines |
| Rename / move an existing note | `obsidian rename` (Obsidian running) | The CLI rewrites wikilinks across the vault — the real graph-consistency win |

`obsidian create` passes content as **one shell-quoted argument**. Inside a
bash double-quoted string, backticks run as command substitution, `$` expands,
and nested quotes end the argument — so a page containing a code fence or
quoted prose will usually break the command or corrupt the content. **If
`create` fails once on content escaping, do not fight the shell: write the
file directly** with identical frontmatter and naming conventions, then verify
with `obsidian read` (or `knowlery health` after bulk changes).

When you do use `obsidian create`, pass `path="dir/note.md"` — `name=`
resolves like a wikilink and lands in the default new-note location, not
necessarily the directory the page belongs in.

In headless environments (Obsidian closed, CLI-initialized workspaces), write
`.md` files directly, and run `knowlery health` after bulk changes.

## Required Frontmatter

Every note MUST have these fields:

| Field | Values |
|-------|--------|
| `title` | Descriptive title |
| `type` | `meeting`, `idea`, `reference`, `daily`, `project`, `person`, `entity`, `concept`, `comparison`, `query`, etc. |
| `date` | YYYY-MM-DD — today's date or extracted from content |
| `tags` | Array of relevant tags |

Additional fields (optional):

| Field | Purpose |
|-------|---------|
| `domain` | Knowledge area (e.g. ai-agents, product-strategy) |
| `references` | Related notes as wikilinks: `[[Note Name]]` |
| `status` | `draft`, `active`, `completed`, `archived` |
| `updated` | YYYY-MM-DD — last substantive edit (common on agent pages) |
| `contradictions` | Cross-links when conflicting claims need review (agent pages) |

## Wikilink Rules

ALWAYS use wikilinks for:

- People → `[[Person Name]]`
- Projects → `[[Project Name]]`
- Domain concepts → `[[Concept Name]]`
- Related notes → `[[Note Name]]`

Rules:
- Use `[[wikilinks]]` for internal vault connections
- Use `[text](url)` for external URLs only
- Use `[[Note Name#Heading]]` for specific section links
- Use `[[Note Name|Display Text]]` for custom display text

## File Naming

- **Agent knowledge pages** (per `SCHEMA.md`): lowercase with hyphens, no spaces
  (`response-time-metrics.md`); one topic per file under `entities/`, `concepts/`,
  `comparisons/`, or `queries/`
- **User notes** keep the user's own naming — never rename them to match agent conventions
- No special characters, no leading/trailing spaces
- Daily notes: `YYYY-MM-DD` format where applicable

## Post-Creation Verification

After creating or modifying a note, verify:

1. All required frontmatter fields are present and correct
2. People and project mentions use `[[wikilinks]]`
3. Domain concepts are linked consistently
