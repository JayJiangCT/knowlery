# Changelog

## [v0.3.0-beta.2] — 2026-05-06

### Internal beta

- Fixes Today quick-action tooltip rendering by switching to Obsidian-native tooltips instead of custom CSS pseudo-elements.
- Keeps the local build flow convenient by copying release assets into the default Test Vault only when that vault exists.

### Beta notes

- This prerelease is intended for internal testing through BRAT and GitHub prerelease assets.
- Feedback should focus on dashboard polish, tooltip reliability, and the end-to-end beta install/update experience.

## [v0.3.0-beta.1] — 2026-05-05

### Internal beta

- Repositions Knowlery from a one-time vault setup utility into a personal knowledge review space.
- Adds the new dashboard structure: Today, This note, Weekly Review, Review Menu, and System.
- Introduces lightweight activity receipts, active knowledge trails, manual reflections, and next-move recommendations.
- Adds explicit agent handoff flows for copying review prompts or sending them to Claudian when available.
- Upgrades weekly reporting into a local Knowledge Review Atlas with an English default, Chinese toggle, knowledge hexagon, timeline, topic constellation, extensions, and next batch prompts.
- Hides raw source skills behind the Review Menu so users can start from natural language workflows.
- Adds internal beta testing guidance for fresh, existing, and returning vault testers.

### Beta notes

- This prerelease is intended for internal testing through BRAT and GitHub prerelease assets.
- Do not treat this as the final public 0.3.0 release.
- Beta feedback should focus on first-use clarity, review workflow usefulness, Claudian handoff reliability, and Knowledge Review Atlas quality.

## [v0.2.0] — 2026-04-30

### New features

- Setup wizard now detects Claude Code, OpenCode, Node.js, Claudian, and skills tooling before setup.
- Optional onboarding installs can prepare missing agent tools, warm up `npx skills`, and install Claudian directly into the vault without BRAT.
- Node.js recovery flow includes auto-detect, manual path entry, and an official download link.

### Improvements

- Installed tools are shown as read-only status rows, while only missing optional tools can be selected.
- Optional install selection no longer re-runs environment checks on every checkbox click.
- Running setup now uses compact circular progress indicators for queued, running, and verifying install work.
- Setup wizard styling was tightened to match Knowlery and Obsidian UI conventions.

### Compatibility notes

- Existing users are not migrated automatically. Optional tool installation only runs from the setup wizard after explicit selection.
- Existing vault files and agent configuration remain unchanged unless users re-run setup or maintenance actions.
- Network and local command use remain user-initiated and are documented in the README.

## [v0.1.1] — 2026-04-22

### Documentation

- README: **static** release and license badges (works while the repo is private; bump the badge text when you ship a new version).
- Stop tracking **`plan.md`**; it remains available locally via `.gitignore` for maintainers.
- **Getting started** embeds the walkthrough as an **MP4** from Releases (`knowlery-walkthrough.mp4` via `latest/download`); inline `<video>` on github.com with a direct-link fallback.
- **BRAT** links the upstream repo ([`TfTHacker/obsidian42-brat`](https://github.com/TfTHacker/obsidian42-brat)) and optional companion plugins: [Claudian](https://github.com/YishenTu/claudian) and [obsidian-agent-client](https://github.com/RAIT-09/obsidian-agent-client).

### Infrastructure

- Add optional **`playwright`** devDependency for local HTML → MP4 recording (e.g. guidance storyboard export); not required to build the plugin.

## [v0.1.0] — 2026-04-22

### New features

- Dashboard (side pane) with **Skills**, **Config**, and **Health** tabs for agent-oriented vault workflows.
- **Setup wizard** to scaffold `KNOWLEDGE.md`, `SCHEMA.md`, content folders, `.knowlery/`, and agent config for Claude Code or OpenCode.
- **Skill browser** and editors to install, browse, and edit bundled and registry skills; **rule editor** for agent rules.
- **Vault health** panel with path-level diagnostics; **Node.js / CLI** detection and safe command execution.
- **Platform adapter** to sync skills and rules between the vault, `.agents/`, and `.claude/`.

### Skills and rules

- Default bundled **knowledge and workflow** skills (for example *cook*, *ask*, *brat*, *init*), editable from the app.
- Rule templates and vault templates in `src/assets` for consistent agent bootstrapping.

### Improvements and fixes

- UI pass across the dashboard, modals, and tabs (precision layout, skill detail flow).
- `gray-matter` import fix for esbuild interop; styles aligned with Obsidian CSS variables and RTL-friendly logical properties.
- `LICENSE`, `README` documentation, and a GitHub **Actions** workflow for future releases (`.github/workflows/release.yml`).

### Infrastructure

- TypeScript, Zod, React 18, esbuild bundle to `main.js` + `styles.css`; `minAppVersion` **1.7.2**.
