# Getting Started

This guide walks through installing Knowlery, initializing a vault, and understanding what changes after setup.

## Requirements

Knowlery targets Obsidian desktop and requires community plugins to be enabled.

You also need Claude Code or OpenCode if you want to run agent workflows against the vault. Node.js and npm are required for optional tool preparation and the external skill browser.

::: tip Desktop behavior
Knowlery uses local command-line tools and Electron desktop APIs for agent-oriented features. The current plugin manifest marks it as desktop-only.
:::

## Install from Community plugins

Install Knowlery from Obsidian's community plugin directory for normal use.

1. Open **Settings -> Community plugins** in Obsidian.
2. Select **Browse**.
3. Search for **Knowlery**.
4. Install and enable the plugin.

## Install beta builds with BRAT

BRAT is the Beta Reviewers Auto-update Tool for Obsidian. Use it only when you want to test preview builds before they are published to the community plugin directory.

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

If you are upgrading from an older release, v0.4.0 keeps the dashboard focused on one action-first home and moves diagnostics, rules, schema shortcuts, and the Skills library into the Knowlery settings tab. Bundled skills still auto-sync on version changes, and `SCHEMA.md` is migrated in place when missing anchor sections are found. Custom and forked skills are preserved.

If Knowlery detects an older BYOAO vault, the setup wizard can switch into migration mode and preserve the existing BYOAO/OpenCode files while configuring Knowlery for Claude Code.

## What Setup Creates

Knowlery creates the knowledge workspace and agent configuration in your vault:

| Path | Purpose |
| --- | --- |
| `KNOWLEDGE.md` | Vault operating guide for humans and agents |
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

Normal use can also create private activity receipts, weekly summary reports, daily review request/result files, and Freshness Review request/result/sidecar files under `.knowlery/`.

## Optional Tool Preparation

The setup wizard can detect Claude Code, OpenCode, Node.js, Claudian, and skills tooling.

Missing optional tools are shown as selectable install or preparation steps. Already-installed tools are shown as read-only status rows. These actions are opt-in and run on your computer with your user permissions.

## Open the Dashboard

After setup, open the Knowlery dashboard. It is a single scrolling review surface:

| Section | Use it for |
| --- | --- |
| Today's move | Start from the current activity context and choose the next small move |
| Suggested moves | Use reusable review prompts such as Process new material or Challenge an idea |
| Knowledge health | Review pending Freshness Review suggestions when they exist |
| This note | Review the active Markdown note and prepare a focused prompt |
| Recent activity | Scan private activity receipts and open the full activity list |
| This week | Generate a weekly summary, open the last report, or send it for review |

Open **Settings -> Knowlery** for diagnostics, rules and schema shortcuts, the Skills library, platform switching, activity logging, and maintenance actions.

## Recommended First Session

1. Initialize a clean test vault first.
2. Read the generated `KNOWLEDGE.md` and `SCHEMA.md`.
3. Open the dashboard and read Today's move, Suggested moves, and This note.
4. Add one or two real notes to the vault.
5. Generate a weekly summary, then open **Settings -> Knowlery** and run diagnostics.
