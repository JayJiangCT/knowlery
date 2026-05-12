# Reference

This reference lists the files, commands, skills, and safety boundaries used by Knowlery.

## Plugin Metadata

| Field | Current value |
| --- | --- |
| Plugin ID | `knowlery` |
| Minimum Obsidian app version | `1.7.2` |
| Desktop-only manifest flag | `true` |
| Main bundle | `main.js` |
| Stylesheet | `styles.css` |

## Created Files and Folders

| Path | Created by setup | Notes |
| --- | --- | --- |
| `KNOWLEDGE.md` | Yes | Vault operating guide |
| `SCHEMA.md` | Yes | Knowledge taxonomy and page conventions |
| `INDEX.base` | Yes | Bases index |
| `entities/` | Yes | Agent-maintained entity pages |
| `concepts/` | Yes | Agent-maintained concept pages |
| `comparisons/` | Yes | Agent-maintained comparison pages |
| `queries/` | Yes | Agent-maintained research threads |
| `.knowlery/manifest.json` | Yes | Setup state |
| `.agents/skills/` | Yes | Canonical skills |
| `.agents/rules/` | OpenCode path | Rules for OpenCode |
| `.claude/skills/` | Yes | Mirrored built-in skills for Claude Code |
| `.claude/CLAUDE.md` | Claude Code path | Claude instructions |
| `.claude/rules/` | Claude Code path | Rules for Claude Code |
| `opencode.json` | OpenCode path | OpenCode config |
| `skills-lock.json` | Yes | Skill lock state |

## Built-In Skills

| Name | Kind | Purpose |
| --- | --- | --- |
| `cook` | knowledge | Digest notes into knowledge pages and keep `SCHEMA.md` aligned |
| `ask` | knowledge | Answer questions from vault content |
| `explore` | knowledge | Trace idea timelines and bridges |
| `challenge` | knowledge | Pressure-test beliefs and drift |
| `ideas` | knowledge | Generate ideas from vault content |
| `audit` | knowledge | Scan agent-maintained directories for structural health issues |
| `organize` | knowledge | Suggest structure improvements |
| `obsidian-cli` | tooling | Use Obsidian CLI patterns |
| `obsidian-markdown` | tooling | Write Obsidian markdown |
| `obsidian-bases` | tooling | Work with Bases files |
| `json-canvas` | tooling | Work with JSON Canvas |
| `defuddle` | tooling | Extract clean markdown from web pages |
| `vault-conventions` | tooling | Enforce vault naming conventions |

## Default Rule Templates

Knowlery includes default rule templates for:

| Rule | Purpose |
| --- | --- |
| Citation required | Require wikilink citations for vault answers |
| Language preference | Match the user's language |
| Domain context | Describe the vault's domain |

## Commands Registered in Obsidian

Knowlery registers command palette actions for opening the dashboard, initializing the vault, running diagnosis, and switching platforms.

The exact labels may evolve with the plugin UI, but the command surface is centered on setup, dashboard access, health, and platform migration.

## Network Use

Knowlery does not collect telemetry.

Network access can happen when you explicitly use skill registry features through `npx skills ...`. That command may contact services used by the external skills tooling.

## Local Command Use

Knowlery can run local commands when you explicitly use CLI-related features or optional setup preparation.

Examples include:

- `claude`
- `opencode`
- `node`
- `npx`
- `skills`

These commands run on your computer with your user permissions.

## Upgrade Behavior

When the plugin version changes, Knowlery refreshes bundled skills in `.agents/skills/` and `.claude/skills/`, and migrates `SCHEMA.md` by inserting any missing anchor sections.

Custom and forked skills are preserved. Disabled built-in skills keep their disabled state, even though the on-disk bundled copy is refreshed.

## Deletion Behavior

Knowlery may remove skill or rule files when you use delete or disable actions in the UI.

It should not delete ordinary user notes during setup. Still, test first and use version control or backups for important vaults.
