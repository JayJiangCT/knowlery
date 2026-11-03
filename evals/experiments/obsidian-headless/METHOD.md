# Method — Obsidian native search vs Knowlery headless retrieval

Experiment date: 2026-11-02. Executed by a Local Agent (Claude Code) on the Owner's machine.
Status: research evidence for CLI-002. **Not a decision.** Nothing here is ACCEPTED.

## 1. Environment

| Item | Value |
|---|---|
| OS | macOS 14 (Darwin 23.6.0) |
| Obsidian | 1.14.5 (installer 1.12.7), CLI `/usr/local/bin/obsidian` |
| Node | v22.22.2 |
| Knowlery under test (A) | 1.6.2 — the vault's shipped `.knowlery/bin/query.mjs` (same build as the 1.6.2 plugin) |
| Repo base | `develop/2.0` @ `973127f` |

## 2. Data freeze

- Source: the Owner's live Work Vault (private). It was never written by any experiment step.
- Snapshot: a separate folder vault, opened in Obsidian as its own vault
  (`knowlery-bench-snapshot-2026-11-02`). Every Obsidian CLI call passes `vault=<snapshot>`;
  the runner's preflight asserts via `eval app.vault.getName()` that the target is the snapshot.
- **Inclusion rule = Knowlery 1.x's own scan scope**, so every group searches the same corpus:
  all `*.md` files, excluding hidden directories (`.*`), `node_modules`, `__pycache__`, and the
  vault's configured `ignoreDirs` (6 top-level folders). `Library/**` (bundles incl. their
  `agent-index.json`) is copied in full. Plus `.knowlery/{bin/query.mjs,config.json,bundles.json,manifest.json,triage.json}`
  so A runs unchanged. No attachments, no `.obsidian` from the source vault.
- Result: 3,934 Markdown files (30 MB). Obsidian sees 3,934 `.md`; the headless walker sees 3,934.
  Knowlery's scanner loads 3,873 of them in both the source and the snapshot — see §6 (malformed frontmatter).
- A sha256 manifest of every snapshot file (3,944 entries) and of every source-vault `.md` (4,899)
  was recorded before any run and re-checked after (results in REPORT.md). Manifests stay local.

### Incident during setup (recorded, fixed before any run)
Loading the Knowlery 1.6.2 plugin in the snapshot (needed once to compare `obsidian knowlery:query`
with A) **rewrote the root `AGENTS.md` and created `.agents/`, `.claude/`, `skills-lock.json`**.
The plugin was disabled, `AGENTS.md` restored from the source, the added files removed, and the
snapshot re-verified byte-identical to the pre-run manifest. B and C ran with no community plugins.
This is itself a finding: an Obsidian plugin that writes on load is unsafe for read-only benchmarks.

## 3. Golden set

- 56 questions, drafted by a separate agent **before any group ran**, sourced mainly from the
  Owner's real past questions in the vault's activity ledger (833 recorded questions), lightly
  rewritten to be self-contained, plus gap fills. Categories: entity 5, concept 5, decision 7,
  alias 6, bilingual 6, provenance 5, synthesis 6, history 6, conflict 4, unanswerable 6.
- Labeling rules: no use of any system under test (no `query.mjs`, no Obsidian CLI, no Knowlery MCP).
  Pages were found by browsing, reading, following wikilinks / `sources:`; `grep` only for distinctive
  identifiers and for confirming absence on unanswerable items. Method recorded per item.
  **Known bias:** grep-assisted labeling favors lexically findable pages.
- `must` = slots that are required; four items accept either of two pages for their slot
  (`must_slots` with alternatives), set before any run.
- Confidence: 47 high, 8 medium, 1 low. The low item (G055) is excluded from main metrics.
- **Owner review: NOT done.** The Owner asked to proceed to PR; labels are agent-drafted.
  All results are reported for "main" (55) and "high-confidence only" (47) as a sensitivity check.
- Freeze: sha256 of `golden.local.yaml`, `golden.frozen.json`, `questions.runner.json` recorded with
  a UTC timestamp before runs. Runners received only `{id, question}`.

## 4. Groups and the frozen plan

All plan parameters live in [`scripts/plan.ts`](scripts/plan.ts) and were committed to disk before
any run: `K=10`, `MAX_TERMS=6`, `RRF_K=60`, `LINK_SEEDS=3`, `W_META=3`, `W_AND=2`. None were tuned.

**Shared query terms:** A's own tokenizer (`extractQueryTerms`), raw form, de-duplicated, first 6.
Using A's tokenizer for B/C/E keeps the input identical and avoids giving any group a hand-written
query advantage.

| Group | What runs | Budget per question | Ranked? |
|---|---|---|---|
| A | `node .knowlery/bin/query.mjs "<question verbatim>"` (cwd = snapshot) | 1 call | yes (engine score) |
| B | `obsidian vault=… search query="<terms space-joined>" limit=10 format=json` (implicit AND) | 1 call | **no** — Obsidian returns no relevance order; MRR not reported |
| C | Obsidian multi-path: 1 all-terms search + 1 search per term + 1 `eval` over `app.metadataCache` (basename/title/aliases/tags) + ≤1 `eval` over `resolvedLinks` (link neighbours) → shared ranker | ≤ 1+6+2 calls | yes (constructed, fixed) |
| D | RRF(A, C), computed offline from the A and C lists | A + C | yes |
| E | A + the **same** shared ranker fed by a plain-file backend (substring scan, tolerant YAML parse + regex fallback, wikilink resolver) → RRF(A, E_supp) | 1 call + same logical query plan as C | yes |

Shared ranker (`rankSupplement`): `score = 3·metaHits + 2·[matches all terms] + Σ idf(term)`,
`idf = ln(1 + N/df)`; ties by path; neighbours of the top 3 appended only when fewer than K scored hits.
Abstains when no file covers ≥ min(2, #terms) terms and nothing matched metadata.
**C and E_supp share this ranker exactly; they differ only in backend**, so their gap isolates
"Obsidian's index vs plain files", not ranking cleverness.

`eval` in C reads Obsidian's in-memory index only (no writes). It is used because the Owner asked
for Obsidian to be leveraged as fully as possible; it is Obsidian's native metadata index, not a
reimplementation of search. `obsidian knowlery:query` was **not** used for B/C: on 3 probe questions
its top-5 was byte-identical to `query.mjs`, i.e. it is group A through a different transport.

**Gap in the preregistration (owned by the Local Agent):** the plan did not specify A's input format.
A was run with the verbatim question, but 1.x's own usage instructions say to pass 2–6 subject terms.
After seeing that A abstained on 29 of 56 questions, and before reading any per-question label outcome,
a **post-hoc** variant was added: A-terms (`scripts/run-a-terms.ts`, `query.mjs "<planTerms joined>"`),
with Dt = RRF(A-terms, C) and Et = RRF(A-terms, E_supp) using the same fusion rule. A (verbatim) remains
the primary row. `planTerms` keeps verbs such as "decide" and truncates at 6 terms, so A-terms is still a
lower bound on agent usage.

### Execution notes
- Runner robustness fix, made before the final B/C run (no plan change): one Obsidian CLI call never
  returned and ignored SIGTERM (it hung for more than 11 min). The identical query returned instantly when
  re-issued. Every CLI call now has a 30 s timeout with SIGKILL and one retry, and retries are logged in
  `env.json` (1 retry in the final run, 0 failed calls out of 969). The partial first run was discarded.
- `query.mjs` resolves the vault root from its own file location, not from the working directory.
  For the public fixture run it was copied into a scratch copy of `evals/fixtures/vault/.knowlery/bin/`.
  A first fixture attempt that pointed at the snapshot's `query.mjs` silently searched the snapshot and
  was discarded.
- The runner agents were stopped by an unrelated vault editing hook after writing their scripts. The
  primary agent reviewed both scripts against `plan.ts` and executed them.

## 5. Metrics

Reuses the definitions in `evals/src/metrics.ts`, extended for alternative-page slots:

- **Recall@5 / @10** — fraction of `must` slots with at least one acceptable page in the top k (answerable items only).
- **MRR** — reciprocal rank of the first acceptable `must` page; reported only for groups with a real ranking (not B).
- **Full must coverage@10** — share of answerable questions where *every* must slot is in the top 10 (evidence coverage).
- **No-answer accuracy** — share of unanswerable items where the group returned nothing.
- **False-abstain rate** — share of answerable items where the group returned nothing.
- Latency median / P95 per pass (pass 1 = first pass; pass 2 = immediate repeat), CLI calls, logical queries, candidate counts, D's de-duplication rate.
- Unique correct slots per group and **Obsidian-only slots** (found by B or C, not by A or E),
  each flagged if the page is invisible to 1.x because of malformed frontmatter.

## 6. Known confounds

- **Malformed frontmatter:** 58 snapshot files have YAML that gray-matter rejects (e.g. an unquoted
  value with `"…" (…)`). 1.x silently drops them from retrieval; Obsidian still indexes their body.
  Additionally, gray-matter caches a failed parse, so parsing the same content a *second* time in one
  process succeeds — page sets can differ between a one-shot CLI and a long-lived process.
- B's top-10 is whatever Obsidian returns first under `limit=10`; it is a set, not a ranking.
- Pass 1 is "first pass after the runner starts", not a cold Obsidian start (Obsidian was already
  running with the index built). Headless pass 1 includes a fresh `query.mjs` process per question in both passes.
- **C's pass-2 latency is contaminated:** two ad-hoc Obsidian CLI probes ran against the snapshot during
  that pass, at the Owner's request. Only pass-1 latency is reported. Results were identical across passes.
- Single machine, single run, 56 questions: differences of a few points are within noise.

## 7. Reproduce

```bash
# from the knowlery repo root
# Obsidian groups (needs the snapshot open as a vault named knowlery-bench-snapshot-2026-11-02)
npx tsx evals/experiments/obsidian-headless/scripts/run-obsidian.ts \
  --vault knowlery-bench-snapshot-2026-11-02 --questions <private>/questions.runner.json --out <private>/runs/obsidian [--probe <term>]
# Headless groups (PATH must not contain /usr/local/bin)
env PATH="$(dirname "$(which node)"):/usr/bin:/bin" npx tsx evals/experiments/obsidian-headless/scripts/run-headless.ts \
  --vault <snapshot> --questions <private>/questions.runner.json --out <private>/runs/headless --layout snapshot
# Post-hoc A-terms variant
env PATH="$(dirname "$(which node)"):/usr/bin:/bin" npx tsx evals/experiments/obsidian-headless/scripts/run-a-terms.ts \
  --vault <snapshot> --questions <private>/questions.runner.json --out <private>/runs/headless/A_terms.pass1.jsonl
# Score (writes results.<pass>.json here; private files to <private>)
npx tsx evals/experiments/obsidian-headless/scripts/score.ts <private> <snapshot> evals/experiments/obsidian-headless pass1
```

Public fixture run (no private data; anyone can run this):

```bash
cp -R evals/fixtures/vault /tmp/kfix && mkdir -p /tmp/kfix/.knowlery/bin
npx tsx evals/experiments/obsidian-headless/scripts/extract-query-mjs.ts 1.6.2 /tmp/kfix/.knowlery/bin/query.mjs  # must live inside the vault copy
env PATH="$(dirname "$(which node)"):/usr/bin:/bin" npx tsx evals/experiments/obsidian-headless/scripts/run-headless.ts \
  --vault /tmp/kfix --questions evals/golden/questions.yaml --out evals/experiments/obsidian-headless/fixture-results/headless --layout fixture
npx tsx evals/experiments/obsidian-headless/scripts/score-fixture.ts
```

Expected: A matches `evals/reports/knowlery-query-2026-07-24T02-08-02.959Z.json`
(Recall@10 0.933, MRR 0.839, unanswerable 1.0). The `query.mjs` used had sha256 prefix `e07dfb0ae4ad`
(recorded in `fixture-results/headless/env.json`). It is byte-identical to the bundle committed at tag
`1.6.2` (`src/assets/query-script.generated.ts`), which the extract script reproduces.
