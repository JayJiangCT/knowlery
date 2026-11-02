# ANSWER — Recovering the missing source behind `concepts/packaged-size.md`

## Short answer

The exact text of `Wonder/Other Team/IKC/Expo T-Shirt Size Optimization.md` **cannot be recovered from this vault**. The note is not in the working tree, was never tracked in any commit of this repository, and no verbatim quotation of it exists anywhere in the vault. What *can* be established is the chain of dependency and a paraphrased, derived account of the source's content, carried by the compiled query page `queries/expo-t-shirt-size-optimization-2026-06-24.md`. That page is a summary, not a copy; nothing in the vault is marked as a direct quote from the missing note.

## 1. Verified: the note is absent and was never in this repository

- `Wonder/` at HEAD contains only `Wonder/Glossary/` and `Wonder/Wonder Fulfillment/`. There is no `Wonder/Other Team/` directory.
- `git ls-tree -r HEAD` has no path containing "Other Team"; the only path matching "t-shirt" is `queries/expo-t-shirt-size-optimization-2026-06-24.md`.
- `git log --all --name-only` across all four commits (`c7daf22`, `97e2815`, `cf9e378`, `e6abc78`) shows no file under `Wonder/Other Team/` was ever added or removed. The note was never committed here; it was not deleted from this repo. `git stash list` is empty and `git fsck --unreachable` reports no unreachable objects, so there is no trace of the note anywhere in the object store either.
- Both `concepts/packaged-size.md` and the query page entered the repository in the first commit, `c7daf22` ("Knowlery cloud pilot: sanitized read-only Fulfillment/Dispatch subset"). The commit message is the most likely explanation: the vault is a sanitized subset of the Fulfillment/Dispatch area, and a cross-team (IKC / Kitchen Design) note was outside that subset. The compiled pages were copied in still citing the path from the original vault.
- No alternate copy: `.knowlery/freshness/` does not exist (no sidecars), `log.md` does not exist, `Attachments/` holds only Zipline/Parallel Search images, and `grep` for distinctive strings from the source (`footprint area`, `Gravity Fed`, `Optimized Weight`, `35.0 in`, the Confluence page id `5407965201`) finds nothing under `Wonder/` or `pilot/`.
- Partial corroboration only: user data files mention some of the audited packaging SKUs by name (e.g. `9000370` "Clamshell Box, 6"x6"x3", Hinged, Brown, Square, Kraft" in `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/assets/drone-eligibility-research-2026-09-07/hdr-item-container-form-map-2026-09-07.csv`; `9001638 (Pulp Plus 36 oz Rect..)` in `sheet-rows-enriched-2026-09-07.json` in the same folder). These confirm the SKU names exist, not the thresholds, areas, or weights attributed to the source.

## 2. Derived (not verbatim): what the vault says the source contained

The only in-vault statement of the note's content is `queries/expo-t-shirt-size-optimization-2026-06-24.md` (compiled 2026-08-20, updated 2026-09-03). Its line 32 states the provenance explicitly: "Jakob's Kitchen Design page under *Expo Discussion Notes - 6/24/26*. Captured as a user note at `Wonder/Other Team/IKC/Expo T-Shirt Size Optimization.md`." The upstream is the Confluence page `https://wonder.atlassian.net/wiki/spaces/~7120200ee1df0596dc4514b0733807c1362aa9/pages/5407965201/Expo+T-Shirt+Size+Optimization` (Jakob, 2026-06-24).

The claims in `concepts/packaged-size.md` that trace to this source, as paraphrased by the query page:

| Claim on `packaged-size` page | Where it appears | Query-page rendering |
| --- | --- | --- |
| Footprint-area bins XS < 10.0 in², S < 35.0, M < 65.0, L < 100.0 | "How the tag is assigned", step 2 | "Rule 1 — footprint area bins" table |
| Audit covered 34 packaging SKUs; XL absent | step 2 and "This is 2D base area…" paragraph | "What is being sized"; "There is no XL row in this 34-SKU audit" |
| Legacy weights 0.25 / 0.5 / 1 / 2; optimized 0.125 / 0.5 / 1 / 1.5 (Medium = 1) | step 3 | "Rule 2 — category weights" table (with SKU counts 3/15/12/4 and avg areas 5.86/25.06/48.37/75.04 in²) |
| Expo simulation showed most t-shirt "fits" overflowed under current hot-spot rules | "What it is not", closing paragraph | "only 3.8% … actually fit … (96.2% overflow)"; shelf table Gravity Fed 97.90%, Ambient Standard 98.60%, Hot Standard 95.70% |
| It is an audit of container SKUs, not a Cookbook formula on food | step 1 heading paragraph | Opening paragraph and "What is being sized" |

Also on the query page but not restated on `packaged-size`: the five outlier SKUs (9000636, 9003111, 9001638, 9000370, 9000039) with their areas and legacy/optimized reclassifications, and the next steps (CE validation, rerun on historical orders, demand-impact simulation).

Treat all of the above as a second-hand summary. The query page contains no quotation marks, blockquotes, or embeds attributed to the user note, so none of it can be presented as the source's exact wording.

## 3. Where the vault records the dependency

| File | Line | What it records |
| --- | --- | --- |
| `concepts/packaged-size.md` | 24 | `sources:` entry `Wonder/Other Team/IKC/Expo T-Shirt Size Optimization.md` |
| `concepts/packaged-size.md` | 23, 50, 115, 121 | Confluence URL and wikilinks to the compiled query page (the body cites the query page, not the raw note) |
| `queries/expo-t-shirt-size-optimization-2026-06-24.md` | 19 | `sources:` entry for the missing note |
| `queries/expo-t-shirt-size-optimization-2026-06-24.md` | 32 | "Captured as a user note at `Wonder/Other Team/IKC/Expo T-Shirt Size Optimization.md`" — the strongest statement that a user-note capture once existed |
| `queries/cookbook-packaged-size-warehouse-landing-2026-08-20.md` | 27 | `sources:` entry for the missing note |
| `queries/kds-bag-recommendation-feature-and-algorithm-2026-07-22.md` | 27 | `sources:` entry for the missing note |
| `entities/kds.md`, `queries/kds-pre-order-bag-recommendation-feasibility-2026-07-16.md`, `queries/cookbook-physical-packaging-data-model-and-drone-eligibility-feasibility-2026-07-23.md`, `queries/cookbook-weight-and-dimension-warehouse-observability-2026-08-18.md` | various | Cite only the compiled query page via wikilink; they do not reference the raw note directly |

## 4. Not established

- The exact wording, structure, or length of the user note, and whether it was a verbatim Confluence export or a hand-written capture.
- Whether the query page reproduced the source's numbers exactly or edited/rounded them.
- Any content of the source not summarized by the query page.
- Whether the note still exists in the original (unsanitized) vault. The only way to recover the text is from outside this vault: the original vault, or the Confluence page `pages/5407965201`. Network access was out of scope for this task, so neither was attempted.

## Paths relied on

- `AGENTS.md`
- `concepts/packaged-size.md`
- `queries/expo-t-shirt-size-optimization-2026-06-24.md`
- `queries/cookbook-packaged-size-warehouse-landing-2026-08-20.md`
- `queries/kds-bag-recommendation-feature-and-algorithm-2026-07-22.md`
- `entities/kds.md`
- `Wonder/Glossary/IKC.md` (confirms IKC = Infinite Kitchen Center, formerly HDR)
- `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/assets/drone-eligibility-research-2026-09-07/hdr-item-container-form-map-2026-09-07.csv` and `sheet-rows-enriched-2026-09-07.json` (partial SKU-name corroboration)
- `.gitignore`, `.knowlery/config.json`, `.knowlery/manifest.json`
- Read-only git: `git log --all --name-only`, `git ls-tree -r HEAD`, `git log --diff-filter=A`, `git grep` over all commits

## Files changed

- `ANSWER.md` (this file, new). No other vault file was created or modified; the task did not ask for vault changes, so `log.md` was not created and the dangling `sources:` entries were left as-is.
