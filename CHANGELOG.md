# Changelog

## [v0.2.3] — 2026-05-07

### Fixes

- Agent vault-operation instructions now cover note creation and updates, preventing agents from using direct `Write` / `Edit` tools instead of Obsidian CLI when creating knowledge pages.
- The bundled Obsidian Markdown skill now repeats the vault write contract because writing workflows often load that skill without loading the Obsidian CLI skill.

## [v0.2.2] — 2026-05-07

### Fixes

- Agent retrieval instructions now make Obsidian CLI usage mandatory for vault-grounded questions, preventing agents from using raw shell search or external connectors before `obsidian search` / `obsidian read`.

## [v0.2.1] — 2026-05-07

### Fixes

- Windows setup now enables TLS 1.2 before running the Claude Code PowerShell installer.
- Windows optional installs now run `.cmd` tools such as `npm.cmd` and `npx.cmd` through `cmd.exe`, avoiding `spawn EINVAL`.
- Setup completion messaging now distinguishes vault configuration success from optional install failures.

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
