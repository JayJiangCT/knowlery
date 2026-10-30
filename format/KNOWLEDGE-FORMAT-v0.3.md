# Knowlery 2.0 — Knowledge Format Specification

**Status:** v0.3 discussion draft · 2026-10-30
**Changes in v0.3** (after independent review of v0.2): block-id anchoring rules fixed; source versions redefined on git blobs with a body-only hash scope; `derived` source kind; Record freeze defined as logical immutability; `updated_by` demoted to provenance; link rules split for pages vs. Sources; statements reclassified as Constraint / Decision / Hypothesis / Conformance; experiment gains a 1.x control group and three new metrics; evidence script and snapshot added under `format/evidence/`.
**Refines:** the Architecture Baseline ([docs/2.0/ARCHITECTURE.md](../docs/2.0/ARCHITECTURE.md), Layer L1). Supersedes [KNOWLEDGE-FORMAT-v0.2.md](./KNOWLEDGE-FORMAT-v0.2.md) (reviewed 2026-10-30; review findings incorporated) and the field-level proposals of [KNOWLEDGE-FORMAT-v0.md](./KNOWLEDGE-FORMAT-v0.md).
**How to read:** Section 15 classifies each statement as **Constraint** (imposed by an upstream decision or a platform; not up for experiment), **Decision** (chosen under the constraints; revisited only if a constraint changes), **Hypothesis** (settled by the Section 16 experiment), or **Conformance** (a decided design whose correct behavior still has to be tested). Field names are final only after the Level 0 experiment.

---

## 1. What the evidence from 1.x says

The Pilot vault (194 compiled pages, ~220 raw notes; `JayJiangCT/Knowlery-Pilot` at commit `cf9e378`) was analyzed before writing this document. The script and its output are in `format/evidence/pilot-stats.py` and `format/evidence/pilot-stats-cf9e378.txt`; classification rules are in the script. Four findings drive the design:

| Finding | Evidence | Consequence for 2.0 |
|---|---|---|
| Trust is expressed by three overlapping page-level fields, none complete | `status` 192/194, `freshness_status` 97/194, `retrieval_priority` 91/194; `supersedes` 0, `contradictions` 4, `freshness_sidecar` defined but used 0 times | One status axis; status at claim level, not only page level |
| Sources carry no version | 1,449 `sources` entries: 1,050 paths, 161 URLs, 225 free text, 13 wikilinks; 0 with a hash or date | Every source reference carries a version; free-text sources become typed attestations |
| Query pages are the primary landing place of new knowledge, not a cache | 95/131 query files are dated snapshots; 71 cite other queries; 17 concept/entity pages cite queries as sources | Queries become immutable **Records**; the dependency chain is straightened: Source → Record → Knowledge |
| Pages have no structural contract | Only `## Related` (101) and `## Short Answer` (38) recur; 48 pages carry appended `## Cook Refresh (date)` sections; median body 109 lines, max 593 | Fixed section order; `## Current` first; history in its own section; section-level writes become deterministic |

Secondary findings: three wikilink forms for the same target (`[[zipline]]`, `[[entities/zipline|Zipline]]`, `[[concepts/x.md]]`); 134 unique dangling link targets across all Pilot Markdown (this count includes targets the Pilot deliberately excluded when sanitizing and targets missing from the source vault itself; the Pilot's own `pilot/AUDIT.md` separates them as 79 and 171 on a per-link basis); conventions split across `SCHEMA.md`, `KNOWLEDGE.md`, `AGENTS.md`, and a skill, and they disagree on legal `status` values; `domain` carries no information (185 of 194 are `delivery`).

## 2. Design goals

1. An Agent with only file tools can discover the structure, answer a question, absorb new information, and detect a conflict (baseline Level 0).
2. "What is currently true" is readable without reading history, and history is never deleted.
3. Every claim can be traced to a versioned source.
4. The part of a page an update touches is addressable deterministically.
5. Nothing in the Format depends on Obsidian or a Knowlery runtime; the Format renders well in Obsidian.
6. Every structure is expressed in Obsidian-native Markdown (properties, wikilinks, block ids, tags, callouts). With Obsidian running, the Obsidian CLI operates on these structures directly; headless, they degrade to text conventions. The Format itself never knows which mode it is in.
7. Pages are organized for progressive disclosure: each layer gives an Agent exactly what it needs to decide whether to read the next one (Section 7.0).
8. Google's OKF v0.2 is a reference, not a target. Where a field has the same meaning, the same name is used; where Knowlery needs more (claim status, versions, supersession) or Obsidian needs flatter data, Knowlery's own rule wins. An OKF export is a Connector feature.

## 3. Vocabulary

| Term | Definition |
|---|---|
| **Source** | Raw material. Owned by its author. Notes, documents, conversations, external pages. |
| **Record** | A dated, frozen account of a finding, decision, readout, or report. Written once; later only pointed forward. |
| **Knowledge page** | An evolving page holding the current understanding of one subject: `concept`, `entity`, or `comparison`. |
| **Claim** | One addressable statement inside a Knowledge page, with its own status and sources. |
| **Attestation** | A source that is a person's statement rather than a document ("Rob confirmed on Slack, 2026-07-28"). |
| **Actor** | Who did something: `human:<id>`, `<agent>/<model>`, or `process:<id>` (OKF convention). |

The dependency rule: **Knowledge pages cite Records and Sources as evidence. Records cite Sources and other Records.** A Knowledge page may cite a claim on another Knowledge page with source kind `derived` (Section 8); that is a legitimate reference, but the autonomy policy counts it as zero independent evidence, because a synthesis is not a new observation. `related` and plain wikilinks express relationships, not evidence.

## 4. Layout

```
<vault>/
  CONVENTIONS.md          # the Agent-readable contract (Section 13); the only convention file
  log.md                  # vault-level operation log, newest first (OKF reserved name)
  index.md                # optional, generated; never a source of truth
  concepts/               # Knowledge pages, type: concept
  entities/               # Knowledge pages, type: entity
  comparisons/            # Knowledge pages, type: comparison
  records/                # Records, type: record   (1.x: queries/)
  <anything else>/        # Sources, user-owned, user-named
  .knowlery/              # derived data: indexes, caches, backups. Rebuildable. Git-ignored except config.
```

Directory names are the only place where page role is encoded twice (directory and `type`); the `type` field governs, the directory is for humans and for Obsidian.

## 5. Common frontmatter

Every Knowledge page and Record has YAML frontmatter. Sources have no required frontmatter.

**Hard constraint: frontmatter is flat.** Only scalars (text, number, date, datetime, checkbox) and flat lists of scalars. No nested maps, no lists of maps. This is what Obsidian Properties and Bases can read, filter, and edit, and it is the lesson 1.x already recorded in `SCHEMA.md` for the freshness fields. Anything that needs structure (the source table, verification history) lives in the body.

Frontmatter is tier 2 of progressive disclosure (Section 7.0): it holds what an Agent needs to decide *how to treat* a page, not the page's evidence.

| Field | Req. | Obsidian type | Meaning |
|---|---|---|---|
| `type` | ✔ | text | `concept` \| `entity` \| `comparison` \| `record` |
| `title` | ✔ | text | Display name |
| `description` | ✔ | text, one sentence | What question this page answers, as of when, and what it does not cover. Written to the standard of an Agent Skill description: an Agent reads it to decide whether to open the page |
| `tags` | ✔ | list | 2–5, sorted. Taxonomy in `CONVENTIONS.md` |
| `status` | ✔ | text | Section 9 |
| `updated` | ✔ | date | Last meaningful content change (1.x name kept) |
| `updated_by` | ✔ | text | Actor: `human:<id>`, `<agent>/<model>`, `process:<id>` |
| `verified` | – | date | Most recent verification. Earlier verifications are lines in `## History` |
| `verified_by` | – | text | Actor of the most recent verification. `human:` marks human review |
| `stale_after` | – | date | After this date treat the page as stale regardless of status |
| `aliases` | – | list | Other names; display and search only, never link targets |
| `related` | – | list of wikilinks | Relationships that are not evidence |
| `supersedes` / `superseded_by` | – | list of wikilinks | Replacement chain (Section 9) |
| `protected` | – | list of text, or checkbox `true` | Claim ids (`^c4`) a human has decided, or whole page (Section 10) |

Wikilinks in list properties are links in Obsidian's graph and backlinks, so `related` and `superseded_by` are navigable both ways with Obsidian running and are plain strings without it.

Removed from 1.x and why: `freshness_status`, `retrieval_priority`, `freshness_reviewed` (folded into `status`, `verified`, `stale_after`); `date` and `created` (Records carry `date`); `domain` (no information); `references` (→ `related`); `contradictions` (→ claim status `disputed` + `## Open`); `freshness_sidecar` (derived data); `sources` (moved to the body `## Sources` section, Section 8, because it needs structure and is tier-4 detail).

Unknown keys are preserved by every consumer and never cause rejection. This is what lets 1.x pages migrate gradually.

## 6. Role-specific frontmatter

**Knowledge page** (`concept`, `entity`, `comparison`): common fields only. `entity` may add free attribute keys (`email`, `role`, `table_id`); they are data, not Format.

**Record** (`type: record`):

| Field | Req. | Meaning |
|---|---|---|
| `date` | ✔ | The date the Record describes. Part of the filename: `<slug>-YYYY-MM-DD.md` |
| `kind` | ✔ | `finding` \| `decision` \| `readout` \| `report` |
| `frozen` | – | Defaults to `true` once `status` leaves `draft`. Logical immutability: the published body is never rewritten without trace (Section 7.2). Frontmatter may change. |
| `followed_by` | – | list of Record slugs that continue or revise this one |

**Source**: no required frontmatter. Optional `kind: observation | decision | external`. A Source created through an Agent in a user-initiated session is authored by the user; no Agent marker is recorded. Autonomous workflows (compile, update, govern) never write under Source directories.

## 7. Body contract

### 7.0 Progressive disclosure

A page is read in tiers. Each tier must let an Agent decide whether the next one is worth reading. This is the same discipline as Agent Skills (metadata → body → bundled resources), applied to knowledge.

| Tier | What | Read when |
|---|---|---|
| 1 | `title` + `description` (from an index or a directory listing) | Deciding whether to open the page |
| 2 | Frontmatter | Deciding how to treat the page: status, freshness, protection |
| 3 | `## Current` | Answering the question |
| 4 | `## Evidence`, `## Sources`, `## History`, `## Open` | Evidence is needed, or an update is being made |
| 5 | Records and Sources | The Knowledge page is insufficient |

A Query workflow stops at tier 3 by default. An Evolve workflow starts at tier 4.

### 7.1 Knowledge page

Sections appear in this order. Empty sections are omitted, but order never changes. Every structure below is Obsidian-native: list items, block ids (`^id`), tags, wikilinks.

```markdown
# <Title>

## Current
One short paragraph of context (optional), then claims:
- <claim text> (src: s1, s3) ^c1
- <claim text> (src: s2) ^c2

## Evidence
Optional prose, tables, or data that support the claims above. May be long.

## Open
- <unresolved question> about [[#^c6]] (src: s4) ^q1

## Sources
- s1 · [[Wonder/…/Create Quote]] · git:<40 hex> · source
- s2 · https://wonder.atlassian.net/… · fetched:2026-07-16 · source · no-snapshot
- s3 · [[zipline-mvp-partner-confirmed-contract-2026-07-30]] · git:<40 hex> · record
- s4 · human:rob-knudson · stated:2026-07-28 · attestation · Confirmed package never returns after Dropbox lock
- s5 · [[dropbox-loading#^c2]] · git:<40 hex> · derived

## History
- <original claim text> · superseded 2026-09-03 by [[#^c5]] · <reason> · src: s7 · by <actor> ^c2
- 2026-08-01 · verified by human:jay
- 2026-07-08 · [[#^c1]] added · src: s1 · by <actor>

## Related
- [[slug]] — one-line why
```

Rules:
- `## Current` holds only claims whose status is current. It is the only section a Query workflow must read.
- A claim is one list item ending in an Obsidian block id `^cN`. Obsidian recognizes a block id only at the **end** of a line, so the id is always the last token. Each id appears exactly once on the page as an anchor; everywhere else the claim is referred to by link, `[[#^c3]]` within the page or `[[page#^c3]]` from another page.
- `## Open` items are questions, not claims; they carry their own `^qN` ids and refer to claims by link.
- Events in `## History` (added, verified, protected) carry no id; they refer to claims by link.
- `(src: …)` lists ids from `## Sources` that support the claim. Every claim has at least one.
- A claim that is replaced is **moved** from `## Current` to `## History` as one line: original text, then the supersession note, then its original id still at the end of the line. The anchor moves with the text, so existing `[[page#^c2]]` links keep resolving. A new claim with a new id takes its place in `## Current`. Nothing is deleted.
- A claim under challenge stays in `## Current` with `#disputed` appended until resolved, so a reader sees the dispute next to the claim.
- `## Sources` and `## History` are append-only. `## History` is newest first, one line per transition or verification.

### 7.2 Record

```markdown
# <Title> (YYYY-MM-DD)

## Summary
Three to five sentences: what was found or decided.

## Detail
Free structure.

## Related
```

A Record's body is frozen in the logical sense: once the Record leaves `draft`, its body is never rewritten without a trace. Files remain editable by their owner; the Format defines what the edit means.

| Situation | Behavior |
|---|---|
| Record still `draft` | Edit freely |
| Published; new facts arrive | Create a new Record; set `followed_by` on the old one. The old body does not change |
| Owner edits a published Record's body directly | The body version changes. The Connector (or, at Level 0, the Agent on next read) records a `revised` line in the Record's `## History`, keeps the previous version reachable through git, and treats the citing pages as needing review |
| Owner corrects a factual error in a published Record | Same as above; the `## History` line says `correction` and why |
| Previous version not recoverable (vault not in git) | The `## History` line says so; citing pages see an `unverified` version |

Later developments are expressed by `followed_by` and, where a whole Record is replaced, `superseded_by`. Both are frontmatter and do not change the body version (Section 8).

### 7.3 Section size guidance

Claim granularity is defined by function, not count: a claim is the smallest statement that can be independently verified, cited, superseded, or updated, with its subject, conclusion, and conditions of applicability in one item. Two conclusions that could change independently are two claims. Working assumptions for the experiment, not rules: 5–10 claims per page, `## Current` under ~40 lines. A page that needs 18 claims to be accurate is not split for being long; a page with 3 is not padded.

## 8. Sources and versions

Sources are listed in the body section `## Sources`, one line per source, five fields separated by ` · `:

```
- <id> · <resource> · <version> · <kind> [· <title or note>]
```

| Field | Meaning |
|---|---|
| `id` | Short stable key (`s1`, `s2`, …) used by `(src: …)` on claims. Never reused within a page |
| `resource` | A wikilink for anything in the vault (so Obsidian backlinks and `obsidian backlinks` find every page citing a source), a URL for external pages, or an actor (`human:<id>`) for attestations |
| `version` | Vault files: the git blob hash of the file's **body** (everything after the frontmatter), `git:<40 hex>`; display may truncate, the stored value never does. URLs: `fetched:<date>`, which is an observation time, not a content version. Attestations: `stated:<date>`. A value of `unverified` means the citing page could not establish what version it relied on |
| `kind` | `source` \| `record` \| `attestation` \| `derived` (a claim on another Knowledge page; resource is `[[page#^cN]]`) |
| note | Optional; required for attestations (what was said) and for URLs without a stored snapshot (`no-snapshot`) |

Two guarantees, kept apart:

| Guarantee | What it means | Provided when |
|---|---|---|
| **Change detection** | "Is the source still what this page cited?" | Always: compare the current body hash with `version` |
| **Historical recoverability** | "Show me what this page actually read" | Only when the cited version is in git history (vault files that were committed) or stored as a Record (a snapshot of an external page). `fetched:` and `unverified` versions give no recoverability and must not be presented as if they did |

Why the body and not the whole file: frontmatter changes (`followed_by`, `verified`, a tag) must not look like evidence changes. Why git blobs and not a free hash: the same hash is the key `git cat-file` needs to return the exact text, so recoverability costs nothing extra in a git-tracked vault.

How the Evolve flow uses it: compute the body hash of a changed Source; with Obsidian running, `backlinks` lists every citing page in one call; headless, grep the path. Pages whose `version` differs are candidates for review. In-place edits of Sources are therefore safe: older Records keep pointing at older blobs.

Why the body and not frontmatter: a source entry has five fields, which would force nested YAML; and sources are tier-4 detail (Section 7.0), read only when evidence or an update is in play.

## 9. Status model

### 9.1 Page status

| Value | Meaning | OKF mapping (reference) |
|---|---|---|
| `draft` | Compiled but not yet trusted for answers | `draft` |
| `current` | Normal state | `stable` |
| `disputed` | At least one claim in `## Current` carries `#disputed` | `stable` + `x-knowlery-disputed: true` |
| `superseded` | Replaced as a whole; `superseded_by` is set | `deprecated` |
| `archived` | Kept for history, no replacement | `deprecated` |

A page's status is derivable from its claims and links; the Connector recomputes it on write. At Level 0 the Agent sets it by convention.

### 9.2 Claim status

A claim has exactly one of three states, encoded by position and marker rather than by a field, so it survives any Markdown tool:

| State | Where | Marker |
|---|---|---|
| current | `## Current` | none |
| disputed | `## Current` | `#disputed` |
| superseded | `## History` | line names the successor |

### 9.3 Supersession

- Claim level: the moved claim's own `## History` line names the successor, `superseded … by [[#^c5]]`; cross-page, `by [[other-slug#^c3]]`. The old claim keeps its anchor, so the chain is navigable in both directions.
- Page level: `superseded_by: [slug]` on the old page, `supersedes: [slug]` on the new. Both directions are written so Level 0 readers do not need a backlink index.
- Record level: `followed_by`.

## 10. Governance markers

- `protected: ["^c4"]` lists claims a human has decided. `protected: true` protects the whole page.
- The Connector refuses any write that alters a protected claim's text or moves it out of `## Current`. It may still append to `## History` and `## Open`.
- A human changes their mind by editing the claim directly or by asking an Agent in a user-initiated session, which writes with user authority. A direct edit is detected by the Connector's pre-write body-hash comparison, not by any frontmatter value. `updated_by` and `verified_by` are provenance: they record who the writer says acted, and an Agent can write `human:` into them, so they are never treated as proof of authorization. At Level 0 nothing enforces `protected`; the conventions page says so.
- `verified` with a `human:` actor is a trust signal, not protection. Approval and protection are different fields on purpose: a human can verify a claim without locking it.
- The autonomy threshold (evidence × impact × reversibility) is a policy page under `CONVENTIONS.md`, not a frontmatter field; see baseline Section 4.

## 11. Logs

Two logs, different purposes:

| Log | Where | Content |
|---|---|---|
| Page history | `## History` of each Knowledge page | Claim transitions. Part of the knowledge. |
| Operation log | `log.md` at vault root | One line per write operation: date, actor, page, what. Newest first under `YYYY-MM-DD` headings (OKF reserved file). Operational, may be truncated. |

The 1.x `.knowlery/activity/*.jsonl` ledger is derived data and outside the Format.

## 12. Identity and links

- A page's identity is its slug: lowercase, hyphens, unique across the vault. The filename is the slug.
- Links to Knowledge pages and Records are wikilinks by slug only: `[[zipline]]`, `[[zipline|Zipline]]`, `[[zipline#^c3]]`. Never by path, never by title. Links to Sources are by vault path (`[[Wonder/…/Create Quote]]`), because Sources are user-named, may share basenames, and are never renamed by the Format.
- Frontmatter references (`related`, `supersedes`, `superseded_by`, `followed_by`) are quoted wikilinks by slug (`"[[zipline]]"`), which Obsidian treats as real links in list properties; without Obsidian they are strings with a trivially extractable slug.
- A dangling link is tolerated and reported by validation, never auto-created.
- Only Obsidian-native syntax is used anywhere in the Format: properties, wikilinks, block ids, tags, callouts, embeds. No custom markers that Obsidian does not render. With Obsidian running, `read`, `backlinks`, `property:read`, `rename`, and `links` act directly on Format structures; headless, the same structures are text conventions read with file tools. The Connector's Obsidian and Headless Adapters differ; the Format does not.

## 13. The conventions page (`CONVENTIONS.md`)

The single file an unfamiliar Agent reads first. It contains, in order:

1. The one-paragraph purpose of the vault and the dependency rule (Section 3).
2. The layout (Section 4) and page roles.
3. The frontmatter tables (Sections 5–6) and the body contract (Section 7), in full.
4. How to read: the tiers of Section 7.0. How to answer: tier 1 → tier 3; go to tier 4 only when evidence is asked for.
4a. How to write a `description`: one sentence saying what question the page answers, as of what date, and what it leaves out — the same bar as an Agent Skill description.
5. How to update: find pages whose `## Sources` version no longer matches (backlinks with Obsidian, grep without); revise claims by the move-to-History rule; never edit `## History`; never touch `protected`; write a `log.md` line.
6. When to stop and ask a human: the autonomy policy.
7. What is lost without a Connector: atomic writes, hash-based conflict detection, enforcement of `protected`. These become conventions.
8. Tag taxonomy.

`SCHEMA.md`, `KNOWLEDGE.md`, and the `vault-conventions` skill are retired; `AGENTS.md` / `CLAUDE.md` import `CONVENTIONS.md` instead of restating it.

## 14. Derived data

Indexes, search caches, backlink maps, OKF exports, and freshness sidecars live under `.knowlery/` and are rebuildable from the pages. No workflow may treat them as truth; no page may reference them.

## 15. Classification of statements

Mapping to the baseline's vocabulary: Constraint ≈ Approved; Decision and Hypothesis ≈ Proposal; Conformance is new and was previously hidden inside Proposal.

**Constraints** (not up for experiment)
- Format-first; Markdown + minimal metadata; no database; relationships as wikilinks. (brief)
- Level 0 must work; the conventions page is part of the Format. (baseline)
- History is never deleted; human decisions are protected. (brief)
- Sources are author-owned; autonomous workflows never write there; user-initiated sessions may. (decided 2026-10-30)
- Frontmatter is flat. (Obsidian Properties / Bases)
- Only Obsidian-native syntax. (Obsidian as first-class environment)

**Decisions** (chosen under the constraints; revisited only if a constraint changes)
- Record as a logically immutable page role replacing `query`.
- `## Sources` in the body; versions on git body blobs; `derived` source kind.
- Claim-level status by position and block id; anchor rules of Section 7.1.
- One `status` axis; removal of `freshness_status`, `retrieval_priority`, `domain`.
- Progressive-disclosure tiers; `## Current` first.
- OKF as reference only.
- Links to pages by slug, to Sources by path.

**Hypotheses** (settled by Section 16)
1. Claim granularity: 5–10 claims per page and a ~40-line `## Current` are the right working size.
2. The Format's overhead (reading `CONVENTIONS.md` and metadata) is small relative to the content an answer needs.
3. Attestations should weigh less than documents in the autonomy policy's "evidence quality".
4. `comparison` is a Knowledge role rather than a Record kind (only 3 exist).

**Conformance** (decided; correct behavior still to be tested)
- Agents parse, cite, and update `## Sources` without reusing or overwriting ids.
- Dangling `(src:)` references and evidence/claim mismatches are detectable.
- Change detection works and non-recoverable versions are reported as such, never silently.
- Wikilinks resolve identically with Obsidian and headless.
- Block-id anchors survive the move from `## Current` to `## History`.

**Open questions** (need a decision, not an experiment)
1. Entity attribute keys: leave free or list the allowed ones in `CONVENTIONS.md`?
2. `queries/` → `records/` rename: 3,109 resolved links in the Pilot need a rewrite pass. Alternative: keep the directory, change only `type`.

## 16. Experiment (Level 0, before any tool is built)

Scope: 10–15 pages from the 1P Drone Delivery thread, chosen because they contain superseded pages, a `contradictions` entry, attestations, and the 252 mm vs 254 mm claim conflict.

Design: a controlled comparison, not a demonstration. Two arms on the same material, questions, model, and token budget, repeated where variance allows: **control** = the pages in their 1.x form with the 1.x `AGENTS.md`; **test** = the same pages migrated to this Format with `CONVENTIONS.md`. Migration is checked by hand for semantic equivalence first, so an improvement cannot come from having added correct answers during migration.

Tasks (each run in both arms):

| Task | What it tests |
|---|---|
| Current-knowledge Q&A (G1 questions from the Pilot set) | Tier 1–3 reading |
| Identify which conclusion is historical | Claim status |
| Locate the evidence for a given claim | `## Sources`, `(src:)` |
| New source version → targeted update | Change detection, move-to-History |
| Two conflicting sources | `#disputed` rather than silent resolution |
| Owner edited a published Record | Logical immutability, `revised` line |
| Cited version not recoverable | Honest `unverified` reporting |

Metrics, beyond pass rate:

| Metric | Definition |
|---|---|
| Unnecessary Rewrite Rate | Share of changed content that the new input did not justify changing |
| Unsupported Current Claim Rate | Share of claims in `## Current` after the run without adequate `(src:)` support |
| Protocol overhead ratio | Tokens spent on `CONVENTIONS.md` and metadata ÷ total tokens read for the answer |
| Tokens per correct answer | As in the brief |

Granularity sub-experiment: the test arm is prepared at three claim granularities (coarse, working, fine) for 3–4 pages; the update and conflict tasks are run on each.

Out of scope for Level 0: atomic writes, concurrent-edit protection, enforcement of `protected`. These need the Connector and their own tests; a Level 0 pass says nothing about them.

Output: a decision record under `design/decisions/` resolving the Hypotheses and recording Conformance results.

## 17. Migration from 1.x (field map)

| 1.x | 2.0 |
|---|---|
| `type: query` | `type: record`, `kind` inferred (`report`/`readout` by filename, else `finding`) |
| `status: active/reviewed` | `status: current` |
| `status: draft` | `status: draft` |
| `status: archived`, `freshness_status: superseded` | `status: superseded` or `archived` |
| `freshness_status: partially_stale/watch` | `stale_after` set; page stays `current` |
| `retrieval_priority` | dropped |
| `freshness_reviewed: D` | `verified: D`, `verified_by: process:cook` |
| `updated: D` | `updated: D`, `updated_by: process:migration` |
| `date`, `created` | Records keep `date`; Knowledge pages drop both |
| `domain` | dropped |
| `references` | `related` |
| `contradictions` | claim marked `#disputed`, question in `## Open` |
| `sources: [path]` | `## Sources` line `sN · [[path]] · git:<blob of that file's body at the last commit on or before the page's `updated` date> · source`. Never the current hash: that would present today's content as what the page relied on. If the vault has no git history for the file, `unverified`. Frontmatter key dropped |
| `sources: [free text]` | `## Sources` line `sN · human:<id> · stated:<date> · attestation · <text>` |
| `sources: [url]` | `## Sources` line `sN · <url> · fetched:<page updated date> · source · no-snapshot` |
| `## Cook Refresh (D)` | lines in `## History` |
| body with no `## Current` | `## Current` created from `description` + first paragraph; everything else to `## Evidence`; requires human or Agent pass for claims |

Everything in this table except the last row is scriptable.

## Appendix A — Example Knowledge page

```markdown
---
type: entity
title: Zipline
description: Current Zipline API, package-limit and custody rules for Wonder 1P drone delivery as of 2026-10-19; does not cover commercial terms.
tags: [api, delivery-service, drone-delivery]
status: current
updated: 2026-10-19
updated_by: claude-code/claude-fable-5-1
verified: 2026-09-03
verified_by: human:jay
aliases: [Zipline Inc]
related: ["[[1p-drone-delivery]]", "[[dropbox-loading]]"]
protected: ["^c4"]
---

# Zipline

## Current
Zipline is the drone operator for Wonder's 1P drone delivery pilot.
- A single Zip carries one Wonder order within the approved package limits; width limit is 254 mm (src: s2) ^c5
- `mass_grams` is required on direct-order Quotes (src: s2) ^c3
- After Dropbox lock the package is delivered or disposed; it never returns to Wonder (src: s3) ^c4
- `DELIVERY_INTENT_STATUS_IN_PROGRESS` is the custody signal (src: s2) #disputed ^c6

## Open
- Is `IN_PROGRESS` authoritative for custody ([[#^c6]]) or only in-transit telemetry? (src: s2) ^q1

## Sources
- s1 · [[Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Zipline API Doc/Create Quote]] · git:9f3a1c0e5b2d7a4f8c1e6b3d9a2f5c8e1b4d7a0c · source
- s2 · [[zipline-mvp-partner-confirmed-contract-2026-07-30]] · git:71be02d4a9c3e6f1b8d5a2c7e0f3b6d9a1c4e7f2 · record
- s3 · human:rob-knudson · stated:2026-07-28 · attestation · Package never returns after Dropbox lock (Slack)

## History
- A single Zip carries one Wonder order within the approved package limits; width limit is 252 mm (src: s1) · superseded 2026-09-03 by [[#^c5]] · partner QA corrected 252 mm to 254 mm · src: s2 · by claude-code/claude-fable-5-1 ^c2
- 2026-09-03 · verified by human:jay
- 2026-07-30 · [[#^c3]] added · src: s2 · by claude-code/claude-fable-5-1
- 2026-07-28 · [[#^c4]] added, protected by human:jay · src: s3
- 2026-07-26 · [[#^c2]] added · src: s1

## Related
- [[1p-drone-delivery]] — the program this entity serves
- [[dropbox-loading]] — loading mode that triggers custody transfer
```
