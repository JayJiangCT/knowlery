# F2 (1.3.0) — Cook Eval: Measuring the Last Unmeasured Organ

- **Status:** Accepted 2026-07-17 (one review round: retrievability pinned, taxonomy static predicate, regen drift guard + metric-delta, two invariants added) — implementation in progress
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
2. **Retrievability under competition** (pinned at spec review — the
   unpinned version would have let implementations diverge): probes are
   generated deterministically per page — probe 1 is the page's `title`
   verbatim; probe 2 is the `description` when present (whole field,
   verbatim). The page must appear in the engine's **top-5** for at least
   one probe, judged by the in-repo engine. On greenfield material the
   weighted engine nearly always self-matches (floor ≈ 1.0 is expected and
   fine — it guards catastrophic regressions only); **the metric bites in
   the collision fixture**, where sibling pages compete — there it measures
   duplication/crowding, not mere findability. **Attribution policy for
   red runs**: cook-eval floors are asserted against the same-commit engine
   (the two co-evolve). A cook-eval red on an engine-only PR is an engine
   regression *signal* — that is the organs checking each other working as
   designed — and resolves either by fixing the engine or by a joint
   re-baseline with the trade-off called out in review. No engine pinning:
   pinning would silence exactly the signal this coupling exists to give.
3. **Frontmatter completeness**: the health-check minimum per type
   (`type`/`created`; `items` for comparisons; `status` for queries), plus
   `description` presence — the field retrieval weights ×2 and the map
   renders.
4. **Taxonomy discipline, as a static predicate** (rewritten at spec
   review — "added in the same cook" is temporal and undecidable from a
   snapshot): every tag and domain used by any compiled page **exists in
   `SCHEMA.md`'s taxonomy sections** — that is the whole machine-checked
   rule. Synonym-shaped near-duplicates across the used set (case/hyphen/
   plural variants) are flagged as findings. The temporal half of the
   skill's rule ("SCHEMA was extended *by* this cook, not edited freely")
   is a human item on the regeneration-review checklist (§4.3), where the
   diff makes it visible.
5. **Wiki connectivity**: fraction of compiled pages with ≥1 wikilink to
   another compiled page — the graph half, measured (orphan compiled pages
   are the anti-pattern the /explore-and-link guidance exists to prevent).
6. **User material untouched** (added at spec review — cheap and
   load-bearing): every file under the fixture's `material/` must exist
   byte-identical inside `cooked/` — cook compiles *from* notes, never
   rewrites them. A hard boolean, not a ratio.
7. **Restraint** (the over-compilation guard): each `case.yaml` may list
   `must_not_compile` decoys (e.g. a pure diary note); the checker fails if
   any decoy acquired a compiled page. Structure-green junk pages are the
   failure §4.5 admits the metrics can't see — this at least catches the
   deliberate-bait shape.

Report shape and baseline semantics mirror the retrieval eval exactly
(aligned at spec review): reports to `evals/reports/`, floors in
`evals/cook/baseline.json`, ratio metrics compared with the same tolerance
mechanism the retrieval baseline uses (±0.01), boolean invariants (material
untouched, decoys, citation resolution) as **hard floors** — no tolerance.
`npm run eval:cook -- --assert-baseline` is the CI entry point.

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
  shape. Includes two `must_not_compile` decoys (a diary entry, a transient
  todo) exercising invariant 7.
- **incremental**: material that *updates* existing compiled pages (changed
  sources → re-cook) — the staleness-driven shape; asserts updates landed in
  existing pages rather than duplicates. One changed source **contradicts**
  a compiled claim, exercising the skill's contradiction section — the
  reference output must show the contradiction folded in per the update
  policy (verified at regen review; the checker verifies the structural
  side: the page updated, no fork).
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
3. Commit `cooked/` — and review **the checker's metric delta as the
   primary artifact** (amended at spec review: LLM re-cooks are
   nondeterministic, so raw text diffs are weak behavior evidence; the
   report-to-report comparison is the signal, the text diff is context).
   The regen commit includes both reports.
4. Human checklist at regen review: the temporal taxonomy rule (§4.1.4) and
   the contradiction handling (§4.2) — the judgments the checker cannot
   make.

Trigger and **drift guard** (amended at spec review — a silent-staleness
hole otherwise): a CI step fails when the PR changes the cook skill
(`plugin/skills/cook/SKILL.md`, which is generated and committed, is the
detectable artifact) without touching `evals/cook/**`. Overridable only by
a `cook-eval-waiver` note in the PR body for prose-only edits — deliberate,
visible, never silent.

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
