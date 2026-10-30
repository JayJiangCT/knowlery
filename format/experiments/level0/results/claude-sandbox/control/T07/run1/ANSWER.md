# ANSWER — Recovering the missing source behind `concepts/packaged-size.md`

## Short answer

**The exact text of `Wonder/Other Team/IKC/Expo T-Shirt Size Optimization.md` cannot be recovered from this vault.** The file is absent from the working tree, absent from every commit in the repository's git history, absent from `.knowlery/`, and is recorded by the pilot's own audit as a file that was *intentionally excluded* from this sanitized copy ("other teams' KBs" — only its path survives, not its content). No vault-local transport (Obsidian, network, the source vault) is available to fetch it.

What **can** be established is (a) exactly which claims on `packaged-size` depend on that note, (b) the closest surviving derivative of the note — the compiled query page `queries/expo-t-shirt-size-optimization-2026-06-24.md`, which states it was "captured as a user note at `Wonder/Other Team/IKC/Expo T-Shirt Size Optimization.md`" — and (c) where the dependency is recorded. The query page is a *compiled summary*, not the user note; its tables and figures are the best available reconstruction of what the note said, but they are not verbatim text.

## 1. What the `packaged-size` page relied on from the missing note

`concepts/packaged-size.md` lists the note in `sources:` (last entry), immediately after the Confluence URL `…/pages/5407965201/Expo+T-Shirt+Size+Optimization` and the compiled page `queries/expo-t-shirt-size-optimization-2026-06-24.md`. The body attributes the following to that source (via the "Expo T-Shirt Size Optimization" link in **How the tag is assigned** and **What it is not**):

1. The assignment rule is an **audit of container SKUs** (34 packaging SKUs), by Jakob of Kitchen Design, dated 2026-06-24.
2. Each packaging SKU's physical **footprint area** is measured and binned: XS < 10.0 in², S < 35.0 in², M < 65.0 in², L < 100.0 in².
3. Each bin has a **weight** (Medium = 1): legacy `0.25 / 0.5 / 1 / 2`; "optimized" weights from average area ratios `0.125 / 0.5 / 1 / 1.5`, which KDS does not use.
4. The audit uses 2D base area, not 3D volume; **XL is absent** from the 34-SKU audit.
5. Jakob's Expo simulation showed the proxy is coarse: under current hot-spot rules most t-shirt-"fits" still overflowed when packed with real dimensions (the query page quantifies this as only 3.8% actually fitting / 96.2% overflow).

## 2. The best surviving reconstruction (not verbatim)

`queries/expo-t-shirt-size-optimization-2026-06-24.md` (type: query, status: active, retrieval_priority: high, created 2026-08-20, updated 2026-09-03) is the compiled page built from the Confluence page and the missing user note. It adds detail the concept page omits and is the closest record in the vault of the note's content:

- Footprint thresholds table (XS < 10.0, S < 35.0, M < 65.0, L < 100.0 in²).
- 5-of-34 outlier SKU table: 9000636 (85.6 in², M→L, no longer in use), 9003111 (26.7, M→S, validated), 9001638 (54.0, L→M, validated), 9000370 (39.8, S→M, validated), 9000039 (39.1, S→M, no longer in use).
- Category weight table: XS 3 SKUs / 5.86 in² / 0.25 → 0.125; S 15 / 25.06 / 0.5 → 0.5; M 12 / 48.37 / 1 → 1; L 4 / 75.04 / 2 → 1.5.
- Expo shelf simulation table: Gravity Fed 11"×39" (1D) capacity 4→4, 97.90%; Ambient Standard 12"×24" (3D) 8–12→12, 98.60%; Hot Standard 12"×14" (3D) 8–12→6, 95.70%.
- "Only 3.8% of simulated orders that 'fit' by t-shirt weight actually fit when packed with real dimensions (96.2% overflow)."
- Next steps: CE validation of reclasses; rerun simulations on historical orders; simulate demand impact of weight and capacity changes.

Caveat: this page is itself agent-compiled. It cannot be used to prove the wording, structure, or completeness of the original note, and because the note and the Confluence page are cited together, the vault does not record which figures came from which of the two.

## 3. Where the vault records the dependency

| Location | What it records |
|---|---|
| `concepts/packaged-size.md` → `sources:` | Lists `Wonder/Other Team/IKC/Expo T-Shirt Size Optimization.md` as a source. |
| `queries/expo-t-shirt-size-optimization-2026-06-24.md` → `sources:` and first body paragraph | Lists the same path; states "Captured as a user note at `Wonder/Other Team/IKC/Expo T-Shirt Size Optimization.md`". |
| `queries/cookbook-packaged-size-warehouse-landing-2026-08-20.md` → `sources:` | Also cites the path. |
| `queries/kds-bag-recommendation-feature-and-algorithm-2026-07-22.md` → `sources:` | Also cites the path. |
| `pilot/README.md` ("Excluded: … other teams' KBs"; "Many `sources:` entries and wikilinks point to files that were intentionally excluded") | Policy-level record that such sources were dropped from the pilot. |
| `pilot/AUDIT.md` §7, §9, §10 | 87 `sources:` entries refer to 68 excluded files, including "other teams' KBs"; "Only their paths appear; their content is not in the pilot"; "No excluded file is in history"; "No excluded file content was copied". |
| `pilot/FILES.txt` | Enumerates every file in the pilot; the `Wonder/Other Team/…` path is not in it (only `queries/expo-t-shirt-size-optimization-2026-06-24.md`, line 406). |

## 4. Verification performed

- Filesystem: no `Wonder/Other Team/` directory exists; `Wonder/` contains only `Glossary/` and `Wonder Fulfillment/`. No file anywhere in the vault matches `*expo*` other than the query page.
- Git: `git log --all` shows two commits (`cf9e378`, `bac4d34`); `git log --all --name-only` contains no `Wonder/Other Team` path and no deleted file by that name.
- `.knowlery/`: contains only `config.json`, `manifest.json`, `bin/query.mjs`; no freshness sidecars, evidence, or activity records that could hold the note's text.
- `.gitignore` excludes `.knowlery/evidence/`, `.knowlery/activity/`, etc., so even if the source vault held captured evidence for this note, it was never committed here.

## 5. What I could not establish

- The verbatim text, headings, tables, or images of the original user note.
- Whether the note was a copy of the Confluence page, meeting notes around it, or Jay's own annotations.
- Which specific figures on the compiled pages came from the note versus the Confluence page `…/5407965201/Expo+T-Shirt+Size+Optimization` (also unreachable: network is prohibited).
- The note's date, author, or frontmatter.

## Files relied on (vault-relative)

- `AGENTS.md`
- `.gitignore`
- `concepts/packaged-size.md`
- `queries/expo-t-shirt-size-optimization-2026-06-24.md`
- `queries/cookbook-packaged-size-warehouse-landing-2026-08-20.md`
- `queries/kds-bag-recommendation-feature-and-algorithm-2026-07-22.md`
- `queries/kds-pre-order-bag-recommendation-feasibility-2026-07-16.md`
- `queries/cookbook-physical-packaging-data-model-and-drone-eligibility-feasibility-2026-07-23.md`
- `queries/cookbook-weight-and-dimension-warehouse-observability-2026-08-18.md`
- `entities/kds.md`
- `Wonder/Glossary/IKC.md`
- `pilot/README.md`
- `pilot/AUDIT.md`
- `pilot/FILES.txt`
- `.knowlery/manifest.json`

## Files changed

- `ANSWER.md` (this file) — created, as instructed by the task. No other file was created, edited, moved, or deleted.
