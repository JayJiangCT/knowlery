---
name: byoao-conventions
description: Use when creating or modifying notes in a BYOAO-structured vault. Enforces frontmatter requirements, wikilinks, and naming conventions.
---

# BYOAO Document Conventions

You MUST follow these conventions when creating or modifying any note in this vault.

## Pre-Flight Checklist

Before creating any note:

1. Read `AGENTS.md` — check the knowledge base structure (user notes vs agent-maintained pages)
2. Decide where the note belongs: **user notes** stay in their existing areas (e.g. `Projects/`, `Daily/`); **agent knowledge pages** live only under `entities/`, `concepts/`, `comparisons/`, or `queries/`
3. Prefer `obsidian create` when Obsidian is running; in headless environments write the file directly, following every convention below

## Creating Notes

Prefer `obsidian create` when Obsidian is running (it keeps the wikilink graph
consistent):

```
obsidian create name="Note Title" content="<frontmatter + content>" silent
```

For multiline content use `\n` for newline and `\t` for tab.

In headless environments (Obsidian closed, CLI-initialized workspaces), write the
`.md` file directly with identical frontmatter and naming conventions, and run
`knowlery health` after bulk changes.

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

- Use Title Case or kebab-case for file names
- No special characters, no leading/trailing spaces
- Daily notes: `YYYY-MM-DD` format where applicable
- Agent knowledge pages: one topic per file under `entities/`, `concepts/`, `comparisons/`, or `queries/`

## Post-Creation Verification

After creating or modifying a note, verify:

1. All required frontmatter fields are present and correct
2. People and project mentions use `[[wikilinks]]`
3. Domain concepts are linked consistently
