# F5 (1.0.0) — The 1.0 Stability Contract

- **Status:** Accepted 2026-07-08 (two findings at spec review: ratification sweep covers F3's marker; passthrough tools tightened at ratification with the health.config carve-out, wording precision-fixed at maintainer read-through) — implementation in progress
- **Target release:** 1.0.0
- **Branch:** `cursor/10-f5-stability-contract-92eb`
- **Depends on:** F1–F4 (the surfaces being frozen), 1.0 plan ("a major version
  that means it: the workspace format, the CLI surface, and the MCP tool
  contracts freeze under semver" — binding)

## 1. Problem statement

Four features built the surfaces; F5 makes them a promise. Until now,
"frozen-candidate" markers and review discipline have protected interfaces
socially — a maintainer notices a rename. 1.0 turns that into mechanics: the
frozen surfaces are pinned by **contract tests** that fail on any drift, the
promise is **documented** where users can cite it, and the release itself
ships through the full lockstep checklist. F5 is the release wearing a spec.

## 2. Goals

1. **Name the frozen surfaces** (§4.1) and state the semver policy over them.
2. **Contract tests** (§4.2): a dedicated test suite that pins each frozen
   surface mechanically — the tests *are* the contract's enforcement.
3. **The stability docs page** (§4.3): a user-citable statement of what is
   frozen, what is explicitly *not*, and what a major bump would mean.
4. **Release prep** (§4.4): the 1.0.0 lockstep bump, changelog, and the
   ratification sweep (frozen-candidate → frozen).

## 3. Non-goals

- No new features, no behavior changes — any bug found during F5 lands as its
  own fix with maintainer sign-off, not silently inside the freeze commit.
- No API/plugin-SDK stability promise: `src/` internals stay internal. The
  contract covers *operational* surfaces (format, CLI, MCP, bundle format),
  not TypeScript imports.
- No LTS/backport policy — one release line, forward only.
- No freeze on the Obsidian plugin's UI surfaces (dashboard layout, modals):
  UI evolves freely; the contract is what scripts and agents depend on.

## 4. Design

### 4.1 The frozen surfaces and the semver policy

**Frozen at 1.0 (breaking any of these requires a major version):**

1. **Workspace format**: the meaning and location of `KNOWLEDGE.md`,
   `SCHEMA.md`, `INDEX.base`, the four compiled dirs, `inbox/`, `Library/`,
   `.knowlery/manifest.json` (existing fields), `.knowlery/bundles.json`
   (schemaVersion 1), and the page tier rules. New *optional* files/fields are
   minor; changing or removing existing meaning is major.
2. **CLI surface**: every command and subcommand shipped in 1.0, their
   positional arities, flags, `--json` output shapes (existing keys — additive
   keys are minor), exit-code semantics (0 success incl. findings / 1
   operational failure / 2 usage), and the `--kb`/`--dir` resolution rules.
3. **MCP contracts**: the eight tool names, their input schemas (required
   fields and types; new *optional* inputs are minor), `structuredContent`
   shapes (existing keys), findings-vs-errors semantics, the nine prompt
   names, the `knowlery://{kb}/{+path}` resource scheme and its allowlist
   boundary, and `mcp serve`'s flags + auth contract (bearer token, 401
   shape). **The frozen keys must be advertised, not just tested** (maintainer
   finding at spec review): four tools currently declare nested output
   objects as passthrough, so the schema a client introspects via
   `tools/list` says nothing about the very keys the freeze promises. §4.4a
   tightens them before ratification — with one deliberate exception,
   `health.config`, listed under not-frozen below.
4. **Bundle format (OKF)**: `knowlery-bundle.json` schemaVersion 1 fields,
   the zip layout (`index.md`, `agent-index.json`, `_sources/`, update log),
   and install/update gate semantics (version-increase requirement,
   local-modification refusal).
5. **KB registry**: `registry.json` schemaVersion 1, the name grammar
   (`[a-z0-9][a-z0-9-_]{0,63}`), reserved names, and the corrupt-is-loud rule.

**Explicitly not frozen:** retrieval ranking internals (scores may improve;
only the *shape* of results and the abstention verdict string are contract),
skill prose (content evolves; names are contract), plugin UI, docs, eval
thresholds, anything under `.knowlery/` not listed above (activity, reports,
freshness files — private state), and **the inner keys of `health`'s `config`
object** — individual check fields may be added, renamed, or retired as the
health checker evolves (maintainer wording fix at read-through: growth alone
would be minor everywhere else in this document; the carve-out exists for
rename/retire); freezing them would freeze the checks themselves. Its
contract is: `healthy` (boolean) and the presence of a `config` object; the
schema stays deliberately loose and this page says so.

**Deprecation path**: a surface can gain a successor (new flag, new tool) in
a minor; the old one keeps working until a major removes it. Aliases don't
count as breaks.

### 4.2 Contract tests

A new `tests/contract/` suite whose only job is pinning §4.1 — deliberately
separate from behavior tests, so a failure reads as "you are breaking the 1.0
contract", not "a test needs updating":

1. **CLI contract**: for each command, a table-driven assertion of accepted
   flags/arities (driven through the real arg parser), plus golden-shape
   checks on every `--json` output (exact top-level key sets against fixture
   workspaces) and the three exit-code classes.
2. **MCP contract**: over the in-memory transport — `tools/list` snapshot
   (names + full input JSON schemas, serialized and committed as a golden
   file), `structuredContent` key sets per tool, `prompts/list` names,
   resource template string, and one findings-are-data assertion per finding
   shape (abstention / unhealthy / stale-heavy).
3. **Format contract**: `manifest.json`, `bundles.json`, `registry.json`, and
   `knowlery-bundle.json` fixtures from 1.0.0 must parse with today's schemas
   (forward: a 1.x must always read 1.0 state); the workspace scaffold file
   list is pinned.
4. The golden files live in `tests/contract/golden/`; regenerating them
   requires a deliberate script run (`npm run contract:regen`), so drift
   cannot be committed by reflex.

### 4.3 The stability docs page

`reference/stability.md` (en + zh), linked from the sidebar: the §4.1 lists
in user language, the semver meaning ("what a 1.x update may/may not do to
you"), the not-frozen list stated just as plainly, and the deprecation path.
The Reference page's plugin-metadata table updates to 1.0.0.

### 4.4 Release prep and ratification sweep

- **(a) Schema tightening at ratification** (the §4.1 finding — the last
  moment the advertised schema may change is the freeze itself): `query`'s
  `candidates` entries, `stale`'s `stalePages`/`uncookedNotes` entries, and
  `list_bundles`' bundle entries replace `passthrough()` with their real key
  sets (`QueryCandidate`, `StaleFinding`/`UncookedNote`, the installed-bundle
  entry schema). `health.config` deliberately stays loose per §4.1's
  not-frozen list. This changes no runtime values — only what `tools/list`
  advertises — and the SDK validates results against the tightened schemas
  from then on, making the freeze self-enforcing at runtime too. The
  contract-test golden snapshot (§4.2.2) is generated *after* this, locking
  the tightened schemas.
- **Ratification**: the "1.0-frozen-candidate" markers in `core/mcp/server.ts`
  and the **F2/F3/F4** specs flip to "1.0-frozen (see f5)" (F3 §4.6 carries
  the marker for the three write tools — maintainer finding: the sweep as
  first drafted would have skipped it); spec README gains the freeze note.
- **Lockstep bump** (the 0.9 checklist, now with MCP): `package.json` +
  `package-lock.json` (`npm install --package-lock-only`), `manifest.json`,
  `versions.json` (1.0.0 → minAppVersion 1.12.2), `compile.ts`
  `knowleryVersion` stamp → `1.0.0`, CHANGELOG entry for 1.0.0 (the four
  features + the contract), and a docs sweep for stale version strings.
  `SERVER_INFO.version` is already 1.0.0 — the contract test pins it equal to
  the package version so it can never drift again.
- Release mechanics unchanged: tag → GitHub Release (plugin assets) + npm
  (OIDC, provenance, idempotent).

## 5. Safety properties, restated as tests

1. The contract suite exists, runs in CI with the normal test run, and each
   golden file matches the live surface (proven by the suite passing on the
   freeze commit itself).
2. Mutation check, once, manually during acceptance: rename one tool input
   field on a scratch branch → the MCP contract test fails; add an extra CLI
   flag handling → the CLI contract test fails. (Documented in the PR, not
   committed.)
3. Version-stamp coherence: one test asserts `package.json` version ==
   `manifest.json` version == `versions.json` head == `SERVER_INFO.version` ==
   the `knowleryVersion` bundle stamp.
4. All existing suites (391+) pass unmodified — F5 changes no behavior. The
   §4.4a schema tightening is the one code change, and its safety is proven
   by exactly those unmodified suites: every existing MCP test result still
   validates against the tightened schemas.
5. `docs:build` green with the stability page in both locales.

## 6. Acceptance criteria

1. §5 green; `npm test`, lint, build, eval `--assert-baseline` green.
2. Stability page reads correctly in both locales; Reference metadata at
   1.0.0.
3. Lockstep bump complete and coherent (the §5.3 test green).
4. Maintainer §7 passes; then the tag is cut by the maintainer.

## 7. Maintainer self-test checklist (acceptance round)

1. Read the stability page as a user: is every promise one you're willing to
   keep until 2.0?
2. Run the mutation check (§5.2) on a scratch branch; confirm both contract
   failures read clearly.
3. `npm test && npm run eval -- --assert-baseline` — green.
4. Cut `1.0.0` tag after merge; verify the GitHub Release assets and the npm
   publish (provenance badge, `npm i -g knowlery@1.0.0`, `knowlery --version`).
5. Post-release: `knowlery mcp` against the published package in one real
   client — the shipped artifact serves the frozen contract.
