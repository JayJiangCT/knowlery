# Knowlery — Implementation Plan

> **Knowlery** = Know + Bakery  
> Your AI Knowledge OS kitchen — setup, monitor, and upgrade your Obsidian vault.

## What Is Knowlery

Knowlery is an Obsidian plugin that turns BYOAO's CLI-only initialization into a first-class Obsidian experience. Instead of running `byoao install && byoao init` in a terminal, users do everything from within Obsidian.

**Relationship to existing tools:**

| Tool | Role |
|------|------|
| **Knowlery** (this) | AI Knowledge OS control panel — setup, monitor, upgrade |
| **BYOAO CLI** (`@jayjiang/byoao`) | Developer-facing backup; CI/CD scripting |
| **Claudian** | Agent runtime UI — chat, inline edit (separate plugin) |

The metaphor: if your Obsidian vault is a kitchen, Knowlery is the head chef's mise en place — everything configured, organized, and ready before the cooking (agent work) begins.

## Core Features

### 1. Setup Wizard (replaces `byoao init`)
A Modal that guides first-time setup:
- KB name, owner, wiki domain
- Preset selection (minimal / pm-tpm)
- Agent platform selection (Claude Code ☑ / OpenCode ☑ / both)
- MCP services (Atlassian, BigQuery)
- One-click vault initialization

No terminal required. Everything stays inside Obsidian.

### 2. Dashboard (replaces `byoao_vault_status` + `byoao_vault_doctor`)
A persistent ItemView (ribbon icon) showing:
- Vault stats: notes, wikilinks, entities/concepts/comparisons/queries
- Health report: orphan notes, broken links, missing frontmatter
- Skills status: installed skills + available updates
- Agent config status: CLAUDE.md ✓, .mcp.json ✓, .opencode.json ✓
- MCP service status

### 3. Upgrade Manager (replaces `byoao upgrade`)
- Background check against npm registry for new BYOAO versions
- Obsidian Notice on new version available
- One-click skill sync + CLAUDE.md/AGENTS.md template refresh

### 4. Settings Tab
- Edit core config (KB name, preset, wiki domain)
- Toggle agent platforms on/off
- Add/remove MCP services
- Regenerate CLAUDE.md or AGENTS.md on demand

## Architecture

### Domain Layer (reused from BYOAO CLI)
The `src/vault/` modules in `@jayjiang/byoao` have zero OpenCode dependencies and can be copied directly into Knowlery:

```
vault/create.ts         — vault initialization orchestrator
vault/status.ts         — vault stats (noteCount, wikilinks, agentPages)
vault/doctor.ts         — diagnostic report (orphans, broken links, frontmatter)
vault/upgrade.ts        — skill + config upgrade logic
vault/preset.ts         — preset loading (minimal, pm-tpm)
vault/template.ts       — Handlebars rendering
vault/manifest.ts       — .byoao/manifest.json read/write
vault/vault-detect.ts   — detect BYOAO vault context
vault/mcp.ts            — MCP server configuration
vault/copy-bundled-skills.ts — skill file sync
plugin-config.ts        — Zod schemas (VaultConfig, PresetConfig, etc.)
lib/cjs-modules.ts      — fs shim + gray-matter/handlebars/semver bundling
```

### Agent Platform Configuration (new)
`src/core/platform-config.ts` — handles both platforms:

**Claude Code:**
- Generate `CLAUDE.md` at vault root (replaces system-transform hook)
- Copy skills → `<vault>/.claude/commands/<name>.md`
- Write `<vault>/.mcp.json` with MCP server definitions

**OpenCode:**
- Write `<vault>/.opencode.json` with plugin registration
- Copy skills → `<vault>/.opencode/skills/<name>/SKILL.md`

### Obsidian Plugin Structure

```
knowlery/
  manifest.json
  package.json
  tsconfig.json
  esbuild.config.mjs
  styles.css
  src/
    main.ts                    # Plugin entry — extends Plugin
    settings.ts                # PluginSettingTab
    types.ts                   # Shared types
    views/
      dashboard-view.ts        # ItemView
    modals/
      setup-wizard.ts          # Initialization wizard Modal
      upgrade-modal.ts         # Upgrade confirmation Modal
    core/
      platform-config.ts       # Claude Code + OpenCode config
      skill-manager.ts         # Skill install/sync
      update-checker.ts        # npm registry version check
    vault/                     # Copied from @jayjiang/byoao
      ...
    assets/
      presets/                 # common/ + minimal/ + pm-tpm/
      obsidian-skills/         # Obsidian CLI skill markdowns
    skills/                    # BYOAO skill markdowns
      cook/SKILL.md
      trace/SKILL.md
      ...
```

### Build System
- **esbuild** → single `main.js` (same approach as Claudian)
- CJS deps (gray-matter, handlebars, semver) bundled inline
- Dev: `OBSIDIAN_VAULT=/path/to/vault npm run dev` — auto-copies to vault plugins folder

### Dependencies
```json
{
  "devDependencies": {
    "obsidian": "latest",
    "esbuild": "^0.28.0",
    "typescript": "^5.4.0",
    "gray-matter": "^4.0.0",
    "handlebars": "^4.7.0",
    "semver": "^7.7.4"
  },
  "dependencies": {
    "zod": "^3.23.0"
  }
}
```

## Implementation Phases

### Phase 1 — Scaffold + Setup Wizard (MVP)
Get the plugin loading in Obsidian and the init wizard working.

- [ ] Project scaffold: manifest.json, package.json, tsconfig, esbuild config
- [ ] Copy vault domain layer from @jayjiang/byoao
- [ ] `main.ts`: Plugin entry, detect uninitialized vault, auto-open wizard
- [ ] `setup-wizard.ts`: Multi-step Modal (KB info → preset → platforms → MCP)
- [ ] `core/platform-config.ts`: Claude Code + OpenCode output
- [ ] `settings.ts`: Basic PluginSettingTab

**Done when:** Empty vault + enable plugin → wizard → vault initialized correctly for Claude Code and/or OpenCode.

### Phase 2 — Dashboard
- [ ] `dashboard-view.ts`: ItemView with ribbon icon
- [ ] Integrate `getVaultStatus()` + `getVaultDiagnosis()`
- [ ] Vault file change listener (throttled refresh)
- [ ] Manual refresh button

**Done when:** Dashboard shows accurate live stats for an existing BYOAO vault.

### Phase 3 — Upgrade Manager
- [ ] `core/update-checker.ts`: Fetch npm registry, compare versions
- [ ] `core/skill-manager.ts`: Sync skills to .claude/commands/ and .opencode/skills/
- [ ] `upgrade-modal.ts`: Show what will change, confirm
- [ ] Dashboard upgrade status badge

**Done when:** New BYOAO version → Obsidian notice → one-click upgrade → skills updated.

### Phase 4 — Polish
- [ ] Error handling + user-friendly notices
- [ ] Settings tab: full config editing
- [ ] BRAT-compatible release (manifest.json + main.js + styles.css)
- [ ] README
- [ ] Obsidian community plugin submission (later)

## Key Design Decisions (open for discussion)

1. **Domain code sync strategy**: Copy from BYOAO CLI vs git submodule vs shared npm package (`@jayjiang/byoao-core`)
2. **Skills packaging**: Bundle as string constants in esbuild, or ship as files alongside main.js?
3. **Obsidian API vs direct fs**: For vault operations, use `app.vault` API or Node.js `fs` directly? (Claudian uses direct fs for Claude-managed files)
4. **Claudian interop**: Should Knowlery detect if Claudian is installed and configure `.claudian/` accordingly?

## References
- [BYOAO CLI](https://github.com/JayJiangCT/BYOAO) — source of domain layer
- [Claudian](https://github.com/YishenTu/claudian) — reference for Obsidian plugin structure
- [obsidian-plugin-design.md](../BYOAO/docs/obsidian-plugin-design.md) — detailed design doc
