# F2 (0.7.0) — The `knowlery` CLI: `init` / `sync` / `health` + npm Packaging

- **Status:** Accepted 2026-07-04 — implemented, awaiting maintainer acceptance testing (§7)
- **Target release:** 0.7.0
- **Branch:** `cursor/07-f2-cli-skeleton-92eb` (stacked on 0.7 F1)
- **Depends on:** F1 (VaultFs inversion — the CLI is a thin shell over the inverted core)

## 1. Problem statement

F1 proved the lifecycle logic runs headlessly (the §6.2 flagship test initializes a
complete vault in a temp dir through `nodeVaultFs`). F2 gives that capability a user:
`npm i -g knowlery` (or `npx knowlery`), so agent-CLI users, cloud agents, and headless
environments can create and maintain a Knowlery workspace without Obsidian — the same
vault format, openable in Obsidian at any time.

## 2. Goals

1. A `knowlery` binary with three commands — `init`, `sync`, `health` — each a thin
   shell over the F1-inverted core (no new lifecycle logic in the CLI layer).
2. npm packaging and automated publishing from the existing release workflow.
3. Zero plugin-behavior change; zero new runtime dependencies (interactive prompts use
   node's built-in `readline/promises`).

## 3. Non-goals

- `query` / `stale` commands (F3), `bundle` commands (F4), skills adaptivity (F5).
- No TUI framework, no color/spinner dependencies — plain text output, `--json` where
  machine-readability matters.
- No config file for the CLI itself; all state lives in the vault, as today.
- No auto-update mechanism; npm is the update channel.

## 4. Design

### 4.1 Command surface

```
knowlery init   [--dir <path>] [--platform claude-code|opencode] [--name <kb name>] [--force]
knowlery sync   [--dir <path>]
knowlery health [--dir <path>] [--json]
knowlery --version | --help
```

- `--dir` defaults to the current working directory for all commands.
- **`init`**: refuses on an already-initialized vault (`isVaultInitialized`) unless
  `--force`, pointing at `knowlery sync` instead. Missing `--platform`/`--name` are
  prompted interactively (readline); non-TTY stdin with missing flags is an error, so
  scripted use stays deterministic. Runs `executeSetup` — byte-for-byte the same file
  tree as the plugin's wizard (already asserted by the F1 flagship test). Optional
  tool installs (Claudian etc.) are Obsidian-shell features and are not offered.
- **`sync`**: the version-sync block the plugin runs on upgrade, minus plugin settings:
  `syncBuiltinSkills` → `syncQueryScript` → `migrateSchemaMd` →
  `migrateFixedContextImports` → `refreshInstalledBundlesBlock` → (when the manifest
  says claude-code) `syncClaudeRuleImports`. All operations are already idempotent and
  write-on-change, so `sync` needs no `lastSyncedVersion` bookkeeping — running it
  twice is a no-op, and the command reports which files actually changed (from a
  write-log wrapper around `nodeVaultFs`).
- **`health`**: renders `checkVaultConfigFiles` (F1's platform-neutral half; platform
  read from the manifest, defaulting to claude-code) plus knowledge-page counts from
  the existing query scanner (`scanVault`). Exit code 0 when everything expected
  exists, 1 otherwise — CI-friendly. `--json` emits the raw structure.

### 4.2 Entry point and build

- `src/cli/main.ts`: argv parsing (hand-rolled, same style as `query-cli`), command
  dispatch, prompts, output rendering. Command handlers live in `src/cli/commands/`
  (`init.ts`, `sync.ts`, `health.ts`) and take a `VaultFs` + options, so they are unit
  testable without spawning processes.
- esbuild gains a third artifact: `knowlery-cli.mjs` (platform node, ESM, minify off,
  `#!/usr/bin/env node` banner + the createRequire shim, same scanner-hygiene plugin).
  Unlike the vault query script it is **not** embedded in `main.js` — it ships via npm
  only.
- `sync` writes `.knowlery/bin/query.mjs` through the existing `syncQueryScript`, whose
  content comes from the same generated module the plugin embeds — CLI-initialized
  vaults get the identical retrieval script.

### 4.3 npm packaging and publishing

- `package.json`: `"bin": { "knowlery": "./knowlery-cli.mjs" }`,
  `"files": ["knowlery-cli.mjs", "README.md", "LICENSE"]` (the plugin's `main.js` is
  not part of the npm artifact), `"engines": { "node": ">=18" }`. Package name
  `knowlery` (availability verified). Version stays shared with the plugin.
- Release workflow gains an npm-publish step on version tags: builds, then
  `npm publish` (with `--tag beta` for prerelease tags). **Maintainer prerequisite:**
  an npm access token stored as the `NPM_TOKEN` repository secret; the step is skipped
  with a warning when the secret is absent, so plugin releases never block on npm.
- The GitHub release keeps shipping the plugin assets exactly as today.

### 4.4 Docs touchpoint (this feature, minimal)

README gains a short "Knowlery CLI" section (install, three commands, one-paragraph
positioning per the release plan's one-core-two-shells discipline). Full docs-site
treatment belongs to 0.7.0 release prep.

## 5. Risks

- **R1 — divergent sync surface.** The plugin's upgrade block and `knowlery sync` must
  stay the same list. Mitigation: both call one shared `runVaultSync(fs, platform)`
  helper extracted in this feature; the plugin's block becomes a call to it.
- **R2 — npm publish failures blocking releases.** Mitigation: the publish step is
  isolated, conditional on the secret, and `continue-on-error` is deliberately NOT set
  — a real publish failure should be visible — but secret absence skips cleanly.
- **R3 — interactive prompts in non-TTY environments.** Explicit error with the exact
  flags to pass; covered by a unit test.

## 6. Acceptance criteria

1. In a clean temp dir: `knowlery init --platform claude-code --name "My KB"` produces
   the identical file tree to the plugin wizard (extends the F1 flagship test to run
   through the CLI handler); a second `init` without `--force` exits non-zero with the
   sync hint.
2. `knowlery sync` on a stale vault (e.g. 0.5.0-era CLAUDE.md imports, outdated skill
   content) applies exactly the plugin's upgrade migrations and lists the changed
   files; a second run reports "no changes" and writes nothing.
3. `knowlery health` exits 0 on a healthy vault and 1 on a vault with a missing skill
   or knowledge dir; `--json` parses.
4. The plugin's version-sync block and `knowlery sync` call the same shared helper
   (one list, two shells — enforced by code structure, checked in review).
5. The built `knowlery-cli.mjs` runs the full init → health → sync round-trip in a
   spawn-based smoke test; `npm pack --dry-run` shows only the CLI artifact, README,
   and LICENSE.
6. `npm test`, `npm run lint`, `npm run build`, `npm run eval -- --assert-baseline`
   green; plugin behavior unchanged; purity guard extended to `src/cli/commands/`.

## 7. Maintainer self-test checklist (acceptance round)

1. `npm run build && node knowlery-cli.mjs init --dir /tmp/kb --platform claude-code --name "CLI KB"`
   — then open `/tmp/kb` as a vault in Obsidian: the plugin should treat it as fully
   initialized (no setup prompt), dashboard and `knowlery:query` work immediately.
2. `node knowlery-cli.mjs health --dir /tmp/kb` — all green, exit 0; delete a skill
   dir, re-run, see the failure and exit 1; `knowlery sync --dir /tmp/kb` restores it.
3. In your real vault's repo checkout: `node knowlery-cli.mjs sync --dir <real vault>`
   — expect "no changes" (the plugin already synced it).
4. After merging + tagging: `npm i -g knowlery && knowlery --version` (requires the
   `NPM_TOKEN` secret configured — see §4.3).
5. `npm test && npm run eval -- --assert-baseline` — green.

## 8. Maintainer prerequisites (before the release, not before implementation)

- Create an npm access token (Automation type) and add it as the `NPM_TOKEN` repo
  secret.
- Decide the BYOAO consolidation timing (release-plan open item) — F2 shipping is the
  natural moment.
