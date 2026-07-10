---
name: organize
description: >
  Directory organization based on frontmatter metadata. Suggests and applies file moves
  to keep the vault structured. Use when the user wants to reorganize notes, fix directory
  placement, clean up the vault structure, or says anything like "organize my notes",
  "clean up the vault", "move files to the right folders", "tidy up", or "restructure
  my notes".
---

# /organize — Directory Organization

You are a librarian. Your job is to ensure every note lives in the right place based on its frontmatter metadata, type, and domain — and to suggest improvements to the overall vault structure.

## Parameters

- **scope** (optional): `all` (full vault), `agents` (agent pages only), `sources` (user notes), or a specific directory. Default: `all`.
- **dry_run** (optional): `true` to only suggest, `false` to apply changes. Default: `true`.

## Process

### Step 1: Scan Current Structure

Start from the orientation map — the compiled layer, bundles, and
stale/uncooked counts, precomputed:

```bash
knowlery index    # or read the MCP knowlery://<kb>/index resource
obsidian list
```

Build a picture of:
- Current directory structure
- Notes in each directory
- Notes that seem misplaced based on their frontmatter

### Step 2: Check Agent Pages

Agent pages should live in their designated directories:

| `type` frontmatter | Expected directory |
|-------------------|-------------------|
| `entity` | `entities/` |
| `concept` | `concepts/` |
| `comparison` | `comparisons/` |
| `query` | `queries/` |

For each agent page, check:
- Does its current directory match its `type`?
- If not, suggest a move

### Step 3: Check User Notes

User notes should **remain** in their existing directories (`Projects/`, `Daily/`, personal folders, etc.). Do not suggest moving them into agent directories. Suggest organization only if:

- A user note has been placed in an agent directory (`entities/`, `concepts/`, `comparisons/`, `queries/`) — this is likely a mistake; propose moving it back to an appropriate user area
- Multiple user notes about the same topic are scattered across **user** directories when they could be grouped there (never into agent dirs unless they are true agent pages with correct `type` frontmatter)

### Step 4: Check Naming Conventions

Per SCHEMA.md conventions:
- File names should be lowercase with hyphens, no spaces
- Names should match the page title (abbreviated, hyphenated)
- No duplicate names with different suffixes (e.g., `feature-a.md` and `feature-a-1.md`)

Flag any naming violations.

### Step 5: Suggest Moves

For each misplaced file:

```
Move: entities/wrong-place.md → concepts/wrong-place.md
  Reason: type=concept but currently in entities/

Move: Projects/random-notes.md → Projects/feature-a/
  Reason: Content is about Feature A, should be grouped with other Feature A notes
```

### Step 6: Apply Moves (If Confirmed)

Prefer Obsidian CLI to rename/move files (it updates wikilinks automatically):

```bash
obsidian rename file="old-path.md" new_name="new-path.md"
```

In headless environments, move the files directly, then check for broken wikilinks
yourself (moved-page names grepped across the vault) and run `knowlery health` after
bulk changes.

Always show the full plan before applying. Never move files silently.

### Step 7: Update Wikilinks

After moving files, check that all wikilinks to the moved files are still valid:

```bash
obsidian backlinks "moved-file"
```

Obsidian typically handles wikilink updates on rename automatically, but verify for safety.

## Key Principles

- **Suggest first, act second.** Default to dry_run mode. Show the full plan before making any changes.
- **Agent directories are sacred.** Only agent pages should live in `entities/`, `concepts/`, `comparisons/`, `queries/`.
- **User notes are user territory.** Suggest organizational improvements but never move user notes without explicit confirmation.
- **Obsidian first, headless second.** Prefer Obsidian CLI for note operations; in headless environments work with files directly under the same conventions.
