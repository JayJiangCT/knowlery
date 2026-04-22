# Changelog

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
