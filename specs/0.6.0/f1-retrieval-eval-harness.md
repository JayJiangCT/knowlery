# F1 — Retrieval Evaluation Harness

- **Status:** Accepted 2026-07-03 — implemented, awaiting maintainer acceptance testing (§7)
- **Target release:** 0.6.0
- **Branch:** `cursor/f1-retrieval-eval-harness-92eb`
- **Depends on:** nothing (this feature is the prerequisite for F2 and F3)

## 1. Problem statement

Knowlery's core value claim is efficient, reliable retrieval from a compiled knowledge layer.
Today nothing in the repository can answer the question *"did `/ask` locate the right pages?"*:

- Vault health checks (`src/core/vault-health.ts`) verify structural integrity only
  (frontmatter present, links resolve), never semantic correctness.
- Every change to the `/ask` retrieval waterfall (e.g. the 0.5.0 bundle-aware step) is
  validated by feel, not by measurement.
- F2 will replace the six-step prompt-driven waterfall in `/ask` Step 2 with a deterministic
  retrieval command. Without a frozen baseline score, "better" cannot be demonstrated.

F1 builds the measurement instrument: a golden question set, a fixture vault, a deterministic
baseline retriever that emulates the current `/ask` Step 2 behavior, and a scoring runner.

## 2. Goals

1. A committed **golden set** of questions with expected result pages, covering the retrieval
   scenarios Knowlery promises to handle.
2. A committed **fixture vault** that is realistic enough to make those questions meaningful,
   including deliberate traps (aliases, mixed Chinese/English, bundle-only knowledge,
   user-note-only knowledge, unanswerable questions).
3. A **baseline retriever** that deterministically reproduces the candidate-location stage of
   the current `/ask` skill (Step 2, sub-steps 2a–2f) without any LLM involvement.
4. A **runner** (`npm run eval`) that scores any retriever implementation against the golden
   set and reports recall@k and MRR, per-question and aggregate.
5. A **frozen baseline report** committed to the repository, which F2 must beat or match.
6. A **regression guard**: the runner can compare a fresh run against the committed baseline
   and exit non-zero on regression, so CI can hold the line.

## 3. Non-goals

- No changes to any bundled skill, template, or plugin runtime behavior. F1 is pure
  measurement infrastructure; the plugin build output (`main.js`) must be byte-identical.
- No LLM calls anywhere in the harness. The eval measures the deterministic
  candidate-location stage only — synthesis quality is out of scope.
- No attempt to bit-perfectly replicate Obsidian's in-app search ranking. The baseline is an
  explicit, documented approximation (see §5.3); its purpose is a stable reference number,
  not fidelity to Obsidian internals.
- No embeddings, no vector store.

## 4. Directory layout

```
evals/
  golden/
    questions.yaml          # golden set (single file, ~30 cases)
  fixtures/
    vault/                  # fixture vault, committed as plain files
      KNOWLEDGE.md
      SCHEMA.md
      INDEX.base
      entities/…            # ~12 pages
      concepts/…            # ~12 pages
      comparisons/…         # ~4 pages
      queries/…             # ~4 pages
      Daily/…               # ~8 user notes
      Projects/…            # ~8 user notes
      Library/sample-bundle/    # one installed OKF bundle
        okf.json
        agent-index.json
        index.md
        concepts/…
      .knowlery/bundles.json
  src/
    types.ts                # GoldenCase, RetrievalResult, EvalReport interfaces
    vault.ts                # fixture vault loader (gray-matter over the fixture tree)
    baseline-retriever.ts   # deterministic emulation of /ask Step 2 (§5.3)
    metrics.ts              # recall@k, MRR
    run.ts                  # CLI entry: score, report, assert-baseline
  reports/
    baseline.json           # frozen baseline, committed once at the end of F1
```

Placement rationale: `evals/` sits at the repo root, parallel to `tests/`, because it is
long-lived infrastructure with its own fixtures, not unit tests. `vitest.config.mjs` and
`npm test` remain untouched; eval fixtures must not be picked up by the unit-test globs
(`vitest run --dir tests` already scopes this).

## 5. Design

### 5.1 Golden set format

`evals/golden/questions.yaml`, one entry per case:

```yaml
- id: q-001
  question: "What did we decide about response time metrics?"
  expected:
    must:                       # pages a correct retrieval MUST surface
      - concepts/response-time-metrics.md
    nice:                       # pages that add value but are not required
      - Daily/2026-04-05.md
  category: concept-lookup
  notes: "Median-vs-average decision lives in one concept page."
```

- `must` paths are vault-relative. Scoring only uses `must`; `nice` is reported but unscored.
- `category` is one of: `entity-lookup`, `concept-lookup`, `synthesis` (evidence spans 2+
  pages), `alias` (question uses an alias, not the page title), `bilingual` (question in
  Chinese, content in English or vice versa), `bundle` (answer only in `Library/`),
  `user-note` (answer only outside agent directories), `unanswerable` (expected `must: []`).
- Target distribution: ~30 cases, at least 3 per category. `unanswerable` cases score as
  correct when the retriever returns fewer than `k` results and none above the score floor
  (see §5.4).

### 5.2 Fixture vault

A self-contained vault under `evals/fixtures/vault/`, written to exercise the golden set:

- Agent pages use the real v2 frontmatter core (`title`, `type`, `created`, `updated`,
  `tags`, `sources`, optional `status`, `domain`, `aliases`), consistent with
  `generateSchemaMd()` conventions.
- Content domain: a fictional but coherent product-engineering workspace (a team building a
  monitoring product), so synthesis questions have real cross-page evidence.
- Deliberate traps, each backing at least one golden case:
  - a concept referenced in questions only by its alias;
  - Chinese-language user notes whose knowledge got compiled into English agent pages;
  - a page whose topic exists only inside the installed bundle under `Library/`;
  - knowledge that was never cooked (exists only in `Projects/`);
  - two near-duplicate page titles in different directories;
  - an orphan page with no inbound links.
- `.knowlery/bundles.json` and `Library/sample-bundle/` mirror the real install layout
  produced by `src/core/okf/install.ts` (hand-authored, minimal but schema-valid).

### 5.3 Baseline retriever

`baseline-retriever.ts` deterministically emulates what the current `/ask` Step 2 instructs
an agent to do, sub-step by sub-step:

| /ask sub-step | Baseline emulation |
|---|---|
| 2a read `INDEX.base` | Scope = the four agent directories (what the Base filters express) |
| 2b `obsidian properties type=…` | Enumerate fixture pages by frontmatter `type` |
| 2c read `SCHEMA.md` | No-op for scoring (taxonomy read, not a lookup) |
| 2d `obsidian search "<concept>"` | Lexical search per extracted query term (see below) |
| 2e bundles | Read `.knowlery/bundles.json`, match bundle `title`/id against query terms, include matching `agent-index.json` entries |
| 2f broad fallback | Same lexical search over all remaining `.md` files |

- **Query term extraction is naive by design**: lowercase, strip punctuation, remove a small
  committed stopword list (English + Chinese function words), keep the rest. No synonym or
  alias expansion — the current skill gives an agent no deterministic mechanism for it
  either, and this gap is exactly what the eval should expose for F2.
- **Lexical search approximation** of `obsidian search`: case-insensitive whole-term match
  over title, aliases, tags, and body; per-term hit counts summed. Documented in the file
  header as an approximation (risk R1 in §8).
- **Ranking** merges candidates in the priority order the skill prose implies: agent pages
  before bundle pages before user notes; then `status: reviewed` over others; then term-hit
  score; then `updated` recency. Ties broken by path (stable output).

The retriever implements a small interface so F2 can plug in later without touching the
runner:

```ts
interface Retriever {
  name: string;
  retrieve(question: string, vault: FixtureVault, k: number): RankedPage[];
}
```

### 5.4 Metrics and scoring

- **recall@5** and **recall@10** over `must` pages, averaged across cases.
- **MRR** over the first `must` hit.
- `unanswerable` cases: correct iff no result reaches the score floor (floor = at least one
  query-term hit); reported as a separate accuracy number, excluded from recall/MRR averages.
- Report: per-category and aggregate table on stdout, plus a JSON report written to
  `evals/reports/<retriever>-<timestamp>.json` (git-ignored except `baseline.json`).

### 5.5 Runner CLI

- `npm run eval` → `tsx evals/src/run.ts` (adds `tsx` as a devDependency; the repo has no
  TS script runner today and esbuild-bundling a script for this is more moving parts).
- `npm run eval -- --assert-baseline` → additionally compares aggregate recall@10 and MRR
  against `evals/reports/baseline.json`; exits non-zero if either drops by more than the
  tolerance recorded in the baseline file (default 0.01). This is the CI hook; wiring it
  into a GitHub Actions workflow is included in F1's scope as a single job step on PRs.

### 5.6 Freezing the baseline

Last step of F1 implementation: run the baseline retriever, review per-question results by
hand (to catch golden-set authoring errors, not to tune the retriever), then commit
`evals/reports/baseline.json`. After freezing, golden set and fixture vault changes require
regenerating the baseline in the same PR.

## 6. Acceptance criteria

1. `npm run eval` runs on a clean checkout (after `npm install`) with no Obsidian, no
   network, and completes in under 30 seconds.
2. Golden set contains ≥ 30 cases with every category from §5.1 represented ≥ 3 times.
3. Fixture vault contains every trap listed in §5.2, each referenced by at least one case.
4. The runner prints per-category and aggregate recall@5 / recall@10 / MRR and writes the
   JSON report.
5. `evals/reports/baseline.json` is committed and `npm run eval -- --assert-baseline`
   passes on the merge commit; artificially degrading the retriever makes it fail.
6. A CI job runs the assert-baseline mode on pull requests.
7. `npm test`, `npm run lint`, and `npm run build` still pass; no file under `src/` changes.
8. The baseline's known weaknesses (alias misses, bilingual misses, bundle discovery) are
   visible in the per-category report — i.e. the eval demonstrably discriminates, with
   at least the `alias` and `bilingual` categories scoring below the aggregate.

## 7. Maintainer self-test checklist (acceptance round)

1. `git checkout cursor/f1-retrieval-eval-harness-92eb && npm install && npm run eval`
   — see the score table; confirm the numbers match `baseline.json`.
2. Open `evals/golden/questions.yaml` and spot-check 5 questions against the fixture vault:
   do the `must` pages actually answer them?
3. Edit `evals/src/baseline-retriever.ts` to return empty results, run
   `npm run eval -- --assert-baseline`, confirm it fails; revert.
4. Add one new golden case of your own against the fixture vault and re-run — confirm the
   report picks it up without code changes.
5. `npm test && npm run build` — confirm green and no plugin diff.

## 8. Risks

- **R1 — Baseline fidelity.** The lexical approximation of `obsidian search` may over- or
  under-perform the real in-app search. Mitigation: the baseline is a *reference point*, not
  a claim about production behavior; the approximation is documented in code, and F2 is
  measured against the same fixture and metric so the comparison stays internally valid.
- **R2 — Golden set overfitting.** F2 could be tuned to this fixture. Mitigation: category
  coverage requirements, `nice` annotations for auditability, and the rule that golden-set
  edits land in the same PR as a regenerated baseline (diff-reviewable).
- **R3 — Fixture drift from real vault conventions.** If templates change (e.g. F4 touches
  `KNOWLEDGE.md`), the fixture could silently diverge. Mitigation: fixture frontmatter is
  validated in the runner against the minimum-core rules used by `src/core/vault-health.ts`
  (duplicated as a constant in `evals/src/vault.ts` with a comment pointing at the source,
  to keep the no-`src/`-changes guarantee).

## 9. Out of scope, deferred to later features

- Plugging the deterministic `knowlery query` retriever into this harness — F2.
- Any skill or template change — F2 / F4.
- Staleness signals in the fixture — F3 may extend the fixture vault in its own spec.
