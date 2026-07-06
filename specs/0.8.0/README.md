# Knowlery 0.8.0 — Release Plan

**Theme:** Close the sharing loop, pay the quality debt — knowledge bundle **export**
becomes headless (completing OKF: 0.5.0 shipped the export UI, 0.7.0 the CLI receiving
side), the retrieval engine learns to abstain on low confidence, and the recorded
engineering debt from two release cycles is cleared.

## Features

| # | Feature | Spec | Depends on |
|---|---------|------|------------|
| F1 | Headless bundle export: `knowlery bundle export` with a file-driven review gate | [f1-headless-export.md](./f1-headless-export.md) | 0.7 F1/F2/F4 |
| F2 | Score-quality abstention (eval-calibrated) | [f2-score-quality-abstention.md](./f2-score-quality-abstention.md) | 0.6 F1 harness |
| F3 | Release engineering hygiene: npm Trusted Publishing (OIDC), idempotent publish step, `bin` path fix, CLI EPIPE handling | [f3-release-hygiene.md](./f3-release-hygiene.md) | — |
| F4 | Repo lint hygiene: unscoped-eslint crash (`.venv*/`, `tests/` typed-lint), 0.6-scan warning cleanup, `display` → `getSettingDefinitions` | [f4-lint-hygiene.md](./f4-lint-hygiene.md) | — |

Execution order: F1 → F2 → F3 → F4 (F1 is the spine; F2 touches the engine and needs
the most careful eval work; F3/F4 are independent and can interleave).

## Non-goals for 0.8.0

- **No weakening of the review gate.** "Nothing ships unreviewed" is 0.5.0's core
  safety property; the headless form changes the review *surface* (a file instead of a
  modal), never the requirement.
- **No remote bundle sources or registries** — sharing stays file-based.
- **No new retrieval mechanisms** beyond the abstention threshold; the frozen baseline
  and all 0.6 thresholds keep holding.
- **No monorepo split**, still.

## Carried policies

- Lockstep versioning (one version, one tag, plugin + CLI together); workspace format
  versioned separately via the manifest; sync downgrade guard active since 0.7.0.
- SDD process unchanged: spec → maintainer acceptance → implementation → maintainer
  self-test, per feature, branches `cursor/08-f<N>-<name>-92eb` cut from `main` after
  the previous feature merges (stacking only if a feature must build on an unmerged
  predecessor — 0.8 has no such dependency after F1).

## Consolidated backlog ledger (source of the F2–F4 scopes)

- Score-quality abstention (0.7 F3 acceptance observation) → **F2**
- Trusted Publishing migration + token retirement; idempotent npm publish; `bin` path
  warning; CLI EPIPE handling (0.7.0 release findings) → **F3**
- Unscoped eslint crash; `tests/` missing from typed-lint; unsafe-assignment /
  require() / promise-in-void warnings; `display` deprecation (0.6.1 scan + 0.7 F1
  acceptance side note) → **F4**
- Deferred beyond 0.8: `/explore`/`/ideas` adopting the retrieval ladder wholesale;
  remote bundle distribution.
- Abstention exactly-half-coverage boundary (F2 acceptance residual, seed cases in
  the f2 spec §7 addendum): 2-term queries whose top candidate matches exactly one
  term pass clause 1's `>=` comparison; distinguishing them from legitimate
  half-coverage answers needs a specificity signal on the *unmatched* terms.
