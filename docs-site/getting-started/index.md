# Getting Started

This guide walks through installing Knowlery, initializing a vault, and understanding what changes after setup.

## Requirements

Knowlery targets Obsidian desktop and requires community plugins to be enabled.

You also need Claude Code or OpenCode if you want to run agent workflows against the vault. Node.js and npm are required for external skill registry browsing and optional tool preparation.

::: tip Desktop behavior
Knowlery uses local command-line tools and Electron desktop APIs for agent-oriented features. The current plugin manifest marks it as desktop-only.
:::

## Install With BRAT

BRAT is the Beta Reviewers Auto-update Tool for Obsidian. Use it when Knowlery is not yet installed from the community plugin directory.

1. Install BRAT in Obsidian.
2. Open BRAT settings.
3. Add this beta plugin repository: `https://github.com/JayJiangCT/knowlery`.
4. Enable Knowlery from **Settings -> Community plugins**.

## Manual Install

1. Download `main.js`, `manifest.json`, and `styles.css` from the latest GitHub release.
2. Create `.obsidian/plugins/knowlery/` inside your vault if it does not already exist.
3. Place the three files in that folder.
4. Reload Obsidian.
5. Enable Knowlery from **Settings -> Community plugins**.

## First Run

After enabling the plugin, open Knowlery from the ribbon icon or command palette.

If the vault is not initialized, Knowlery shows setup entry points in the dashboard and settings tab.

The setup wizard asks you to choose a platform:

| Platform | Generated config |
| --- | --- |
| Claude Code | `.claude/CLAUDE.md` plus `.claude/rules/` |
| OpenCode | `opencode.json` plus `.agents/rules/` |

If you are upgrading from an older release, v0.3.5 will auto-sync bundled skills and migrate `SCHEMA.md` the first time the plugin loads. Custom and forked skills are preserved.

## What Setup Creates

Knowlery creates the knowledge workspace and agent configuration in your vault:

| Path | Purpose |
| --- | --- |
| `KNOWLEDGE.md` | Human and agent-facing vault operating guide |
| `SCHEMA.md` | Knowledge taxonomy and page conventions |
| `INDEX.base` | Obsidian Bases index for compiled knowledge pages |
| `entities/` | Named things such as people, tools, organizations, and projects |
| `concepts/` | Ideas, frameworks, theories, and mental models |
| `comparisons/` | Side-by-side analyses |
| `queries/` | Saved questions and research threads |
| `.knowlery/manifest.json` | Knowlery setup metadata |
| `.agents/skills/` | Canonical installed skill files |
| `.agents/rules/` | OpenCode rules and shared agent rules |
| `.claude/skills/` | Mirrored built-in skill files for Claude Code |
| `.claude/CLAUDE.md` | Claude Code vault instructions |
| `.claude/rules/` | Claude Code rules |
| `opencode.json` | OpenCode configuration |
| `skills-lock.json` | Skill source, version, and disabled-state metadata |

## Optional Tool Preparation

The setup wizard can detect Claude Code, OpenCode, Node.js, Claudian, and skills tooling.

Missing optional tools are shown as selectable install or preparation steps. Already-installed tools are shown as read-only status rows. These actions are opt-in and run on your computer with your user permissions.

## Open the Dashboard

After setup, open the Knowlery dashboard. It has three main tabs:

| Tab | Use it for |
| --- | --- |
| Skills | Browse, inspect, fork, enable, disable, edit, and delete skills |
| Config | Open `KNOWLEDGE.md`, open `SCHEMA.md`, and manage rules |
| Health | View vault stats, run structural diagnosis, and check setup integrity |

## Recommended First Session

1. Initialize a clean test vault first.
2. Read the generated `KNOWLEDGE.md`.
3. Open the Skills tab and inspect `cook`, `ask`, and `audit`.
4. Add one or two real notes to the vault.
5. Use your agent to run a knowledge workflow, then review the generated knowledge pages.
