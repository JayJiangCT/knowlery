# F4 (0.9.0) — Retrieval: Specificity-Weighted Coverage

- **Status:** Accepted 2026-07-07 — implemented, awaiting maintainer acceptance testing (§7)
- **Target release:** 0.9.0
- **Branch:** `cursor/09-f4-specificity-92eb`
- **Depends on:** 0.8 F2 (confidence gate + calibration discipline), its §7
  addendum (the recorded boundary and the four real-vault seed cases)

## 1. Problem statement

0.8 F2's confidence gate left one recorded boundary: **top-candidate coverage of
exactly ½ passes clause 1's `>=`**, and on 2-term queries that lets one-word
collisions through. The maintainer's real-vault probes documented the shape:

| question | terms | matched | verdict (0.8) |
|---|---|---|---|
| 斑马 的移动端路线图是什么 | 斑马 · 移动端路线图 | 斑马 (entity title) | leaked |
| 胚胎筛查 的 API webhook 怎么接入 | 胚胎筛查 · api · webhook · 接入 | api, webhook | leaked (2/4) |
| 鼠疫 的 iOS 应用路线图是什么 | 鼠疫 · ios · 应用路线图 | 1/3 | correctly abstained |

The 0.8 sweep proved the boundary can't be fixed by moving the threshold:
raising `C_struct` past 0.5 over-abstains legitimate half-coverage answers
(q-013 synthesis, q-017 alias nickname, q-037 hard negative). The recorded
diagnosis: the gate needs a signal on the **unmatched** terms — 移动端路线图
going unmatched means something very different from "systems" going unmatched.

## 2. The mechanism: specificity-weighted coverage

Coverage stops counting terms and starts weighing them:

- **A latin token weighs 1.**
- **A CJK chunk weighs its character length** (a chunk is already a
  stopword-delimited phrase; under substring matching, a long chunk is a far
  more specific claim than a short one — the same reasoning that gave CJK
  matches ×2 scoring specificity in 0.6).

`coverage = matched weight / total weight`, used by both clause 1 (`>= ½` with a
structured hit) and clause 2 (`>= ⅔` prose). Thresholds, comparators, and the
other clauses stay exactly as calibrated in 0.8.

Why this is the right shape:

1. **Pure-latin queries are byte-identical to 0.8** — all weights are 1, the
   ratio reduces to the current count ratio. Six of eight golden categories
   cannot move, by construction.
2. The seed cases resolve correctly *with the existing thresholds*:
   - 斑马(2) matched / 移动端路线图(6) unmatched → 2⁄8 < ½ → **abstains**
   - api(1)+webhook(1) matched / 胚胎筛查(4)+接入(2) unmatched → 2⁄8 < ½ → **abstains**
   - and the guard case q-021 keeps answering: 性能优化调研(6)+推荐(2) matched /
     采样方法(4) unmatched → 8⁄12 ≥ ½ → **passes**
3. No new constants — the weights fall out of term shape. (A cap on chunk
   weight is deliberately *not* proposed; if calibration shows one huge chunk
   dominating pathologically, the cap becomes a calibration output and is
   recorded, 0.8-style.)

## 3. Non-goals

- No scoring/ranking changes — weights apply to the *gate's coverage ratio*
  only, never to candidate scores or ordering.
- No latin-term specificity modelling (rarity/IDF needs corpus statistics; the
  no-statistical-models line holds). Recorded: an all-latin exactly-half
  collision remains possible; none has been observed in practice.
- No changes to clause 3 (pure source-graph) or the body floor.
- q-016/q-020 (ranking misses) stay out of scope, as in 0.8.

## 4. Design

### 4.1 Engine

`extractQueryTerms` already returns `{ raw, cjk }`; a `termWeight(term)` helper
(latin → 1, cjk → `raw.length`) feeds a weighted-coverage computation in
`shouldAbstain`. Matched weight comes from the candidate's `matchedTerms`
(raw strings, mapped back through the query's term list). All three transports
inherit via the shared engine; `query-script.generated.ts` regenerates.

### 4.2 Golden set + fixture (0.8 §4.3 floor procedure, reused verbatim)

The fixture vault gains the seed shapes it currently lacks — a short-CJK-titled
entity page (the 斑马 analogue) — enabling:

- **≥3 new unanswerable cases**: the 2-chunk exactly-half shape (CJK title hit +
  long unmatched chunk), the mixed CJK+latin half shape (胚胎筛查 analogue), and
  a latin-anchored variant.
- **≥1 answerable guard case**: the q-021 shape (long CJK chunks matched, one
  shorter chunk unmatched) — pinning the weighted ratio from below.

Procedure: golden expansion lands first; pre-change engine runs once (the new
unanswerable cases will leak — that's the point) and the answerable floor is
re-frozen; the weighted gate then must fix the leaks without dropping any
answerable category below the floor. Sweep/verification recorded in a §7
addendum.

### 4.3 Docs

The 0.8 known-boundary note (docs + spec cross-references) updates to "closed
in 0.9"; the abstention explanation in the docs gains one sentence on weighting.

## 5. Safety properties, restated as tests

1. Latin-only invariance: for every existing latin-only golden question, the
   gate's decision inputs are bit-identical pre/post (unit test over the
   coverage function, plus the frozen floors holding).
2. Each seed shape abstains; the guard shape answers (fixture-driven).
3. Unit tests pin the weighted arithmetic: 2⁄8 abstains under clause 1, 8⁄12
   passes, weights of mixed queries computed as specified.
4. `unanswerableAccuracy` stays gated at 1.0 over the grown set; all per-category
   floors hold (`--assert-baseline`).
5. Transport parity: smoke re-asserts identical output CLI vs embedded script on
   one of the new abstention cases.

## 6. Acceptance criteria

1. §5 green; engine unit tests cover the weight function and both boundary
   directions.
2. Eval: new unanswerable cases 0-leak, answerable floors held, baseline
   re-frozen per procedure; §7 addendum records the runs.
3. `npm test`, lint, build, eval `--assert-baseline`, docs build green.
4. Maintainer real-vault probes (§7): the original four questions behave
   correctly on the real vault.

## 7. Maintainer self-test checklist (acceptance round)

1. Real vault: re-run the four 0.8-acceptance probes — 斑马/莫言/胚胎筛查 must
   now abstain; 鼠疫 keeps abstaining; your normal CJK questions keep answering.
2. Spot-check a couple of mixed-language questions you actually use.
3. `npm test && npm run eval -- --assert-baseline` — green.

## 8. Verification addendum (implementation record)

Floor procedure executed per §4.2:

1. **Pre-change run** (expanded set, 41 cases): the three new unanswerable shapes
   leak as designed — unanswerable **8/11**; answerable floors captured
   (bilingual grew a case: 0.8/0.8/0.566 re-frozen; all other categories
   unchanged); waterfall baseline re-frozen.
2. **Weighted gate on**: unanswerable **11/11**; every answerable category
   exactly at its pre-change floor (aggregate recall@10 0.933, MRR 0.839 —
   identical to pre-change, confirming the latin-invariance construction); the
   two pre-existing ranking misses (q-016, q-020) unchanged in number.
3. No sweep was needed: zero new constants, as specced. One arithmetic
   correction during implementation: 移动端路线图 is 6 characters, so the 斑马
   shape computes **2⁄8** (spec draft said 2⁄7); conclusions unaffected.
4. Both maintainer implementation watch-points landed as tests: duplicate/stray
   `matchedTerms` entries are weightless by construction (Set + Map lookup,
   unit-pinned), and latin-only invariance is pinned directly on
   `weightedCoverage`, not only via eval floors.
