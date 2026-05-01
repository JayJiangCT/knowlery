# Core Concepts

Knowlery is easiest to understand as a small kitchen for your vault. Your notes are the ingredients. Skills are recipes. Rules are kitchen habits. The agent cooks structured knowledge pages that remain readable in plain markdown.

## Knowledge Cookery

Knowledge cookery means turning raw notes into maintained, structured knowledge.

Knowlery does not replace your personal notes. It creates a separate compiled layer that agents can update while preserving the boundary between human notes and agent-maintained pages.

## The Compiled Knowledge Layer

The setup wizard creates four top-level knowledge directories:

| Directory | Type | Use |
| --- | --- | --- |
| `entities/` | `entity` | People, tools, organizations, projects, products, systems |
| `concepts/` | `concept` | Ideas, frameworks, theories, mental models |
| `comparisons/` | `comparison` | Side-by-side analysis of related things |
| `queries/` | `query` | Saved questions, investigations, and research threads |

These pages are meant to be readable by humans and predictable for agents. The shape is defined in `SCHEMA.md`.

## `KNOWLEDGE.md`

`KNOWLEDGE.md` is the vault's operating guide. It explains:

- Which directories belong to the agent.
- Which directories belong to the user.
- How the agent should retrieve knowledge.
- Which skills are available.
- How to cite vault sources with wikilinks.

Agents should read it early when working in the vault.

## `SCHEMA.md`

`SCHEMA.md` defines the frontmatter expected for each knowledge page type.

The current schema covers:

| Type | Required shape |
| --- | --- |
| Entity | `type`, `aliases`, `tags`, `created`, `updated` |
| Concept | `type`, `aliases`, `tags`, `related`, `created`, `updated` |
| Comparison | `type`, `items`, `tags`, `created`, `updated` |
| Query | `type`, `status`, `tags`, `created`, `updated` |

Health diagnostics use this structure to find missing frontmatter in knowledge directories.

## `INDEX.base`

`INDEX.base` is an Obsidian Bases index over the compiled knowledge layer.

It groups and sorts knowledge pages, exposes useful properties, and gives agents a stable map before they start reading individual files.

## Skills

Skills are markdown prompt packages installed in `.agents/skills/<name>/SKILL.md`.

Knowlery currently ships these built-in skills:

| Skill | Purpose |
| --- | --- |
| `cook` | Digest notes into knowledge pages and maintain `INDEX.base` |
| `ask` | Answer questions against vault content |
| `explore` | Trace timelines and find connections |
| `challenge` | Pressure-test beliefs and detect drift |
| `ideas` | Generate actionable ideas from vault content |
| `audit` | Check vault health and structural integrity |
| `organize` | Suggest vault restructuring |
| `obsidian-cli` | Work with Obsidian through CLI patterns |
| `obsidian-markdown` | Write Obsidian-flavored markdown |
| `obsidian-bases` | Work with Obsidian Bases files |
| `json-canvas` | Create and edit JSON Canvas files |
| `defuddle` | Extract clean markdown from web pages |
| `vault-conventions` | Document and enforce vault naming conventions |

## Rules

Rules are markdown instructions for agent behavior. Knowlery installs default rule templates and lets you add, edit, view, or delete rules from the Config tab.

Claude Code rules live in `.claude/rules/`. OpenCode rules live in `.agents/rules/`.

## Platform Adapters

Knowlery supports two agent platforms:

| Platform | Config file | Rules directory |
| --- | --- | --- |
| Claude Code | `.claude/CLAUDE.md` | `.claude/rules/` |
| OpenCode | `opencode.json` | `.agents/rules/` |

Switching platforms regenerates the target platform config and can migrate rules from the previous platform directory.

## Vault Health

The Health tab checks two things:

- **Content structure:** note counts, wikilink counts, knowledge page counts, orphan notes, broken wikilinks, missing frontmatter.
- **Configuration integrity:** expected files, directories, rules, built-in skills, agent CLI detection, and platform config.
