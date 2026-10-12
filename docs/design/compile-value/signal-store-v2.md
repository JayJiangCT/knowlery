# Signal store v2 design

Status: draft revision 3. Revision 2 addressed the first #86 review; revision 3
adds the second review's engineering conditions (lock reclaim, semantic
inversion) and its decisions. Target release:
**1.7.0**. Nothing here ships in 1.6.x.
Lineage: successor of the 1.6.0 triage store (`.knowlery/triage.json`, schemaVersion 1).

## 1. Principles

1. **Three independent, explainable signals**: Worth, Delta, Relevance. Each
   carries its value, a confidence, the evidence it rests on, and the producer
   and algorithm version that made it. No composite score is persisted.
2. **`unknown` is a first-class answer.** A signal without enough evidence says so;
   it never manufactures precision.
3. **Confidence is earned, not asserted.** No producer claims `high` without a
   calibration record from the evaluation protocol (§2.4).
4. **Ordering is a named, versioned policy computed at read time** from the
   stored signals. Changing policy never requires re-scoring (and never costs
   money).
5. **Works without Jev.** Every signal has a local producer, or an honest
   `unknown`. Jev is an optional producer for Worth (as in 1.6.0) and for the
   subject relation; Jev Delta sits behind a separate consent.
6. **The store holds paths, hashes, numbers and enums. It never holds note or
   page text, and never the key.** Same boundary as 1.6.0.
7. **Correct invalidation over clever reuse.** Every cached judgment records a
   fingerprint of exactly the inputs its producer consumed (§4); when any of
   them changes, the judgment is stale.
8. **Signals order the queue; they never remove a note from it.** No signal
   value, fresh or stale, lets the cook agent skip a note without reading it
   (§5.3).

## 2. The three signals

| Signal | Depends on | Producers | Persisted? |
| --- | --- | --- | --- |
| Worth | the note only | `jev-worth` (note-only request), `local-worth` (structural detectors; otherwise no claim) | yes |
| Delta | the note **and** the relevant part of the knowledge base | `local-delta`; `jev-subject` (target only); `jev-delta` (opt-in, off by default) | yes |
| Relevance | the note **and** the focus in force | local only | **no**, computed at read time |

Relevance is not persisted because its input (focus) changes on the user's
schedule rather than the note's, so a cached value would usually be stale. It
is cheap to compute locally and memoised in-process per
`(contentHash, focusFingerprint, algorithmVersion)`.

### 2.1 Worth

`value ∈ [0, 1]`, plus `confidence ∈ {low, medium, high} | null` (null means
"not calibrated").

**`jev-worth`** asks only `worth_compiling`, with the note's path, title,
frontmatter and preview. **No candidate pages are sent with it** (see §4.2 for
why this request is split from today's combined one). Its confidence is `null`
until a calibration record exists for its exact version (§2.4). A score of 0.95
is shown as "0.95 (uncalibrated)", never as "high confidence". The ordering
policies still use the value, exactly as 1.6.0 does.

**`local-worth`** (minimal, as decided) emits a signal only on clear,
verifiable evidence, and is silent otherwise. Silence means `unknown`:

| Detector | Fires when | Value |
| --- | --- | --- |
| `empty` | No non-whitespace body after frontmatter, and frontmatter has no keys beyond an allow-list of structural ones (`tags`, `aliases`, `created`, `updated`, `date`) | 0 |
| `template-boilerplate` | After removing template placeholders (`{{…}}`, `<% … %>`), the body equals a file in the vault's configured templates folder (Obsidian core Templates or Templater setting), or a template Knowlery ships | 0 |
| `declared-generated` | Frontmatter declares the file generated, matched against a code-reviewed list of exporter markers with a test per marker | 0 |

Rules for `local-worth`:

- No folder names, no "draft" or "scratch" words in paths or titles, no length
  thresholds. Ordinary notes get no local Worth signal.
- Confidence starts at `medium` and rises to `high` only through calibration (§2.4).
- The detector that fired is the evidence, and the UI shows it (for example,
  "matches template `Templates/Daily.md`").

### 2.2 Delta

Delta is a **class**, not a number: `new` | `partial` | `redundant` | `unknown`.
It comes with `confidence ∈ {low, medium, high} | null`, a `target` compiled
page or `null`, and an evidence list. A note without a usable Delta judgment is
`unknown`.

#### 2.2.1 Evidence by relation type

Evidence is classified by **what relation it actually proves**. The class a rule
may conclude is limited by the relation, not just by how strong the evidence
looks. Remember that an uncooked note is, by definition, cited by no compiled
page.

| Relation | Evidence kinds | What it proves | What it does **not** prove |
| --- | --- | --- | --- |
| **Source**: the note resembles material a page was compiled from | `near-duplicate-of-source` (shingle similarity to a note that page `P` cites) | `P` was compiled from closely related material | That `P` contains this note's facts: the page may have used a fraction of its source, and this note may differ exactly where it matters |
| **Version**: the note is another version of a cited note | `version-of-source` with `direction ∈ {newer, older, unknown}` and `via ∈ {frontmatter, dated-path}` | Same document lineage | That the newer side is covered: a **newer** version may add decisions the page lacks |
| **Subject**: the note and a page share a subject | `links-to-page`, `jev-same-subject` (probability), `retrieval-similar` (score) | Where the note's content would belong (the `target`) | Anything about overlap |
| **Coverage**: the page holds the note's content | `content-coverage` (share of the note's key items found on page `P`), `jev-delta` (opt-in model judgment against `P`'s summary) | How much of the note `P` already holds | Nothing beyond the items checked |
| **Absence** | `no-candidate` (no subject relation found by any producer) | Retrieval found no home | That none exists: retrieval can miss |
| Context only | `page-newer` (a related page changed after the note) | Nothing about the class | It is recorded for the explanation line only |

**Only coverage evidence can support `redundant`.** Source and version relations
choose which pages to check for coverage. They never conclude `redundant` on
their own.

`content-coverage` (local, `local-delta@1`) works like this. It extracts the
note's **key items**: numbers with units, dates, version strings, identifiers
(ticket keys, code symbols, `CamelCase`/`snake_case` names), quoted strings and
sentences carrying decision markers ("decided", "agreed", "must", "决定",
"确认", …). It then looks for each item in `P`'s text after normalisation. The
evidence records counts, never the items.

**Matching words is not matching meaning.** "Caching must be enabled" and
"caching must be disabled" share almost every token. "Retention: 30 days" and
"Retention: 90 days" share the subject, but the value was updated. Each key item
is therefore compared as a small tuple, not a bag of words:

| Item kind | Compared as | Covered only if | Conflict if |
| --- | --- | --- | --- |
| Number / date / version | `(subject term within the same clause, value, unit)` | Same subject, value and unit on `P` | Same subject and unit, different value (an update) |
| Decision sentence | `(subject terms, action, polarity)`, where polarity comes from a reviewed lexicon of negators and opposite pairs per language (`not`/`never`/`must not`/`no longer`, `enable`↔`disable`, `adopt`↔`drop`; `不`/`没`/`禁止`/`不得`/`无需`, `启用`↔`禁用`, `采用`↔`放弃`, …) | Same subject and action with the **same** polarity | Same subject and action with opposite polarity (a reversal) |
| Identifier / quoted string | Exact token | Present on `P` | — |

An item whose polarity or subject cannot be determined reliably is
**unverifiable**. That includes double negation, conditionals ("unless",
"除非"), negation scope spanning clauses, and a language outside the lexicon.
An unverifiable item never counts as covered.

`content-coverage` evidence records `itemCount`, `coveredCount`,
`conflictCount` and `unverifiableCount`.

Direction of a version relation comes from explicit evidence only. That means a
`supersedes:` / `superseded_by:` frontmatter key on either note, or an ISO date
or version number in otherwise identical file names. When that evidence is
missing, the direction is `unknown`. File mtime alone never decides direction.

#### 2.2.2 Decision rules for `local-delta@1`

Rules are applied top to bottom; the first match wins.

| Evidence present | Class | Max confidence | Target |
| --- | --- | --- | --- |
| `content-coverage` on `P` with `conflictCount > 0`, and the note is the newer side by explicit evidence (`version-of-source` `direction: newer`, or a later date in its frontmatter or file name than the conflicting statement's source) | `partial` | `low` | `P` |
| `content-coverage` on `P` with `conflictCount > 0`, direction not established | `unknown` | — | `P` |
| `content-coverage` on `P`: `itemCount ≥ 5`, `conflictCount = 0`, no unverifiable decision sentence, and `coveredCount / itemCount ≥ 0.9` | `redundant` | `medium`, or `high` only via calibration (§2.4) | `P` |
| `content-coverage` on `P`: `unverifiableCount / itemCount > 0.3` | `unknown` | — | `P` |
| `content-coverage` on `P`: covered share between 0.3 and 0.9 | `partial` | `medium` | `P` |
| `version-of-source`, `direction: newer` | `partial` | `low` | the page citing the older version |
| `content-coverage` on `P`: covered share < 0.3, with a source or version relation to `P` | `partial` | `low` | `P` |
| Any subject, source or version relation, but no coverage evidence (too few key items, or `direction: older/unknown`) | `unknown` | — | the strongest related page |
| `no-candidate` only | `new` | `low` | `null` |
| Nothing usable | `unknown` | — | `null` |

Notes on these rules:

- A note with fewer than 5 key items cannot reach `redundant` locally: there is
  not enough to check. It stays `unknown` with its target, which is the honest
  answer for short prose notes.
- `page-newer` never changes the class.
- **`high` is reserved for coverage producers that passed calibration.** Lexical
  coverage alone is capped at `medium` until the protocol's rule 3 is met on
  labelled data.
- Thresholds (5 items, 0.3, 0.9, and the shingle threshold used for
  `near-duplicate-of-source`) are starting points. They are reviewed against the
  first labelled round, and any change bumps the version to `local-delta@2`.

#### 2.2.3 `jev-subject`: the 1.6.0 target, separated

Today's combined request also asks `same_subject_pN` for up to five candidate
pages. In 1.7.0 that becomes its own producer. It sends the same data as 1.6.0
(note path, title, frontmatter, preview, plus candidate titles and descriptions),
so **nothing new is sent**. It contributes `jev-same-subject` evidence (a subject
relation) and a `target`, never a class. Its input fingerprint includes the
candidate set (§4.2).

#### 2.2.4 New local capabilities needed

- **Link extraction**: wikilinks per page in both transports. The fs scanner
  parses `[[…]]`; the live snapshot reads Obsidian's metadata cache. A parity
  test covers both, like the existing one.
- **Near-duplicate detection**: shingles from the existing tokenizer (CJK-aware),
  compared against *cited* notes only. Candidates are pre-filtered by retrieval
  neighbourhood and directory, so the cost stays far below uncooked × cited.
- **Key-item extraction and coverage check**: deterministic, CJK-aware, and
  unit-tested per item kind.

### 2.3 Relevance

`level ∈ {high, medium, low, unknown}` plus `source ∈ {focus, knowledge} | null`:

- If `.knowlery/focus.md` is in force (§2.3.1), retrieval overlap of the note
  against its terms gives `high` or `low`. When the result is not `high`, fall
  through to `KNOWLEDGE.md`.
- The "About This Knowledge Base" section of `KNOWLEDGE.md`: overlap gives
  `medium` or `low`.
- If neither source is usable, the result is `unknown`.

Matched terms are shown at render time and never written to the store.

#### 2.3.1 `focus.md` format and expiry

```markdown
---
until: 2026-12-31
---
- storage migration for example-service
- onboarding docs rewrite
```

- Free Markdown, user-owned; one topic per bullet is recommended. Frontmatter is
  optional and `until:` is its only defined key.
- `until: YYYY-MM-DD` is **inclusive**: focus is in force through 23:59:59 local
  time on that date and has expired from the next local midnight. After that,
  Relevance uses `KNOWLEDGE.md` only.
- No `until` means focus is in force indefinitely. An unparseable `until` is
  treated as absent, and `knowlery health` warns about it.
- "Local time" is the time zone of the process computing Relevance. Frozen
  evaluations use `frozenAt` in the time zone recorded in the freeze manifest,
  never the evaluation machine's clock.
- `focusFingerprint` = sha256 of `(focus.md content, in-force flag, KNOWLEDGE.md
  About section)`. Expiry therefore changes the fingerprint even when no file
  changed.

### 2.4 Calibration and confidence

A producer version may label a value band `high` (or `medium`) only through a
**calibration record**. The record is a constant in code, reviewed like any other
change, and never stored in the vault:

```ts
interface CalibrationRecord {
  producerVersion: string;      // e.g. 'jev-1.13.0/worth@2'
  protocol: string;             // 'cv-eval@1'
  freezeIds: string[];          // every freeze it was measured on
  bands: Array<{
    range: [number, number];    // value range, or the class for Delta
    confidence: Confidence;
    n: number;                  // labelled notes in this band
    precision: number;          // share whose label agrees
    wilsonLower95: number;      // lower bound of the 95% Wilson interval
  }>;
}
```

A band may be labelled `high` only if `n ≥ 20`, `precision ≥ 0.85` and
`wilsonLower95 ≥ 0.70` (evaluation protocol §10, rule 3). With 20 notes, that
requires at least 19 correct. A band that fails stays at `medium` at most; if no
record exists, confidence is `null` (shown as "uncalibrated"). The 1.6.0 bands
(> 0.8, ≤ 0.2) remain **ordering** thresholds for `jev-worth@1`. They are no
longer presented as confidence.

## 3. Data structures

File: **`.knowlery/compile-signals.json`**, `schemaVersion: 2`. The new path is
deliberate (§6.1).

```ts
type Confidence = 'low' | 'medium' | 'high';

interface SignalStore {
  schemaVersion: 2;
  /** Monotonic counter, incremented on every successful write (§4.4). */
  generation: number;
  /** Agent-tier fingerprint at the last write; lets readers skip revalidation when unchanged. */
  kbFingerprint: string;
  /** Last consent state a 1.7.x shell observed, so a silent change can be announced (§7.1). */
  consentObserved?: { pageSummaries: boolean; at: string };
  notes: Record<string, NoteSignals>; // keyed by vault-relative path
}

interface NoteSignals {
  /** sha256 of the normalised full note (LF, BOM stripped), first 16 hex chars. Identity, not a cache key. */
  contentHash: string;
  /** Fast path only: same mtime ⇒ trust contentHash without re-hashing. Whole ms. */
  mtimeMs: number;
  worth?: Record<string, WorthSignal>;  // by producer: 'jev-worth', 'local-worth'
  delta?: Record<string, DeltaSignal>;  // by producer: 'local-delta', 'jev-subject', 'jev-delta'
}

interface SignalMeta {
  producer: string;
  version: string;            // e.g. 'jev-1.13.0/worth@2', 'local-delta@1'
  computedAt: string;         // ISO
  /** sha256 over exactly what the producer consumed (§4.2), first 16 hex chars. */
  inputFingerprint: string;
}

interface WorthSignal extends SignalMeta {
  value: number;
  confidence: Confidence | null;   // null = uncalibrated
  detector?: 'empty' | 'template-boilerplate' | 'declared-generated';  // local-worth only
  detectorRef?: string;            // e.g. the matching template path
}

interface DeltaSignal extends SignalMeta {
  class: 'new' | 'partial' | 'redundant' | 'unknown';
  confidence: Confidence | null;   // null when class is unknown or uncalibrated
  target: { path: string; title: string } | null;
  evidence: DeltaEvidence[];
  /** KB state the judgment was last revalidated against (§4.3). */
  revalidatedAt: { kbFingerprint: string };
}

type DeltaEvidence =
  | { kind: 'near-duplicate-of-source'; of: string; citedBy: string[]; similarity: number }
  | { kind: 'version-of-source'; of: string; citedBy: string[]; direction: 'newer' | 'older' | 'unknown'; via: 'frontmatter' | 'dated-path' }
  | { kind: 'links-to-page'; page: string; direction: 'note-to-page' | 'page-to-note' }
  | { kind: 'jev-same-subject'; page: string; probability: number }
  | { kind: 'retrieval-similar'; page: string; score: number }
  | { kind: 'content-coverage'; page: string; itemCount: number; coveredCount: number; conflictCount: number; unverifiableCount: number }
  | { kind: 'jev-delta'; page: string; probability: number }
  | { kind: 'no-candidate' }
  | { kind: 'page-newer'; page: string };
```

Example entry:

```json
{
  "schemaVersion": 2,
  "generation": 41,
  "kbFingerprint": "9f2c41d07ab3e815",
  "notes": {
    "Projects/example-service/2026-03-04 storage decision.md": {
      "contentHash": "a41f09c2be77d013",
      "mtimeMs": 1791619688992,
      "worth": {
        "jev-worth": {
          "producer": "jev-worth", "version": "jev-1.13.0/worth@2", "computedAt": "2026-11-02T09:12:00Z",
          "inputFingerprint": "77c0e21a9b3d4f10", "value": 0.91, "confidence": null
        }
      },
      "delta": {
        "local-delta": {
          "producer": "local-delta", "version": "local-delta@1", "computedAt": "2026-11-02T09:12:01Z",
          "inputFingerprint": "3be0c9a1f4d27e66",
          "class": "partial", "confidence": "medium",
          "target": { "path": "concepts/example-service-storage.md", "title": "Example service storage" },
          "evidence": [
            { "kind": "near-duplicate-of-source", "of": "Daily/2026-03-01.md", "citedBy": ["concepts/example-service-storage.md"], "similarity": 0.58 },
            { "kind": "content-coverage", "page": "concepts/example-service-storage.md", "itemCount": 9, "coveredCount": 5, "conflictCount": 0, "unverifiableCount": 1 },
            { "kind": "page-newer", "page": "concepts/example-service-storage.md" }
          ],
          "revalidatedAt": { "kbFingerprint": "9f2c41d07ab3e815" }
        }
      }
    }
  }
}
```

## 4. Cache lifecycle and invalidation

### 4.1 Two different hashes

- **`contentHash`** identifies the note's content. It is used for the mtime fast
  path, rename detection and the in-process Relevance memo. **It is not a cache
  key for any signal.**
- **`inputFingerprint`** is per signal. It hashes exactly what that producer
  consumed, including the request template or algorithm version and, for Jev,
  the model id. A signal is valid while its recomputed `inputFingerprint` equals
  the stored one, and stale otherwise.

The two genuinely differ. An edit on line 40 changes `contentHash` but not the
Jev preview (first 15 non-empty lines), so a Jev Worth score stays valid and is
not paid for again. A rename leaves `contentHash` unchanged but changes the path
Jev saw, so the Jev score becomes stale.

### 4.2 What each producer's fingerprint covers

| Producer | `inputFingerprint` covers |
| --- | --- |
| `jev-worth` | Path, title, normalised frontmatter, preview (`PREVIEW_LINES`, `PREVIEW_MAX_CHARS`), request template version, model id |
| `jev-subject` | Everything in `jev-worth` **plus** the ordered candidate set: each candidate's path, title and description, and the shortlist algorithm version |
| `jev-delta` | Everything in `jev-subject` **plus** each candidate's summary payload hash (§7) |
| `local-worth` | `contentHash`, detector version, and the hash of the templates folder contents and exporter-marker list |
| `local-delta` | Path, `contentHash`, algorithm version, and the `(path, contentHash)` of every page and cited note consulted (retrieval candidates, link neighbours, version and near-duplicate partners) |

**Why Jev Worth is split from the candidate request.** In 1.6.0 one request asks
`worth_compiling` together with `same_subject_pN`, so the Worth answer was
produced in the presence of candidate pages. Its true input therefore includes
the candidate set, and any new related page would invalidate a paid Worth score.
The review offered two options: isolate Worth from candidate context, or include
candidates in its dependencies. Including them would make Worth churn on every
cook session. Isolating it gives Worth a stable, note-only fingerprint and
confines candidate churn to `jev-subject`, the only part that semantically
depends on it.

The costs of splitting:

- Two requests instead of one, so the note preview is sent twice when both run.
  `jev-subject` only re-runs when its candidate set changes, so in steady state
  most re-runs are subject-only.
- `jev-worth@2` is a new measurement and its distribution may differ from 1.6.0
  scores. It must be re-baselined in the evaluation (B2 uses the frozen 1.6.0
  scores; `jev-worth@2` is reported as its own row).

**Imported 1.6.0 scores** (§6.2) are stored as `jev-worth` with version
`jev-1.13.0/combined@1`. Their `inputFingerprint` covers the `jev-worth` inputs
only, because the candidate set they saw cannot be reconstructed. That is a
documented approximation: they are used for ordering exactly as 1.6.0 uses
them, are never used as evaluation evidence for `@2`, and are replaced the next
time a Jev run scores that note.

### 4.3 Revalidation when the knowledge base changes

Recomputing `local-delta`'s fingerprint needs the current candidate set, which
means a local retrieval per note. To keep `stale` fast:

1. If the snapshot's `kbFingerprint` equals the entry's
   `revalidatedAt.kbFingerprint`, the entry is valid and no work is needed. This
   is the common case between cook sessions.
2. Otherwise the entry is **pending revalidation**. Recompute its candidate set
   and fingerprints locally:
   - unchanged: still valid; update `revalidatedAt`;
   - changed: recompute `local-delta` immediately (local, no cost). Mark
     `jev-subject` and `jev-delta` stale. They are re-scored only by an explicit
     Jev run, never on an agent's critical path.
3. Revalidation runs under a budget per `stale` call (indicative: 200 notes or
   300 ms on the 4,000-note perf tier, newest first). Entries beyond the budget
   are served as **unrevalidated** (§5.3), never dropped. `knowlery triage`
   revalidates everything.

This also catches **new** related pages: a new page that retrieval or links
would surface changes the candidate set, so it invalidates the judgment even
though no previously consulted page changed. A new page the producer would not
consult cannot change its answer. The remaining blind spot is retrieval recall
itself, which the evaluation measures (`no-candidate` evidence against `delta`
labels).

### 4.4 Pruning and renames

- Entries for notes that are no longer uncooked are pruned on write (as in 1.6.0).
- **Renames**: before pruning, an orphaned entry whose `contentHash` matches an
  unscored note is moved to the new path. Each signal is then rechecked:
  `local-*` are recomputed for free; `jev-*` inputs include the path, so they
  become stale (shown with their old value and a stale marker) until an explicit
  Jev run re-scores them. Keeping the path in the Jev input is deliberate: folder
  and file names carry real meaning for the judgment.
- `mtimeMs` is a fast path only. Equal mtime means `contentHash` is reused. A
  different mtime means the note is re-hashed; if the hash is unchanged (a touch,
  or a sync tool rewriting timestamps), every signal survives and only `mtimeMs`
  is updated. This removes the 1.6.0 behaviour of re-scoring, and paying for,
  notes whose content did not change.

### 4.5 Concurrent writers

Writers: the plugin (manual rank, background scoring), CLI `knowlery triage` and
`stale`, and the MCP server's `stale` auto-score. These can run at the same time
on one machine. A cloud-sync client can also deliver another device's version of
the file at any moment.

**Read–merge–write plus rename alone is not safe.** Two writers can both read
generation `G`, merge their own scores, and rename into place one after the
other; the second rename silently discards the first writer's paid scores. Rename
prevents a torn file. It does not prevent a lost update.

#### 4.5.1 What the runtimes guarantee

| Operation | Guarantee | Limits |
| --- | --- | --- |
| Node `fs.open(path, 'wx')` | `O_CREAT \| O_EXCL` (POSIX) / `CREATE_NEW` (Windows): exactly one creator wins on a local filesystem | Not across devices on a cloud-sync folder (iCloud, Dropbox, OneDrive, Obsidian Sync): each device's lock is local; sync may later produce a conflicted copy |
| Node `fs.rename` | POSIX `rename(2)`: atomic replace within one filesystem; readers see the old or the new file, never a mix | Windows (`MoveFileExW` with replace): no atomicity promise to readers, and it fails with `EPERM`/`EBUSY`/`EACCES` while another process (antivirus, sync client, indexer) holds the target open; needs bounded retry |
| Obsidian `vault.adapter.write` | Whole-file write on desktop | No exclusive create, no compare-and-swap; not suitable as a lock primitive |
| Obsidian `vault.adapter.rename` | Moves a file | Behaviour when the target exists is not specified by the API; the design does not rely on it |

The plugin is desktop-only (`isDesktopOnly: true`) and already resolves the vault
base path (`FileSystemAdapter.getBasePath()`). The store writer can therefore use
**Node `fs` directly in both runtimes**, through one shared helper. It does not
go through `VaultFs` and is independent of the Obsidian adapter's semantics.
`.knowlery/` is a dot-folder, so Obsidian does not index the lock or temp files.

#### 4.5.2 Options compared

| | A. Exclusive lock file + generation check | B. Optimistic generation check only | C. Per-writer segment files + locked compaction |
| --- | --- | --- | --- |
| Mechanism | Create `.knowlery/compile-signals.lock` with `wx`; inside the lock, read, check `generation`, merge, write temp, rename, release | Read `G`; prepare; re-read just before rename; retry if changed | Each writer appends to its own `.knowlery/signals/<writerId>.json`; readers merge all; compaction under a lock |
| Lost updates on one machine | None while locks are honoured | Still possible: the check-then-rename gap is a TOCTOU window | None (no shared file to race on) |
| Crash while holding | Stale lock must be reclaimed (below) | Nothing to reclaim | Nothing to reclaim; compaction lock as in A |
| Cross-device (sync) | Lock is local only; another device's write can still win | Same | Better: devices write different files, as long as `writerId` includes a device id |
| Reader cost | One file | One file | N files, plus a merge on every read |
| Complexity | Low | Lowest | Highest: writer identity, segment growth, compaction policy |

**Recommendation: A**, with C as the fallback if the tests below or field reports
show A is not enough. Both rely on lock files that need `wx`. B is rejected as a
sole mechanism, but its generation check is kept inside A as a second line of
defence.

#### 4.5.3 Option A in detail

- The lock is held **only for the read–merge–write critical section**
  (milliseconds), never across Jev calls. Network work happens outside the lock;
  results are merged afterwards.
- Lock content: `{ token, pid, host, pidNamespace, command, createdAt }`.
  `pidNamespace` is the inode of `/proc/self/ns/pid` on Linux and absent
  elsewhere. Acquisition retries with jittered backoff for up to 2 s. If the lock
  is still unavailable after that, the writer gives up for this write: results
  are kept in memory and retried once at the end of the run, then dropped with a
  warning. A dropped result costs a re-score later; it is never written unlocked.

**Age never proves the holder is gone.** A holder can be paused (`SIGSTOP`, a
debugger), blocked on a slow disk, or resumed from system sleep, and still
legitimately hold the lock. The 30 s age is only the point after which a waiting
writer *checks* liveness instead of just waiting. It is never a reason to
reclaim on its own.

**Liveness is decided only when it can be decided:**

| Holder, compared with the waiting writer | Decision |
| --- | --- |
| Same `host`, same `pidNamespace` (or both absent), `process.kill(pid, 0)` throws `ESRCH` | **Dead**: may be reclaimed |
| Same `host` and namespace, pid exists (alive, paused, or a reused pid) | **Alive**: wait, then give up as above; never reclaim |
| Different `host` (a lock delivered by a sync client or a shared drive), or a different `pidNamespace` (for example a Flatpak or container sandbox, where pids are not comparable) | **Undecidable**: never reclaimed automatically |
| Malformed lock content | **Undecidable** |

Errors always land on the safe side. A reused pid reads as alive, which costs a
skipped write, never a stolen lock. When a write gives up because of an alive or
undecidable holder, `knowlery health` and the triage output name the holder
(host, pid, command, age). `knowlery triage --break-lock` removes the lock after
showing the holder and requiring `yes` on a TTY. That is the only way an
undecidable lock is removed.

**Ownership-verified reclaim.** Reading a lock, judging it dead, and then
renaming or unlinking it is a check-then-act race. Between the check and the act,
the lock may have been released and recreated by a live writer. Reclaim
therefore runs under a second lock, so the observed lock cannot change before
it is removed:

1. Observe `compile-signals.lock` with token `t`, and judge its holder dead (table
   above).
2. Create `compile-signals.lock.reclaim` with `wx`. If that fails, another writer
   is reclaiming; go back to waiting.
3. Re-read `compile-signals.lock`. If it is gone, or its token is not `t`, the
   situation changed: release the reclaim lock and go back to waiting.
4. Re-check liveness for `t`'s holder. If still dead, unlink
   `compile-signals.lock`.
5. Release the reclaim lock, then acquire normally with `wx`.

Why this is safe: while the reclaim lock is held, only two actors could remove
`compile-signals.lock`. Its owner can't, because step 4 verified it is dead.
Another reclaimer can't, because it would need the reclaim lock. No live writer
can create a new lock either, because `wx` fails while the dead one exists. So
the lock unlinked in step 4 is the lock checked in step 3. The window the review
described (lock released and recreated between observation and rename) is
closed by step 3.

**The reclaim lock is never reclaimed automatically.** It is held for
microseconds, so a leftover one means a crash inside reclaim, which is a double
failure. Writers then give up as above, and `--break-lock` clears both files.
This bounds the design: no automatic step ever removes a lock it has not just
verified under exclusion.

**Fencing at commit (defence in depth).** Immediately before the final rename,
the holder re-reads the lock and checks two things: that the token is still its
own, and that the store's `generation` is still the `G` it read. If either check
fails, it abandons the temp file and restarts the update from acquisition, up to
3 times. This catches a lock removed by `--break-lock` or delivered by a sync
client mid-update. The remaining window is between this check and `rename`
(microseconds), and only matters if a lock was also wrongly removed.
- On Windows, the rename retries `EPERM`/`EBUSY`/`EACCES` with backoff for up to
  1 s.
- Merging is per `(note, signal kind, producer)`: the entry with the newer
  `computedAt` wins when both have the same `inputFingerprint`; otherwise the
  entry whose fingerprint matches the current inputs wins.
- Entries with an unknown producer, evidence kind or signal are **preserved
  verbatim**, so a 1.7.x shell never deletes what a later 1.7.y wrote.

**Stated guarantee.** On one machine, with holders in comparable pid namespaces,
concurrent Knowlery writers lose no updates and never produce a torn file. A
holder that cannot be proven dead blocks writes, which costs scores, rather than
being reclaimed, which could corrupt merges. Across devices on a sync folder, the file
is never torn locally, but the sync client may choose one device's version; the
worst case is **re-scoring cost, never corruption** and never a wrong signal
(every surviving entry still carries its own fingerprint).

#### 4.5.4 Tests (real concurrency, not interleaved promises)

- **Multi-process**: spawn 8 Node child processes; each writes 50 distinct notes'
  signals in tight loops against one temp vault. Assert all 400 entries are
  present and `generation` equals the number of successful writes. Run it in CI
  on Linux; run it on Windows and macOS in a scheduled job before the 1.7.0 tag.
The lock tests below are **must-pass conditions for merging the 1.7.0 store
implementation**. Timeouts are shortened through a test-only parameter, never by
sleeping 30 s.

- **Crash holding the lock**: a child acquires the lock and is killed with
  `SIGKILL`; another writer reclaims it after the age threshold and completes;
  no `.reclaim` file is left behind.
- **Paused holder is not reclaimed**: a child acquires the lock and is stopped
  with `SIGSTOP` well past the age threshold. Other writers give up (results
  dropped with the holder named), never reclaim. After `SIGCONT`, the child
  commits successfully and its update is present.
- **Release-and-recreate between observation and reclaim**: a test hook pauses a
  reclaimer after step 1; the dead lock is replaced by a live writer's lock; the
  reclaimer resumes, sees a different token at step 3, and backs off. The live
  writer's lock and update survive.
- **Concurrent reclaimers**: several processes judge the same dead lock at once;
  exactly one unlinks it; no update is lost.
- **Undecidable holders**: locks with a foreign `host`, a different
  `pidNamespace`, or malformed content are never removed automatically;
  `--break-lock` removes them only after TTY confirmation.
- **Pid reuse**: a lock naming a live, unrelated pid is treated as alive.
- **Crash during reclaim**: a leftover `.reclaim` file makes writers give up with
  a health message; `--break-lock` recovers.
- **Fencing**: a lock removed by `--break-lock` mid-update makes the original
  holder's commit abort and retry instead of overwriting.
- **Windows rename contention** (scheduled job): hold the target open from
  another process during a write; the write succeeds after retry or reports a
  dropped result, never a partial file.
- **Plugin and CLI together**: the plugin helper and the CLI share the same lock
  in an integration test using the real Node helper from both entry points.

## 5. Ordering policies and the public interface (1.7.0)

### 5.1 Policies

Registered, versioned, pure functions over
`(note, signals, relevance) → sort key`, with deterministic tie-breaking (mtime
descending, then path):

| Policy | Behaviour |
| --- | --- |
| `mtime@1` | Today's behaviour without a key |
| `jev-worth@1` | 1.6.0 behaviour (> 0.2 by worth, unscored by mtime, ≤ 0.2 last) |
| `worth-delta@1` | Evaluation candidate C1 |
| `worth-delta-relevance@1` | C2 |
| `local@1` | C3, the no-Jev product path |

Policies read the **effective** Delta class (§5.3), never the raw stored class.
The default stays `jev-worth@1` with a key and `mtime@1` without one, until a
candidate passes the pre-registered rules of the evaluation protocol. Switching
the default is a reviewed change, recorded in the CHANGELOG with the report.

### 5.2 Staleness report (additive, 1.7.0)

```ts
interface UncookedNote {
  path: string;
  title: string;
  mtimeMs: number;
  jev?: JevAnnotation;          // unchanged and still populated; frozen since 1.6.0
  signals?: {                   // added 1.7.0
    worth?: { value: number; confidence: Confidence | null; producer: string; detector?: string };
    delta?: {
      class: 'new' | 'partial' | 'redundant' | 'unknown';   // effective class (§5.3)
      confidence: Confidence | null;
      target: { path: string; title: string } | null;
      evidence: Array<{ kind: string; page?: string; of?: string; direction?: string }>;
      freshness: 'fresh' | 'stale' | 'unrevalidated';
      previous?: { class: 'new' | 'partial' | 'redundant'; confidence: Confidence | null };
    };
    relevance?: { level: 'high' | 'medium' | 'low' | 'unknown'; source: 'focus' | 'knowledge' | null };
  };
}

interface StalenessReport {
  // …existing keys unchanged…
  ordering?: { policy: string };  // added 1.7.0
}
```

Evidence numbers (similarity, coverage counts, probabilities) stay in the store
and the UI. The report exposes kinds, paths and directions: enough for an agent
to open the right files, without inviting it to over-read decimals.

Text renderers gain one "why" line per note, for example:

```
- Projects/example-service/2026-03-04 storage decision.md
    worth 0.91 (Jev, uncalibrated) · delta: partial, medium — 5 of 9 key items on concepts/example-service-storage.md · relevance: high (focus)
```

The MCP `stale` output schema gains the optional keys. The contract golden is
regenerated deliberately and the diff reviewed as additive only.

### 5.3 Freshness, stale `redundant`, and the cook skill

Effective Delta, as exposed to policies, the report and the agent:

| Stored judgment | Freshness | Effective class | `previous` |
| --- | --- | --- | --- |
| any | `fresh` | stored class | — |
| `redundant` | `stale` or `unrevalidated` | **`unknown`** | `{ class: 'redundant', … }` |
| `new` / `partial` | `stale` or `unrevalidated` | stored class, confidence lowered one step (`low` → `null`) | — |

A stale `redundant` judgment is the risky one: the page or the candidate set has
moved since it was made, and acting on it could bury a note. It is therefore
always exposed as `unknown`, with the previous class shown for explanation.

Cook skill rules (1.7.0 text):

- The three signals arrive separately. Worth informs reading order. Delta tells
  the agent **what to look for**: open the target; for `partial`, find what is
  missing; for `unknown`, do the retrieval yourself. Relevance breaks ties.
- **No signal is a reason to skip a note unread.** Even a fresh `redundant` only
  moves a note later in the reading order. The agent reads it, confirms coverage
  against the target page, and only then treats it as absorbed. A stale or
  unrevalidated note (`previous.class: redundant`) may be deprioritised but is
  read like any other.
- It is still a reading order, never a filter.

The skill text change triggers the cook-eval drift guard. A `compile-value` cook
fixture built from a synthetic freeze is the planned way to satisfy it, rather
than a waiver.

## 6. Migration and compatibility

### 6.1 Why a new file instead of `triage.json` schemaVersion 2

The 1.6.0 parser does not check `schemaVersion`. A v2 document at the same path
fails its entry validation, is read as an empty store, and the next 1.6.0 write
replaces it. Mixed versions are normal (the plugin auto-updates; a global CLI or
`npx` cache may lag), so sharing the path would mean silent data loss and paying
twice. A separate file makes 1.6.0 and 1.7.0 shells unable to clobber each
other's store by construction.

### 6.2 Upgrade path and the `triage.json` mirror

1. **Import**: when `compile-signals.json` is absent and `triage.json` is
   present, 1.7.0 imports each v1 entry whose mtime still matches as `jev-worth`
   with version `jev-1.13.0/combined@1` (§4.2), hashing the note at import. The
   v1 `target` becomes `jev-same-subject` evidence on a `jev-subject` signal
   (same semantics: a subject relation), never coverage evidence.
2. **Mirror during 1.7.x**: 1.7.0 keeps writing a v1 projection (worth and
   target) to `triage.json`, so a lagging 1.6.0 shell still ranks and does not
   re-score. The mirror write happens inside the §4.5 lock, in this order:
   - re-read `triage.json`;
   - import any v1 entry that is newer than ours (`scoredAt` later, mtime
     matching the note) into `compile-signals.json`;
   - write the union back.
   1.6.0 writers do not take the lock, so a 1.6.0 write landing between those
   steps can still be lost from the mirror. The authoritative copy is
   `compile-signals.json`, so the only exposure is a 1.6.0 score written in that
   window, which costs one re-score.
3. **Mirror content rules**: only entries whose `jev-worth` and `jev-subject` are
   valid and were produced with the model the mirror declares (`model:
   jev-1.13.0`). The 1.6.0 parser discards entries from another model, so if
   1.7.x moves to a new Jev model, the mirror keeps only `jev-1.13.0` entries.
   It does not relabel them. Entries a 1.6.0 shell wrote for notes 1.7.0 has not
   imported yet are preserved.
4. **Retire**: a later minor stops writing `triage.json`. That is allowed under
   the stability contract, which names it as a rebuildable private cache, and is
   called out in the CHANGELOG.

Mirror tests:

- import round-trip;
- a 1.6.0 writer (the real 1.6.0 `recordScores` + `writeTriageStore`, run in a
  child process) and a 1.7.0 writer alternating and overlapping, with a
  quantified bound: only scores written inside the documented window may be
  lost, and nothing in `compile-signals.json` is ever lost;
- a model mismatch does not wipe 1.6.0 entries;
- retention pruning matches 1.6.0's (no longer uncooked, or mtime changed).

### 6.3 Forward compatibility

- `schemaVersion > 2`: read what parses and **never write** (do not clobber a
  newer shell's file); report its scores read-only.
- Unknown producers, evidence kinds and signals: preserved on rewrite, ignored by
  policies.
- Parsing stays tolerant: this is a cache, so a malformed file reads as empty,
  never as an error. A malformed file is not overwritten until it has been moved
  aside to `compile-signals.json.corrupt-<timestamp>`, keeping at most one.

### 6.4 Contract classification

A new optional file and new optional report keys make this a minor release
(1.7.0). The `jev` field stays populated through 1.x. `compile-signals.json` is
documented as private, rebuildable state; `.knowlery/focus.md` (including
`until:`) is documented as an optional, user-owned file whose meaning is frozen
once shipped.

## 7. Jev Delta (opt-in): boundary

Not built in 1.7.0 unless the evaluation rule for C4 passes. It is specified here
so the store does not need another migration.

### 7.1 Consent

- **Separate consent**, default off, offered only when a key is configured:
  "Send compiled-page summaries to Jev". It is stored as `jev.pageSummaries:
  true` in `.knowlery/config.json`, which the plugin and the CLI already share.
  It is absent by default. Being visible in the vault means the choice is
  inspectable and versionable with the vault.
- **Mixed versions fail safe.** The 1.6.x `writeConfig` serialises only the keys
  it knows, so a 1.6.x shell that edits reference or ignore directories drops
  `jev.pageSummaries`. Consent is then revoked, never granted. 1.7.0 changes
  `parseConfig`/`writeConfig` to preserve unknown keys, with a test, so 1.7.x
  shells never drop each other's settings.
- **Consent changes are announced.** The store records the last consent state any
  1.7.x shell observed (`consentObserved: { pageSummaries: boolean, at: string }`
  at the top level of `compile-signals.json`; a boolean and a timestamp, no
  text). When the config disagrees with it, that shell says so once and then
  updates the record. The plugin shows a notice and the settings toggle; the CLI
  prints a line on stderr in `triage` and a `knowlery health` warning. Example:
  "Page-summary consent is now off; `.knowlery/config.json` was rewritten,
  possibly by an older Knowlery. Re-enable it in settings if intended." Consent
  is never restored automatically.
- **Granting** happens in plugin settings (a toggle that first shows the payload
  preview), or with `knowlery triage consent page-summaries on`. The CLI command
  prints the preview for a real note and requires typing `yes` on a TTY. It
  refuses to run non-interactively, and there is no `--yes` for it.
- **Per-run control** has no flag that grants consent and no environment
  variable. `--no-page-summaries` suppresses summaries for one run even when
  consent is on.
- **Where summaries can be sent**: only explicit runs (`knowlery triage`, or
  plugin manual rank). Never the MCP `stale` auto-score, never plugin background
  scoring, and never an agent's critical path.
- **Limit, stated plainly**: consent records the user's intent. It is not a
  security boundary against an agent that already has write access to the vault
  (such an agent could edit the config). The boundaries that hold are: the key
  never reaches agents through Knowlery, the cook skill never calls Jev, and the
  agent-facing paths above never send summaries.

| Stored consent | Flag | Run type | Summaries sent? |
| --- | --- | --- | --- |
| absent / false | none | explicit | no |
| absent / false | `--no-page-summaries` | explicit | no |
| true | none | explicit | **yes** |
| true | `--no-page-summaries` | explicit | no |
| true | any | MCP auto-score / background | no |
| malformed value | any | any | no, and `knowlery health` warns |

Each row is a test, plus one asserting that unknown flags such as
`--allow-page-summaries` are rejected as unknown options rather than silently
accepted.

### 7.2 Payload

- **Preview before consent**: settings and `knowlery triage --preview-payload
  <note>` render the exact request JSON for a real note without sending it.
- **Summary contents**: compiled page title, description, heading outline, and at
  most the first N non-empty lines, capped in characters. Never the full page,
  and never pages outside the candidate set.
- The store records only the answer (`jev-delta` evidence) and the payload hash
  inside `inputFingerprint`. Payloads are never stored.
- Confidence follows §2.4: `null` until calibrated.

## 8. Performance budget

| Path | Budget (4,000-note perf tier) |
| --- | --- |
| `stale`, nothing changed | ≤ 5% over 1.6.0: hashing piggybacks on content the scanners already read; one fingerprint comparison per entry |
| `stale`, after a cook session | Revalidation capped (§4.3); the rest served as unrevalidated |
| Near-duplicate and coverage pass | Bounded by the retrieval-neighbourhood pre-filter; measured in `evals/perf` before shipping |
| Lock critical section | p99 < 50 ms, measured in the multi-process test |

## 9. Test plan (1.7.0)

- **Fingerprints**: `contentHash` and `kbFingerprint` agree across transports (fs
  scanner and live snapshot), including CRLF/LF and frontmatter key order.
  `inputFingerprint` per producer covers exactly §4.2's inputs: an edit beyond
  the preview leaves `jev-worth` valid; a rename stales `jev-*` and not
  `local-worth`; a candidate change stales `jev-subject` and not `jev-worth`.
- **Invalidation matrix**: note edit, touch only, consulted page edit, a new page
  that enters the candidate set, a new unrelated page, algorithm bump, model
  bump, templates folder change (`local-worth`).
- **Delta rules**: one case per row of §2.2.2. Also:
  - near-duplicate or version evidence alone never yields `redundant`;
  - `direction: newer` yields `partial`;
  - fewer than 5 key items never yields `redundant`;
  - weak evidence never exceeds `low`;
  - nothing exceeds `medium` without a calibration record.
- **Semantic counter-examples (must pass before local Delta merges)**. Each case
  is a note/page pair, in English and Chinese, with the expected result. None of
  these may yield `redundant`:
  - negation: "must enable caching" vs "must not enable caching"; "需要审批" vs
    "无需审批";
  - decision reversal: "adopt Postgres" vs "drop Postgres"; "启用缓存" vs
    "禁用缓存";
  - numeric update: "retention 30 days" vs "retention 90 days"; a version string
    changed;
  - unit change: "timeout 30 s" vs "timeout 30 min";
  - same number, different subject: not a conflict, but not covered either;
  - double negation and conditionals ("unless", "除非") produce unverifiable
    items, and a note dominated by them yields `unknown`.

  A conflict with an explicitly newer note yields `partial`; without direction,
  `unknown`.
- **Local Worth**: each detector fires on its fixture; folder names, the word
  "draft" and short notes do **not** trigger anything.
- **Freshness**: a stale or unrevalidated `redundant` is exposed as `unknown`
  with `previous`; policies never order on the raw class.
- **Calibration**: a band with 18/20 correct is not labelled `high`; 19/20 is.
- **`focus.md`**: `until` inclusivity at 23:59:59 and 00:00:00 local time; time
  zone taken from the freeze manifest in evaluation mode; unparseable dates warn.
- **Concurrency and mirror**: §4.5.4 and §6.2.
- **Forward compatibility**: unknown-field preservation; `schemaVersion: 3` is
  read-only; a corrupt file is moved aside once.
- **Privacy**: the store and the report contain no note or page text and no key
  (extends the 1.6.0 assertions). `jev-worth` requests contain no candidate
  pages. No request contains page summaries unless §7.1's matrix allows it.
- **Policy purity**: same inputs give the same order; `jev-worth@1` reproduces
  1.6.0 output byte-for-byte.

## 10. Questions resolved in review (revision 3)

1. **`triage.json` mirror period**: the whole 1.7.x line. Removal is evaluated
   no earlier than the next minor after that.
2. **Lock age threshold**: 30 s is kept as the initial parameter, and it only
   triggers a liveness check. It can never override a live or undecidable
   holder (§4.5.3).
3. **Template with only a filled-in title**: not treated as low Worth.
   `template-boilerplate` matches the unmodified template only, until the first
   labelled round measures the false-positive rate of a looser rule.
4. **Consent location**: `.knowlery/config.json`, with consent changes announced
   (§7.1).

No open questions remain in this document.
