# Core Concepts

Knowlery is easiest to understand as a review layer on top of your vault. Your notes are the source material. Skills are reusable prompts. Rules are the guardrails. The dashboard turns recent activity into a small set of actions, while Obsidian settings holds the deeper maintenance tools.

## One Core, Three Shells

The same knowledge-base lifecycle is available in three shells over one workspace format:

| Shell | Gets you | Install |
| --- | --- | --- |
| Obsidian plugin | Everything: review space, Knowledge health UI, live in-app retrieval, plus all lifecycle operations | Community plugins |
| `knowlery` CLI | The full lifecycle — `init` / `sync` / `health` / `query` / `stale` / `kb` / `bundle …` — for terminals, agents, and headless environments | `npm i -g knowlery` |
| MCP server | `knowlery mcp` (stdio) and `knowlery mcp serve` (remote HTTP): tools, skills-as-prompts, and pages-as-resources for any MCP-capable agent | ships with the CLI |

A folder initialized by the CLI opens in Obsidian with zero migration, and any Knowlery vault works with the CLI as-is. All shells share one implementation of sync and migrations, and the workspace records which Knowlery version last synced it — an older shell refuses to sync rather than downgrade what a newer one upgraded. See [Agents & MCP](../guides/agents-mcp) for the MCP surface.

## Review Space

Knowlery is not trying to replace your notes. It keeps a boundary between human-authored markdown and agent-maintained review material.

The dashboard is one action-first home:

| Section | Use |
| --- | --- |
| Today's move | Start from the current activity context and choose a next move |
| Suggested moves | Pick a reusable review prompt without browsing raw skill files |
| Knowledge health | See compiled pages whose sources changed and notes never compiled, with a re-cook prompt |
| This note | Review the active Markdown note in context |
| Recent activity | Scan recent private activity receipts |
| This week | Generate and review a weekly summary |
| Bundles | Share reviewed knowledge bundles and manage installed ones |

Diagnostics, rules, schema shortcuts, platform switching, and the Skills library live under **Settings -> Knowlery**.

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

It groups and sorts knowledge pages and exposes useful properties for humans browsing in Obsidian. Agents can still query it on demand with `obsidian base:query`, but candidate location for questions goes through the deterministic retrieval engine below.

## Deterministic Retrieval

Since 0.6.0, finding candidate pages for a question is one deterministic command with two transports running the same engine:

| Transport | When | Command |
| --- | --- | --- |
| In-app CLI | Obsidian running (1.12.2+, CLI enabled) | `obsidian knowlery:query question="..." [k=<n>] [json]` |
| Headless script | Obsidian closed, plain Node | `node .knowlery/bin/query.mjs "..." [--k <n>] [--json]` |

The engine scans compiled pages, user notes, and installed bundles; scores with field weights (title/aliases over tags, description, then body); matches light word variants and Chinese phrases; credits a compiled page when a raw note it cites matches the question (so cross-language questions reach the compiled answer); and returns an explicit `No confident matches` verdict instead of noise.

The same machinery reports mechanical staleness:

- `obsidian knowlery:stale` or `node .knowlery/bin/query.mjs --stale` lists compiled pages whose cited sources changed after the page was last written, user notes cited by no compiled page, and dangling `sources` references.
- The dashboard's Knowledge health section shows the same report, and `/cook`'s incremental mode uses it as its scope (`log.md` remains as append-only history).

Retrieval quality is measured: the repository ships an evaluation harness (`evals/`) with a golden question set, a frozen baseline of the old retrieval flow, and CI checks that hold every change to at least the current scores.

## Skills and Suggested Moves

Skills are markdown prompt packages installed in `.agents/skills/<name>/SKILL.md`.

The dashboard exposes natural-language moves first, and the settings tab exposes the source skills behind the scenes:

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

The Skills library can install registry skills, and skill detail views can copy example prompts, open the source file, or run a skill through the configured agent CLI.

## Activity Ledger and Weekly Summary

Knowlery records lightweight private activity receipts in `.knowlery/activity/` when logging is enabled.

Those receipts feed:

- Today thread summaries and next moves.
- This note suggestions.
- Weekly summary reports in `.knowlery/reports/latest.html` and `.knowlery/reports/weekly/<week-label>.html`.
- Optional daily review requests and results in `.knowlery/requests/` and `.knowlery/reviews/`.

## Knowledge Health and Staleness

Staleness is computed mechanically, never guessed: a compiled page is stale when a source it cites changed after the page was last written, and a user note is uncooked when no compiled page cites it. The dashboard's Knowledge health section, `knowlery stale`, `obsidian knowlery:stale`, and the MCP `stale` tool all render the same deterministic report — it is the exact work list a `/cook` session should scope from.

## Knowledge Bundles

A knowledge bundle is a portable, reviewed slice of a vault's compiled knowledge, packaged in the OKF format.

On the sharing side, export scope is chosen from a seed topic plus its graph-closure, every item passes an approve/flag review gate with an automated risk scan, and the shipped `SCHEMA.md` is scoped to the taxonomy the bundle actually uses. On the receiving side, bundles install under `Library/<bundle-id>/`, are tracked in `.knowlery/bundles.json`, and stay read-only reference material until you fork a page into your own knowledge directories.

Installed bundles are part of retrieval: `KNOWLEDGE.md` gains a pointer block while bundles are installed, and the `/ask` skill reads each relevant bundle's `agent-index.json` alongside the vault's own compiled pages.

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

The diagnostics section in settings checks two things:

- **Content structure:** note counts, wikilink counts, knowledge page counts, orphan notes, broken wikilinks, missing frontmatter.
- **Configuration integrity:** expected files, directories, rules, built-in skills, agent CLI detection, and platform config.
