# Migration guide — 1.x page → v0.3.1 (Test arm)

Applies to the pages in `pages.txt`. The goal is **semantic equivalence**: no claim added, none dropped, none sharpened or softened. Where 1.x is ambiguous, keep the ambiguity and log it in `migration-log.md`.

Read first: `test/CONVENTIONS.md`, then the exemplar `test/concepts/drone-delivery-integration-strategy.md` (migrated from `concepts/drone-delivery-integration-strategy.md` in the Pilot). Validate every output with `python3 -I tools/validate.py <file>`.

## Frontmatter (both roles)

| 1.x | v0.3.1 |
|---|---|
| `title` | keep |
| `type: concept/entity/comparison` | keep; `type: query` → `type: record` |
| `description` | rewrite as one sentence: what question the page answers, as of what date, what it leaves out |
| `tags` | keep, drop `DaaS`-style duplicates, 2–5 sorted |
| `status: active/reviewed` → `current`; `draft` → `draft`; `archived` or `freshness_status: superseded` → `superseded` (if `superseded_by` present) else `archived`; any `#disputed` claim in Current → `disputed` |
| `updated` | keep; add `updated_by: process:cook` |
| `freshness_reviewed: D` | `verified: D`, `verified_by: process:cook` |
| `freshness_status: watch/partially_stale` | omit; note in log if it carried information |
| `retrieval_priority`, `domain`, `date` (Knowledge only), `created`, `contradictions`, `freshness_sidecar` | drop (`contradictions` → `#disputed` claim + `## Open` item) |
| `references` | `related`, as `"[[slug]]"` |
| `superseded_by: ["[[x]]"]` | keep as `"[[slug]]"`; add `supersedes` on the other side only if that page is in scope |
| `aliases` | keep |
| `sources` | **delete from frontmatter**; becomes `## Sources` |
| Records only | add `date` (from 1.x `date`), `kind` (`decision` if the page records a decision, `readout` for meeting/deck readouts, `report` for metric reports, else `finding`) |

Links: pages by slug `[[slug]]` (strip `queries/`, `concepts/`, `.md`, and `|display` may stay); Sources by vault path without `.md`, e.g. `[[Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Zipline API Doc/Create Quote]]`.

## `## Sources` lines

`- sN · <resource> · <version> · <kind> [· blob:…] [· note]`

- Vault file (path or `queries/…`) → `[[path-or-slug]] · @pin · source` or `· record` (`record` for anything under `queries/`). `@pin` is resolved by the build script; do not compute hashes by hand.
- URL → `<url> · fetched:<date the 1.x page used it; else the page's date> · source · no-snapshot`
- Free text naming a person/conversation → `human:<slug> · stated:<date in the text, else page date> · attestation · <what was said, from the page>`
- Free text that is a BigQuery table id, repo path or bare name → `<text> · unverified · source · <as written>`
- Keep every 1.x `sources` entry; number s1… in the order they are first needed by claims (Knowledge) or in 1.x order (Records).

## Knowledge pages (concept, entity, comparison)

1. `## Current`: one optional context paragraph, then **claims** as list items `- <subject, conclusion, conditions> (src: sN[, sM]) ^cN`. Group with a bold-free plain line (e.g. `Direction and scope`) when the page has several sub-topics; groups are plain text, not headings. A claim is the smallest statement that can be verified, cited, superseded or updated on its own; two conclusions that could change independently are two claims. Comparison tables stay as tables in `## Evidence` with the conclusions they support written as claims.
2. Dated sections like `## X (2026-07-30)` and `## Cook Refresh (date)` are the 1.x history. Their **still-valid** statements become claims; their **replaced** statements become History lines: `- <original text> (src: sN) · superseded <date> by [[#^cNEW]] · <reason> · src: sM · by process:cook ^cOLD`. Use the date of the section that replaced them. Never drop a replaced statement.
3. `#disputed`: a 1.x `contradictions` entry, or text saying "needs confirmation" / "unconfirmed" about a specific fact → the claim stays in Current with `#disputed` and an `## Open` item `^qN` referencing it.
4. `## Open`: 1.x Open Questions / Open Decisions, each `^qN`, referencing claims where applicable.
5. `## Evidence`: tables, pipelines, data, supporting prose the claims rely on. Keep it; shorten only exact duplication of a claim.
6. `## History`: newest first; one `added` line per dated section (`- <date> · [[#^cN]] [[#^cM]] added · src: … · by process:cook`), one `verified` line for `freshness_reviewed`, and the superseded lines from step 2.
7. `## Related`: 1.x Related list as `- [[slug]] — why`.
8. Every claim has at least one `(src:)`; every source id used exists in `## Sources`.

## Records (1.x queries)

Records keep their text; they are **not** rewritten into claims.

1. `## Summary`: the 1.x `## Short Answer` / `## Summary` / `## Executive Summary` if present, else 3–5 sentences from `description` and the opening paragraph. No new facts.
2. `## Detail`: everything else from the 1.x body in original order, including `## Cook Refresh (date)` and `## Freshness Review` sections, demoted to `###` headings so the section contract holds. Remove only the 1.x `## Related` (moves to the end) and nothing else.
3. `## Sources`: as above, 1.x order.
4. `## History`: one line per dated refresh/review section found in the body: `- <date> · revised by process:cook · <section title>`; plus `- <freshness_reviewed> · verified by process:cook` if present. Newest first.
5. `## Related`: the 1.x Related list.
6. Frontmatter `kind` as in the table; `frozen` omitted (defaults).

## Log every ambiguity

Append to `migration-log.md` one line per item: `- <page> · <what was ambiguous> · <what you did>`. Typical items: a date you inferred; a statement you could not tell was current or historical; a source you could not classify; a 1.x `freshness_status: watch` with no explanation.
