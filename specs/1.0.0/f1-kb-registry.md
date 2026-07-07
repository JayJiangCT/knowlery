# F1 (1.0.0) — The KB Registry: Named Knowledge Bases

- **Status:** Accepted 2026-07-07 (with ownership-rule and wording corrections) — implemented, awaiting maintainer acceptance testing (§7)
- **Target release:** 1.0.0
- **Branch:** `cursor/1-0-plan-92eb` (spec rides the plan PR, house precedent);
  implementation follows acceptance
- **Depends on:** 1.0 plan (compatibility contract, addressing principle — both
  binding)

## 1. Problem statement

Every Knowlery command is folder-scoped: you are either *in* the vault or you
pass `--dir`. That was right for one KB; it breaks down the moment there are
two ("work" and "personal"), and it is structurally incompatible with the 1.0
story — an MCP server answering *"query my work KB"* from any conversation
needs an addressing layer that outlives any cwd. The registry is that layer,
and it is deliberately a plain CLI feature first: valuable on its own, with MCP
(F2) as its second consumer.

## 2. Goals

```
knowlery kb add <name> [path]      # register (path defaults to cwd)
knowlery kb list [--json]          # names, paths, and their current state
knowlery kb remove <name>          # registry-only; never touches files
knowlery <any-command> --kb <name> # resolve through the registry, then proceed as --dir
knowlery query --kb '*' "..."      # federated query with per-KB attribution
```

1. A **global registry** of named knowledge bases, independent of any vault.
2. `--kb <name>` on every **existing-KB** command that takes `--dir` (`init`
   is the explicit exception — it errors helpfully, see §4.3), under the plan's
   frozen compatibility contract: additive sugar, `--dir` untouched forever,
   both at once is an error, neither keeps the cwd default, **the registry is
   never a prerequisite**.
3. **Federated query**: `--kb '*'` runs the engine per registered KB and merges
   ranked results with per-KB attribution (scores are comparable — same engine,
   same weights). "Which KB did I put that in?" becomes one call.
4. The Obsidian plugin can register its vault, so KBs born in Obsidian are
   discoverable by the CLI and (later) MCP.

## 3. Non-goals

- No per-KB settings, aliases, or metadata beyond `name → path` (v1 registry is
  an address book, not a config store).
- No `kb rename` (remove + add; rename would need cross-referencing decisions
  that nothing yet requires).
- No automatic discovery/scanning of the filesystem for vaults.
- No MCP surface (F2) and no remote semantics (F4).
- No change to any command's behavior once the path is resolved — `--kb` ends
  at path resolution, by contract.

## 4. Design

### 4.1 The registry file

- Location: `$KNOWLERY_CONFIG_DIR` else `~/.config/knowlery/`, file
  `registry.json`:

  ```json
  { "schemaVersion": 1, "kbs": { "work": { "path": "/Users/jay/vaults/work-kb" } } }
  ```

- Names: `[a-z0-9][a-z0-9-_]*`, max 64 chars; `*` and `all` reserved
  (federation). Rejected with the rule spelled out.
- Paths are expanded and **canonicalized at add-time** (symlinks resolved —
  the same canonicalize-first discipline the plan freezes for `init_kb`) and
  stored absolute. Registering a path already registered under another name is
  a warning, not an error (two names may deliberately point at one KB).
- **A corrupt registry is an error, never a silent reset.** This file is the
  user's list of their knowledge bases; unlike vault-local caches (which
  self-heal by regeneration), losing it silently is data loss. Parse failure →
  exit 1 naming the file and suggesting manual repair.
- `kb add` verifies the path exists; if it is not an initialized workspace it
  registers anyway with a notice (`knowlery init --dir` may come later — the
  registry is an address book, not a gatekeeper).

### 4.2 `kb list` and drift

`kb list` reports each entry's live state: `ok` (initialized workspace),
`uninitialized` (folder exists, no workspace), `missing` (path gone — moved or
deleted). Missing entries are flagged, never auto-pruned; `kb remove` is the
explicit cleanup. `--json` for tooling/agents.

### 4.3 `--kb` resolution

In `main.ts`, before command dispatch: `--kb <name>` → registry lookup →
resolved path takes the exact position `--dir` would have. Unknown name → exit
1 listing registered names. `--kb` + `--dir` → exit 2 (usage error, the plan's
no-silent-precedence rule). Applies uniformly to every command that accepts
`--dir` (init included — `knowlery init --kb work` errors helpfully: init
doesn't take `--kb`, register after initializing; this keeps `--kb` strictly
"resolve an *existing* name", mirroring the plan's addressing principle).

### 4.4 Federated query

`query --kb '*'`:

1. Iterate registered KBs (skipping `missing`/`uninitialized` with a stderr
   note each — reported, not fatal).
2. Run the standard engine per KB; collect non-abstaining results.
3. Merge candidates by score (comparable by construction), truncate to `--k`,
   and prefix each result's path with its KB name (`work: concepts/...`);
   `--json` carries a `kb` field per candidate plus a per-KB verdict summary.
4. All KBs abstain → the abstention message lists the KBs consulted; exit 0 as
   ever.

`stale --kb '*'` is deliberately excluded in v1 (staleness reports are
per-vault work lists; concatenating them invites misreading) — recorded, easy
to add on demand.

### 4.5 Plugin registration

The Obsidian plugin registers its vault on setup completion and on load of an
initialized vault: name = the kbName slug (deduplicated with a numeric suffix
on collision), skipped if the path is already registered. A settings toggle
("Register this vault for CLI/agent access", default **on** — maintainer
decision at spec review) opts out and unregisters.

**Ownership rule (maintainer correction at spec review):** the plugin records
**the exact name it created** in its own plugin settings, and toggle-off
removes **only that name**. If the path was already registered when the plugin
first looked (a user-created entry, e.g. `work`), the plugin creates nothing,
records no ownership, and toggle-off removes nothing — a pre-existing entry is
the user's, never the plugin's to delete. If the plugin-owned entry was
meanwhile removed or repointed by the user, toggle-off is a silent no-op
(remove exactly what you created, or nothing).

### 4.6 Docs

The docs site gains "Working with multiple knowledge bases" under Guides
(en + zh): the registry, `--kb`, federated query, and the plugin toggle. The
skill's command table gains the `kb` rows and `--kb` conduct (prefer `--kb`
names the user used; never register/remove on the agent's own initiative).

## 5. Safety properties, restated as tests

1. Compatibility: every existing command behaves byte-identically with no
   registry present; `--kb`+`--dir` exits 2; unknown `--kb` exits 1 with names.
2. Registry file: canonicalization at add; reserved/invalid names rejected;
   corrupt file errors loudly (and `kb list`/`add` never rewrite it in that
   state); remove never touches the KB's files.
3. Federated: attribution present on every merged result; a KB with a missing
   path is skipped with a note, not fatal; all-abstain lists consulted KBs;
   merge ordering is score-descending across KBs.
4. Plugin registration: registers once (no duplicate churn on every load),
   collision gets a suffix; **ownership**: toggle-off removes only the
   plugin-created name — a pre-existing user entry for the same path survives
   toggle-off, and a user-removed plugin entry makes toggle-off a no-op; all
   through the same core registry module (purity-guarded, shared by CLI and
   plugin).

## 6. Acceptance criteria

1. §5 tests pass; no existing test modified.
2. Docs chapter (both locales) + skill assertions; `docs:build` green.
3. `npm test`, lint, build, eval `--assert-baseline` green.
4. Manual §7 passes.

## 7. Maintainer self-test checklist (acceptance round)

1. Register your real vault and a scratch KB under names; `knowlery query --kb
   <name>` from an unrelated directory; `kb list` shows live states.
2. `query --kb '*'` with a question only one KB can answer — attribution names
   the right KB; with a question neither can answer — abstention lists both.
3. Move a registered folder; `kb list` flags it `missing`; commands with that
   `--kb` fail with a clear message; `kb remove` cleans it.
4. In Obsidian: confirm the vault self-registered (or the toggle controls it);
   turn the toggle off and confirm unregistration.
5. `npm test && npm run eval -- --assert-baseline` — green.
