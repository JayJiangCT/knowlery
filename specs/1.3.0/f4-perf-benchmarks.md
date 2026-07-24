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
3. **CI guardrails that survive noisy runners** (§4.3): three layers with
   distinct jobs — generous absolute ceilings (catch catastrophe), a
   growth-shape ratio check (catch super-linear blowup, machine-independent),
   and a **same-runner base/head paired comparison** (catch the uniform
   slowdown — the "one more regex per page" regression from §1 — which
   neither of the other two layers can see).
4. **The measured envelope, documented** (§4.4): what KB size Knowlery is
   comfortable at, in user language, with numbers — claimed no more strongly
   than a two-point measurement supports.

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
  wall-clock numbers are machine-bound. Drift detection is done by the
  same-runner paired comparison (§4.3) instead of a committed baseline;
  the committed contract is the ceiling set + ratio bounds, reviewed in
  the spec, not regenerated.

## 4. Design

### 4.1 The synthetic vault generator

`evals/perf/generate-vault.ts` — a pure function from `(seed, tier)` to an
in-memory file map, materialized to a temp dir by the runner:

- **Deterministic**: seeded PRNG (mulberry32 — tiny, no dependency); same
  seed → byte-identical vault; the seed is a constant in the runner.
- **Realistic shape**, calibrated against the maintainer's real vaults
  (Test 179 pages at 5% compiled, Wonder 134 at 31%, Jay WorkSpace 1,129 at
  17%): **~20% compiled pages / ~80% user-tier notes** (`Idea/`,
  `Projects/`, inbox items) — matching the largest observed real vault, so
  §4.4's envelope numbers describe reality rather than a synthetic
  compiled-heavy world. The compiled share is a generator parameter; a
  compiled-heavy stress variant is a one-line change if ever needed, not a
  tier of this spec.
- **Both graphs the engine actually walks**: compiled pages carry
  conforming frontmatter (type/title/description/domain/created), a
  body-wikilink graph (2–6 outlinks per page, Zipf-ish so hubs exist),
  **and frontmatter `sources:` edges pointing at generated user-tier note
  paths** — the edges `applySourceGraphBoost` resolves against the scanned
  page map; without them the benchmark would skip the engine's main graph
  computation entirely. Source edges are also Zipf-drawn (hub notes cited
  by many pages, mirroring real cook behavior). Bodies mix en and zh
  sentences from a fixed phrase bank (CJK bigram behavior is part of query
  cost).
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
     matches exist. **Each question is its own measured series with its own
     median**; every assertion in §4.3 applies per question (a zh-only
     regression must not hide inside an en-dominated aggregate);
  3. **index** — `collectOrientationMap(root, now)`: the live-view promise;
  4. **federation** — `runFederatedQuery` across 3 registered medium KBs
     (temp registry via `KNOWLERY_CONFIG_DIR`, same isolation trick the
     MCP tests use).
- **Method**: 2 warmup + 5 measured iterations per path, report the
  **median** (variance-robust, standard practice); `performance.now()`
  timing; single-threaded, sequential — no parallel noise.
- **The pairing seam**: the runner accepts `--src <repo-root>` (default:
  its own repo) and dynamically imports the four entry points from that
  tree — so CI can run *head's* runner against *base's* core with identical
  methodology (§4.3's paired layer). Eval code, not core: the dynamic
  import lives outside the purity boundary.
- **Report**: a JSON report to `evals/reports/perf-<timestamp>.json`
  (already gitignored) with per-path median/min/max per tier, plus a
  printed table. Report-only fields: pages/sec scan throughput and peak
  RSS delta (informational — no budget on memory yet).

### 4.3 CI guardrails: three layers, each catching what the others cannot

Honest division of labor — no single assertion catches everything, and the
layer table says which regression class lands where:

| Layer | Catches | Blind to |
| --- | --- | --- |
| Absolute ceilings | catastrophe (10×+, hangs) | drift within headroom |
| Growth-shape ratio | super-linear blowup (O(n²)) | uniform slowdown at every tier |
| Paired base/head | uniform slowdown (the 2× regex) | nothing structural — but needs the same runner |

- **Absolute ceilings** (per path × tier, generous): exact numbers are set
  from the first CI runs with ~4× headroom over observed medians and
  recorded in this spec at implementation (a finding, not a guess) —
  changing a ceiling afterwards touches the spec-named constants file,
  which is the review tripwire.
- **Growth shape**: `median(large) / median(medium)` must stay below
  `(5000/1000) × 2.0 = 10` for scan/query/index. Data grows 5×; time may
  grow at most 10× — clean growth passes with generous margin, quadratic
  (≈25×) fails loudly; runner speed cancels out of the ratio. **What this
  layer proves is bounded**: a two-point ratio can only certify "no obvious
  super-linear blowup in the 1k–5k range" — never linearity (§4.4 words
  the claim accordingly).
- **Paired base/head comparison** — the layer that makes §1's motivating
  scenario (one more regex per page, everything uniformly 2× slower)
  actually detectable. In the same CI job, on the same runner: check out
  the PR's merge-base into a scratch worktree, run **head's** runner twice
  — once against head's `src/`, once against base's via `--src` (identical
  methodology by construction; base needs no benchmark code of its own) —
  same seed, same tiers (medium only: pairing halves are compared, not
  extrapolated). Budget: **head median ≤ 1.5× base median, per path** —
  catches 2× with margin; same-machine sequential variance is far below
  this (observed spread recorded during the observational window).
  Bootstrap rule: if base's core predates the entry points the runner
  imports, the pairing layer reports `skipped` (only relevant to
  archaeology; every post-F4 PR has them).
- **Federation gets its own machine-independent bound** instead of joining
  the tier-shape check (its scaling axis is KB count, not page count):
  `median(federation over 3 medium KBs) ≤ 3.5 × median(single medium
  query)` — linear-in-KB-count with headroom for registry/attribution
  overhead, and the ratio cancels runner speed. Plus its ceiling and its
  paired comparison like every other path.
- **CI wiring**: a `perf` job in the eval workflow (same trigger set as
  retrieval/cook eval), running `eval:perf -- --assert-budgets` plus the
  paired comparison, uploading the JSON report as an artifact.
  **Observational→required graduation, concretely**: the job runs
  non-required until (a) ≥ 10 CI runs have accumulated, (b) zero false
  failures among them, and (c) per-path median spread across runs stays
  within 30% (confirming the 1.5× paired budget has real margin). The
  maintainer flips it required and the flip is recorded here with the
  observed spread numbers. If (c) fails, budgets are retuned from the data
  before flipping — never silently loosened after.

### 4.4 The documented envelope

`docs-site` addition to the existing architecture/design pages (en+zh, one
section, not a new page): what "no index" costs at realistic sizes — the
medium-tier medians from CI as the quotable numbers, and growth claimed
exactly as strongly as two points support: *"observed growth was consistent
with linear behavior over the measured 1k–5k range"* — never "proven
linear". Plus the honest sentence that beyond the large tier you are in
unmeasured territory. The retrospective's "does no-index hold at scale?"
question gets a numeric answer with a dated source.

## 5. Verification

1. **Generator determinism**: same seed twice → deep-equal file maps; tier
   page counts exact; every generated compiled page passes the conformance
   checker (the generator must not test a vault shape that cannot exist).
2. **Generator graph reality**: the generated vault has a non-zero count of
   frontmatter `sources:` edges, every edge resolves to an existing
   generated page path (the `applySourceGraphBoost` precondition), and the
   compiled share matches the ~20% parameter — asserted, not assumed.
3. **Runner correctness**: on the small tier, each path returns plausible
   non-error results (query finds matches for **each** of the three fixed
   questions — a benchmark that measures failed queries measures nothing);
   per-question medians appear separately in the schema-validated report.
4. **Budget mechanics**: with an artificially tiny ceiling injected, the
   runner exits non-zero naming the path and tier; with defaults on a dev
   machine, exits zero.
5. **Shape + ratio mechanics**: a synthetic quadratic timing set fails the
   growth-shape assertion, linear passes; a synthetic federation median
   above 3.5× the query median fails the federation bound.
6. **Pairing mechanics**: head runner with `--src` pointed at a scratch
   copy of the same tree → all paths within budget (self-comparison is the
   null test); with an artificial 2× delay shimmed into one path of the
   "head" side → the paired assertion fails naming that path; `--src` at a
   tree missing an entry point → `skipped`, exit zero.
7. **Purity/lint/CI**: generator + runner live under `evals/` (outside the
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
3. Break growth on purpose (e.g. add a nested rescan in a scratch branch)
   — the shape check fails and names the path.
4. Break *uniformly* on purpose (e.g. an extra regex pass over every page
   in a scratch branch, ~2× everywhere): ceilings and shape stay green —
   and the **paired comparison** fails. This is the §1 scenario, caught by
   the layer built for it.
5. `npm test && npm run eval -- --assert-baseline && npm run eval:cook -- --assert-baseline && npm run eval:perf -- --assert-budgets` — all green.
