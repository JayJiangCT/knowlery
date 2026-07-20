---
name: obsidian-cli
description: Interact with Obsidian vaults using the Obsidian CLI to read, create, search, and manage notes, tasks, properties, and more. Also supports plugin and theme development with commands to reload plugins, run JavaScript, capture errors, take screenshots, and inspect the DOM. Use when the user asks to interact with their Obsidian vault, manage notes, search vault content, perform vault operations from the command line, or develop and debug Obsidian plugins and themes.
---

# Obsidian CLI

Use the `obsidian` CLI to interact with a running Obsidian instance. Requires Obsidian to be open.

## Command reference

Run `obsidian help` to see all available commands. This is always up to date. Full docs: https://help.obsidian.md/cli

## Syntax

**Parameters** take a value with `=`. Quote values with spaces:

```bash
obsidian create name="My Note" content="Hello world"
```

**Flags** are boolean switches with no value:

```bash
obsidian create name="My Note" silent overwrite
```

For multiline content use `\n` for newline and `\t` for tab.

## Writing long or complex content

`content=` is a **single shell-quoted argument**, and three bash hazards apply
inside it: backticks run as command substitution, `$` expands variables, and
nested double quotes end the argument. Any page carrying a code fence, LaTeX,
or quoted prose will usually break the command or corrupt the written content —
on top of the `\n` escaping that multiline content already needs.

- **Short content** (a heading, a line or two): `obsidian create` / `obsidian append` are fine.
- **Full pages** (frontmatter + body, Mermaid or other charts, code fences,
  tables): write the `.md` file directly with your file tools — Obsidian
  indexes new files automatically — then verify with `obsidian read path="..."`.
- Always pass `path="dir/note.md"` when the note must land in a specific folder;
  `name=` resolves like a wikilink and uses the default new-note location.
- If `create` fails once on escaping, switch to a direct file write; do not retry
  with more escaping.

## File targeting

Many commands accept `file` or `path` to target a file. Without either, the active file is used.

- `file=<name>` — resolves like a wikilink (name only, no path or extension needed)
- `path=<path>` — exact path from vault root, e.g. `folder/note.md`

Dot-directories (`.claude/`, `.knowlery/`, `.agents/`, `.obsidian/`) are
outside Obsidian's vault index. File-targeting commands that depend on that
index — including `read` and `create`, even with `path=` — cannot reach
them. Read or write those paths directly with your file tools. This is an
expected boundary; do not retry the Obsidian CLI. The CLI may print an
`Error:` while still exiting with status 0, so require a `Created: <path>`
result and verify important writes.

## Vault targeting

Commands target the most recently focused vault by default. Use `vault=<name>` as the first parameter to target a specific vault:

```bash
obsidian vault="My Vault" search query="test"
```

## Common patterns

```bash
obsidian read file="My Note"
obsidian create name="New Note" content="# Hello" template="Template" silent
obsidian append file="My Note" content="New line"
obsidian rename file="old-path.md" new_name="new-path.md"
obsidian search query="search term" limit=10
obsidian search:context query="search term"
obsidian daily:read
obsidian daily:append content="- [ ] New task"
obsidian property:set name="status" value="done" file="My Note"
obsidian tasks daily todo
obsidian tags sort=count counts
obsidian backlinks file="My Note"
```

Use `--copy` on any command to copy output to clipboard. Use `silent` to prevent files from opening. Use `total` on list commands to get a count.

## Plugin development

### Develop/test cycle

After making code changes to a plugin or theme, follow this workflow:

1. **Reload** the plugin to pick up changes:
   ```bash
   obsidian plugin:reload id=my-plugin
   ```
2. **Check for errors** — if errors appear, fix and repeat from step 1:
   ```bash
   obsidian dev:errors
   ```
3. **Verify visually** with a screenshot or DOM inspection:
   ```bash
   obsidian dev:screenshot path=screenshot.png
   obsidian dev:dom selector=".workspace-leaf" text
   ```
4. **Check console output** for warnings or unexpected logs:
   ```bash
   obsidian dev:console level=error
   ```

### Additional developer commands

Run JavaScript in the app context:

```bash
obsidian eval code="app.vault.getFiles().length"
```

Inspect CSS values:

```bash
obsidian dev:css selector=".workspace-leaf" prop=background-color
```

Toggle mobile emulation:

```bash
obsidian dev:mobile on
```

Run `obsidian help` to see additional developer commands including CDP and debugger controls.
