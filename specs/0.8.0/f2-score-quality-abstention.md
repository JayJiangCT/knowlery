# F2 (0.8.0) — Score-Quality Abstention (Eval-Calibrated)

- **Status:** Done — maintainer acceptance testing (§6) passed 2026-07-06; real-vault residuals recorded in §7
- **Target release:** 0.8.0
- **Branch:** `cursor/08-f2-abstention-92eb` (off `main` @ 0.8 F1)
- **Depends on:** 0.6 F1 (eval harness, golden set, frozen baseline), 0.6 F2 (engine)

## 1. Problem statement

The engine's abstention rule (0.6 F2, §5.1 step 6) fires only when **no candidate
anywhere** has a structured-field or description hit and the best body-only score is
under a small floor. That was enough to clear the fixture's two easy unanswerable
cases, but the golden set already documents the failure mode it leaves open:

> `q-030` — "What is our mobile app roadmap?" → returns 6 results.
> Top hit: `entities/bob-martinez.md`, whose description says "owns the **alerting
> roadmap**". Of the three content terms `{mobile, app, roadmap}`, exactly one
> matched — and only in a description. The other five results are progressively
> weaker noise.

The mechanism: a *single common word* colliding with *one* field on *one* page defeats
abstention entirely, because the current rule asks "did anything match?" instead of
"did enough of the question match?". On a personal vault of realistic size, almost
every unanswerable question shares at least one word with something — so, as recorded
at 0.7 F3 acceptance, the engine almost never says the honest "no". Current measured
unanswerable accuracy: **2/3** (baseline prompt waterfall: also 2/3, by luck not
mechanism).

An agent acting on retrieval output cannot distinguish "the vault knows this" from
"one word collided". A wrong page presented confidently becomes a wrong answer
presented confidently; an honest abstention becomes a correct "I don't know, want me
to research it?".

## 2. Goals

1. **A confidence gate that reasons about query coverage, not mere match existence.**
   The signals are already computed per candidate — distinct terms matched, which
   field tier they matched in, body-only score, source-graph evidence — the gate just
   never consulted them.
2. **Calibrated against the harness, not intuition.** Exact constants are fixed by
   running the expanded golden set (see §4.3), under a hard constraint: **every
   answerable category holds its current numbers** (aggregate recall@10 0.926, MRR
   0.846; per-category floors per the existing `--assert-baseline` gates). Abstention
   improvements that cost recall are rejected — over-abstention is the same bug in the
   opposite direction.
3. **Golden set grows realistic unanswerable phrasings** — the current three were
   written before there was any abstention mechanism to probe; §4.3 adds collision
   shapes we know exist (tag collision, CJK substring collision, multi-page weak
   scatter), plus answerable hard negatives that pin the boundary from the other side.
4. **`unanswerableAccuracy` becomes a gated threshold** in the eval assert step, so
   the property is held by CI like recall and MRR are, not just reported.
5. All three transports (plugin CLI, global CLI, embedded script) get the improvement
   simultaneously — it's one function in the shared engine.

## 3. Non-goals

- **No new retrieval mechanisms** (0.8.0 release plan): no synonym dictionaries, no
  embeddings, no fuzzy scoring changes. Only the confidence gate over the existing
  signals changes.
- **No scoring/weight changes.** Ranking of returned results stays identical; the
  gate decides *whether* to return, never *what order*.
- **No output format break.** The verdict vocabulary stays `ok` /
  `no-confident-match`; the abstention line and `--json` shape are unchanged. (A
  graded "low-confidence" middle band was considered and rejected: agents treat any
  returned list as usable, so a soft band would just relocate the original problem.)
- **No fixing of the two known answerable misses** (`q-016` alias, `q-020` bilingual)
  — they are ranking problems, not abstention problems, and stay on the backlog. The
  gate must simply not make them worse.

## 4. Design

### 4.1 The confidence gate

`shouldAbstain` is replaced by a candidate-level predicate: **a result set is
confident iff the top candidate is confident.** (Weaker trailing candidates are fine —
the top item is what an agent reads first and trusts most; if the *best* evidence is a
collision, the whole list is noise.)

A top candidate is confident when any of these holds:

1. **Structured anchor:** at least one query term hit title/aliases/tags/basename
   (or prefix-matched them) — the page author's own naming agrees with the question —
   **and** term coverage clears the calibrated floor `C_struct` (proposed ½ of content
   terms; single-term questions trivially pass — this is what keeps `q-001`-style
   lookups and CJK single-chunk questions confident).
2. **Coverage anchor:** no structured hit, but the candidate matched (description or
   body) at least `C_soft` of the content terms (proposed: all terms for 2-term
   questions, ≥ ⅔ for longer) — a question fully restated in a page's prose is an
   answer even when the title uses different words. This clause is what protects
   `q-024` ("RED method" — bundle title shares no query term).
3. **Source-graph evidence:** the candidate was boosted by evidence in a cited source
   note (the existing bilingual path, `q-018`-`q-021`) — kept as an independent
   anchor, since coverage is computed against the compiled page and would misjudge
   cross-language questions.

The existing zero-candidates and body-only-floor rules remain as the outer shortcut.
All constants (`C_struct`, `C_soft`, the body floor) are **calibration outputs**, not
spec constants: implementation tunes them on the expanded golden set and records the
final values plus the sweep table in the spec's acceptance addendum.

The predicate reads only fields the engine already computes per candidate
(`matchedTerms`, `structuredHits`, `descriptionHits`, `bodyScore`, `evidence`) plus
one new cheap aggregate (distinct terms per field tier, today collapsed into total
hit counts). Deterministic, explainable, zero I/O — engine purity unchanged.

### 4.2 Why q-030 falls and q-024 survives

| | terms | structured hits | coverage | evidence | verdict |
|---|---|---|---|---|---|
| q-030 top (`bob-martinez`) | mobile, app, roadmap | 0 | 1/3 | none | abstain (fails 1, 2, 3) |
| q-024 top (`red-method`) | red, method, service, dashboards | 0 | high (prose restates the method) | none | ok (clause 2) |
| q-001 (`backpressure`) | backpressure | 1 (title) | 1/1 | — | ok (clause 1) |
| q-020 (bilingual) | CJK chunks | varies | low vs compiled page | cited source | ok (clause 3) |

### 4.3 Golden set expansion

New unanswerable cases (target ≥ 8 total, from today's 3), each probing a distinct
collision shape that exists in the fixture vault:

- **Tag collision:** a question whose only overlap is a taxonomy word (`person`,
  `product`) appearing as a tag on many pages.
- **CJK substring collision:** a Chinese question about a topic the vault lacks,
  sharing one common chunk (e.g. 告警) with existing pages — probes clause 1 under
  CJK's substring matching. **Boundary note (maintainer clarification at spec
  review):** these cases must be **multi-chunk** questions where only one common
  chunk collides — coverage then correctly fails clause 1. A *single-chunk*
  unanswerable question whose chunk substring-hits a title is mechanically
  indistinguishable from a legitimate single-term lookup ("背压" hitting the
  backpressure page is exactly how CJK retrieval is supposed to work), so clause 1's
  "single-term questions trivially pass" applies to CJK single-chunk queries too, by
  design. That residual leak is recorded as a known limitation, not probed by a
  golden case the gate cannot honestly distinguish.
- **Multi-page weak scatter:** each query term matches *somewhere*, but no single
  page covers more than one — probes that coverage is per-candidate, not per-corpus.
- **Entity-adjacent:** asks about a person/project the vault genuinely doesn't track,
  phrased like the entity-lookup cases that must keep working.

New answerable hard negatives (≥ 2): questions answerable only through
description/body phrasing with zero title overlap — the q-024 shape, but in the
`user-note` tier where no bundle-index description helps. These pin `C_soft` from
below; if calibration can't hold them, the constants are wrong, not the cases.

**Metric floor procedure after expansion** (maintainer clarification at spec review —
the denominators change, so "holds current numbers" needs an operational definition):

1. The golden set expansion lands as its own commit, **before** any engine change.
2. The **current (pre-gate) engine** runs once against the expanded set; that report
   is frozen as the new answerable floor — per-category recall@5/@10 and MRR. Old
   cases thus keep their old behavior inside the new denominators, and the new
   answerable hard negatives enter the floor at whatever the pre-gate engine scores
   on them (today's engine abstains almost never, so they are expected to be
   answered; if the pre-gate engine misses one, that miss is *in* the floor and the
   gate is only obligated not to add to it).
3. The prompt-waterfall baseline is re-run mechanically on the expanded set (frozen
   code) and committed alongside, keeping the cross-retriever comparison meaningful.
4. Acceptance then compares gate-on vs. the step-2 floor: no answerable category may
   drop on any metric. The unanswerable gate (§4.4) is measured on the expanded set
   only — there is no "old unanswerable floor" worth preserving at 2/3.

### 4.4 Eval gate extension

`--assert-baseline` adds `unanswerableAccuracy` to the engine threshold block:
proposed **1.0 on the expanded set** (unanswerable questions are hand-built probes of
a deterministic gate — unlike recall there is no inherent noise, so anything below
"all of them" means a known collision shape still defeats the gate). If calibration
proves 1.0 unreachable without recall cost, the spec addendum records which case was
conceded and why, and the threshold gates the rest.

## 5. Acceptance criteria

1. `q-030` abstains; `q-028`/`q-029` keep abstaining; all new unanswerable cases
   abstain (or the documented concession in §4.4 applies).
2. No answerable regression: recall@5, recall@10, MRR per category ≥ current report
   values (aggregate recall@10 0.926 / MRR 0.846 held); the two known misses don't
   grow in number.
3. `unanswerableAccuracy` gated in `--assert-baseline`; CI red if it dips.
4. Transport parity: the smoke test's abstention check still passes through the built
   CLI and the embedded `query.mjs`, and a new smoke assertion covers a near-collision
   abstention (not just the all-terms-unknown case).
5. Engine unit tests cover each clause of the confidence predicate and each collision
   shape with minimal synthetic snapshots (no fixture dependence), plus the
   calibration constants as named exports so tests fail loudly if they drift.
6. Spec addendum records the calibration sweep (constants tried, resulting
   metrics) — the "eval-calibrated" claim must be auditable.
7. `npm test`, lint, build green; engine purity guard unchanged.

## 6. Maintainer self-test checklist (acceptance round)

1. In your real vault: ask 3-5 questions you know the vault **cannot** answer but that
   share words with it (project names you never compiled, adjacent tech topics) — the
   CLI should abstain on most; note any that leak through and whether the top hit was
   a genuine near-collision.
2. Ask your usual real questions — confirm nothing that used to answer now abstains.
3. `knowlery query` vs `node .knowlery/bin/query.mjs` on one abstaining question —
   identical output.
4. `npm test && npm run eval -- --assert-baseline` — green, and the report shows
   unanswerable accuracy at the gated value.

## 7. Calibration addendum (implementation record, §4.1 / §5.6)

Instrument: `evals/src/calibrate.ts` (dev tool, prints per-candidate gate signals for
every golden question via `runQuery(..., { debug: true })`).

**Design revision found during calibration.** The drafted clause 3 ("source-graph
evidence is an unconditional anchor") leaked four of the five new unanswerable cases:
on q-031/033/034/035 the top collision candidate carried evidence boosts from its
cited sources on top of a one-word match. Clause 3 is therefore narrowed to **pure**
source-graph reach — it only fires when the candidate's own text matched *zero* terms
(the bilingual mechanism: q-018/019/021's compiled pages score entirely through their
cited Chinese sources). Candidates with direct matches must earn confidence through
clauses 1-2. Clause 2's "no structured hit" precondition was also dropped as
redundant — high prose coverage is an anchor regardless.

**Final constants** (exported from `src/core/query/engine.ts`, pinned by unit test):

| constant | value | meaning |
|---|---|---|
| `ABSTAIN_STRUCT_COVERAGE` | 0.5 | clause 1: min fraction of terms matched when a structured hit anchors |
| `ABSTAIN_SOFT_COVERAGE` | 2/3 | clause 2: min fraction of terms covered by prose alone |
| `ABSTAIN_BODY_FLOOR` | 2 | clause 2: min description+body evidence |

**Sweep** (expanded golden set, 37 cases; chosen row in bold):

| variant | unanswerable | answerable damage |
|---|---|---|
| **STRUCT=0.5, SOFT=2/3, FLOOR=2** | **8/8** | **none — all categories at pre-gate floor** |
| STRUCT=0.34 | 6/8 | none, but q-031/q-035 leak (2-of-5-term collisions pass) |
| STRUCT=0.67 | 8/8 | q-013 (synthesis), q-017 (alias), q-037 (hard negative) over-abstain |
| SOFT=0.5 | 8/8 | none on this set, but a ½-coverage prose match defeats the scatter shape by construction; 2/3 keeps clause 2 meaningfully stricter than clause 1 |
| FLOOR=3 | 8/8 | q-018 (bilingual) over-abstains — its source-note match is exactly 2 |

**Result on the expanded set (gate on):** unanswerable **8/8** (from 2/8 pre-gate);
every answerable category exactly at its pre-gate floor — aggregate recall@10 0.931,
MRR 0.833; the two pre-existing ranking misses (q-016, q-020) unchanged in number.
The pre-gate floor is enforced in CI via `ENGINE_ANSWERABLE_FLOOR` in `evals/src/run.ts`
(per-category recall@5, recall@10, and MRR — the recall@5 column was added at
implementation acceptance to match §4.3 step 2 exactly) alongside the new
`unanswerableAccuracy: 1` threshold — no §4.4 concession was needed.

**Real-vault residuals (maintainer acceptance round, recorded as future calibration
samples — not golden cases yet, since the fixture lacks their shapes):**

| question (real vault) | outcome | mechanism |
|---|---|---|
| 斑马 的移动端路线图是什么 | leaked (returned the 斑马 entity page) | 2 chunks after stopword split, 1 hits the title — coverage exactly ½, and clause 1 is `>=` C_struct |
| 莫言 的企业定价方案是什么 | leaked (returned the 莫言 entity page) | same boundary shape |
| 胚胎筛查 的 API webhook 怎么接入 | leaked (returned installed drone bundle's API/webhook pages) | mixed CJK+latin; the two latin terms hit bundle titles — again exactly-half coverage |
| 鼠疫 的 iOS 应用路线图是什么 | correct abstain | 3 terms, 1 hit — coverage ⅓ < ½ |

All three leaks sit on the same edge: **top-candidate coverage of exactly ½ passes
clause 1's `>=` comparison**. Tightening to strict `>` (or raising C_struct past 0.5)
was checked against the fixture during the original sweep — it over-abstains q-013
(synthesis), q-017 (alias), and q-037 (hard negative), all legitimate half-coverage
answers. Distinguishing the two halves likely needs a signal the gate doesn't use yet
(e.g. whether the *unmatched* terms are high-specificity CJK chunks vs. latin filler).
Deferred to the backlog with these four questions as the seed cases; per maintainer
decision the exactly-half leak ships as a known boundary in 0.8.0.
