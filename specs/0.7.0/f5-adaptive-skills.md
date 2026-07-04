# F5 (0.7.0) — Environment-Adaptive Skills + the Sync Downgrade Guard

- **Status:** Draft — awaiting maintainer spec acceptance
- **Target release:** 0.7.0 (final feature)
- **Branch:** `cursor/07-f5-adaptive-skills-92eb` (stacked on 0.7 F4)
- **Depends on:** F2/F3 (the `knowlery` CLI exists), 0.6 F5/F3 (transport ladder,
  staleness report)

## 1. Problem statement

The skills still assume the Obsidian shell: they mandate `obsidian create` for writes
and know two retrieval transports, not three. Meanwhile two recorded debts come due
here by plan: the 0.6 skills backlog (retrieval-aware `/cook`, `/audit` on CLI
primitives) and the versioning policy's sync downgrade guard. All of it is "make the
two shells behave coherently", so it ships as one feature.

## 2. Scope

### 2.1 Third transport in the retrieval ladder

`/ask` Step 2, `/cook` incremental mode, and the `KNOWLEDGE.md` template teach three
transports in preference order:

1. `obsidian knowlery:query` / `knowlery:stale` — Obsidian running;
2. `knowlery query` / `knowlery stale` — globally installed CLI;
3. `node .knowlery/bin/query.mjs` — zero-install, always present in the vault.

Degraded prose fallback stays last, unchanged.

### 2.2 CLI-mode write path

`/cook`, `/organize`, and `vault-conventions` currently mandate `obsidian create` /
`obsidian rename`. They become environment-adaptive: **prefer Obsidian CLI when
available** (it maintains wikilink graph integrity on renames); when it is not, write
or move files directly with the same frontmatter and naming conventions, and recommend
`knowlery health` after bulk changes. The ownership boundary and all conventions are
unchanged — only the tool bindings gain a headless branch.

### 2.3 Retrieval-aware `/cook` (0.6 backlog)

`/cook` gains an explicit aliasing convention in Steps 3/5 and Key Principles: when
creating or updating a page, record into `aliases` frontmatter (a) colloquial or team
nicknames, (b) abbreviations, and (c) the cross-language title when sources are in a
different language than the page. Rationale recorded in the skill: lexical retrieval
can only match what is written down — this closes the alias/bilingual gaps the 0.6
eval quantified (q-016/q-020) from the write side. `SCHEMA.md` template's Custom
Fields table documents `aliases`.

### 2.4 `/audit` on CLI primitives (0.6 backlog)

The `/audit` scan categories replace prose traversal instructions with tools:
`obsidian orphans` (orphan pages), `obsidian unresolved` (broken wikilinks),
`obsidian deadends`, and — fulfilling F3's promise — `knowlery stale` /
`query.mjs --stale` whose `danglingSources` become the "pages citing missing notes"
category. Prose fallback retained for environments without either CLI.

### 2.5 Sync downgrade guard (versioning-policy backlog)

- `Manifest` gains optional `lastSyncedBy: string` (core version that last ran sync).
- `runVaultSync(fs, platform, toolVersion)` first compares `toolVersion` against the
  manifest's `lastSyncedBy`: when the running tool is **older**, it performs nothing
  and returns `{ skipped: 'newer-shell', lastSyncedBy }`; otherwise it runs the sync
  list and records `lastSyncedBy: toolVersion` (write-on-change; missing field = legacy
  vault, always allowed). Version comparison is numeric-segment (the same rule the
  bundle registry uses), with prerelease suffixes ignored for ordering simplicity.
- Shell rendering: the plugin shows a Notice ("this vault was synced by a newer
  Knowlery; update the plugin"); `knowlery sync` exits 1 with the upgrade hint. No
  override flag — an older tool rewriting newer skill content is precisely the
  accident this prevents.
- The plugin passes `manifest.version` (its own), the CLI passes `KNOWLERY_VERSION`.

## 3. Non-goals

- No skill-content forks per shell: one skill text, environment-adaptive prose. Custom
  and forked skills remain untouched by auto-sync, as always.
- No eval changes: skill text is not what the harness measures; the frozen baseline
  and F2 thresholds must be byte-identical.
- No changes to `/explore`, `/challenge`, `/ideas` tool bindings beyond what they
  inherit from shared sections (their obsidian-CLI usage is read-only and degrades
  gracefully already).

## 4. Acceptance criteria

1. `/ask`, `/cook`, and the `KNOWLEDGE.md` template list the three-transport ladder in
   order; the embedded script remains the guaranteed-present last resort.
2. `/cook`, `/organize`, `vault-conventions` contain the headless write branch and the
   post-bulk `knowlery health` recommendation; `obsidian` CLI remains the stated
   preference.
3. `/cook` contains the aliasing convention (nicknames, abbreviations, cross-language
   titles); `SCHEMA.md` template documents `aliases`.
4. `/audit` names `obsidian orphans`/`unresolved`/`deadends` and consumes
   `danglingSources` from the staleness report.
5. Downgrade guard unit tests: older tool → skipped + nothing written; equal/newer →
   sync runs and `lastSyncedBy` recorded; legacy manifest (no field) → allowed;
   `knowlery sync` on a newer-synced vault exits 1 with the hint; plugin path renders
   a Notice (mock-level test).
6. Full suite, lint, build, eval baseline + F2 thresholds green; generated `query.mjs`
   changes only by the skill-content updates it embeds (none — the script embeds no
   skills; expect zero diff).

## 5. Maintainer self-test checklist (acceptance round)

1. Build + reload the plugin in your Test vault: version-sync delivers the updated
   skills; check `.claude/skills/ask/SKILL.md` shows the three-transport ladder and
   `.claude/skills/cook/SKILL.md` shows the aliasing convention.
2. Run one `/ask` with Obsidian open (should use `knowlery:query`) and one from a
   plain terminal with Obsidian closed (should pick the global CLI or the embedded
   script — whichever the agent finds first).
3. Downgrade guard, real flow: run `knowlery sync --dir <Test vault>` with the built
   CLI (records `lastSyncedBy`), then temporarily lower the version constant in a
   scratch build and re-run — expect refusal with the upgrade hint.
4. Run `/audit` once — confirm it reaches for the CLI primitives instead of manual
   traversal, and reports dangling sources if any exist.
5. `npm test && npm run eval -- --assert-baseline` — green.
