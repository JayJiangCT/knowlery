# Core Concepts

Knowlery is easiest to understand as a review layer on top of your vault. Your notes are the source material. Skills are reusable prompts. Rules are the guardrails. The dashboard turns recent activity into a small set of actions instead of a pile of options.

## Review Space

Knowlery is not trying to replace your notes. It keeps a boundary between human-authored markdown and agent-maintained review material.

The dashboard centers on five surfaces:

| Surface | Use |
| --- | --- |
| Today | Start from the current activity context and choose a next move |
| This note | Review the active Markdown note in context |
| Weekly Review | Generate a local Knowledge Atlas and optional polish request |
| Review Menu | Browse source skills and reusable review recipes |
| System | Run diagnostics and maintain configuration |

## Compiled Knowledge Layer

The setup wizard creates four top-level knowledge directories:

| Directory | Type | Use |
| --- | --- | --- |
| `entities/` | `entity` | People, tools, organizations, projects, products, systems |
| `concepts/` | `concept` | Ideas, frameworks, theories, mental models |
| `comparisons/` | `comparison` | Side-by-side analysis of related things |
| `queries/` | `query` | Saved questions, investigations, and research threads |

These pages are meant to be readable by humans and predictable for agents. The shape is guided by `SCHEMA.md`, but health checks only enforce a minimum frontmatter core.

## `KNOWLEDGE.md`

`KNOWLEDGE.md` is the vault's operating guide. It tells agents:

- Which directories belong to the agent and which belong to the user.
- How to retrieve knowledge with Obsidian-friendly commands.
- Which skills are available.
- How to cite vault sources with wikilinks.

Agents should read it early when working in the vault.

## `SCHEMA.md`

`SCHEMA.md` is a living convention file, not just a frontmatter template.

The current template groups guidance into:

- Knowledge Domains
- Tag Taxonomy
- Domain Taxonomy
- Agent Page Conventions
- Frontmatter Schema
- Page Thresholds
- Custom Fields

It encourages fields like `title`, `date`, `created`, `updated`, `type`, `tags`, and `sources`, plus optional fields such as `status`, `domain`, `description`, `references`, and `author`.

Health diagnostics still use a smaller minimum check for knowledge pages:

| Type | Minimum fields |
| --- | --- |
| Entity | `type`, `created` |
| Concept | `type`, `created` |
| Comparison | `type`, `items`, `created` |
| Query | `type`, `status`, `created` |

## `INDEX.base`

`INDEX.base` is an Obsidian Bases index over the compiled knowledge layer.

It groups and sorts knowledge pages, exposes useful properties, and gives agents a stable map before they start reading individual files.

## Skills and Review Menu

Skills are markdown prompt packages installed in `.agents/skills/<name>/SKILL.md`.

The Review Menu exposes the source skills behind the scenes:

| Skill | Purpose |
| --- | --- |
| `cook` | Digest notes into knowledge pages and keep `SCHEMA.md` taxonomy in sync |
| `ask` | Answer questions against vault content |
| `explore` | Trace timelines and find connections |
| `challenge` | Pressure-test beliefs and detect drift |
| `ideas` | Generate actionable ideas from vault content |
| `audit` | Scan agent-maintained directories for structural health issues |
| `organize` | Suggest vault restructuring |
| `obsidian-cli` | Work with Obsidian through CLI patterns |
| `obsidian-markdown` | Write Obsidian-flavored markdown |
| `obsidian-bases` | Work with Obsidian Bases files |
| `json-canvas` | Create and edit JSON Canvas files |
| `defuddle` | Extract clean markdown from web pages |
| `vault-conventions` | Document and enforce vault naming conventions |

The skill browser can install registry skills, and skill detail views can copy example prompts, open the source file, or run a skill through the configured agent CLI.

## Activity Ledger and Weekly Atlas

Knowlery records lightweight private activity receipts in `.knowlery/activity/` when logging is enabled.

Those receipts feed:

- Today thread summaries and next moves.
- This note suggestions.
- Weekly Review atlases in `.knowlery/reports/latest.html` and `.knowlery/reports/weekly/<week-label>.html`.
- Optional daily review requests and results in `.knowlery/requests/` and `.knowlery/reviews/`.

## Platform Adapters

Knowlery supports two agent platforms:

| Platform | Config file | Rules directory |
| --- | --- | --- |
| Claude Code | `.claude/CLAUDE.md` | `.claude/rules/` |
| OpenCode | `opencode.json` | `.agents/rules/` |

Switching platforms regenerates the target platform config and can migrate rules from the previous platform directory.

## Companion Chat

Knowlery can send prompts to a companion chat UI when it is available:

- Claudian for Claude Code.
- `obsidian-agent-client` for OpenCode.

That keeps review prompts inside the vault instead of pushing them into a separate app.

## Vault Health

The System tab checks two things:

- **Content structure:** note counts, wikilink counts, knowledge page counts, orphan notes, broken wikilinks, missing frontmatter.
- **Configuration integrity:** expected files, directories, rules, built-in skills, agent CLI detection, and platform config.
