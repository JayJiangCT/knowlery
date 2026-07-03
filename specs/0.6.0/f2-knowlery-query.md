# F2 — Deterministic Retrieval: the `knowlery query` Script and the `/ask` Slim-Down

- **Status:** Accepted 2026-07-03 — implemented, awaiting maintainer acceptance testing (§8)
- **Target release:** 0.6.0
- **Branch:** `cursor/f2-knowlery-query-92eb` (stacked on F1)
- **Depends on:** F1 (retrieval eval harness, frozen baseline)

## 1. Problem statement

The candidate-location stage of `/ask` is a six-step waterfall written in prose
(`src/assets/skills.ts`, Step 2, 2a–2f). Its correctness depends on an LLM following a
380-line prompt, it costs ~8 CLI round-trips per question, and it drifts across models.
The F1 baseline quantifies its weaknesses: aggregate recall@10 0.778 with alias at 0.500,
bilingual at 0.250, bundle recall@5 at 0.000, and no abstention signal for unanswerable
questions.

F2 moves candidate location from prompt to code: one deterministic, offline script that
the agent calls once, leaving the model only the judgment work (choosing what to read,
synthesizing, citing).

## 2. Design deviation from the release plan

The 0.6.0 plan named this feature "vault-level index projection + `knowlery query`".
This spec **drops the index projection**. Two reasons:

1. **The projection is a cache with an invalidation problem.** A projected
   `agent-index.json` for the vault goes stale the moment a page changes while Obsidian
   is closed — reintroducing exactly the staleness class 0.6.0 is trying to eliminate.
   A live scan of a personal vault (thousands of files) costs milliseconds in Node;
   there is nothing worth precomputing.
2. **The query script is itself the headless path.** The projection was justified as
   "first-class headless retrieval"; a self-contained script that scans live supersedes
   that justification.

The release plan README is updated accordingly in this PR.

## 3. Goals

1. A **pure retrieval engine** (`src/core/query/engine.ts`) with zero `obsidian` module
   imports, shared verbatim by three consumers: the shipped CLI script, plugin-side
   features, and the F1 eval harness.
2. A **self-contained CLI script** delivered into every vault at
   `.knowlery/bin/query.mjs`, runnable as `node .knowlery/bin/query.mjs "<question>"`
   with no Obsidian, no network, and no npm install.
3. A **slimmed `/ask` skill** whose Step 2 is one script invocation plus a compact
   fallback, replacing sub-steps 2a–2f.
4. **Measured superiority**: the engine, run through the F1 harness, beats the frozen
   baseline on aggregate and regresses no category (§7 for exact thresholds).

## 4. Non-goals

- No embeddings, no vector store, no external search dependency.
- No change to `/cook`, `/explore`, or other skills beyond `/ask` (they may point at the
  script in a later feature once it has proven itself in `/ask`).
- No change to the F1 baseline: `evals/reports/baseline.json` stays byte-identical.
- No index projection files (see §2).
- No staleness detection (that is F3).

## 5. Design

### 5.1 The engine (`src/core/query/engine.ts`)

Input: vault root (or preloaded page list), question string, `k`.
Output: ranked candidates with per-candidate explanations.

Pipeline:

1. **Scan.** Walk the vault for `.md` files (skip `.obsidian`, `.knowlery` internals,
   `KNOWLEDGE.md`, `SCHEMA.md`); parse frontmatter with `gray-matter`. Classify tier:
   `agent` (the four compiled dirs), `bundle` (matched via installed bundle indexes),
   `user` (everything else). Read `.knowlery/bundles.json` and **every** installed
   bundle's `agent-index.json` — unlike the baseline, bundle relevance is not gated on
   the bundle title matching the query.
2. **Term extraction.** Same tokenizer family as the baseline (lowercase, stopword
   lists for English and Chinese function words, CJK runs as literal chunks), plus
   **light morphological variants**: each latin term also matches its plural/singular
   pair (`label` ↔ `labels`) and simple `-ed`/`-ing` forms sharing the stem.
3. **Field-weighted scoring** (replaces the baseline's flat hit count):
   - title / aliases: ×4
   - tags / basename: ×3
   - `description` frontmatter: ×2
   - body: ×1
4. **Source-graph boost.** If a user note scores above zero and an agent page lists it
   in `sources`, the agent page inherits a fraction (0.5) of that note's score, with the
   note recorded as evidence. This is the deterministic fix for the bilingual gap: a
   Chinese question matches the Chinese source note, and the credit flows to the English
   compiled page that cites it.
5. **Ranking.** Score-first with small additive tier bonuses (agent +15%, bundle +10%
   of own score) — priority becomes a nudge, not a gate, which is what buries bundle
   and user-note answers in the baseline. Ties: `status: reviewed`, then `updated`
   recency, then path.
6. **Abstention.** If no candidate has any hit outside body text (i.e. nothing matched
   a title, alias, tag, basename, or description anywhere) and the top body-only score
   is below a floor, return an explicit `no-confident-match` verdict instead of a list.

### 5.2 CLI contract (`src/query-cli/main.ts` → `query.mjs`)

```
node .knowlery/bin/query.mjs "<question>" [--k 12] [--json]
```

- Resolves the vault root as the grandparent of its own directory
  (`.knowlery/bin/ → vault`), so it works from any cwd.
- Default output is token-lean plain text: one line per candidate —
  rank, path, type, score, one-line description or matched-evidence note — followed by
  a one-line hint when source-graph evidence contributed. `--json` emits the full
  structured result for tooling.
- The abstention verdict prints `No confident matches in this vault for: <terms>` and
  exits 0 (absence of knowledge is a result, not an error).
- Runtime: under 2 seconds on a vault of a few thousand notes.

### 5.3 Build and delivery

- `esbuild.config.mjs` gains a first pass that bundles `src/query-cli/main.ts`
  (platform `node`, format `esm`, gray-matter inlined) and writes
  `src/assets/query-script.generated.ts` exporting the bundle as a string constant.
  The generated file is committed so `tsc`/`eslint` work on a clean checkout; CI
  regenerates it and fails on diff (drift guard).
- The plugin ships the script text inside `main.js` (community-plugin installs only
  distribute `main.js`/`manifest.json`/`styles.css`, so a separate release asset would
  never reach store installs).
- Delivery reuses the version-sync pattern from 0.3.5 (`syncBuiltinSkills`): on plugin
  load with a new version, write `.knowlery/bin/query.mjs`; the setup wizard writes it
  on initialize. Vault-health config integrity gains a row for the script's presence.

### 5.4 The `/ask` slim-down (`src/assets/skills.ts`)

Step 2 becomes:

1. Run `node .knowlery/bin/query.mjs "<question>"` once; treat its ranked list as the
   candidate set. Respect an explicit no-confident-match verdict by telling the user the
   vault lacks coverage (and suggesting `/cook`).
2. **Fallback** (only if the script or Node is unavailable): a compact two-probe
   waterfall — `obsidian properties type=…` enumeration plus `obsidian search` per key
   concept — with a note to report that degraded mode was used.

Steps 1 and 3–6 (understanding, reading, synthesis, citation, saving) are unchanged.
The updated skill reaches existing vaults through the existing builtin-skill auto-sync;
custom/forked `/ask` copies are untouched, per the 0.3.5 rules. The `KNOWLEDGE.md`
template's "Knowledge Retrieval" section is updated for newly initialized vaults;
existing vaults are not rewritten (the skill is the operative instruction carrier).

### 5.5 Eval wiring (consumes F1)

- `evals/src/retrievers/knowlery-query.ts` adapts the engine to the F1 `Retriever`
  interface (the engine scans the fixture vault directly — same code path as the CLI).
- `npm run eval` reports both retrievers side by side; `--assert-baseline` now also
  asserts the F2 thresholds in §7 for the engine retriever, in addition to the frozen
  baseline check for the baseline retriever.
- Engine unit tests live in `tests/core/` like the rest of the suite (tokenizer
  variants, source-graph boost, abstention, CJK handling).

## 6. Risks

- **R1 — Overfitting to the fixture.** The engine's weights could be tuned to the 30
  golden cases. Mitigation: weights must be justified in code comments by mechanism
  (why titles outweigh bodies), not by which case they flip; the maintainer self-test
  (§8) includes running the script against a real vault.
- **R2 — Generated-file drift.** `query-script.generated.ts` could go stale relative
  to its source. Mitigation: CI regenerates and diffs (§5.3).
- **R3 — Node unavailability in some agent environments.** The `/ask` fallback (§5.4)
  keeps a degraded path; the README already lists Node as a requirement for registry
  features.
- **R4 — Divergence between script scan and Obsidian's view** (e.g. exotic vault
  layouts). The scan skips only well-known internal dirs and honors
  `app.vault.configDir` conventions the same way the 0.5.0 bundle code does.

## 7. Acceptance criteria

1. `src/core/query/engine.ts` imports nothing from `obsidian`; verified by a unit test
   or lint rule, and by the CLI bundle building with `platform: node`.
2. On the F1 fixture and golden set, the engine retriever achieves — with the frozen
   baseline untouched:
   - aggregate recall@10 ≥ 0.85 (baseline 0.778) and MRR ≥ 0.53 (baseline 0.428);
   - **no category below its baseline value** on recall@10 or MRR;
   - alias recall@10 ≥ 0.625, bilingual recall@10 ≥ 0.50, bundle recall@5 ≥ 0.667;
   - unanswerable accuracy ≥ baseline (0.667).
3. `npm run eval -- --assert-baseline` enforces criterion 2 in CI and fails when the
   engine regresses; `evals/reports/baseline.json` has no diff.
4. In a scratch vault: enabling the plugin writes `.knowlery/bin/query.mjs`;
   `node .knowlery/bin/query.mjs "<question>"` returns ranked results offline with
   Obsidian closed, in under 2 seconds; vault-health shows the script row.
5. The `/ask` skill contains the single-invocation Step 2 with fallback; no other
   bundled skill changes; auto-sync delivers it on version bump (existing test pattern).
6. `npm test`, `npm run lint`, `npm run build` green; regenerating
   `query-script.generated.ts` produces no diff on the merge commit.

## 8. Maintainer self-test checklist (acceptance round)

1. `git checkout cursor/f2-knowlery-query-92eb && npm install && npm run build && npm run eval`
   — confirm the side-by-side table: engine ≥ thresholds, baseline unchanged.
2. Copy `query.mjs` into a **real vault** (or enable the dev build of the plugin there),
   close Obsidian, and run 5 questions you know the answers to — judge whether the
   ranked paths are the pages you would have wanted an agent to read. This is the
   overfitting check (R1); trust your judgment over the fixture numbers.
3. Ask one question you know the vault cannot answer — confirm the explicit
   no-confident-match verdict rather than noise.
4. In the scratch/real vault, run `/ask` end-to-end from your agent client and confirm
   the skill makes exactly one query-script call before reading pages.
5. `npm test && npm run lint` — green.

## 9. Out of scope, deferred

- Staleness dirty-flags and their surfacing — F3.
- `CLAUDE.md` / `opencode.json` fixed-context slimming — F4.
- Pointing `/cook`, `/explore`, `/ideas` at the script — after F2 proves out in `/ask`.
