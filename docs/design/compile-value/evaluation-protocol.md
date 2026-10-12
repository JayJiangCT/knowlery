# Evaluation protocol and annotation template

Protocol version: `cv-eval@1` (draft). Target release for the tooling: 1.6.1.

## 1. What the evaluation must decide

One question: **does ordering policy _O_ put the notes that the next `/cook`
session should process ahead of the others, without systematically burying
important knowledge?**

It feeds three concrete decisions:

1. Which ordering policy (if any) replaces the 1.6.0 default in 1.7.0.
2. Whether local Delta is good enough to ship as a signal, and with what
   confidence vocabulary.
3. Whether sending compiled-page summaries to Jev (Jev Delta) earns its privacy
   cost — i.e. measurably beats local Delta.

Non-goals: tuning a weighted formula; proving long-term reliability from one
vault; evaluating retrieval quality (covered by `evals/` baseline).

## 2. Frozen evaluation state

Priority judgments are only meaningful against the knowledge base *as it was*.
Judging an old note against pages compiled later leaks the future into the past.

At sampling time **T0** the harness writes a freeze manifest and a private copy:

| Frozen item | How |
| --- | --- |
| Compiled pages (`entities/`, `concepts/`, `comparisons/`, `queries/`) | Copied, with per-file content hash |
| Sampled notes | Copied, with content hash and original mtime |
| `KNOWLEDGE.md`, `.knowlery/focus.md` (if present) | Copied, hashed |
| `.knowlery/config.json` | Copied (exclusions affect the population) |
| Population | Full list of uncooked note paths at T0 (after exclusions) |
| Tool versions | Knowlery version, retrieval engine version, Jev model id, signal algorithm versions |

The freeze directory lives **outside the repository** (see §10) and is identified
by `freezeId = sha256(manifest)`. Every annotation file and every report records
the `freezeId`; the harness refuses to score annotations against a different
freeze.

All signals under evaluation are computed against the frozen copy, never the
live vault.

## 3. Blindness

- Annotators never see Jev scores, any signal value, any ordering, or the
  sampling stratum.
- The annotation sheet lists notes in a seeded random order; the seed is recorded
  in the sheet header, the stratum mapping is stored separately by the harness.
- Jev is called (for strata and for the B2 baseline) only by the harness, and
  its output is written to a file the annotator does not open. If the annotator
  is also the maintainer, run Jev scoring *after* annotation is finished and
  stratify by the non-Jev strata only (see §4) — blindness beats stratification.
- The annotator reads each note **in full** (labels are full-read ground truth,
  not preview judgments), plus whatever compiled pages they consider necessary.

## 4. Sampling

**Population**: uncooked notes at T0 after exclusions.

**Strata** (sampled independently, merged, then shuffled):

| Stratum | Buckets | Purpose |
| --- | --- | --- |
| Age | ≤ 30 d, 30–180 d, > 180 d | Today's default is mtime order; old notes are where it fails |
| Jev worth band (if blind-compatible, §3) | > 0.8, 0.2–0.8, ≤ 0.2 | Measure each band, especially the low one |
| Directory family | Top-level directory (or first two levels for deep vaults) | Avoid one project dominating |

**Allocation for a first round of 80**: proportional to population, with floors —
at least 15 notes in the oldest age bucket and, when Jev strata are used, at
least 15 in the ≤ 0.2 band. Versioned snapshots of the same document (e.g.
`…-<date>/document-text.md`) are kept in the population but at most two per
document are sampled.

**Seeded critical set (separate, non-random)**: before seeing the sample, the
annotator nominates up to 10 uncooked notes they already know to be critical
(architecture decisions, irreversible commitments, compliance). They are
annotated with the same sheet but reported **separately** — they measure miss
behaviour on what matters, and are not used for average-ranking metrics because
their selection is biased.

## 5. Labels

Every note gets six labels. The first four are the evaluation targets; `type`
and `importance` exist for the breakdowns and miss analysis.

### 5.1 `worth` — Knowledge Worth

Does the note contain knowledge that would still be useful to someone asking
about its subject months from now?

| Value | Criterion |
| --- | --- |
| `yes` | Records decisions, requirements, rationale, definitions, specifications, findings, or durable facts about a named system, project, person, or concept |
| `no` | Transient or raw: agenda without outcomes, status chatter, scratch draft, generated output, boilerplate, template, pure link dump |
| `unsure` | Cannot tell even after a full read (e.g. depends on context outside the vault) |

### 5.2 `delta` — Knowledge Delta, relative to the frozen knowledge base

How much of the note's durable content is **absent** from the frozen compiled
pages?

| Value | Criterion |
| --- | --- |
| `new` | Its main durable content appears on no compiled page |
| `partial` | Some durable content is already compiled, some is not (new decisions, updated numbers, extra rationale) |
| `redundant` | Everything durable is already on compiled pages, or the note is a superseded version of a cited one |
| `unknown` | Cannot tell without effort disproportionate to the note |
| `n/a` | `worth: no` |

Record `delta_evidence`: the compiled page paths checked or found to contain the
content (empty is allowed for `new`, but state how you looked, see template).

### 5.3 `relevance` — User Relevance, relative to the frozen focus

Judged against `.knowlery/focus.md` first, then the "About This Knowledge Base"
section of `KNOWLEDGE.md`.

| Value | Criterion |
| --- | --- |
| `high` | Directly about a topic named in current focus |
| `medium` | Within the long-term scope described in `KNOWLEDGE.md`, not in current focus |
| `low` | Outside both |
| `unknown` | No focus file and no usable `KNOWLEDGE.md` description at T0 |

### 5.4 `cook_next` — the primary target

> If the next `/cook` session could process only 10–20 notes from this vault,
> should this note be one of them?

`yes` / `no`. This is the label orderings are scored on. The three dimension
labels are explanatory variables: they let us see *why* an ordering wins or
loses, and calibrate each signal against its own label.

### 5.5 `type`

One of: `decision`, `requirement` (spec/PRD/use case), `ticket`, `meeting`,
`journal` (daily/log), `reference` (imported or copied material), `draft`,
`template`, `generated` (exports, tool output), `other`.

### 5.6 `importance`

`critical` when losing this note's knowledge would cause real harm: architecture
or product decisions, irreversible commitments, safety or compliance
constraints, the only record of a rationale. Otherwise `normal`. Independent of
`cook_next` (a critical note already fully compiled is `critical` +
`redundant` + likely `cook_next: no`).

### 5.7 Optional

`target`: compiled page the note's content belongs on, or `new` — keeps the
1.6.0 target-accuracy measurement alive. `notes`: free text.

## 6. Annotation quality

- **Agreement**: a second annotator labels a random 20% subset; report Cohen's
  κ per label. With a single annotator, re-label the same 20% after at least a
  week without looking at the first pass (intra-rater κ).
- A label with κ < 0.4 is reported but not used for a ship decision until its
  definition is revised.
- Time per note is recorded (helps estimate the cost of the next round).

## 7. Orderings compared

Baselines:

| Id | Ordering |
| --- | --- |
| B0 | mtime descending — today's behaviour without a key |
| B1 | Seeded random (mean over 100 seeds) — the floor |
| B2 | Jev worth, 1.6.0 policy (> 0.2 by worth, unscored by mtime, ≤ 0.2 last) |
| Oracle | Labels themselves (`cook_next`, then `importance`) — the ceiling |

Candidates (defined as policies in the store design, evaluated here — the list
grows as signals are implemented):

| Id | Ordering |
| --- | --- |
| C1 | Worth band, then local Delta class within band (`new` > `partial` > `unknown` > `redundant`) |
| C2 | C1 with Relevance as the tie-breaker within each Delta class |
| C3 | Local-only: C2 with a local Worth heuristic instead of Jev (the "no Jev" product path) |
| C4 | C2 with Jev Delta replacing local Delta (requires the consent path; offline only) |

No fixed numeric weights are fitted. If a later round does fit any parameter, it
is chosen by leave-one-out cross-validation over the annotated set and reported
with the held-out score only.

## 8. Metrics and report

All metrics are computed per ordering over the random sample, with 95% bootstrap
confidence intervals (1,000 resamples). The critical set gets its own section.

**Ranking gain**

- Precision@k on `cook_next`, k ∈ {10, 20}.
- nDCG@k with graded gain: `cook_next: yes` + `critical` = 3, `cook_next: yes` = 1, otherwise 0.
- Paired difference vs B0 and vs B2, with CI.

**Miss of important knowledge** — reported next to ranking gain, never below it

- Low-band miss rate: share of `cook_next: yes` notes placed in the bottom 20%
  of the ordering; same for `importance: critical`.
- Critical recall@k (k = 10, 20, and 50% of the population).
- Worst rank of any critical note, as a percentile of the population.
- For the seeded critical set: rank percentile of each note, listed individually.

**Per-type behaviour**

- Table by `type`: count, Precision@k contribution, mean rank percentile,
  low-band miss count. A policy that wins on average by burying one type is
  visible here.

**Signal calibration**

- Worth signal vs `worth` label; Delta class vs `delta` label (confusion matrix);
  Relevance vs `relevance` label.
- Abstention: share of notes where each signal is `unknown`, and the metrics
  restricted to notes where it is known.

**Cost**: Jev tokens and estimated USD per ordering.

## 9. Pre-registered decision rules

Written before results are seen; changing them requires noting the change in the
report.

1. A candidate may replace the default only if **all** hold, on the random
   sample:
   - Precision@10 is not worse than B2's (CI of the difference includes or is
     above 0), and better than B0's;
   - low-band miss rate for `critical` notes is ≤ B0's and ≤ B2's;
   - no `type` with ≥ 5 notes has a mean rank percentile worse than under B0 by
     more than 20 points;
   - every seeded-critical note ranks in the top half.
2. Jev Delta (C4) is enabled as an option only if it beats the best local-Delta
   policy on Precision@10 or critical miss rate with a CI excluding 0, and is
   not worse on the other.
3. A local signal ships in 1.7.0 only if its confusion matrix shows `high`
   confidence claims are correct ≥ 85% of the time; otherwise it ships with its
   confidence capped at `low`.
4. With 60–80 notes, a rule passing is a **direction**, not proof. Before the
   default changes for everyone, the same protocol is repeated on at least one
   more vault or a second round of ≥ 80 notes from a later freeze.

## 10. Data handling

- The repository is public. Real annotations, freeze copies, Jev caches and
  reports stay **outside the repo**; the harness takes them by path
  (`--freeze <dir>`, `--annotations <file>`), and the repo `.gitignore` covers
  any default output paths.
- Committed: this protocol, the annotation template (synthetic example only),
  and a synthetic fixture vault used by the harness's own tests.
- Note for review: `evals/jev-triage/labels.yaml` already contains real work
  vault paths and ticket ids in a public repository. Recommend replacing it with
  a synthetic example and moving the real file next to the freeze copies.
  (History rewriting is a separate decision.)

## 11. 1.6.1 deliverables (tooling only, no product change)

| Piece | Role |
| --- | --- |
| `evals/compile-value/freeze.ts` | Write the freeze copy + manifest for a vault (§2) |
| `evals/compile-value/sample.ts` | Stratified sample + seeded critical set → blind annotation sheet from the template (§3, §4) |
| `evals/compile-value/run.ts` | Compute baselines and candidate orderings on the freeze; metrics with bootstrap CIs; markdown + JSON report (§7, §8) |
| `evals/compile-value/fixtures/` | Synthetic vault + annotations for the harness's own tests |
| Tests | Metric math (P@k, nDCG, miss rates, κ) on hand-computed cases; freeze-id mismatch refusal; blindness (sheet contains no signal values) |

The `jev-triage` experiment harness stays as-is for reproducibility of the 1.6.0
numbers; the new harness reuses its request-hash cache approach for Jev calls.

## 12. Open questions for review

1. Second annotator available, or intra-rater re-labelling?
2. Size of the first round: 80 random + up to 10 seeded critical — acceptable
   time budget?
3. Should `cook_next` assume a fixed session size (10–20 notes) or the user's
   real typical session size?
4. Is "top half" the right bar for the seeded-critical rule, or should it be the
   top 20%?
