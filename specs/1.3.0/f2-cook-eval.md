# F2 (1.3.0) — Cook Eval: Measuring the Last Unmeasured Organ

- **Status:** Draft — awaiting maintainer spec acceptance
- **Target release:** 1.3.0
- **Branch:** `cursor/13-f2-cook-eval-92eb`
- **Depends on:** the retrieval engine (retrievability is judged by it), the
  existing eval harness conventions (`evals/`), 1.3 plan theme (binding:
  measurement, no new capabilities)

## 1. Problem statement

Every mechanical organ in Knowlery is measured — retrieval has golden sets
and CI floors, contracts have golden snapshots, generated artifacts have
drift checks. The one exception is the organ everything depends on: **cook**.
The compiled layer's quality — whether pages carry citations, whether they
can be found by the questions they exist to answer, whether the taxonomy
stays disciplined — is exactly what retrieval, staleness, bundles, and the
whole LLM-wiki story consume. Today it is guarded by prose in a skill and a
maintainer's eye.

Cook is LLM-driven and Knowlery never runs an LLM — so this eval cannot be
"run cook in CI." The design splits the problem the way the 0.6 rewrite
split retrieval: **judgment stays with agents; the judging of outcomes
becomes code.**

## 2. Goals

1. **A deterministic cook-quality checker**: pure functions over a workspace
   snapshot that score the *outcomes* of cooking, whoever performed it.
2. **Golden material fixtures + committed cooked outputs**: fixed raw
   material, a real agent's cook run committed as the reference output, CI
   asserting the checker's invariants over it forever.
3. **A regeneration protocol**: when the cook skill changes materially, a
   documented, deliberate maintainer act re-cooks the fixtures and commits
   the diff — skill-change impact becomes reviewable, like every other
   golden in this repo.
4. **Floors in CI**: the checker's metrics join the eval workflow with
   frozen minimums, the retrieval-baseline pattern applied to compilation.

## 3. Non-goals

- **No LLM calls in CI, ever** — the harness judges outputs; it never
  produces them.
- No semantic quality scoring (is this summary *good*?) — that remains
  agent/human judgment; we measure the structural substrate that makes
  semantic quality possible and verifiable.
- No new user-facing commands in this feature (the checker is an eval-suite
  module; promoting it into `/audit` or a CLI command is a recorded
  follow-up, not scoped here).
- No changes to the cook skill itself beyond what eval findings justify
  (and those land as their own reviewed edits).

## 4. Design

### 4.1 The invariants: what "well-cooked" means, mechanically

`evals/src/cook/checker.ts` — pure: `(snapshot, schema) → CookReport`.
Five measured properties per compiled page, aggregated per run:

1. **Citation coverage**: fraction of compiled pages with a non-empty
   `sources:` whose every entry resolves to an existing file. Pages without
   citations are invisible to staleness — the fabric metric.
2. **Retrievability**: for each compiled page, form probe questions from its
   own title and description; the page must appear in the engine's top-k for
   at least one probe. A page that can't be found by its own framing is
   compiled noise. (Judged by the real engine — the two organs check each
   other.)
3. **Frontmatter completeness**: the health-check minimum per type
   (`type`/`created`; `items` for comparisons; `status` for queries), plus
   `description` presence — the field retrieval weights ×2 and the map
   renders.
4. **Taxonomy discipline**: every page tag/domain either pre-exists in
   `SCHEMA.md` or was added to it in the same cook (the skill's own rule,
   now checked); flag synonym-shaped near-duplicates (case/hyphen variants)
   as findings.
5. **Wiki connectivity**: fraction of compiled pages with ≥1 wikilink to
   another compiled page — the graph half, measured (orphan compiled pages
   are the anti-pattern the /explore-and-link guidance exists to prevent).

Report shape mirrors the retrieval eval: per-fixture scores + an aggregate,
written to `evals/reports/`, with a `--assert-baseline` mode against frozen
floors in `evals/cook/baseline.json`.

### 4.2 Fixtures: golden material, committed outputs

```
evals/cook/fixtures/<case>/
├── material/        # the raw notes given to the agent (committed, frozen)
├── cooked/          # the reference workspace after a real cook (committed)
└── case.yaml        # what this case exercises + the cook invocation used
```

Three cases at launch, chosen to exercise distinct cook pressures:

- **greenfield**: 8–10 mixed raw notes (meeting scraps, a clipped article,
  inbox captures incl. CJK titles) into an empty workspace — the cold-start
  shape.
- **incremental**: material that *updates* existing compiled pages (changed
  sources → re-cook) — the staleness-driven shape; asserts updates landed in
  existing pages rather than duplicates.
- **collision**: material about near-identical topics that must merge or
  cross-link rather than fork (`aliases` discipline) — the drift shape.

The `cooked/` outputs are produced by a real agent run (the maintainer's,
protocoled in §4.3) — **committed like a golden**, then judged by the
checker in CI on every commit thereafter.

### 4.3 The regeneration protocol

`docs/` (contributor-facing) records the deliberate act, mirroring
`contract:regen`'s spirit:

1. Run the current cook skill against `material/` with a real agent
   (invocation recorded in `case.yaml`).
2. `npm run eval:cook` locally — the checker must pass floors.
3. Commit `cooked/` with the diff called out in review: **a golden diff is a
   skill-behavior change made visible.**

Trigger: material edits to the cook skill (the PR checklist notes it);
otherwise outputs stay frozen — CI is judging invariants, not freshness.

### 4.4 CI integration

The eval workflow gains a `cook-eval` job: `npm run eval:cook --
--assert-baseline` — checker over all fixture `cooked/` trees, floors from
`baseline.json`. Floors are set from the launch outputs (the 0.6 pattern:
freeze what is, then never regress silently; raising floors is a deliberate
commit).

### 4.5 One honest boundary, stated in the report

The checker validates *structure*, and structure is a necessary-not-
sufficient proxy for quality. The report says so in its header — this eval
catches "cook stopped citing" and "taxonomy exploded", not "this summary
misrepresents the source". The latter stays with maintainer acceptance
rounds and (future) agent-assisted review.

## 5. Safety properties, restated as tests

1. **Checker purity + determinism**: same snapshot → identical report;
   checker modules join the purity guard.
2. **Each invariant has a violation fixture**: a synthetic bad workspace per
   property (missing sources, dangling citation, unretrievable page, rogue
   tag, orphan page) — the checker must flag each; the *reference* fixtures
   must pass. (The checker is itself tested before it judges anything.)
3. **Baseline mechanics**: floors load, a below-floor report fails with a
   named metric, `--assert-baseline` green on the launch outputs.
4. **No-LLM guarantee**: the eval path makes zero network calls (asserted
   the same way the retrieval eval already is offline).
5. **Report shape** stable keys (it will be consumed by CI and future
   tooling).

## 6. Acceptance criteria

1. §5 green; checker + fixtures + baseline + CI job land together.
2. The three launch fixtures pass floors; violation fixtures all flagged.
3. Docs: regeneration protocol documented; eval README updated (en docs-site
   note optional — this is contributor-facing).
4. Maintainer §7 passes.

## 7. Maintainer self-test checklist (acceptance round)

1. Read the three `case.yaml`s and the committed `cooked/` trees — do the
   reference outputs look like cooks you'd accept from an agent in your own
   vault?
2. Run `npm run eval:cook` — floors pass; deliberately break one page
   (delete its `sources:`) — the checker names it.
3. Run one real re-cook of `greenfield` with your agent per the protocol;
   diff against the committed output — is the diff readable as a
   behavior-comparison artifact?
4. `npm test && npm run eval -- --assert-baseline` — all green.
