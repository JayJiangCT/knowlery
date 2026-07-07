# F4 (0.8.0) — Repo Lint Hygiene

- **Status:** Done — maintainer acceptance passed 2026-07-07 (with two acceptance amendments: generic hidden-dir ignores; Catalyst finding → two-renderer settings design, minAppVersion stays 1.12.2)
- **Target release:** 0.8.0
- **Branch:** `cursor/08-f4-lint-hygiene-92eb` (off `main` @ 0.8 F3)
- **Depends on:** — (independent; scope from the 0.6.1 scan + 0.7 F1 acceptance side
  notes, consolidated in the 0.8 README backlog ledger)

## 1. Problem statement

Investigation results on current `main` (all reproduced, not assumed):

1. **Unscoped eslint crashes.** `npx eslint .` dies with a hard error before
   producing a report: obsidianmd's recommended config applies typed rules
   (`@typescript-eslint/no-deprecated`) to every file, but only `src/**` has
   `parserOptions.project` — the first file outside that scope
   (`build/shims/gray-matter-engines.js`) kills the run. On the maintainer's
   machine, untracked `.venv*/` dirs (gitignored but not eslint-ignored) crash it
   even earlier. `tests/` and `evals/` are invisible to lint entirely.
2. **The 0.6-era warning debt is hidden, not paid.** `npm run lint` reports 0
   problems because eight typed rules are switched `off` in the config. Re-enabling
   them measures the real debt: **77 violations** — 41 `no-misused-promises`
   (async handlers passed to void-returning JSX attributes), 15
   `no-floating-promises`, 11 `no-unsafe-assignment`, 7 `no-require-imports`, 2
   `no-unsafe-return`, 1 `no-unsafe-argument`. (Two of the eight, `no-unsafe-call`
   and `no-unsafe-member-access`, have **zero** violations — switched off for
   nothing.)
3. **`display()` is now formally deprecated.** With obsidian typings updated
   (installed 1.12.3 → current 1.13.1), the API docs mark
   `SettingTab.display()` as *"@deprecated Since 1.13.0. Use getSettingDefinitions
   instead"* — and our own lint immediately errors on all 4 `this.display()`
   re-render call sites in `src/settings.tsx`. The typings pin `"obsidian":
   "latest"` is itself part of the problem: lint results drift with whatever
   version npm resolves on install day.
4. **Discovered during investigation, not in the backlog:** no CI workflow runs
   lint or tests at all. The two green checks on every PR are `assert-baseline`
   and `generated-script-drift`; the 276-test suite and eslint run only on
   developer machines. Every guarantee F4 establishes would be unenforced.

## 2. Goals

1. `npx eslint .` completes repo-wide without crashing — including with `.venv*/`
   present — and `tests/` + `evals/` come under typed lint.
2. The eight disabled typed rules are re-enabled at `error` severity and all 77
   violations fixed. `npm run lint` stays at zero problems, now meaning something.
3. Obsidian typings pinned exactly at `1.13.1` (maintainer decision at spec
   review: a `^` range still drifts on future 1.14/1.15 resolutions — the exact
   pin is what actually removes install-day drift; future bumps become deliberate
   commits); the settings tab migrates to declarative `getSettingDefinitions()`
   with `display()` retained only as the pre-1.13 interpreter of the same
   definitions (amended at acceptance — see §4.3; `minAppVersion` stays 1.12.2
   because Obsidian 1.13 is Catalyst-only).
4. A `ci.yml` workflow runs lint + tests on every PR and push to `main`, making
   F4's state the enforced floor rather than a snapshot.

## 3. Non-goals

- No new lint rules beyond re-enabling what exists (exceptions below); no
  formatter introduction, no tooling swap.
- `no-undef` stays off for TS files (redundant under the type checker, standard
  practice) and `no-control-regex` stays off (the tokenizer's CJK handling uses
  control-plane regexes deliberately); both get a config comment saying why.
- No settings **UX** redesign — the migration re-expresses the same settings in
  the new API, it does not add/remove/reorganize them.
- No eslint-disable comments anywhere — same policy the 0.6.1 scan compliance
  work established. Everything is fixed at the config or code level.

## 4. Design

### 4.1 Config: one typed-lint scope, honest ignores

- `eslint.config.mjs` ignores gain `.venv*/**`, `build/**` (three inert scanner
  shims, not application code), and `docs-site/**` cache paths as needed — the
  goal is that *unscoped* runs see exactly the code we maintain.
- Typed linting moves from `project: './tsconfig.json'` (src-only) to
  typescript-eslint's `projectService`, with `tests/**` and `evals/**` included —
  they are TypeScript and they call the same APIs; type-aware rules apply. Any
  violations this surfaces in tests/evals are fixed in this feature, not waived.
- `npm run lint` becomes `eslint .` — the scoped-vs-unscoped distinction (the
  thing that let the crash hide) stops existing.

### 4.2 The 77 fixes, by mechanism

- **41 `no-misused-promises`:** async functions passed where `void`-returns are
  expected (JSX `onClick` etc.). Fix pattern: `onClick={() => { void doAsync(); }}`
  — the established codebase idiom (`void persistScope(...)` etc.), applied
  consistently.
- **15 `no-floating-promises`:** explicit `void` or `await` at each call site.
- **7 `no-require-imports`:** convert to static imports (they live in node-side
  core files like `scan.ts`, `node-detect.ts` — import at top is correct there).
- **11 `no-unsafe-assignment` + 2 return + 1 argument:** narrow with real types
  (mostly `JSON.parse` and frontmatter results — cast to `unknown` and parse
  through the existing zod schemas where one exists, or a local interface).
- `no-unsafe-call` / `no-unsafe-member-access`: zero hits — re-enabled for free.
- `no-explicit-any` stays off in this feature (its count is unmeasured and `any`
  at the Obsidian API boundary is sometimes the honest type); recorded as a
  possible future tightening, not scope creep here.

### 4.3 Settings tab migration (`display` → `getSettingDefinitions`)

**Decision point for the maintainer — this bumps `minAppVersion` to 1.13.0**
(currently 1.12.2; precedent: 0.6.1 bumped for `registerCliHandler`).

Why migrate rather than pin typings and wait:

- The 1.13 API is *declarative*: definitions with `visible`/`disabled` predicates
  and `refreshDomState()`/`update()` replace our four manual `this.display()`
  full-tab re-renders — the exact call sites the lint now flags. The tab's
  logic gets simpler, not just newer.
- Custom UI survives: definition items accept a `render(setting, group)` escape
  hatch (with cleanup), which carries the React-rooted advanced section and the
  async vault-initialized banner without redesign.
- Staying on `display()` means pinning typings at 1.12 forever-growing behind, or
  suppressing a deprecation our own no-eslint-disable policy leaves no clean way
  to suppress.

Migration shape: `getSettingDefinitions()` returns the general / platform /
activity / bundle-defaults / maintenance groups as definitions (controls wired
through `getControlValue`/`setControlValue` overrides onto `plugin.settings`);
the uninitialized-vault banner and the React advanced section become `render`
items; `hide()` keeps unmounting the React root.

**Amended at maintainer acceptance (blank-settings finding).** The original plan
deleted `display()` and bumped `minAppVersion` to 1.13.0. The maintainer's
real-vault test showed a completely blank settings page — and the root cause
invalidated the plan's premise: **Obsidian 1.13 is Catalyst-only** (early
access; verified against the official changelog — latest public release is
1.12.7, 2026-03-23). Shipping `minAppVersion: 1.13.0` would have locked every
public-release user out of 0.8.0.

Revised design — *one definitions array, two renderers*:

- `minAppVersion` stays **1.12.2**.
- `getSettingDefinitions()` remains the single source of truth. On >= 1.13 the
  framework renders it declaratively (settings search included).
- `display()` returns as the documented pre-1.13 fallback — but instead of a
  second hand-maintained rendering, it runs a ~60-line interpreter that renders
  the *same* definitions imperatively (groups → headings, `control` items →
  `addToggle`/`addText` wired through the same `get/setControlValue`, `render`
  items called directly). The drift-by-construction objection to the original
  "dual path" option is void: there is one description of the settings and two
  mechanical consumers of it.
- Re-renders go through a capability-detected `requestRender()`:
  `SettingTab.update()` when it exists (1.13+), re-running the fallback renderer
  otherwise. Structural access keeps `obsidianmd/no-unsupported-api` satisfied
  at `minAppVersion` 1.12.2.
- When 1.13 reaches public release, deleting the fallback is a two-line change
  and the minAppVersion bump can ride any later release.

### 4.4 CI workflow

`.github/workflows/ci.yml`: on PR + push to `main`, Node 20, `npm ci`, `npm run
lint`, `npm test`. Build is already exercised by `generated-script-drift`; eval by
`eval.yml`. Kept as a separate workflow so required-check configuration stays
per-concern.

## 5. Acceptance criteria

1. `npx eslint .` (unscoped, repo root) exits 0 with zero problems; a synthetic
   `.venv-test/` dir with a `.py`/`.js` file inside does not crash or pollute it.
2. All eight previously-disabled rules at `error`; `npm run lint` zero problems
   with `tests/**` and `evals/**` in scope.
3. `rg "eslint-disable" src tests evals` returns nothing hand-written.
   (Implementation note: the one textual match is inside
   `src/assets/query-script.generated.ts` — a `max-len` comment from *vendored
   dependency source* embedded in the generated string constant, not a
   suppression in maintained code; the file is auto-generated, lint-ignored,
   and CI-diffed.)
4. Obsidian typings pinned exactly at `1.13.1` in `package.json` (no `latest`,
   no `^` range) with `package-lock.json` resolved to `obsidian@1.13.1`;
   `minAppVersion` **stays 1.12.2** (amended — 1.13 is Catalyst-only, §4.3);
   `src/settings.tsx` keeps `display()` solely as the pre-1.13 fallback that
   interprets the same definitions, our own code never calls it, and lint shows
   zero `no-deprecated` / `no-unsupported-api` errors.
5. `ci.yml` present and green on this PR (it self-tests: the PR that introduces
   it must pass it).
6. Full suite: `npm test`, `npm run build`, `npm run eval -- --assert-baseline`
   green; settings behavior verified by the maintainer in §6.

## 6. Maintainer self-test checklist (acceptance round)

1. On your **public-release Obsidian (1.12.x)** with the built plugin: open
   Settings → Knowlery. Verify all sections render via the fallback interpreter,
   every control reads and persists correctly (platform switch, activity toggle,
   bundle defaults, maintenance actions), the uninitialized-vault banner still
   appears in a fresh vault, and the advanced React section works.
2. (Deferred until 1.13 is available to you — Catalyst or public:) the
   declarative path renders identically and Knowlery settings appear in
   Obsidian's settings search.
3. Repo root: `npx eslint .` — zero problems, no crash, with your `.venv*` dirs
   present.
4. `npm test && npm run eval -- --assert-baseline` — green.
5. Confirm the new `ci` check appears and passes on the PR.
