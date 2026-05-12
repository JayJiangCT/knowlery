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

## Dashboard Surfaces

| Surface | Purpose |
| --- | --- |
| Today | Current activity summary and next move |
| This note | Active note review and prompt preparation |
| Weekly Review | Atlas generation and daily review polish |
| Review Menu | Suggested moves and source skills |
| System | Diagnostics and configuration maintenance |

## Created Files and Folders

| Path | Created by | Notes |
| --- | --- | --- |
| `KNOWLEDGE.md` | Setup | Vault operating guide |
| `SCHEMA.md` | Setup | Knowledge taxonomy and page conventions |
| `INDEX.base` | Setup | Bases index |
| `entities/` | Setup | Agent-maintained entity pages |
| `concepts/` | Setup | Agent-maintained concept pages |
| `comparisons/` | Setup | Agent-maintained comparison pages |
| `queries/` | Setup | Agent-maintained research threads |
| `.knowlery/manifest.json` | Setup | Setup state |
| `.agents/skills/` | Setup | Canonical skills |
| `.agents/rules/` | OpenCode | Rules for OpenCode |
| `.claude/skills/` | Setup | Mirrored built-in skills for Claude Code |
| `.claude/CLAUDE.md` | Claude Code | Claude instructions |
| `.claude/rules/` | Claude Code | Rules for Claude Code |
| `opencode.json` | OpenCode | OpenCode config |
| `skills-lock.json` | Setup | Skill lock state |
| `.knowlery/activity/` | Activity logging | Private activity receipts |
| `.knowlery/reports/` | Weekly Review | Local Knowledge Atlas output |
| `.knowlery/requests/` | Daily polish | Daily review requests |
| `.knowlery/reviews/` | Daily polish | Daily review results |

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

## Settings Sections

| Section | What it controls |
| --- | --- |
| General | Knowledge base name and Node.js path |
| Platform | Claude Code / OpenCode switching |
| Activity | Activity logging and activity ledger rule |
| Maintenance | Regenerate agent config and re-initialize vault |

## Default Rule Templates

Knowlery includes default rule templates for:

| Rule | Purpose |
| --- | --- |
| Citation required | Require wikilink citations for vault answers |
| Language preference | Match the user's language |
| Domain context | Describe the vault's domain |

## Commands Registered in Obsidian

Knowlery registers command palette actions for:

- Opening the dashboard.
- Initializing the vault.
- Running vault diagnosis.
- Adding a reflection.
- Switching platforms.

The exact labels may evolve with the plugin UI, but the command surface is centered on review, setup, diagnosis, and platform migration.

## Activity Ledger

Activity receipts live in `.knowlery/activity/YYYY-MM-DD.jsonl`.

They are private summaries, not normal knowledge pages. The activity toggle in settings can disable logging by writing `.knowlery/activity-disabled`.

## Weekly Atlas and Daily Review

Weekly Review writes HTML output to:

- `.knowlery/reports/latest.html`
- `.knowlery/reports/weekly/<week-label>.html`

Daily review polish uses:

- `.knowlery/requests/daily-review-YYYY-MM-DD.json`
- `.knowlery/reviews/daily-review-YYYY-MM-DD.json`

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
