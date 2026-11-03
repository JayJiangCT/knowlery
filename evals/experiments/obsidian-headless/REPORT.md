# Retrieval benchmark — Obsidian native search vs Knowlery headless (pilot, 2026-11-02)

**Purpose:** evidence for CLI-002 (2.0 retrieval architecture). **Not a decision**; nothing here is
ACCEPTED and nothing was written to `DECISIONS.md`. Method, environment and reproduction steps:
[METHOD.md](METHOD.md). Privacy handling: [PRIVACY.md](PRIVACY.md). Scrubbed per-question data:
[results.json](results.json).

## TL;DR

1. **Knowlery 1.x (`query.mjs`) performs very poorly on the real vault**: Recall@10 **0.14**, and it
   abstains on 52% of answerable questions. On the repo's synthetic fixture the *same build* scores
   Recall@10 0.93, matching the repo's own latest report exactly. The 1.x confidence gate and ranking
   were calibrated on a 51-page fixture and do not carry over to a 3,934-page vault with real questions.
2. **Obsidian adds no retrieval quality that plain files can't reproduce.** With an identical query plan
   and ranker, the Obsidian backend (C) and the plain-file backend (E_supp) hit **exactly the same**
   must-evidence (Recall@10 0.880 vs 0.880, MRR 0.636 vs 0.634, top-10 Jaccard 0.987, 51/56 identical lists).
3. **Native single-query Obsidian search (B) is weak** (Recall@10 0.38) and **has no relevance order**,
   so it cannot serve as a ranked retriever by itself.
4. **Fusing 1.x with a better retriever hurts** (D, E: 0.84 < 0.88). 1.x's noisy list displaces correct
   hits under RRF. The gain in D/E over A comes entirely from the supplement, not from fusion.
5. **The headless gap to Obsidian-joint retrieval is ≈ 0 on quality and favors headless on latency**
   (E_supp median 80 ms vs C 637 ms per question, after a one-time 1.4 s index build).
6. **No group handles unanswerable questions well.** The supplement ranker never abstains (0%);
   1.x abstains a lot but indiscriminately (60% on unanswerable, 52% on answerable).

What is worth building in 2.0: a **persistent, tolerant, field-aware lexical index** with IDF and
metadata (title / aliases / tags) weighting, plus a calibrated answerability gate. **Not** a hard
Obsidian dependency (§8).

## 1. Setup in one paragraph

A frozen, Markdown-only snapshot (3,934 files) of the Owner's Work Vault, identical for all groups.
56 golden questions, mostly adapted from the Owner's real past questions, labeled before any retrieval
ran (**not Owner-reviewed**, see Limitations). Five groups, K = 10 for all. A = 1.x `query.mjs` with
the verbatim question. B = one native `obsidian search`. C = Obsidian multi-path plan (per-term
searches + metadataCache + link graph) → a fixed shared ranker. D = RRF(A, C). E = RRF(A, E_supp),
where E_supp is the **same** plan and ranker on plain files. All parameters were fixed in
`scripts/plan.ts` before runs; nothing was tuned on labels.

## 2. Main results (55 questions: 50 answerable + 5 unanswerable; pass 1)

| Group | Recall@5 | Recall@10 | MRR | Full must-coverage@10 | No-answer acc. | False-abstain | Median ms | P95 ms | CLI calls / q |
|---|---|---|---|---|---|---|---|---|---|
| A — 1.x `query.mjs` | 0.090 | 0.143 | 0.050 | 0.120 | 0.60 | 0.52 | 790 | 965 | 1 |
| B — Obsidian single search | 0.300 | 0.380 | n/a¹ | 0.320 | 0.20 | 0.10 | 321 | 1126 | 1 |
| C — Obsidian multi-path | **0.810** | **0.880** | **0.636** | **0.820** | 0.00 | 0.00 | 637 | 5716² | 7.6 |
| D — RRF(A, C) | 0.683 | 0.840 | 0.531 | 0.780 | 0.00 | 0.00 | 1529 | 6488 | 8.6 |
| E — RRF(A, E_supp) | 0.683 | 0.840 | 0.530 | 0.780 | 0.00 | 0.00 | 858 | 1045 | 1 |
| E_supp — headless plan alone | **0.810** | **0.880** | **0.634** | **0.820** | 0.00 | 0.00 | **80** | **100** | 0 |

¹ Obsidian returns results in index/traversal order, not by relevance (e.g. the vault's root log file
is first for most queries). MRR would be fabricated, so it is not reported.
² C's tail latency is dominated by a few per-term searches on very frequent terms (large JSON result lists).

**Sensitivity — high-confidence labels only (47 items):** Recall@10 A 0.148, B 0.398, C 0.886, D 0.841,
E 0.841, E_supp 0.886. Same ordering.

**Post-hoc variant (added after seeing A's abstention count, before reading per-question label outcomes):**
A-terms = `query.mjs` given only the extracted subject terms, as 1.x's own usage instructions recommend.

| Variant | Recall@10 | MRR | False-abstain | No-answer acc. |
|---|---|---|---|---|
| A-terms | 0.283 | 0.092 | 0.40 | 0.60 |
| RRF(A-terms, C) | 0.820 | 0.559 | 0.00 | 0.00 |
| RRF(A-terms, E_supp) | 0.820 | 0.558 | 0.00 | 0.00 |

Input formatting explains part of A's failure but not most of it; conclusions 1 and 4 still hold.

### Per category (Recall@10)

| Category (n) | A | B | C | E | E_supp |
|---|---|---|---|---|---|
| entity-lookup (5) | 0.00 | 0.20 | 1.00 | 0.80 | 1.00 |
| concept-lookup (5) | 0.00 | 0.60 | 1.00 | 1.00 | 1.00 |
| decision (7) | 0.14 | 0.43 | 1.00 | 1.00 | 1.00 |
| alias (6) | 0.33 | 0.50 | 0.83 | 0.83 | 0.83 |
| bilingual (6) | 0.00 | 0.17 | 0.83 | 0.83 | 0.83 |
| provenance (5) | 0.00 | 0.20 | 0.80 | 0.70 | 0.80 |
| synthesis (6) | 0.11 | 0.25 | 0.92 | 0.83 | 0.92 |
| history (6) | 0.42 | 0.50 | 0.67 | 0.67 | 0.67 |
| conflict (4) | 0.25 | 0.62 | 0.88 | 0.88 | 0.88 |
| unanswerable (5) — no-answer acc. | 0.60 | 0.20 | 0.00 | 0.00 | 0.00 |

"History" is the weakest category for every group: finding the *current* page and the *superseded*
page together needs more than lexical overlap.

## 3. Reproducible fixture (public, no private data)

Same headless runner, on `evals/fixtures/vault` with `evals/golden/questions.yaml`
(`fixture-results/summary.json`):

| Group | Recall@5 | Recall@10 | MRR | Unanswerable acc. | False-abstain |
|---|---|---|---|---|---|
| A (1.x) | 0.933 | 0.933 | 0.839 | 1.00 | 0.07 |
| E | 0.933 | 0.933 | 0.900 | 0.27 | 0.00 |
| E_supp | 0.867 | 0.867 | 0.833 | 0.27 | 0.03 |

A's fixture numbers equal `evals/reports/knowlery-query-2026-07-24T02-08-02.959Z.json` exactly, which
validates the harness and parser. **The fixture flatters 1.x:** its 51 short pages and short questions
are what the gate thresholds were tuned on. B/C were not run on the fixture (it would need to be opened
as a separate Obsidian vault). That is a follow-up.

## 4. Where Obsidian adds value (and where it doesn't)

- **Unique correct evidence, C vs E_supp: none in either direction.** Every must-slot C found, E_supp
  found, and vice versa.
- **"Obsidian-only" vs the 1.x-based groups:** 3 must-slots (G003, G031 slot 2, G040 slot 2) were found
  by B or C but by neither A nor E. All three are also in E_supp's top-10 and are lost in E only because
  RRF with A's list pushes them below rank 10. This is a fusion effect, not an Obsidian capability.
- **Malformed frontmatter:** 58 files fail YAML parsing and are invisible to 1.x. Obsidian indexes their
  bodies (29 C result slots are such files). The plain-file backend recovers the same files through a
  regex fallback for title/aliases/tags, so this is an advantage of tolerant parsing, not of Obsidian.
- **What Obsidian does give:** an already-built, live-updated index (`metadataCache`, `resolvedLinks`),
  with no indexing code to maintain. That is an operational benefit, not a quality benefit in this test.

### Why D gains over A, and why it loses to C
D's gain over A (+0.70 Recall@10) is entirely the C list. D's de-duplication rate is only 5.9%, so A
and C rarely agree. When A answers, its top ranks are dominated by a handful of large, heavily cited hub
pages. Under equal-weight RRF these hubs interleave with C's hits and displace correct ones past rank 10.

### What E (headless) lacks relative to D
Nothing measurable on this set: E = D on every metric and E_supp = C. The only differences are
latency (headless is faster) and the operational cost of maintaining an index without Obsidian.

## 5. Case analysis (12 cases)

IDs refer to the private golden set. Content is described generically for privacy; the Owner can
inspect the real pages locally (`scored.pass1.local.json`).

| # | Case | Category | What happened | Mechanism |
|---|---|---|---|---|
| 1 | G001 | entity | A abstained; C and E_supp ranked the person page #1 | The person's name matches the page title (2 of 5 terms). Generic terms dilute coverage to 0.4, below the 0.5 structured gate. **Gate too strict for natural questions.** |
| 2 | G009 | concept | A abstained; C ranked the concept page #1 | 6 terms; the title matches 4. The prose-coverage gate (2/3) failed because a question-specific term is absent from the page. |
| 3 | G003 | entity (short name) | A, A-terms and B missed the person page; C and E_supp ranked it #8 | A hub-page bias: heavily cited project hub pages win on source-graph boost; the person page matches only one distinctive term. |
| 4 | G040 | synthesis | A's top-5 = project hub pages unrelated to the question; C found the validation page and the rules page | Same hub bias; the numeric date terms ("07", "28") match almost everywhere in A's prefix matching. |
| 5 | G044 | history | Every group found the current strategy page (A #3, B #1, C #2); **no group** found the second must page, the sprint-by-sprint iteration plan | The plan page states the target in different words than the question. A lexical-retrieval ceiling for "history" questions. |
| 6 | G015 | decision | A abstained on the verbatim question; A-terms ranked the contract page #10; C ranked it #4 | A person's name plus generic verbs ("approve") outweigh the decisive noun phrase in A. |
| 7 | G020 | alias (single term) | A, A-terms and C all ranked the alias page #1 | Single-term queries pass A's gate trivially (coverage 1/1). **1.x works when the question is one distinctive term.** |
| 8 | G024 | bilingual (CN+EN) | A abstained; B returned nothing (implicit AND over a CJK phrase); C found both entity pages at #4 and #5 | Latin terms carry the match; the CJK term is unmatched noise. C's per-term OR tolerates it, but B's AND and A's coverage gate do not. |
| 9 | G031 | provenance | Only B/C (and E_supp) placed the raw meeting note in the top-10; E lost it to RRF | Raw source notes rank low in A (user tier factor); fusion drops them. |
| 10 | G051 | unanswerable (CJK) | A abstained correctly; C returned 5 related entity pages | The supplement's abstain rule only needs 2 terms covered; related pages always exist. **No answerability signal.** |
| 11 | G052 | unanswerable | A answered with hub pages; C answered with related project pages | Both are wrong: a plausible in-domain question has high lexical overlap with many pages. |
| 12 | B overall | — | The vault's root log page appears in B's top-3 for most questions | Obsidian's result order is not relevance; a page that mentions everything always ranks first. |

## 6. Safety checks

| Check | Result |
|---|---|
| Snapshot: all 3,944 files, sha256 before vs after all runs | **Identical** |
| Work Vault: all 4,899 `.md`, sha256 before vs after | 2 differences: one append to the root log page and one new compiled page dated 2026-11-02. Neither is touched by any experiment command: no command takes the Work Vault path, and every Obsidian call carried `vault=<snapshot>`, asserted by the preflight. **Inference:** concurrent Owner or agent activity in the live vault during the run. |
| Headless runner, own manifest check (snapshot and fixture) | Unchanged |
| No paid LLM API, no Jev, no Cook/Sync/Capture | Confirmed. All retrieval is deterministic local code. |

## 7. Operational findings

| Finding | Evidence | Status |
|---|---|---|
| The Knowlery 1.6.2 plugin **writes on load** (rewrote the root `AGENTS.md`; created skills directories) | Snapshot hash diff; restored and re-verified before any run | Verified |
| Obsidian CLI **occasionally never returns** a response and ignores SIGTERM | 1 of 969 calls hung for more than 11 min; the identical query returned instantly when re-issued. Fixed with a 30 s SIGKILL timeout plus one retry (1 retry needed in the final run) | Verified, cause unknown |
| `query.mjs` resolves the vault root from **its own location**, not the working directory | Running it with cwd = fixture searched the snapshot; fixed by copying it into the fixture | Verified |
| 1.x re-scans the whole vault per query (about 0.8 s per question at 3.9k files) | A median 790 ms vs E_supp 80 ms on an in-memory index | Verified |
| gray-matter caches a failed parse, so a second parse of identical content "succeeds" | Same file: null on first parse, a page on second, in one process | Verified; affects long-lived processes (plugin live snapshot) |
| `obsidian knowlery:query` = A, not native search | Top-5 identical to `query.mjs` on 3 probes | Verified (3 probes only) |

## 8. Recommendations for CLI-002 (for Owner decision; not accepted)

**Measured facts**
- On this vault, a simple lexical ranker over per-term hits (IDF) plus metadata fields reaches
  Recall@10 0.88 with or without Obsidian, versus 0.14 for 1.x.
- Obsidian contributes no unique correct evidence once the same plan runs on plain files.
- Native Obsidian `search` has no relevance ranking.
- Fusing in 1.x as-is lowers recall.

**Inferences** (supported, but not directly tested)
1. 2.0 retrieval should be **headless-first**. The CLI should own a persistent index (tolerant
   frontmatter parse, title/alias/tag fields, IDF, wikilink graph) that is reusable across queries. That
   removes the per-query full scan and makes Obsidian unnecessary for quality.
2. Obsidian can remain an **optional adapter** for freshness (live `metadataCache`) inside a running
   Obsidian, behind a hard timeout. It should not be a quality dependency. This matches SK-001's
   direction ("Knowlery CLI first; Obsidian CLI an optional internal adapter").
3. **Do not ship the 1.x confidence gate as-is.** Recalibrate it on real-vault questions, or replace it
   with a calibrated answerability score. Abstention must be measured separately from recall.
4. **Down-weight hub pages** (source-graph boost) or apply it only as a tie-breaker. Retest.
5. Fix the operational defects in §7 (plugin writes on load; vault root resolution; parse-cache
   nondeterminism; silent drop of malformed-frontmatter pages; it should at least be reported).

**Hypotheses that need validation before deciding**
- H1: A recalibrated 1.x gate plus hub damping reaches parity with E_supp. (Re-run this harness.)
- H2: Answerability can be predicted from top-k score margin or field coverage. (Needs more
  unanswerable items; only 5 are in the main set.)
- H3: The results generalize beyond one Owner's vault and to Owner-reviewed labels.
- H4: A semantic or embedding layer is needed for the "history" category (current vs superseded pages).
  Lexical retrievers all plateau there at 0.67.

## 9. Limitations

- **Labels were not Owner-reviewed** (the Owner asked to proceed to the PR). They were drafted by an
  agent that used browsing plus grep for distinctive identifiers. This favors lexical retrievers (C,
  E_supp) in absolute terms. The **C-vs-E_supp comparison is robust** to it, because both share the same
  bias. **A's absolute score is not.** The least label-biased subset is the provenance items, whose must
  pages include raw notes, and A also scores 0.00 there.
- One vault, one machine, 56 questions, a single run (determinism verified across two passes for every
  group). Small differences, such as E vs D, are within noise.
- 5 main-set unanswerable items are too few for a reliable no-answer metric.
- **C's pass-2 latency is contaminated:** two ad-hoc Obsidian CLI probes ran during that pass. Do not
  draw cold-vs-warm conclusions for C. Pass 1 is used throughout.
- B/C were not run on the public fixture.
- A's input was the verbatim question, which is not 1.x's documented usage. The A-terms variant
  partially addresses this, but `planTerms` is a crude stand-in for an agent choosing subject terms.

## 10. What a Cloud reviewer can check independently

| Can verify from the repo | Depends on Local Agent evidence |
|---|---|
| `plan.ts` ranker and fusion logic, frozen parameters | That the golden set was frozen before runs (hashes kept locally) |
| Runner and scorer code paths; no tuning on labels | Snapshot and Work Vault hash checks |
| Fixture run: re-run `run-headless.ts --layout fixture` and `score-fixture.ts`; A must match the repo's own report | Real-vault per-question results (scrubbed copy in `results.json`) |
| Internal consistency of `results.json` (metrics recomputable from ranks) | Obsidian CLI behavior (version 1.14.5) |
