# Signal store v2 design

Status: draft for review. Target release: **1.7.0**. Nothing here ships in 1.6.x.
Lineage: successor of the 1.6.0 triage store (`.knowlery/triage.json`, schemaVersion 1).

## 1. Principles

1. **Three independent, explainable signals** — Worth, Delta, Relevance. Each
   carries its value, a confidence, the evidence it rests on, and who produced it
   with which algorithm version. No composite score is persisted.
2. **`unknown` is a first-class answer.** A signal without enough evidence says so;
   it never manufactures precision.
3. **Ordering is a named, versioned policy computed at read time** from the
   stored signals. Changing policy never requires re-scoring (and never costs
   money).
4. **Works without Jev.** Every signal has a local producer, or an honest
   `unknown`. Jev is an optional producer for Worth (as in 1.6.0) and, behind a
   separate consent, for Delta.
5. **The store holds paths, hashes, numbers and enums — never note or page
   text, never the key.** Same boundary as 1.6.0.
6. **Correct invalidation over clever reuse.** Every cached judgment names
   exactly what it depended on; when any of it changes, the judgment is stale.

## 2. The three signals

| Signal | Depends on | Producers | Persisted? |
| --- | --- | --- | --- |
| Worth | the note | `jev` (worth_compiling probability), `local` (heuristics, may be `unknown`) | yes |
| Delta | the note **and** the relevant part of the knowledge base | `local` (provenance + weak signals), `jev-delta` (opt-in, off by default) | yes |
| Relevance | the note **and** the user's focus | `local` only (retrieval overlap with focus terms) | **no** — computed at read |

Relevance is not persisted because its input (focus) changes on the user's
schedule, not the note's; a cached value would mostly be a stale value. It is
cheap to compute locally and memoised in-process per
`(noteHash, focusFingerprint, algorithmVersion)`.

### 2.1 Worth

`value ∈ [0, 1]` or `null` (unknown), plus `confidence`. The Jev producer maps
its probability to confidence using the 1.6.0 bands (> 0.8 or ≤ 0.2 → `high`,
otherwise `medium`). The local producer (introduced only if the evaluation
shows it is useful) starts with structural detectors whose claims are
verifiable — template, generated export, empty or link-only note — and returns
`null` otherwise.

### 2.2 Delta

Delta is a **class**, not a number: `new` | `partial` | `redundant` | `unknown`,
with `confidence ∈ {low, medium, high}` and an evidence list. Evidence is
graded; confidence is capped by the strongest evidence present.

| Evidence kind | Strength | What it establishes |
| --- | --- | --- |
| `cited-near-duplicate` | strong | The note's content is a near-duplicate (shingle similarity ≥ τ) of a note that a compiled page already cites in `sources` |
| `superseded-version` | strong | The note is an older or newer version of a cited note: version-like path relation (dated sibling, explicit `supersedes:` frontmatter) **and** content similarity ≥ τ_low |
| `links-to-page` | relation | The note wikilinks a compiled page (or a compiled page links the note) — the subject relation is verified, the content overlap is not |
| `model-judgment` | medium | Jev Delta's answer for one candidate page (opt-in producer only) |
| `retrieval-similar` | weak | The deterministic engine ranks a compiled page highly for the note's terms |
| `no-candidate` | weak | Retrieval found no compiled page for the note's terms — could be new knowledge, could be a retrieval miss |
| `page-newer` | weak | A related compiled page was modified after the note — does not mean the note was absorbed |

Decision rules for `local-delta@1`:

| Evidence present | Class | Confidence |
| --- | --- | --- |
| `cited-near-duplicate` (similarity ≥ τ_high) or `superseded-version` of a cited note | `redundant` | high |
| `cited-near-duplicate` with τ_low ≤ similarity < τ_high | `partial` | medium |
| `links-to-page` without duplicate evidence | `unknown` (with `target` set) | — |
| `retrieval-similar` only | `partial` | low |
| `no-candidate` only | `new` | low |
| `page-newer` | never changes the class; recorded as context | — |
| nothing usable | `unknown` | — |

Weak evidence alone can never yield more than `low`. `high` requires strong
evidence. Thresholds τ_low / τ_high are set from the offline experiment, not
guessed; until then the producer runs in the evaluation harness only.

Two local capabilities are new in 1.7.0 and are needed by these rules:

- **Link extraction** — wikilinks per page in both transports (fs scanner parses
  `[[…]]`; the live snapshot reads Obsidian's metadata cache), with a parity
  test like the existing one.
- **Near-duplicate detection** — shingles from the existing tokenizer (CJK-aware),
  compared against *cited* notes only, pre-filtered by retrieval neighbourhood
  and directory so the cost stays far below uncooked × cited.

### 2.3 Relevance

`level ∈ {high, medium, low, unknown}` plus `source ∈ {focus, knowledge}`:

- `.knowlery/focus.md` present: retrieval overlap of the note against its terms →
  `high` / `low`; if it is not high, fall through to `KNOWLEDGE.md`.
- "About This Knowledge Base" section of `KNOWLEDGE.md`: overlap → `medium` / `low`.
- Neither usable → `unknown`.

`focus.md` format: free Markdown, user-owned, one topic per bullet recommended.
Matched terms are shown at render time; they are never written to the store.

## 3. Data structures

File: **`.knowlery/compile-signals.json`**, `schemaVersion: 2`. A new path is
deliberate (§6.1).

```ts
type Confidence = 'low' | 'medium' | 'high';

interface SignalStore {
  schemaVersion: 2;
  /** Agent-tier fingerprint at the last write; lets readers skip revalidation when unchanged. */
  kbFingerprint: string;
  notes: Record<string, NoteSignals>; // keyed by vault-relative path
}

interface NoteSignals {
  /** sha256 of normalised note content (frontmatter + body), first 16 hex chars. */
  noteHash: string;
  /** Fast path only: same mtime ⇒ trust noteHash without re-hashing. Whole ms. */
  mtimeMs: number;
  worth?: Record<string, WorthSignal>;  // by producer id: 'jev', 'local'
  delta?: Record<string, DeltaSignal>;  // by producer id: 'local', 'jev-delta'
}

interface SignalMeta {
  producer: string;     // 'jev' | 'local' | 'jev-delta'
  version: string;      // e.g. 'jev-1.13.0/worth@1', 'local-delta@1'
  computedAt: string;   // ISO
}

interface WorthSignal extends SignalMeta {
  value: number | null; // null = unknown
  confidence: Confidence;
}

interface DeltaSignal extends SignalMeta {
  class: 'new' | 'partial' | 'redundant' | 'unknown';
  confidence: Confidence | null; // null when class is unknown
  target: { path: string; title: string } | null;
  evidence: DeltaEvidence[];
  /** What this judgment depended on; see §4. */
  basis: { kbFingerprint: string; candidateSetVersion: string };
}

type DeltaEvidence =
  | { kind: 'cited-near-duplicate'; of: string; citedBy: string[]; similarity: number }
  | { kind: 'superseded-version'; of: string; citedBy: string[]; via: 'path' | 'frontmatter' }
  | { kind: 'links-to-page'; page: string; direction: 'note-to-page' | 'page-to-note' }
  | { kind: 'model-judgment'; page: string; probability: number }
  | { kind: 'retrieval-similar'; page: string; score: number }
  | { kind: 'no-candidate' }
  | { kind: 'page-newer'; page: string };
```

Example entry:

```json
{
  "schemaVersion": 2,
  "kbFingerprint": "9f2c41d07ab3e815",
  "notes": {
    "Projects/svc/2026-03-04 storage decision.md": {
      "noteHash": "a41f09c2be77d013",
      "mtimeMs": 1791619688992,
      "worth": {
        "jev": { "producer": "jev", "version": "jev-1.13.0/worth@1", "computedAt": "2026-11-02T09:12:00Z", "value": 0.91, "confidence": "high" }
      },
      "delta": {
        "local": {
          "producer": "local", "version": "local-delta@1", "computedAt": "2026-11-02T09:12:01Z",
          "class": "partial", "confidence": "medium",
          "target": { "path": "concepts/svc-storage.md", "title": "Service storage" },
          "evidence": [
            { "kind": "cited-near-duplicate", "of": "Daily/2026-03-01.md", "citedBy": ["concepts/svc-storage.md"], "similarity": 0.58 },
            { "kind": "page-newer", "page": "concepts/svc-storage.md" }
          ],
          "basis": { "kbFingerprint": "9f2c41d07ab3e815", "candidateSetVersion": "3be0c9a1f4d27e66" }
        }
      }
    }
  }
}
```

## 4. Cache lifecycle and invalidation

### 4.1 Fingerprints

| Fingerprint | Definition | Computed by |
| --- | --- | --- |
| `noteHash` | sha256 of normalised note content | scanners (both already read content) |
| `kbFingerprint` | sha256 over sorted `(path, contentHash)` of agent-tier pages **plus** the sorted provenance edges (page → cited source) | scanners; carried on the snapshot |
| `candidateSetVersion` | sha256 over sorted `(path, contentHash)` of the pages and cited notes a Delta judgment consulted: retrieval candidates, link neighbours, near-duplicate partners | the Delta producer, per note |
| `focusFingerprint` | sha256 of `focus.md` + the About section of `KNOWLEDGE.md` | at read, for Relevance memoisation |
| producer `version` | algorithm version, plus model id and prompt version for Jev | producers |

### 4.2 Validity rules

| Signal | Valid while | When it goes stale |
| --- | --- | --- |
| Worth | `noteHash` and producer `version` unchanged | note content changes; algorithm/model/prompt version bump |
| Delta | `noteHash`, producer `version`, **and** `candidateSetVersion` unchanged | note changes; a consulted page or cited note changes; **a page enters or leaves the candidate set**; version bump |
| Relevance | not stored | — |

`mtimeMs` is a fast path only: equal mtime ⇒ reuse `noteHash`; different mtime ⇒
re-hash, and if the hash is unchanged (a touch, a sync tool rewriting
timestamps) every signal survives and only `mtimeMs` is updated. This removes
the 1.6.0 behaviour of re-scoring — and paying for — notes whose content did
not change.

### 4.3 Revalidation when the knowledge base changes

Comparing `candidateSetVersion` needs the current candidate set, which is a
local retrieval per note. To keep `stale` fast:

1. If the snapshot's `kbFingerprint` equals the entry's `basis.kbFingerprint`,
   the entry is valid. No work. (The common case between cook sessions.)
2. Otherwise the entry is **pending revalidation**: recompute its candidate set
   locally and compare `candidateSetVersion`.
   - Equal → still valid; update `basis.kbFingerprint`.
   - Different → recompute `local` Delta immediately (local, no cost); mark
     `jev-delta` stale (re-scored only by an explicit Jev run, never on an
     agent's critical path).
3. Revalidation runs under a budget per `stale` call (indicative: 200 notes or
   300 ms on the 4,000-note perf tier, newest first). Entries beyond the budget
   are served with `stale: true`, which readers treat as one confidence step
   lower — shown, not dropped. `knowlery triage` revalidates everything.

This is what catches **new** related pages: a new page that retrieval or links
would surface changes the candidate set, so it invalidates the judgment even
though no previously consulted page changed. A new page that the producer would
not consult cannot change its answer by definition; the remaining blind spot is
retrieval recall itself, which the evaluation measures (`no-candidate`
evidence vs `delta` labels).

### 4.4 Pruning, renames, concurrent writers

- Entries for notes no longer uncooked are pruned on write (as in 1.6.0).
- **Rename tolerance**: before pruning, an orphaned entry whose `noteHash`
  matches an unscored note is moved to the new path.
- **Read–merge–write**: writers re-read the file immediately before writing and
  merge per `(note, signal, producer)`, keeping the newer `computedAt`. 1.6.0 is
  last-writer-wins; with the plugin and a CLI scoring at the same time, one
  side's paid scores are silently lost. Writes go to a temp file first and are moved
  into place with `VaultFs.rename`.
- Entries with an unknown producer, evidence kind, or signal are **preserved
  verbatim** on rewrite, so a 1.7.x shell never deletes what a later 1.7.y wrote.

## 5. Ordering policies and the public interface (1.7.0)

### 5.1 Policies

Registered, versioned, pure functions over `(note, signals, relevance) → sort key`,
with deterministic tie-breaking (mtime desc, then path):

| Policy | Behaviour |
| --- | --- |
| `mtime@1` | Today's behaviour without a key |
| `jev-worth@1` | 1.6.0 behaviour (> 0.2 by worth, unscored by mtime, ≤ 0.2 last) |
| `worth-delta@1` | Evaluation candidate C1 |
| `worth-delta-relevance@1` | C2 |
| `local@1` | C3, the no-Jev product path |

The default stays `jev-worth@1` (with a key) / `mtime@1` (without) until a
candidate passes the pre-registered rules of the evaluation protocol. Switching
the default is a reviewed change, recorded in the CHANGELOG with the report.

### 5.2 Staleness report (additive, 1.7.0)

```ts
interface UncookedNote {
  path: string;
  title: string;
  mtimeMs: number;
  jev?: JevAnnotation;          // unchanged and still populated — frozen once shipped in 1.6.0
  signals?: {                   // added 1.7.0
    worth?: { value: number | null; confidence: Confidence; producer: string };
    delta?: {
      class: 'new' | 'partial' | 'redundant' | 'unknown';
      confidence: Confidence | null;
      target: { path: string; title: string } | null;
      evidence: Array<{ kind: string; page?: string; of?: string }>;
      stale?: true;
    };
    relevance?: { level: 'high' | 'medium' | 'low' | 'unknown'; source: 'focus' | 'knowledge' | null };
  };
}

interface StalenessReport {
  // …existing keys unchanged…
  ordering?: { policy: string };  // added 1.7.0
}
```

Evidence numbers (similarity, scores) stay in the store and the UI; the report
exposes kinds and paths — enough for an agent to open the right files, without
inviting it to over-read decimals.

Text renderers gain one "why" line per note, e.g.

```
- Projects/svc/2026-03-04 storage decision.md
    worth 0.91 (Jev) · delta: partial, medium — near-duplicate of Daily/2026-03-01.md, cited by concepts/svc-storage.md · relevance: high (focus)
```

The MCP `stale` output schema gains the optional keys; the contract golden is
regenerated deliberately and the diff reviewed as additive only.

### 5.3 Cook skill

The skill receives the three signals separately and is told how to use each:
Worth decides reading order, Delta decides *what to look for* (open the target;
for `redundant` confirm and move on; for `unknown` do the retrieval yourself),
Relevance breaks ties. It is still a reading order, never a filter. The skill
text change triggers the cook-eval drift guard; a `compile-value` cook fixture
built from a freeze is the planned way to satisfy it rather than a waiver.

## 6. Migration and compatibility

### 6.1 Why a new file instead of `triage.json` schemaVersion 2

The 1.6.0 parser does not check `schemaVersion`: a v2 document at the same path
fails its entry validation, is read as an empty store, and the next 1.6.0 write
replaces it. Mixed versions are normal (the plugin auto-updates; a global CLI or
`npx` cache may lag), so sharing the path would mean silent data loss and paying
twice. A separate file makes 1.6.0 and 1.7.0 shells invisible to each other's
writes by construction.

### 6.2 Upgrade path

1. **Import**: when `compile-signals.json` is absent and `triage.json` is present,
   1.7.0 imports each v1 entry whose mtime still matches as a `worth.jev` signal
   (`version: 'jev-1.13.0/worth@1'`), hashing the note at import. The v1 target is
   **not** imported as Delta evidence — it was a same-subject judgment, not an
   overlap judgment. It is mirrored back to `triage.json` (step 2) and otherwise
   superseded by the local Delta producer's own `target`.
2. **Mirror during 1.7.x**: 1.7.0 keeps writing a v1 projection (worth + target)
   to `triage.json`, so a lagging 1.6.0 shell still ranks and does not re-score.
   Entries a 1.6.0 shell writes later are re-imported when newer than ours.
3. **Retire**: a later minor stops writing `triage.json`. Allowed under the
   stability contract (it is named there as a rebuildable private cache); called
   out in the CHANGELOG.

### 6.3 Forward compatibility

- `schemaVersion > 2`: read what parses, **never write** (do not clobber a newer
  shell's file); report scores from it read-only.
- Unknown producers / evidence kinds / signals: preserved on rewrite, ignored by
  policies.
- Tolerant parse remains: this is a cache; malformed ⇒ empty, never an error.

### 6.4 Contract classification

New optional file and new optional report keys ⇒ minor (1.7.0). The `jev` field
stays populated through 1.x. `compile-signals.json` is documented as private,
rebuildable state; `.knowlery/focus.md` is documented as an optional,
user-owned file whose meaning is frozen once shipped.

## 7. Jev Delta (opt-in) — boundary

Not built in 1.7.0 unless the evaluation rule for C4 passes; specified here so
the store does not need another migration.

- **Separate consent**, default off, visible only with a key: "Send compiled-page
  summaries to Jev". Stored in the plugin's `data.json` next to the key; Node
  shells read it the same way and also accept a per-run `--allow-page-summaries`.
- **Payload preview before consent**: settings and `knowlery triage
  --preview-payload <note>` render the exact request JSON for a real note without
  sending it.
- **Summary contents**: compiled page title, description, heading outline, and at
  most the first N non-empty lines, capped in characters. Never the full page,
  never pages outside the candidate set.
- The store records only the answer (`model-judgment` evidence); payloads are
  never stored.

## 8. Performance budget

| Path | Budget (4,000-note perf tier) |
| --- | --- |
| `stale`, nothing changed | ≤ 5% over 1.6.0: hashing piggybacks on content the scanners already read; one fingerprint comparison per entry |
| `stale`, after a cook session | revalidation capped (§4.3); rest served `stale: true` |
| Near-duplicate pass | bounded by retrieval-neighbourhood pre-filter; measured in `evals/perf` before shipping |

## 9. Test plan (1.7.0)

- Fingerprint stability across transports (fs scanner and live snapshot agree on
  `noteHash` and `kbFingerprint`), including CRLF/LF and frontmatter key order.
- Invalidation matrix: note edit, touch-only, consulted page edit, new page that
  enters the candidate set, new unrelated page, algorithm version bump, model bump.
- Delta decision table: one case per row of §2.2, including "weak only never
  exceeds low".
- Migration: v1 import, mirror write, re-import of newer v1 entries, a 1.6.0
  writer and a 1.7.0 writer alternating without loss.
- Read–merge–write under interleaved writers; unknown-field preservation;
  `schemaVersion: 3` read-only behaviour.
- Privacy: the store and the report contain no note/page text and no key
  (extends the 1.6.0 assertions); Jev requests never include page summaries
  without consent.
- Policy purity: same inputs ⇒ same order; `jev-worth@1` reproduces 1.6.0 output
  byte-for-byte.

## 10. Open questions for review

1. File name: `compile-signals.json`, or keep the `triage` vocabulary
   (`triage-v2.json`) for continuity in docs and UI?
2. Should a local Worth producer exist at all in 1.7.0, or should "no Jev" mean
   Worth `unknown` and ordering by Delta + Relevance only?
3. Is `links-to-page` without duplicate evidence better expressed as `unknown`
   with a target (current proposal) or as `partial` with `low` confidence?
4. `focus.md`: free Markdown, or a light structure (e.g. one topic per bullet,
   optional `until:` date so stale focus expires)?
5. Mirror period for `triage.json`: the whole 1.7.x line, or one minor?
