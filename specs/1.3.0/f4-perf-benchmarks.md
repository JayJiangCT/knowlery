# F4 (1.3.0) — Performance Benchmarks in CI: the Guardrail Under No-Index

- **Status:** Draft — awaiting maintainer spec acceptance
- **Target release:** 1.3.0
- **Branch:** `cursor/13-f4-perf-bench-92eb`
- **Depends on:** the eval-harness precedent (0.6 F1 / 1.3 F2 — same repo
  conventions), the retrieval engine and orientation map (the things being
  measured)

## 1. Problem statement

Knowlery's architecture rests on one load-bearing assumption that has never
been measured: **no persisted index**. Every `query` rescans the vault; the
orientation map is computed live on read; federation multiplies both by the
number of registered KBs. This is a deliberate principle (nothing to go
stale, nothing to corrupt, the staleness report stays honest) — and it is
*linear-cost by design*. The promise holds only while the constant factor
stays small and the growth stays linear. Today nobody knows either: not the
latency envelope at 1,000 pages, not whether some helper quietly does
O(n²) work, not whether a future "small" change (one more regex per page)
doubles query time. 1.3's theme is grounding promises; this feature ships
**a deterministic synthetic-vault generator, a benchmark runner, and CI
guardrails** — so the no-index principle carries a measured envelope
instead of a hope, and regressions surface in the PR that causes them.

## 2. Goals

1. **Synthetic vault generator** (§4.1): seeded, deterministic, scalable —
   realistic page shape (frontmatter, wikilinks, en+zh bodies), three size
   tiers.
2. **Benchmark runner** (§4.2): `npm run eval:perf` measures the four
   user-visible paths — vault scan, query (scan included, the honest
   number), orientation map, federated query — with warmup and median-of-N.
3. **CI guardrails that survive noisy runners** (§4.3): generous absolute
   ceilings per tier **plus a complexity-shape check** (the large/medium
   timing ratio bounded — the machine-independent assertion that catches
   quadratic blowup even when absolute numbers drift).
4. **The measured envelope, documented** (§4.4): what KB size Knowlery is
   comfortable at, in user language, with numbers.

## 3. Non-goals

- **No optimization work.** Measure first; optimizing without a baseline is
  this feature's own anti-pattern. Any hotspot found becomes a ledger
  candidate, not scope creep here.
- **No persisted index and no caching** — this feature is the guardrail
  *under* the principle, not a referendum on it. If the envelope turns out
  unacceptable at realistic sizes, that finding goes to the maintainer as a
  1.4+ decision with data attached.
- No micro-benchmarks of internal helpers (tokenizers, scorers) — only the
  four user-visible paths; internals are free to reshuffle under them.
- No benchmarking of cook (LLM-bound, not our latency), bundle
  install/export (rare operations), or MCP transport overhead (protocol
  cost, not scan cost — and stdio framing is not ours).
- No committed absolute-latency baseline file (unlike retrieval/cook eval):
  wall-clock numbers are machine-bound; the committed contract is the
  ceiling set + ratio bound, reviewed in the spec, not regenerated.

## 4. Design

### 4.1 The synthetic vault generator

`evals/perf/generate-vault.ts` — a pure function from `(seed, tier)` to an
in-memory file map, materialized to a temp dir by the runner:

- **Deterministic**: seeded PRNG (mulberry32 — tiny, no dependency); same
  seed → byte-identical vault; the seed is a constant in the runner.
- **Realistic shape**, mirrored from real KB anatomy: ~60% compiled pages
  across the four dirs with conforming frontmatter (type/title/description/
  domain/created), a wikilink graph (2–6 outlinks per page, drawn from a
  Zipf-ish distribution so hubs exist), body text mixing en and zh sentences
  drawn from a fixed phrase bank (CJK bigram behavior is part of query
  cost); ~40% user-tier notes (`Idea/`, `Projects/`, inbox items) so scan
  sees the real tier mix.
- **Three tiers**: `small` = 100 pages (sanity/local), `medium` = 1,000
  (the CI workhorse — a serious personal KB), `large` = 5,000 (the
  stress tier — beyond any observed real KB today). The 100k-page number
  from the retrospective ledger is deliberately *not* a tier: generating it
  in CI costs more than the signal is worth at this stage; the ratio check
  extrapolates the shape instead.

### 4.2 The benchmark runner

`evals/perf/run.ts`, `npm run eval:perf [-- --assert-budgets]`:

- Materializes each tier to a temp dir, then measures four paths through
  the same public entry points the shells use (no private-API shortcuts):
  1. **scan** — `scanVault(root)`: the floor every operation pays;
  2. **query** — `runQuery(question, scanVault(root), 12)`: cold each
     iteration, scan included — the number the user actually feels; three
     fixed questions (en, zh, mixed) drawn from generated content so
     matches exist;
  3. **index** — `collectOrientationMap(root, now)`: the live-view promise;
  4. **federation** — `runFederatedQuery` across 3 registered medium KBs
     (temp registry via `KNOWLERY_CONFIG_DIR`, same isolation trick the
     MCP tests use).
- **Method**: 2 warmup + 5 measured iterations per path, report the
  **median** (variance-robust, standard practice); `performance.now()`
  timing; single-threaded, sequential — no parallel noise.
- **Report**: a JSON report to `evals/reports/perf-<timestamp>.json`
  (already gitignored) with per-path median/min/max per tier, plus a
  printed table. Report-only fields: pages/sec scan throughput and peak
  RSS delta (informational — no budget on memory yet).

### 4.3 CI guardrails: ceilings + shape

Two assertion layers, tuned to survive shared runners:

- **Absolute ceilings** (per path × tier, generous — these catch
  catastrophe, not drift): e.g. medium-tier query < 2s, large-tier query
  < 10s, medium index < 2s, federation(3×medium) < 6s. Exact numbers are
  set from the first CI runs with ~4× headroom over observed medians, and
  recorded in this spec at implementation (a finding, not a guess in
  advance) — changing a ceiling afterwards requires touching the spec-named
  constants file, which is the review tripwire.
- **Complexity shape**: `median(large) / median(medium)` must stay below
  `(5000/1000) × 2.0 = 10` for scan/query/index. Data grows 5×; time may
  grow at most 10× — linear passes with generous margin, quadratic
  (≈25×) fails loudly. This is the machine-independent core: runner speed
  cancels out of the ratio.
- **CI wiring**: a `perf` job in the eval workflow (same trigger set as
  retrieval/cook eval), running `eval:perf -- --assert-budgets` on the
  medium+large tiers, uploading the JSON report as an artifact. Not a
  required-for-merge check in week one: it runs observational for a few
  PRs to confirm runner variance, then the maintainer flips it required
  (recorded here when it happens).

### 4.4 The documented envelope

`docs-site` addition to the existing architecture/design pages (en+zh, one
section, not a new page): what "no index" costs at realistic sizes — the
medium-tier medians from CI as the quotable numbers, the linearity
statement, and the honest sentence that beyond the large tier you are in
unmeasured territory. The retrospective's "does no-index hold at scale?"
question gets a numeric answer with a dated source.

## 5. Verification

1. **Generator determinism**: same seed twice → deep-equal file maps; tier
   page counts exact; every generated compiled page passes the conformance
   checker (the generator must not test a vault shape that cannot exist).
2. **Runner correctness**: on the small tier, each path returns plausible
   non-error results (query finds matches for the fixed questions — a
   benchmark that measures failed queries measures nothing); report file
   schema-validated.
3. **Budget mechanics**: with an artificially tiny ceiling injected, the
   runner exits non-zero naming the path and tier; with defaults on a dev
   machine, exits zero.
4. **Shape check mechanics**: feeding a synthetic quadratic timing set to
   the ratio assertion fails it; linear passes.
5. **Purity/lint/CI**: generator + runner live under `evals/` (outside the
   core purity boundary but inside lint scope); `npm test`, lint, both
   existing evals stay green — this feature adds a third eval without
   touching the other two.

## 6. Acceptance criteria

1. §5 green locally; the `perf` CI job runs and uploads its report.
2. Ceilings recorded in this spec from first CI data (implementation
   finding).
3. Maintainer §7 passes.

## 7. Maintainer self-test checklist (acceptance round)

1. `npm run eval:perf` locally — read the table: do the medium-tier numbers
   match your lived experience of your real KB's responsiveness?
2. Point the runner's query path at your real KB size class and sanity-check
   the envelope claim in the docs section against feel.
3. Break linearity on purpose (e.g. add a nested rescan in a scratch branch)
   — the shape check fails and names the path.
4. Review the ceiling constants: would a 2× regression on the query path
   get caught? (It should fail the shape check or the ceiling, whichever
   moves first.)
5. `npm test && npm run eval -- --assert-baseline && npm run eval:cook -- --assert-baseline && npm run eval:perf -- --assert-budgets` — all green.
