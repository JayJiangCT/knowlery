# Knowlery 2.0 — Knowledge Format Specification

**Status:** v1.0-rc (release candidate) · 2026-11-02 — Format Decisions fixed; two Hypotheses closed by the Level 0 experiment, one left as guidance; Conformance items verified at Level 0 except those that need a Connector.
**Changes in v1.0-rc** (from v0.3.1, after the Level 0 experiment, `format/experiments/level0/RESULTS.md`): §7.0 reading rule adds a source-check before a claim is given as an answer (F1); §9.2 adds propagation of `#disputed`/supersession to `derived` citers (F3); §7.2/§8 Record evidence scope ends at `## Sources` (found while pinning); §8 adds governance signals on Source frontmatter (F3/T12); §15 reclassified with experiment outcomes; §18 added.
**History — v0.3.1** (after independent re-review of v0.3, commit `d5215d6`): source versions split into a change-detection digest and a recoverability reference (a git body blob is not a stored object, so v0.3's recovery claim was wrong); evidence scope defined per page role so Record history lines and unrelated claims do not look like evidence changes; claim fingerprints for `derived` references; §15 classification separated from approval status; migration versions marked as candidates; three failure tests added to §16; every §1 figure now printed by the evidence script.
**Changes in v0.3** (after independent review of v0.2): block-id anchoring rules fixed; source versions redefined on git blobs with a body-only hash scope; `derived` source kind; Record freeze defined as logical immutability; `updated_by` demoted to provenance; link rules split for pages vs. Sources; statements reclassified as Constraint / Decision / Hypothesis / Conformance; experiment gains a 1.x control group and three new metrics; evidence script and snapshot added under `format/evidence/`.
**Refines:** the Architecture Baseline ([docs/2.0/ARCHITECTURE.md](../docs/2.0/ARCHITECTURE.md), Layer L1). Supersedes [KNOWLEDGE-FORMAT-v0.3.md](./KNOWLEDGE-FORMAT-v0.3.md) (v0.3.1, the experiment version), [KNOWLEDGE-FORMAT-v0.2.md](./KNOWLEDGE-FORMAT-v0.2.md) and the field-level proposals of [KNOWLEDGE-FORMAT-v0.md](./KNOWLEDGE-FORMAT-v0.md). A mirror of this file is kept as `design/knowledge-format.md` in the Knowlery 2.0 Claude Project workspace; the repository copy governs.
**How to read:** Section 15 classifies each statement as **Constraint** (imposed by an upstream decision or a platform; not up for experiment), **Decision** (chosen under the constraints; revisited only if a constraint changes), **Hypothesis** (settled by the Section 16 experiment), or **Conformance** (a decided design whose correct behavior still has to be tested). Field names are final as of v1.0-rc; a change now needs a new Hypothesis and experiment, not a review comment.

---

## 1. What the evidence from 1.x says

The Pilot vault (194 compiled pages, ~220 raw notes; `JayJiangCT/Knowlery-Pilot` at commit `cf9e378`) was analyzed before writing this document. The script and its output are in `format/evidence/pilot-stats.py` and `format/evidence/pilot-stats-cf9e378.txt`; every figure below is printed under the script's `SECTION 1 FIGURES` heading, and classification rules are in the script. Four findings drive the design:

| Finding | Evidence | Consequence for 2.0 |
|---|---|---|
| Trust is expressed by three overlapping page-level fields, none complete | `status` 192/194, `freshness_status` 97/194, `retrieval_priority` 91/194; `supersedes` 0, `contradictions` 4, `freshness_sidecar` defined but used 0 times | One status axis; status at claim level, not only page level |
| Sources carry no version | 1,449 `sources` entries: 1,002 vault paths, 161 URLs, 273 free text, 13 wikilinks. No vault path or URL entry carries a version; the only version pins are 10 free-text entries naming an external code commit | Every source reference carries a version; free-text sources become typed attestations |
| Query pages are the primary landing place of new knowledge, not a cache | 95/131 query files are dated snapshots; 77 cite other queries in `sources`; 20 concept/entity pages cite queries in `sources` | Queries become immutable **Records**; the dependency chain is straightened: Source → Record → Knowledge |
| Pages have no structural contract | Only `## Related` (156) and `## Short Answer` (39) recur across the four directories; 48 pages carry appended `## Cook Refresh (date)` sections; body after frontmatter: median 109 lines, max 563 | Fixed section order; `## Current` first; history in its own section; section-level writes become deterministic |

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

The dependency rule: **Knowledge pages cite Records and Sources as evidence. Records cite Sources and other Records.** A Knowledge page may cite a claim on another Knowledge page with source kind `derived` (Section 8). Two guarantees come with it: (1) a `derived` reference is a reasoning dependency, never a new independent observation; when evidence strength matters, the policy follows the chain down to Sources and Records and de-duplicates them; (2) the reference pins the specific claim's fingerprint, so a change to that claim, and only that claim, marks the dependent claim for review. `related` and plain wikilinks express relationships, not evidence.

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

A Query workflow stops at tier 3 by default, with one exception that the Level 0 experiment made necessary (RESULTS F1: two of three Test runs repeated a compiled claim that its own cited Source contradicts): **before a claim is given as an answer, the Agent reads that claim's first vault-file Source unless the page's `## History` carries a `source-checked` event for that claim at the Source version listed in `## Sources` *and* the Source's current digest still equals that version.** The digest comparison is a shell step (`tools/digest.py`, or `sed`+`sha256sum`), not a read into context, so the saving the rule exists for is kept; a History event alone proves a past read, not the Source's state now (review finding 2026-11-02, regression task T13). The compile workflow writes that event (`- <date> · [[#^cN]] source-checked · s<k>@<version> · by <actor>`) when it has verified the claim against the Source, so routine queries stay at tier 3 and the check is paid once per claim per source version, not once per question. An Evolve workflow starts at tier 4.

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
- s1 · [[Wonder/…/Create Quote]] · sha256:<digest> · source · blob:<40 hex>
- s2 · https://wonder.atlassian.net/… · fetched:2026-07-16 · source · no-snapshot
- s3 · [[zipline-mvp-partner-confirmed-contract-2026-07-30]] · sha256:<digest> · record · blob:<40 hex>
- s4 · human:rob-knudson · stated:2026-07-28 · attestation · Confirmed package never returns after Dropbox lock
- s5 · [[dropbox-loading#^c2]] · sha256:<claim fingerprint> · derived

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

## Sources
(as in 7.1)

## History
- 2026-09-10 · revised by human:jay · <why> (only if the frozen part was ever changed)

## Related
```

The **evidence scope** of a Record is everything from the end of the frontmatter up to the first of `## Sources`, `## History` or `## Related`, i.e. Summary and Detail. Only that part is versioned (Section 8); appending a Sources or History line or editing Related never changes the Record's version. (v0.3.1 ended the scope at History; that made a Record's digest depend on the versions written in its own `## Sources`, so pinning a Record changed the Record. Found while building the Level 0 kit, 2026-10-30.)

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
| `version` | Change-detection digest: `sha256:<hex>` over the resource's **evidence scope** (table below), computed by the citing Agent at citation time and recomputable anywhere with no git. URLs: `fetched:<date>`, an observation time, not a content version. Attestations: `stated:<date>`. `unverified` means the citing page could not establish what it relied on |
| `kind` | `source` \| `record` \| `attestation` \| `derived` (a claim on another Knowledge page; resource is `[[page#^cN]]`) |
| `blob:<40 hex>` | Optional recoverability reference: the git blob of the **whole file** as committed, i.e. an object that actually exists in the repository and that `git cat-file -p` returns. Present only when the cited version was committed. A digest alone recovers nothing |
| note | Optional; required for attestations (what was said), for URLs without a stored snapshot (`no-snapshot`), and for migrated entries (`candidate`, Section 17) |

Evidence scope, by resource:

| Resource | Digest covers |
|---|---|
| Source (user note) | Body after the frontmatter; the whole file if it has none |
| Record | Frontmatter end → first of `## Sources` / `## History` / `## Related`: Summary and Detail (Section 7.2) |
| Claim (`derived`) | The claim's fingerprint: the list-item text with `(src: …)`, `#disputed` and the `^id` removed and whitespace collapsed. One claim, not the page |

A Source's frontmatter is outside its evidence scope, so a frontmatter-only change is never an evidence change. It can still be a **governance signal**: a change to a Source's `status`, `decision_status`, `superseded_by` or `withdrawn`-type key is grounds for the Agent to mark claims citing that Source `#disputed` with an Open item, never to supersede them. (Level 0 T12: all four agents reasoned this way unprompted; the rule records it.) Connectors that watch for changed Sources therefore report two kinds of change: evidence (digest differs) and governance (one of those keys differs).

Digests are computed over the scope after normalizing line endings to `\n` and stripping trailing whitespace; the exact procedure is in `CONVENTIONS.md`.

Two guarantees, kept apart:

| Guarantee | What it means | Provided by |
|---|---|---|
| **Change detection** | "Is the evidence still what this page cited?" | `version`, always, in any environment |
| **Historical recoverability** | "Show me what this page actually read" | `blob:` when present (the Agent strips the frontmatter from the recovered file itself); a Record holding a snapshot for external pages. `fetched:`, `unverified`, and a `version` with no `blob:` give no recoverability and are never presented as if they did |

Why two values: git stores only the blobs it committed, which are whole files; a digest over part of a file is not a git object and cannot be fetched (verified 2026-10-30). The digest therefore carries detection and the blob carries recovery. Why the scope is narrower than the file: frontmatter changes (`followed_by`, `verified`, a tag), appended History lines on a Record, and edits to unrelated claims on a Knowledge page must not look like changes to the evidence a page relied on; a wide scope would turn every bookkeeping edit into a false "source changed" signal and defeat targeted updates.

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

Propagation: when a claim is marked `#disputed` or moved to `## History`, the Agent finds every `derived` citation of it (grep for `[[<slug>#^cN]]` across Knowledge pages) and appends `#disputed` to each dependent claim with a History line naming the upstream change. The dependent claim is not superseded automatically; its own evidence may still hold. (Level 0 T11: both Test agents reached the upstream dispute through the link but noted the dependent claim carried no mark; this rule closes that gap.)

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

The single file an unfamiliar Agent reads first. The reference text is `format/CONVENTIONS.md`. It contains, in order:

1. The one-paragraph purpose of the vault and the dependency rule (Section 3).
2. The layout (Section 4) and page roles.
3. The frontmatter tables (Sections 5–6) and the body contract (Section 7), in full.
4. How to read: the tiers of Section 7.0. How to answer: tier 1 → tier 3, plus the source-check of Section 7.0 for any claim given as an answer; go to tier 4 only when evidence is asked for.
4a. How to write a `description`: one sentence saying what question the page answers, as of what date, and what it leaves out — the same bar as an Agent Skill description.
5. How to update: find pages whose `## Sources` version no longer matches (backlinks with Obsidian, grep without); revise claims by the move-to-History rule; propagate `#disputed` to `derived` citers (Section 9.2); treat Source frontmatter status changes as governance signals (Section 8); never edit `## History`; never touch `protected`; write a `log.md` line.
6. When to stop and ask a human: the autonomy policy.
7. What is lost without a Connector: atomic writes, hash-based conflict detection, enforcement of `protected`. These become conventions.
8. Tag taxonomy.

`SCHEMA.md`, `KNOWLEDGE.md`, and the `vault-conventions` skill are retired; `AGENTS.md` / `CLAUDE.md` import `CONVENTIONS.md` instead of restating it.

## 14. Derived data

Indexes, search caches, backlink maps, OKF exports, and freshness sidecars live under `.knowlery/` and are rebuildable from the pages. No workflow may treat them as truth; no page may reference them.

## 15. Classification of statements (as of v1.0-rc)

Classification says how a statement is handled; approval status lives in `docs/2.0/DECISIONS.md`.

**Constraints** (unchanged)
- Format-first; Markdown + minimal metadata; no database; relationships as wikilinks. Level 0 must work; `CONVENTIONS.md` is part of the Format. History is never deleted; human decisions are protected. Sources are author-owned; autonomous workflows never write there. Frontmatter is flat. Only Obsidian-native syntax.

**Decisions** — fixed in v1.0-rc
- Three page roles: Knowledge (`concept`, `entity`, `comparison`), Record (frozen; replaces `query`; directory `records/`), Source. Dependency rule with `derived` as a zero-weight reference.
- Claim = one list item ending in `^cN`; status by position (`## Current` / `#disputed` / `## History`); supersession by moving the line with its anchor; propagation to `derived` citers (§9.2).
- `## Sources` in the body; `version` = sha256 over a per-role evidence scope; optional `blob:` for recovery; `unverified` / `fetched:` / `stated:` markers; Record scope ends at `## Sources`.
- Progressive-disclosure tiers with the source-check exception (§7.0).
- One `status` axis; `updated/updated_by`, `verified/verified_by`, `stale_after`; removal of `freshness_status`, `retrieval_priority`, `domain`.
- Links: pages by slug, Sources by path. Governance signals on Source frontmatter (§8). `comparison` stays a Knowledge role. Entity attribute keys stay free; `CONVENTIONS.md` lists the recommended ones.

**Hypotheses — outcome**
1. Claim granularity (5–10 per page, ~40-line Current): **retired as a number.** The 14 migrated pages carry 11–35 claims each and all 24 Test runs located and updated the right claim; the functional definition (smallest independently verifiable, citable, supersedable statement) is the rule, the counts are guidance. The granularity sub-experiment was not run; nothing observed argued for it.
2. Format overhead small relative to content: **not falsified, not measured.** Token totals moved in opposite directions across the two harnesses (+3% / −11%); files read fell 26% in the one harness that counted distinct files. Needs an instruction-token split no harness exposed.
3. Attestations weigh less than documents: **out of the Format.** It belongs to the autonomy policy page; no task exercised it.
4. `comparison` as Knowledge role: **confirmed** (the migrated comparison behaved like a concept page in T01).

**Conformance — Level 0 verified (two harnesses, one repetition each)**
- Agents parse, cite and update `## Sources` without reusing ids (T04–T06: 4/4 cells).
- Change detection works; non-recoverable versions reported honestly (T07, T08, T09: 6/6 cells).
- Frontmatter-only, Record-History-only and unrelated-claim changes do not register as evidence changes (T08, T10: 4/4).
- Anchors survive the move to `## History` and `[[page#^cN]]` resolves after it (T04 Test, both harnesses).
- Dispute reaches `derived` dependents through the link (T11: 2/2 Test cells), now backed by the §9.2 rule.

**Conformance — needs a Connector (Level 1), not tested here**
- Atomic writes; concurrent-edit detection; enforcement of `protected`; automatic `status` recomputation; automatic propagation (§9.2) rather than Agent-performed.

**Open — process, not Format**
- `queries/` → `records/` rename in a live 1.x vault needs a link-rewrite pass (3,109 links in the Pilot); the Format decision is `records/`, the migration tooling is Connector work.
- Scorer rubric and repetitions for any further experiment (RUNBOOK §3).

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
| Frontmatter changed, evidence scope unchanged | No false "source changed" |
| Record history exists in git, body blob not stored separately | Recovery goes through the whole-file `blob:`; a bare digest is not claimed as recovered |
| Unrelated claim edited on a page cited as `derived` | Dependent claims are not flagged |

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
| `sources: [path]` | `## Sources` line `sN · [[path]] · sha256:<digest of that blob's evidence scope> · source · blob:<whole-file blob at the last commit on or before the page's `updated` date> · candidate`. The blob is the best available candidate for what the page read, not a read log, so the note says `candidate` until a human or a later cook confirms it. Never the current hash. No git history for the file → `unverified`. Frontmatter key dropped |
| `sources: [free text]` | `## Sources` line `sN · human:<id> · stated:<date> · attestation · <text>` |
| `sources: [url]` | `## Sources` line `sN · <url> · fetched:<page updated date> · source · no-snapshot` |
| `## Cook Refresh (D)` | lines in `## History` |
| body with no `## Current` | `## Current` created from `description` + first paragraph; everything else to `## Evidence`; requires human or Agent pass for claims |

Everything in this table except the last row is scriptable.

## 18. Evidence from the Level 0 experiment

Full data: `format/experiments/level0/RESULTS.md` (kit `c162a64`, Pilot `cf9e378`, harnesses `claude-sandbox` and `claude-code-local`, model `claude-fable-5-1`, one repetition per cell). The experiment was single-model; the owner accepted that scope on 2026-11-02.

| What the Format promised | What was observed |
|---|---|
| Targeted update: one claim changes when one fact changes (§7.1, §9) | T04 Unnecessary Rewrite Rate: 1.x arm 0.77 / 0.70, Format arm 0.00 / 0.00 |
| Conflicts are surfaced, not resolved (§8 of CONVENTIONS) | T05, T06: 8/8 cells marked disputed and stopped; no silent resolution |
| Recoverability is honest (§8) | T07, T09: no invented text in 8/8 cells; `blob:` gave mechanical recovery |
| Scope rules prevent false "source changed" (§8) | T08, T10: 8/8 cells made no edit |
| Tier-3 reading is sufficient for queries (§7.0, v0.3.1) | **Falsified for the unqualified form**: 2 of 3 Format-arm runs repeated a compiled claim its Source contradicts; rule amended in v1.0-rc |
| `source-checked` reuse is safe (§7.0, v1.0-rc) | Reviewer found the event-only form unsafe when a Source changes before Evolve runs; rule now also requires a current-digest match. Regression task T13 (kit `2ba5db3`): pass in both arms, 1 cell each; Test arm caught the drift by digest without reading the Source body |
| `derived` carries disputes (§3) | T11: reached in 2/2, but dependent claim unmarked; propagation rule added |
| Body-only Source scope is safe (§8) | T12: 4/4 agents still surfaced a frontmatter withdrawal; governance-signal rule added so this no longer depends on judgment |

Also observed: the Format made a 1.x practice visible that 1.x could not express (Records rewritten in place by cook runs), flagged independently in five Test runs.

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
- s1 · [[Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Zipline API Doc/Create Quote]] · sha256:4e1b…c9d0 · source · blob:9f3a1c0e5b2d7a4f8c1e6b3d9a2f5c8e1b4d7a0c
- s2 · [[zipline-mvp-partner-confirmed-contract-2026-07-30]] · sha256:a77f…02e3 · record · blob:71be02d4a9c3e6f1b8d5a2c7e0f3b6d9a1c4e7f2
- s3 · human:rob-knudson · stated:2026-07-28 · attestation · Package never returns after Dropbox lock (Slack)

## History
- A single Zip carries one Wonder order within the approved package limits; width limit is 252 mm (src: s1) · superseded 2026-09-03 by [[#^c5]] · partner QA corrected 252 mm to 254 mm · src: s2 · by claude-code/claude-fable-5-1 ^c2
- 2026-09-03 · verified by human:jay
- 2026-09-03 · [[#^c5]] source-checked · s2@sha256:2b1e…9f · by human:jay
- 2026-07-30 · [[#^c3]] added · src: s2 · by claude-code/claude-fable-5-1
- 2026-07-28 · [[#^c4]] added, protected by human:jay · src: s3
- 2026-07-26 · [[#^c2]] added · src: s1

## Related
- [[1p-drone-delivery]] — the program this entity serves
- [[dropbox-loading]] — loading mode that triggers custody transfer
```
