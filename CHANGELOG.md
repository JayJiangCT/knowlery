# Changelog

## [v0.3.4] — 2026-05-11

### Skills

- Replaces all 11 bundled skill stubs (marketing descriptions only) with full operational content from `docs/files/skills/`, enabling the complete cook pipeline including SCHEMA.md taxonomy sync.
- Renames `explore` → `trace`, `audit` → `health`, `vault-conventions` → `conventions` to match canonical skill names.
- Adds 6 previously missing skills: `connect`, `drift`, `mise`, `prep`, `wiki`, `vault-thinking`.
- Total bundled skills: 19 (12 knowledge + 7 tooling).

### Improvements

- Enhances `generateSchemaMd()` template with Tag Taxonomy table, Domain Taxonomy table, Agent Page Conventions, Frontmatter Schema reference, Page Thresholds, and Custom Fields — giving the cook skill proper anchor sections from day one.
- Updates the KNOWLEDGE.md skill table with corrected skill names and all new skills.

### Bug Fixes

- Fixes SCHEMA.md never being updated after `/cook` — the deployed cook skill now contains the full 7-step pipeline including Step 5 (Sync SCHEMA.md) instead of a marketing stub with no operational instructions.

## [v0.3.3] — 2026-05-08

### Fixes

- Fixes Windows 11 install failures where `npx skills`, `npm install -g opencode-ai`, and `<tool>.cmd --version` calls aborted with `EINVAL` (Node 18.20.2+ refuses to spawn `.cmd`/`.bat` via `execFile` after CVE-2024-27980). All `.cmd`/`.bat` invocations now go through `cmd.exe /d /s /c` with proper Windows argument quoting in `environment-install.ts`, `cli-detect.ts`, and the skill browser modal.
- Switches the Windows Claude Code installer to `winget install --id Anthropic.ClaudeCode` (with `--silent --accept-source-agreements --accept-package-agreements`) and falls back to the documented `irm https://claude.ai/install.ps1 | iex` script only when winget is unavailable, matching Anthropic's official Windows setup guidance.
- Verifies Claude Code on Windows by checking `%USERPROFILE%\.local\bin\claude.exe` directly before falling back to PATH lookup, since both winget and the irm script land the binary there but PATH may not refresh in the current Obsidian process (anthropics/claude-code issues #11571, #27634, #27867).

## [v0.3.2] — 2026-05-08

### Fixes

- Makes agent handoff prompts end with a verifiable Activity Ledger checklist.
- Requires agents to report whether the receipt was written or skipped, the path used, and a short reason.
- Keeps the checklist compact without embedding the full Activity Ledger JSON schema in every prompt.

## [v0.3.1] — 2026-05-08

### Fixes

- Restores Active threads for knowledge-analysis receipts that include maintenance follow-up work.
- Accepts `analysis` as an Activity Ledger record type and dimension so agent receipts from real cook sessions are not dropped.
- Keeps explicit `source.surface: "system"` and `type: "maintenance"` records out of Active threads while allowing `source.surface: "knowledge"` records to remain visible.
- Clarifies the Activity Ledger rule so evidence review and incident/document analysis should be logged as knowledge analysis, not system maintenance.

## [v0.3.0] — 2026-05-08

### Release

- Promotes the internal review-space beta to the stable v0.3.0 release after multi-day vault testing.
- Adds the new Knowlery dashboard: Today, This note, Weekly Review, Review Menu, and System.
- Introduces Activity Ledger receipts, active knowledge threads, manual reflections, and next-move recommendations.
- Adds Weekly Review Atlas generation and optional daily review polishing with agent output cards.
- Adds conservative BYOAO migration for existing vaults, preserving user files and custom skills.
- Improves Claudian handoff prompts and keeps maintenance/system receipts out of active knowledge threads.
- Explicitly imports Claude Code rules from `.claude/rules/*.md` into `.claude/CLAUDE.md`, including future user-added rules, while preserving OpenCode compatibility through `.agents/rules/*.md`.

### Compatibility notes

- Existing Claude Code vaults will sync Knowlery-managed rule imports into `.claude/CLAUDE.md` when the plugin loads.
- Activity written by external agents may still require pressing Refresh if Obsidian does not emit a vault change event for hidden `.knowlery` files.

## [v0.3.0-beta.4] — 2026-05-07

### Internal beta

- Keeps maintenance and system activity receipts out of Today active knowledge threads while still counting them as recent agent work.
- Adds `source.surface` to activity receipts so agents can distinguish user knowledge work from system, setup, audit, and maintenance logs.
- Makes agent handoff prompts append a compact Activity Ledger reminder without exposing JSONL schema in Claudian.
- Accepts both proper JSONL and pretty-printed activity receipt objects when reading `.knowlery/activity`.
- Tightens first-cook prompts so agents summarize maintenance findings in chat instead of creating report notes by default.
- Strengthens Obsidian CLI guidance and Activity Ledger rules for Claude Code.
- Polishes Today suggested-step buttons into compact action rows.

### Beta notes

- This prerelease is intended for Jay WorkSpace validation of first-cook, Claudian handoff, Activity Ledger receipts, and Today state boundaries.
- After updating through BRAT or release assets, reload Obsidian/Knowlery before testing Claudian handoff behavior.

## [v0.3.0-beta.3] — 2026-05-07

### Internal beta

- Adds a one-click conservative migration path for legacy BYOAO vaults, preserving existing files while configuring Knowlery for Claude Code.
- Imports legacy OpenCode skills into `.agents/skills`, syncs missing Claude skill copies, and normalizes Knowlery skill lock metadata.
- Replaces legacy BYOAO `.claude/CLAUDE.md` guidance with the Knowlery include-based Claude config when migration detects old BYOAO instructions.
- Fixes Today quick actions so `Scan vault health` opens System diagnostics and starts a health scan.
- Polishes Today suggested-step button layout inside Obsidian so labels and helper text render cleanly.

### Beta notes

- This prerelease is intended for internal BYOAO migration testing through BRAT and GitHub prerelease assets.
- Feedback should focus on migration safety, legacy skill preservation, Claude Code config correctness, and Today/System workflow polish.

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
