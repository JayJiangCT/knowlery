# CONVENTIONS — how this knowledge base works

You are reading a Knowlery 2.0 vault. This file is the whole contract. There is no runtime, no plugin, no index you must use; everything below is readable and writable with ordinary file tools.

## 1. Purpose and the one dependency rule

The vault turns raw material into a maintained wiki an Agent can trust. Three kinds of pages, in a strict evidence chain:

- **Sources** are raw material (notes, documents, conversations). Owned by their authors. Never written by autonomous workflows.
- **Records** are dated, frozen accounts of a finding, decision, readout, or report. Written once; later only pointed forward.
- **Knowledge pages** (`concept`, `entity`, `comparison`) hold the current understanding of one subject as a list of claims, each with its own sources and history.

**Knowledge pages cite Records and Sources as evidence. Records cite Sources and other Records. A Knowledge page may cite a single claim on another Knowledge page as `derived`, which is a reasoning dependency and counts as zero independent evidence.** `related` and plain wikilinks are relationships, not evidence.

## 2. Layout

```
CONVENTIONS.md      this file
log.md              operation log, newest first, one line per write
concepts/ entities/ comparisons/     Knowledge pages (type = concept | entity | comparison)
records/            Records (type = record)
Wonder/ and other user-named folders   Sources
.knowlery/          derived data; never a source of truth
```

A page's identity is its slug (the filename without `.md`). Knowledge pages and Records are linked by slug: `[[zipline-loading-methods]]`, `[[zipline-loading-methods#^c3]]`. Sources are linked by vault path: `[[Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Zipline API Doc/Create Quote]]`.

## 2a. Legacy pages (migration in progress)

Only part of this vault has been migrated. A page under `concepts/`, `entities/`, `comparisons/` or `queries/` whose frontmatter has **no `updated_by`** is a legacy 1.x compiled page. Read it as a dated snapshot (like a Record): its `status`/`freshness_status` are advisory, it has no claim ids, and its `sources` list is in the frontmatter without versions. Cite it as `record` with `unverified` unless you compute its digest. Do not restructure legacy pages; if a task requires changing one, append a dated note at the end and log it.

## 3. How to read a page (progressive disclosure)

| Tier | Read | To decide |
|---|---|---|
| 1 | `title` + `description` | whether to open the page |
| 2 | frontmatter | how to treat it: `status`, `verified`, `stale_after`, `protected` |
| 3 | `## Current` | the answer |
| 4 | `## Evidence`, `## Open`, `## Sources`, `## History` | evidence, or any update |
| 5 | the Records and Sources themselves | only when the Knowledge page is insufficient |

**To answer a question:** find candidate pages by `description` (grep the frontmatter), read `## Current`, cite the claim (`[[slug#^cN]]`) and, if asked for evidence, follow `(src: sN)` to the `## Sources` line. Stop at tier 3 unless evidence is requested. Prefer `status: current` pages; a `superseded` page points to its replacement in `superseded_by`; a Record is a snapshot as of its `date`.

## 4. Frontmatter (flat only)

Scalars and flat lists. Never nested maps.

| Field | Pages | Meaning |
|---|---|---|
| `type` | all | `concept` / `entity` / `comparison` / `record` |
| `title` | all | display name |
| `description` | all | one sentence: what question the page answers, as of when, and what it leaves out |
| `tags` | all | 2–5, sorted |
| `status` | all | `draft` / `current` / `disputed` / `superseded` / `archived` |
| `updated`, `updated_by` | all | last meaningful content change; actor as `human:<id>`, `<agent>/<model>` or `process:<id>`. Provenance only: never proof of authorization |
| `verified`, `verified_by` | optional | most recent verification; earlier ones are History lines |
| `stale_after` | optional | after this date treat as stale regardless of status |
| `aliases` | optional | other names; never link targets |
| `related` | optional | `"[[slug]]"` links that are not evidence |
| `supersedes` / `superseded_by` | optional | page-level replacement chain, written in both directions |
| `protected` | optional | list of claim ids (`"^c4"`) a human has decided, or `true` for the whole page |
| `date`, `kind`, `followed_by`, `frozen` | Records | the date the Record describes; `finding` / `decision` / `readout` / `report`; later Records continuing this one; frozen defaults to true once not draft |

## 5. Body contract — Knowledge page

Sections in this order; omit empty ones, never reorder.

```markdown
# Title

## Current
Optional one-paragraph context, then claims:
- <subject, conclusion, conditions> (src: s1, s3) ^c1
- <claim> (src: s2) #disputed ^c2

## Evidence
Optional supporting prose, tables, data.

## Open
- <question> about [[#^c2]] (src: s4) ^q1

## Sources
- s1 · [[Wonder/…/Create Quote]] · sha256:<digest> · source · blob:<40 hex>
- s2 · https://… · fetched:2026-07-16 · source · no-snapshot
- s3 · [[some-record-2026-07-30]] · sha256:<digest> · record · blob:<40 hex>
- s4 · human:rob-knudson · stated:2026-07-28 · attestation · what was said
- s5 · [[other-page#^c2]] · sha256:<claim fingerprint> · derived

## History
- <original claim text> (src: s1) · superseded 2026-09-03 by [[#^c5]] · <reason> · src: s2 · by <actor> ^c2
- 2026-08-01 · verified by human:jay
- 2026-07-08 · [[#^c1]] added · src: s1 · by <actor>

## Related
- [[slug]] — why
```

Rules:
- A **claim** is one list item ending in a block id `^cN`: the smallest statement that can be independently verified, cited, superseded or updated, with its subject, conclusion and conditions in one item. The id is always the **last token on the line** (that is where Obsidian recognizes it). Each id appears exactly once on the page as an anchor; refer to it elsewhere by link `[[#^cN]]`. Ids are never reused.
- `## Current` holds only current claims. A claim under challenge stays there with `#disputed` appended.
- `## Open` items are questions (`^qN`), not claims.
- **Superseding a claim:** move its whole line from `## Current` to `## History`, keep the original text, append ` · superseded <date> by [[#^cNEW]] · <reason> · src: <ids> · by <actor>`, and keep the original `^cOLD` at the end of the line. Add the new claim with a new id in `## Current`. Never delete.
- `## Sources` and `## History` are append-only; History is newest first.
- Never edit a line whose id is listed in `protected`; you may append to `## Open` and `## History` about it.

## 6. Body contract — Record

```markdown
# Title (YYYY-MM-DD)

## Summary
## Detail
## Sources
## History
## Related
```

The **evidence scope** of a Record is everything after the frontmatter up to the first of `## History` / `## Related`. Once a Record is not `draft`, that part is never rewritten. New facts go in a new Record with `followed_by` on the old one. If an owner has edited the frozen part anyway, append `- <date> · revised by <actor> · <why>` to its `## History` and treat every page citing it as needing review.

## 7. Sources and versions

Each `## Sources` line: `- <id> · <resource> · <version> · <kind> [· blob:<40 hex>] [· note]`.

- `version` is a change-detection digest: `sha256:` over the resource's **evidence scope**, or `fetched:<date>` for a URL, `stated:<date>` for an attestation, `unverified` if unknown.
- Evidence scope: a **Source** = its body after the frontmatter (whole file if none); a **Record** = frontmatter end → first `## History`/`## Related`; a **claim** (`derived`) = the claim line with `(src: …)`, `#disputed` and `^id` removed and whitespace collapsed.
- Digest procedure: take the scope, normalize line endings to `\n`, strip trailing whitespace on each line, strip leading/trailing blank lines, SHA-256 the UTF-8 bytes. `tools/digest.py <file> [--scope source|record|claim]` does exactly this if present; otherwise do it by hand with `sed`/`sha256sum`.
- `blob:` is the git blob of the **whole file** as committed, i.e. `git rev-parse HEAD:<path>` at citation time. It is the only thing that recovers text: `git cat-file -p <blob>` then strip the frontmatter yourself. A `sha256:` alone recovers nothing; say so rather than claiming recovery.
- A change in frontmatter only, a History line appended to a Record, or an unrelated claim edited on a page cited as `derived` is **not** an evidence change.

**To absorb a changed Source:** compute its new digest; find pages citing that path (grep `## Sources` lines); for each cited claim whose `version` no longer matches, judge whether the claim still holds; if not, supersede it (rule in §5) with a new `## Sources` line for the new version; never overwrite; write one line to `log.md`.

## 8. When to stop and ask a human

Act on your own when evidence quality, impact scope and reversibility are all good. If any one is weak — a single attestation against a document, a change that touches a `protected` claim, a conflict between two current sources you cannot rank — do not resolve it: mark the claim `#disputed`, add the question to `## Open`, and stop. Two sources that contradict each other are a finding to surface, never a choice to make silently.

## 9. What is not enforced here

No tool enforces any of this in this vault: writes are not atomic, concurrent edits are not detected, `protected` is not locked. These are conventions you keep. Say so when it matters.

## 10. Writing to `log.md`

One line per write, newest first under a `## YYYY-MM-DD` heading: `- <HH:MM> · <actor> · <page> · <what changed, one clause>`.
