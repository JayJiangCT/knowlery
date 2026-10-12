# Evaluation protocol and annotation template

Protocol version: `cv-eval@1`, draft revision 3. Revision 2 addressed the first
#86 review; revision 3 replaces "the CI includes 0" with pre-registered
non-inferiority margins and records the second review's decisions. No data has
been collected under any revision, so revising the rules here does not breach
§10.
Target release for the tooling: 1.6.1.

## 1. What the evaluation must decide

One question: **does ordering policy _O_, run on the real uncooked queue, put the
notes the next `/cook` session should process at the top, without burying
important knowledge that is still uncompiled?**

It feeds three decisions:

1. Which ordering policy (if any) replaces the 1.6.0 default in 1.7.0.
2. Whether each local signal ships, and at what maximum confidence.
3. Whether sending compiled-page summaries to Jev (Jev Delta) earns its privacy
   cost — i.e. measurably beats local Delta.

Non-goals: fitting a weighted formula; proving long-term reliability from one
vault; evaluating retrieval quality (covered by the `evals/` baseline).

### 1.1 Two tiers, never mixed

A ranking measured inside an 80-note sample does not say what the top 10 of a
4,000-note queue look like — and the sample deliberately over-represents old and
low-scored notes. The protocol therefore has two tiers with separate metrics and
separate labels in every report.

| Tier | Population ranked | Labels | Answers | Reported as |
| --- | --- | --- | --- | --- |
| **Diagnostic** | The stratified sample only | Every sampled note | Relative behaviour of policies; bias against old notes, the low band, note types; signal calibration | `sample-only` |
| **Operational** | The **full frozen uncooked queue** | Pool = union of every available policy's top-k, plus the diagnostic labels already collected | What `/cook` would actually receive: Precision@k on the real queue; actionable-critical misses (estimated) | `operational` |

Ship decisions (§10) use operational metrics; diagnostic metrics can veto a
policy (bias) but cannot pass one.

## 2. Frozen evaluation state

Judgments are only meaningful against the knowledge base *as it was* at sampling
time **T0**. The operational tier also needs every input a policy uses for every
uncooked note, so freezing paths alone is not enough.

| Frozen item | Content |
| --- | --- |
| Compiled pages (`entities/`, `concepts/`, `comparisons/`, `queries/`) | Full copy + content hashes |
| **All uncooked notes at T0** | Full copy + content hashes + original mtimes (needed so every policy can be recomputed on the whole queue) |
| Cited source notes | Copy of every note a compiled page cites (needed by provenance-based Delta evidence) |
| `KNOWLEDGE.md`, `.knowlery/focus.md` | Copy + hashes |
| `.knowlery/config.json`, `.knowlery/triage.json` | Copy (exclusions define the queue; 1.6.0 Jev scores feed baseline B2 without new API calls) |
| Clock | `frozenAt` (ISO, UTC) **and** the IANA time zone of the machine that froze it — used to interpret `focus.md` `until:` dates (§11) |
| Tool versions | Knowlery version, engine version, Jev model id, each producer's algorithm version |

The freeze lives outside the repository (§12) and is identified by
`freezeId = sha256(manifest)`. Every annotation file, pool and report records the
`freezeId`; the harness refuses to mix freezes.

Cost: a full freeze is a copy of the vault's Markdown minus excluded directories
(megabytes, local only). The tooling is validated first on a **synthetic full
vault** committed under `evals/compile-value/fixtures/`; the cost of a real
freeze is then measured before the first real round.

## 3. Blindness

- Annotators never see Jev scores, signal values, policy ranks, the tier a note
  came from, the stratum, or whether it was nominated as critical.
- Diagnostic sample, operational pool additions and seeded notes are merged into
  one sheet in a seeded random order. Provenance of each entry (tier, stratum,
  seeded, inclusion probability) is kept in a **private harness file** the
  annotator does not open — never in the sheet.
- When the annotator is also the maintainer, any Jev call needed for strata is
  made by the harness and its output stays in the private file; if that is not
  practical, drop the Jev stratum. Blindness beats stratification.
- Labels are full-read judgments: the annotator reads each note in full, plus
  whichever frozen compiled pages they need.

## 4. Diagnostic sample

**Population**: the frozen uncooked queue.

**Strata**: age (≤ 30 d, 30–180 d, > 180 d); Jev worth band (> 0.8, 0.2–0.8,
≤ 0.2) when compatible with §3; directory family (top-level directory, two levels
for deep vaults).

**First round**: 80 notes, proportional allocation with floors (≥ 15 oldest,
≥ 15 in the ≤ 0.2 band when used); at most two snapshots of one versioned
document. The harness records each note's **inclusion probability**, so
diagnostic counts can be re-weighted to population estimates (§9.3).

**Seeded set**: before sampling, the annotator privately nominates up to 10
uncooked notes they believe hold **critical knowledge that is not yet
compiled**. The harness stores the nomination privately and mixes these notes
into the sheet indistinguishably. They are excluded from average metrics (biased
selection) and reported individually.

## 5. Operational pool

1. Run every **available** policy (§8) over the full frozen queue.
2. Pool = union of each policy's top 20 (k = 10 and k = 20 are both scored), so
   Precision@20 is exact. If the labelling budget allows, also add a **random
   probe**: up to 10 notes drawn uniformly from ranks 21–50 of each policy,
   with inclusion probabilities recorded in the private file. The probe
   estimates how many `cook_next: yes` notes sit just below every policy's cut,
   which measures pooling bias. It never changes the exact top-k metrics.
3. Notes in the pool without labels are added to the blind sheet (§3). With
   five policies the pool is at most 100 notes and in practice far fewer —
   policies overlap and diagnostic labels are reused.
4. After per-note labelling, the annotator performs the **budgeted selection**
   (§6.4.2) over the pooled `cook_next: yes` notes.

Properties: Precision@k is **exact** for every pooled policy (all its top k are
labelled). The ideal top 10 may contain notes no policy surfaced; that is the
usual pooling bias, reported as a limitation, and reduced by adding the oracle-
seeking random diagnostic sample to the labelled set.

## 6. Labels

### 6.1 `worth` — Knowledge Worth

| Value | Criterion |
| --- | --- |
| `yes` | Records decisions, requirements, rationale, definitions, specifications, findings, or durable facts about a named system, project, person, or concept |
| `no` | Transient or raw: agenda without outcomes, status chatter, scratch draft, generated output, boilerplate, template, pure link dump |
| `unsure` | Cannot tell even after a full read |

### 6.2 `delta` — Knowledge Delta, against the frozen compiled pages

| Value | Criterion |
| --- | --- |
| `new` | Its main durable content appears on no compiled page |
| `partial` | Some durable content is compiled, some is not (a new decision, updated numbers, extra rationale) |
| `redundant` | Every durable item is already **on a compiled page** — checked against page content, not against a similar raw note |
| `unknown` | Cannot tell without disproportionate effort |
| `n/a` | `worth: no` |

`delta_evidence.pages` lists compiled pages checked or found to contain the
content; `how_checked` says how.

### 6.3 `relevance` — User Relevance, against the frozen focus

Judged against `focus.md` if it is in force at `frozenAt` (§11), then the
"About This Knowledge Base" section of `KNOWLEDGE.md`.

| Value | Criterion |
| --- | --- |
| `high` | Directly about a topic in the current focus |
| `medium` | Within the long-term scope of `KNOWLEDGE.md`, not current focus |
| `low` | Outside both |
| `unknown` | No focus in force and no usable `KNOWLEDGE.md` description |

### 6.4 `cook_next` — the primary target

Fixed evaluation target: **the next `/cook` session processes at most 10 notes.**

#### 6.4.1 Per-note label

`cook_next: yes` means the note belongs in the **priority candidate set** for that
session. All four must hold:

1. it has durable content that is **not yet compiled** (`delta` is `new` or
   `partial`; `unknown` only if a full read shows unabsorbed durable content);
2. compiling it now is useful — it is not blocked on a decision or document that
   does not exist yet;
3. it is not better handled entirely as part of another note's compilation
   (then it goes in that note's `compile_with` group, and only the group's lead
   note gets `yes`);
4. the annotator can name **why now** — one reason code below.

Being important or well written is not sufficient; that is what `worth` and
`importance` record.

Every `yes` carries `cook_next_reason` (one code + one sentence):

| Code | Meaning |
| --- | --- |
| `new-decision` | A decision, requirement or rationale with no compiled home |
| `updates-page` | Corrects or extends a specific compiled page that is now wrong or incomplete |
| `focus-gap` | Fills a gap in the current focus area |
| `unblocks` | Other notes or pages depend on this being compiled first |
| `time-sensitive` | Value decays (an upcoming launch, a deadline, an expiring context) |
| `other` | Stated in the sentence |

Every note (yes or no) may carry `depends_on` (notes or pages that must be
compiled first) and `compile_with` (notes to compile together).

#### 6.4.2 Budgeted selection (operational tier)

After all pooled notes are labelled, the annotator picks **at most 10** notes from
the pooled `yes` set as `selected_next` — the session they would actually run —
in priority order. This is the step that separates "should be compiled soon"
from "should be in the next session", and it supplies the graded gain in §9.2.

### 6.5 `type`

`decision`, `requirement` (spec/PRD/use case), `ticket`, `meeting`, `journal`,
`reference` (imported or copied material), `draft`, `template`, `generated`,
`other`.

### 6.6 `importance` and actionable critical

- `importance: critical` — losing this knowledge would cause real harm
  (architecture or product decision, irreversible commitment, safety or
  compliance constraint, the only record of a rationale). Otherwise `normal`.
  Describes the knowledge, regardless of whether it is compiled.
- `actionable_critical: yes` — `critical` **and** still has uncompiled content.
  Derived as `critical ∧ delta ∈ {new, partial}`; when `delta` is `unknown`, the
  annotator decides explicitly. `critical + redundant` is `actionable_critical:
  no` and is never counted as a miss.

**Only `actionable_critical` enters miss rates, recall and ranking gates.**

### 6.7 Optional

`target` (compiled page or `new`), `minutes_spent`, `notes`.

## 7. Annotation quality

- First round: single annotator; a random 20% of the labelled notes is
  re-labelled **at least one week later** without access to the first pass;
  intra-rater Cohen's κ per label. A second annotator is used only if they are
  qualified to judge the notes (understand the projects and decisions); a
  formally independent but unqualified annotator is not.
- A label with κ < 0.4 is reported but not used for a ship decision until its
  definition is revised.

## 8. Orderings

Baselines:

| Id | Ordering |
| --- | --- |
| B0 | mtime descending — today without a key |
| B1 | Seeded random (mean over 100 seeds) |
| B2 | 1.6.0 Jev policy, from the frozen `triage.json` |
| Oracle | `selected_next` order, then other `cook_next: yes`, then the rest (ceiling) |

Candidates — each depends on producers that may not exist yet:

| Id | Ordering | Needs |
| --- | --- | --- |
| C1 | Worth band, then local Delta class (`new` > `partial` > `unknown` > `redundant`) | Jev or local Worth; local Delta |
| C2 | C1 with Relevance as tie-breaker | + Relevance |
| C3 | No-Jev path: local Worth, local Delta, Relevance | local producers only |
| C4 | C2 with Jev Delta | opt-in Jev Delta (offline only) |
| B2′ | B2's policy on `jev-worth@2` scores (note-only request, store §4.2) | re-scoring the freeze with the split request |

B2′ exists because 1.7.0 splits the 1.6.0 combined request. The new Worth
scores may be distributed differently, so they are measured as their own row
instead of being assumed equal to B2.

**Availability is explicit.** A policy whose producers are not implemented is
reported as `not available` with the missing producer named. The harness never
fills a missing signal with a placeholder value. In 1.6.1 only B0, B1, B2 and the
oracle are expected to be available; candidates appear as their producers land.

No numeric weights are fitted. If a later round fits any parameter, it uses
leave-one-out cross-validation and reports held-out scores only.

## 9. Metrics

All with 95% bootstrap confidence intervals (at least 2,000 resamples, percentile
method).

**Resampling unit.** On one freeze, operational P@k is exact for that queue.
The uncertainty that matters is whether the result would hold for a similar
queue. The harness therefore uses a **paired bootstrap over the labelled pool**:

1. Resample pooled notes with replacement.
2. Re-rank each policy within the resample, keeping its original relative order.
3. Recompute every policy's metric on the same resample, so differences stay
   paired.

When several freezes are combined, each freeze is a stratum and is resampled
separately.

### 9.1 Diagnostic tier (`sample-only`)

- Precision@10 / @20 on `cook_next` **within the sample** — relative comparison only.
- Rank-percentile distribution per age bucket, Jev band and `type`; a policy that
  systematically sinks one group shows here.
- Signal calibration: Worth vs `worth`, Delta class vs `delta` (confusion
  matrix), Relevance vs `relevance`; share of `unknown` per signal and metrics on
  known-only notes.

### 9.2 Operational tier

- Precision@10 / @20 on `cook_next` over the full queue (exact, pooled).
- nDCG@10 with graded gain: in `selected_next` and `actionable_critical` = 3;
  in `selected_next` = 2; other `cook_next: yes` = 1; else 0.
- Paired difference vs B0 and vs B2.
- Seeded set: rank percentile of each seeded note **that the labels confirm as
  `actionable_critical`**, listed individually.

### 9.3 Actionable-critical misses on the full queue (estimated)

The full queue is not labelled, so the number of actionable-critical notes in it
is estimated from the diagnostic sample with inverse-probability weights
(Horvitz–Thompson), and combined with the pooled labels:

- estimated share of actionable-critical notes ranked in the bottom 20% of the
  queue, per policy;
- actionable-critical recall@k (k = 10, 20, 10% of queue);
- worst observed rank percentile of any labelled actionable-critical note.

These are estimates with wide intervals at n = 80; the report says so next to
the numbers, and puts them **beside** ranking gain, never below it.

### 9.4 Cost

Jev tokens and estimated USD per policy.

## 10. Pre-registered decision rules

Fixed per protocol version. Changing a rule creates a new protocol version, and
**data used to revise rules cannot be used to declare the revised rules passed**:
the next decision needs a fresh freeze.

**A confidence interval that contains 0 only means the data cannot tell the
policies apart. It does not show the new policy is no worse.** Every comparison
is therefore one of two pre-registered tests on the paired difference
`Δ = candidate − baseline`, judged by its 95% CI `[L, U]`. Each test has three
outcomes, and only `pass` counts toward a decision:

| Test | Pass | Fail | Otherwise |
| --- | --- | --- | --- |
| Superiority (higher is better) | `L > 0` | `U ≤ 0` | `insufficient evidence` |
| Non-inferiority with margin `δ` (higher is better) | `L ≥ −δ` | `U < −δ` | `insufficient evidence` |
| Non-inferiority with margin `δ` (lower is better, e.g. a miss share) | `U ≤ δ` | `L > δ` | `insufficient evidence` |

Pre-registered margins for `cv-eval@1`:

| Metric | Margin | Meaning |
| --- | --- | --- |
| Precision@10 | δ = 0.10 | At most one of the ten next-session notes worse than the baseline |
| Estimated bottom-20% share of actionable-critical notes | δ = 0.05 | At most 5 percentage points more of them buried |

`insufficient evidence` is reported as such, never rounded to a pass. With 10
binary outcomes per policy on one freeze, it is the **expected** outcome of a
first round, and it is the honest one. Freezes may be combined (stratified, as
above) to reach a decision.

1. A candidate may replace the default only if, on the operational tier, all of
   these pass:
   - superiority over B0 on Precision@10;
   - non-inferiority to B2 on Precision@10 (δ = 0.10);
   - non-inferiority to both B0 and B2 on the estimated bottom-20% share of
     actionable-critical notes (δ = 0.05);
   - every seeded note confirmed `actionable_critical` ranks in the top 20% of
     the queue (an observed check per note, not a statistical test);
   - and on the diagnostic tier (a veto only), no `type` or age bucket with
     ≥ 5 notes has a mean rank percentile worse than under B0 by more than 20
     points.
2. Jev Delta (C4) becomes an option only if it passes superiority over the best
   local-Delta policy on operational Precision@10 or on the actionable-critical
   miss estimate, and passes non-inferiority (same margins) on the other.
3. A producer (local or Jev) may claim `high` confidence for a band only if, on
   labelled data, its claims in that band are correct ≥ 85% of the time, with at
   least 20 supporting cases and a 95% Wilson lower bound ≥ 0.70 (in practice
   ≥ 19 of 20). Otherwise local producers are capped at `medium` and Jev bands
   stay `null` (uncalibrated). See the calibration record in
   [signal-store-v2 §2.4](./signal-store-v2.md#24-calibration-and-confidence).
4. Passing on one freeze of 60–80 + pool notes is a **direction**. The default
   changes for everyone only after the rules also pass on a second freeze
   (rules 1–2 are evaluated per freeze and on the combined stratified sample).
   An independent second vault is preferred. A second freeze of the **same**
   vault qualifies only after at least 30 days **and** a substantive change in
   knowledge: at least 10 compiled pages created or modified, and at least 30
   notes added or modified since the first freeze. Both are counted from the
   two manifests, and the report shows the counts.

## 11. `focus.md` dates

- Format: Markdown with optional YAML frontmatter `until: YYYY-MM-DD`.
- `until` is **inclusive**: focus is in force through 23:59:59 of that date in the
  machine's local time zone; from the next local midnight it has expired and
  Relevance falls back to `KNOWLEDGE.md`.
- No `until`: in force indefinitely. Unparseable `until`: treated as absent, and
  `knowlery health` warns.
- Frozen evaluation: the date is interpreted against `frozenAt` in the time zone
  recorded in the manifest, never the evaluation machine's clock.

## 12. Data handling

- The repository is public. Freezes, real annotation sheets, private harness
  files, Jev caches and reports live **outside the repository**; the harness
  takes them by path (`--freeze`, `--sheet`, `--private`), and default output
  paths are gitignored.
- Committed: this protocol, the annotation template (synthetic example), the
  synthetic full-vault fixture and its synthetic annotations.
- The real-vault `evals/jev-triage/labels.yaml` is being replaced by a synthetic
  example in #87; history rewriting is a separate risk assessment.

## 13. 1.6.1 deliverables (tooling only, no product change)

| Piece | Role |
| --- | --- |
| `evals/compile-value/freeze.ts` | Full freeze + manifest (§2) |
| `evals/compile-value/sample.ts` | Diagnostic sample with inclusion probabilities, seeded set, blind sheet + private file (§3–4) |
| `evals/compile-value/pool.ts` | Run available policies on the full freeze, build the operational pool, append unlabelled notes to the sheet (§5) |
| `evals/compile-value/run.ts` | Both tiers' metrics, availability reporting, bootstrap CIs, weighted estimates; Markdown + JSON report stamped with protocol version and `freezeId` (§8–9) |
| `evals/compile-value/fixtures/` | Synthetic full vault + synthetic labels with hand-computed expected metrics |
| Tests | Metric maths (P@k, graded nDCG, Horvitz–Thompson, κ, Wilson bounds); decision tests return `pass` / `fail` / `insufficient evidence` exactly at their boundaries, and a CI containing 0 is never reported as non-inferior unless `L ≥ −δ`; paired and stratified bootstrap reproducible under a fixed seed; freeze-id mismatch refusal; blindness (sheet holds no scores, tiers, strata or seeded flags); `not available` reporting; `until` interpretation incl. time zone and inclusivity |

The 1.6.0 `jev-triage` harness stays for reproducibility of its numbers.

## 14. Questions resolved in review (revision 3)

1. **Pool depth**: top 20 per policy, plus an optional random probe of ranks
   21–50 when the budget allows (§5).
2. **Second freeze**: an independent vault is preferred. The same vault
   qualifies after at least 30 days and a substantive knowledge change (§10,
   rule 4).

No open questions remain in this document.
