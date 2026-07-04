# Knowlery 0.7.0 — Release Plan

**Theme:** One core, two shells — Knowlery's knowledge-base lifecycle becomes available
as a standalone CLI (`npm i -g knowlery`), while the Obsidian plugin remains the
premium shell on top of the same core and the same vault format.

## Positioning discipline

The CLI is **not** "Knowlery without Obsidian" — it is the same core with a second
shell. The framing every doc and announcement must keep:

- **CLI shell:** init / sync / query / stale / health / bundle-install — the knowledge
  base lifecycle for agent-CLI users, cloud agents, and headless environments.
- **Obsidian shell:** everything the CLI has, **plus** the review space, Knowledge
  health UI, the live snapshot with in-app `knowlery:query`, and Obsidian's semantic
  layer (wikilink resolution, backlinks, Bases).
- **One vault format.** A folder initialized by the CLI opens in Obsidian with zero
  migration, and vice versa; both shells may operate on the same vault concurrently
  (idempotent, write-on-change file operations make this safe).

npm package name `knowlery` verified available (2026-07-03).

## Features

| # | Feature | Spec | Depends on |
|---|---------|------|------------|
| F1 | Core extraction: `VaultFs` inversion of the lifecycle modules | [f1-core-extraction.md](./f1-core-extraction.md) | — |
| F2 | `knowlery` CLI skeleton: `init` / `sync` / `health` + npm packaging | [f2-cli-skeleton.md](./f2-cli-skeleton.md) | F1 |
| F3 | `knowlery query` / `knowlery stale` commands | (spec pending) | F2 |
| F4 | `knowlery bundle install` / `list` / `uninstall` | (spec pending) | F1, F2 |
| F5 | Environment-adaptive skills (CLI-mode write path; folds in the 0.6 backlog: retrieval-aware `/cook`, `/audit` on CLI primitives) | (spec pending) | F2 |

Execution order: F1 → F2 → F3 → F4 → F5.

## Non-goals for 0.7.0

- **No CLI bundle export.** The approve/flag review gate is UI-shaped; a headless
  export flow (TUI or manifest-driven review) is 0.8 material. `bundle install` only.
- **No review-space features in the CLI** (dashboard, weekly summary, activity ledger
  consumers, Claudian integration) — these are the Obsidian shell's value.
- **No monorepo package split.** The CLI is a third esbuild artifact from the same
  `src/`; separate packages are premature abstraction until proven otherwise.
- **No change to the vault format or the skills' contract** beyond environment
  adaptivity (F5).
- `INDEX.base` keeps being generated on init (harmless for CLI users, valuable the day
  they open the vault in Obsidian).

## Backlog (repo hygiene, schedulable any time)

- **Unscoped eslint run crashes** (pre-existing, confirmed on 0.6.1 base): `npx eslint .`
  fails on untracked `.venv*/` dirs (gitignored but not eslint-ignored) and on `tests/`
  (typed-lint rules lack `parserOptions.project` coverage for test files). The project
  script `npm run lint` scopes to `src/` and is unaffected. Fix together with the
  0.6-era warning cleanup (unsafe assignments, `require()` imports, promise-in-void
  attributes, `display` → `getSettingDefinitions`).

## Open item for the maintainer

- **BYOAO consolidation:** 0.7.0 effectively supersedes BYOAO's "global CLI install"
  role. Recommend archiving BYOAO and pointing its README at Knowlery once F2 ships,
  to avoid split effort. Decision pending.

## Process (SDD)

Same as 0.6.0: feature branch (`cursor/07-f<N>-<name>-92eb`) → spec under
`specs/0.7.0/` → maintainer spec acceptance → implementation against the spec's
acceptance criteria → maintainer acceptance testing with the spec's self-test
checklist.
