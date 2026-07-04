# Knowlery

[![Release](https://img.shields.io/github/v/release/jayjiangct/knowlery?label=release&style=flat-square)](https://github.com/JayJiangCT/knowlery/releases)
[![Docs](https://img.shields.io/badge/docs-official-blue?style=flat-square)](https://jayjiangct.github.io/knowlery/)
[![License: MIT](https://img.shields.io/github/license/jayjiangct/knowlery?style=flat-square)](LICENSE)

Knowlery turns an Obsidian vault into a personal knowledge review space for Claude Code and OpenCode workflows. It helps initialize the vault, keep built-in skills and schemas in sync, choose small next moves from one action-first dashboard, review the current note, generate weekly summaries, share and install knowledge bundles, and maintain vault health from Obsidian settings.

In v0.6.0, retrieval becomes deterministic and measurable. Finding knowledge is now **one command with two transports** — `obsidian knowlery:query` while Obsidian is running, or `node .knowlery/bin/query.mjs` with it closed — ranking compiled pages, your own notes, and installed bundles with field-weighted scoring, cross-language source-graph boosts, and an honest "no confident matches" verdict. **Knowledge health** on the dashboard mechanically detects compiled pages whose sources changed and notes never compiled, feeding `/cook`'s incremental scope. Agent sessions got lighter: fixed context now carries only `KNOWLEDGE.md` plus your rules. And every retrieval change is scored by a committed evaluation harness with a frozen baseline, enforced in CI.

Read the official documentation: <https://jayjiangct.github.io/knowlery/>.

## Inspiration: LLM Wiki & BYOAO

### Andrej Karpathy’s “LLM Wiki”

In [LLM Wiki](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f), Andrej Karpathy describes a pattern different from one-off RAG: instead of re-deriving answers from raw notes on every question, an agent **incrementally builds and maintains a persistent wiki**—structured, interlinked markdown that sits between you and your sources. New material is read, distilled, and **folded into** entity pages, topic summaries, and cross-links; the base is **kept current** rather than re-scanned from scratch each time.

Knowlery’s take is **aligned with that maintenance story** for your vault: it gives you the layout (`KNOWLEDGE.md`, `SCHEMA.md`, `INDEX.base`, `entities/`, `concepts/`, `comparisons/`, `queries/`), agent skills, and health checks so a coding agent can **compile and maintain** structured knowledge pages from your notes—while keeping a clear boundary (your free-form notes stay yours; the agent works the shared map). It is an opinionated, Obsidian-native way to operationalize the “LLM wiki” idea on the desktop.

### BYOAO

[BYOAO](https://github.com/JayJiangCT/BYOAO) (*Build Your Own AI OS*) is a separate project: an OpenCode-oriented flow that turns Obsidian into an AI-powered “LLM Wiki” style knowledge base with global CLI install. Working on BYOAO is what made it natural to ask: **what if the same ideas lived as a first-class Obsidian plugin**—settings, setup wizard, skills, and health—without leaving the app? Knowlery is that plugin-shaped experiment: same family of ideas, different packaging (plugin UI + vault-side wiring for Claude Code / OpenCode).

## Getting started (video)

![Walkthrough preview](media/knowlery-walkthrough-preview.gif)

**[▶ Full walkthrough](https://github.com/JayJiangCT/knowlery/blob/main/media/knowlery-walkthrough.mp4)** (~3 min, with audio) · same file: [Releases](https://github.com/JayJiangCT/knowlery/releases)

## Requirements

- Obsidian desktop, version 1.12.2 or newer.
- Community plugins enabled.
- Claude Code or OpenCode, if you want to run installed skills from the dashboard.
- Node.js and npm, if you want to browse or install skills from the external skills registry.

Knowlery is desktop-only because it uses local command-line tools and Electron desktop APIs.

During the setup wizard, Knowlery can detect whether Claude Code, OpenCode, Node.js, and the external `skills` CLI are available. On desktop, the wizard can optionally help install or prepare missing agent tools, and can optionally install Claudian directly into your vault without requiring BRAT. These steps are opt-in; if a tool is already installed, Knowlery skips it.

### Agent chat in Obsidian (optional companions)

Knowlery focuses on **vault layout, skills, rules, and health** for agent workflows. If you also want a **full agent chat** inside Obsidian (sidebar, inline edit, multi-provider), consider installing one of these **in addition to** Knowlery:

- **[Claudian](https://github.com/YishenTu/claudian)** — embeds Claude Code, Codex, and related flows in the vault; file read/write and bash from a chat UI.
- **[obsidian-agent-client](https://github.com/RAIT-09/obsidian-agent-client)** — brings agents in via Agent Client Protocol (ACP) (e.g. Claude Code, Codex, Gemini CLI) with multi-session and MCP support.

## Knowlery CLI

The same knowledge-base lifecycle is available as a standalone CLI — one core, two
shells. A folder initialized by the CLI opens in Obsidian with zero migration, and the
plugin adds the review UI on top.

```bash
npm i -g knowlery

knowlery init     # scaffold a workspace (interactive, or --platform/--name flags)
knowlery sync     # bring skills, rules, and the retrieval script up to date
knowlery health   # config integrity + knowledge-page counts; exit code for CI
knowlery query "<question>"   # deterministic retrieval over the workspace
knowlery stale    # compiled pages whose sources changed; notes never compiled
knowlery bundle install <zip-or-folder>   # install a shared knowledge bundle
knowlery bundle list / uninstall <id>     # manage installed bundles
```

Retrieval works headlessly too: `node .knowlery/bin/query.mjs "<question>"` (written by
`init`/`sync`) searches the workspace with Obsidian closed.

## Install from Community plugins

Knowlery is available from Obsidian's community plugin directory.

1. Open **Settings -> Community plugins** in Obsidian.
2. Select **Browse**.
3. Search for **Knowlery**.
4. Install and enable the plugin.

## Install beta builds with BRAT

BRAT is the **Beta Reviewers Auto-update Tool** for Obsidian. Upstream project: [`TfTHacker/obsidian42-brat`](https://github.com/TfTHacker/obsidian42-brat) (documentation: [tfthacker.com/BRAT](https://tfthacker.com/BRAT)).

Use BRAT only when you want to test preview builds before they are published to the community plugin directory.

1. Install the **BRAT** plugin in Obsidian (from Community plugins, or build from the [BRAT repository](https://github.com/TfTHacker/obsidian42-brat) above).
2. Open **BRAT** settings.
3. **Add Beta plugin** and use this repository URL: `https://github.com/JayJiangCT/knowlery` (or the short form `JayJiangCT/knowlery` if BRAT accepts it).
4. Enable **Knowlery** under Settings → Community plugins.

## Manual install

1. Download `main.js`, `manifest.json`, and `styles.css` from the [latest release](https://github.com/JayJiangCT/knowlery/releases).
2. Put those files in `.obsidian/plugins/knowlery/` inside your vault.
3. Reload Obsidian and enable Knowlery from Settings -> Community plugins.

## What Knowlery Creates

During setup and normal use, Knowlery can create or update these files and folders inside your vault:

- `KNOWLEDGE.md`
- `SCHEMA.md` (knowledge taxonomy and page conventions)
- `INDEX.base`
- `entities/`, `concepts/`, `comparisons/`, and `queries/`
- `.knowlery/manifest.json`
- `.agents/skills/` and `.agents/rules/`
- `.claude/skills/`, `.claude/rules/`, and `.claude/CLAUDE.md`
- `opencode.json`, when OpenCode is selected
- `skills-lock.json`
- `.knowlery/activity/`, when activity logging is enabled
- `.knowlery/reports/`, when Weekly summary generates an HTML report
- `.knowlery/requests/` and `.knowlery/reviews/`, when daily review polish is used
- `.knowlery/freshness/`, when Freshness Review prepares request, result, log, queue, and sidecar files
- `.knowlery/exports/`, when Share knowledge bundle compiles a bundle (plus an optional `.zip` next to it)
- `Library/<bundle-id>/` and `.knowlery/bundles.json`, when Install knowledge bundle installs a shared bundle
- `.knowlery/bin/query.mjs`, the local retrieval script (written on setup and refreshed on plugin upgrades)

Knowlery may delete skill or rule files only when you use the corresponding delete or disable actions in the UI, and may delete an installed bundle's `Library/<bundle-id>/` folder when you uninstall that bundle from the dashboard.

## Permissions and Disclosures

Knowlery does not collect telemetry.

Knowlery reads and writes files inside your vault to create and maintain the knowledge base layout, bundled skills, rules, activity summaries, review requests, and generated reports listed above. It also reads Obsidian's configured plugin directory when detecting or installing optional companion plugins.

Network access is opt-in and feature-specific. The skill browser can call the external `skills` registry through `npx skills ...` when you search for or install registry skills. The setup wizard can download the latest Claudian release from GitHub when you choose to install that optional companion plugin.

Knowlery can run local CLI commands such as `claude`, `opencode`, `node`, `npx`, and `skills` when you explicitly use CLI-related features. These commands run on your computer with your user permissions. Knowlery does not send vault contents to those tools by itself; agent requests are created only from the actions you trigger.

On Obsidian 1.12.2+ with the command line interface enabled, Knowlery registers two read-only CLI commands, `knowlery:query` and `knowlery:stale`, which search and inspect vault content locally when you (or an agent you run) invoke them. The bundled `.knowlery/bin/query.mjs` script does the same offline with plain Node; neither makes network requests.

Freshness Review is a local, approval-gated workflow. Knowlery prepares request JSON files, imports result JSON files written by an agent you run separately, and applies scalar freshness metadata only after you approve a suggestion. Knowlery does not include a Freshness runner and does not call a model API for this workflow.

Some companion tools or services used with Knowlery, including Claude Code, OpenCode, registry skills, or model providers configured outside Knowlery, may require separate accounts or paid usage. Knowlery itself is free and does not process payments.

## Development

```bash
npm install
npm run build
```

The production build writes `main.js`. Release assets should include:

- `main.js`
- `manifest.json`
- `styles.css`

## License

MIT (see [LICENSE](LICENSE)).
