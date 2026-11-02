# ANSWER — Recovering the missing `Expo T-Shirt Size Optimization` source for `packaged-size`

## Short answer

**The exact text of `Wonder/Other Team/IKC/Expo T-Shirt Size Optimization.md` cannot be recovered from this vault.** The file is not present, it is not in git history, and no page in the vault quotes it verbatim. What *can* be recovered is a close, structured paraphrase of the content the `packaged-size` page relied on, because that content was compiled into a dedicated query page, `queries/expo-t-shirt-size-optimization-2026-06-24.md`, which cites the same missing note as its source and which `packaged-size` cites alongside it.

## What the `packaged-size` page took from that source

Every claim in `concepts/packaged-size.md` that depends on the missing note is reproduced (in paraphrase, with numbers) in `queries/expo-t-shirt-size-optimization-2026-06-24.md`:

| Claim on `packaged-size` | Where it is recorded in the vault |
| --- | --- |
| Assignment rule authored by Jakob (Kitchen Design), dated 2026-06-24, under *Expo Discussion Notes – 6/24/26* | `queries/expo-t-shirt-size-optimization-2026-06-24.md` (intro + `sources:`) |
| It is an audit of **34 container/packaging SKUs** (`90*` bowls, tins, clamshells, pulp), not a Cookbook formula on food | same page, "What is being sized" |
| Footprint-area bins: XS < 10.0 in², S < 35.0 in², M < 65.0 in², L < 100.0 in² (2D base area, not 3D volume) | same page, "Rule 1"; also the identical table on `concepts/packaged-size.md` |
| Legacy weights `0.25 / 0.5 / 1 / 2`; optimized weights `0.125 / 0.5 / 1 / 1.5` from average area ratios; Medium = 1; optimized weights **not** what KDS uses | same page, "Rule 2" (adds SKU counts 3/15/12/4 and avg areas 5.86/25.06/48.37/75.04 in²) |
| No XL row in the audit; XL in KDS is a bundle/vending construct | same page, "Rule 2" |
| Expo shelf simulation: under current t-shirt rules most "fits" still overflowed with real dimensions | same page, "Rule 3": only **3.8%** of simulated orders that fit by t-shirt weight fit when packed with real dimensions (96.2% overflow); spot profiles Gravity Fed 97.90%, Ambient Standard 98.60%, Hot Standard 95.70% |
| 5 of 34 SKUs reclassified (9000636, 9003111, 9001638, 9000370, 9000039) | same page, "Rule 1" outlier table (not repeated on `packaged-size`) |
| Next steps: CE validation of reclasses, rerun on historical orders, simulate demand impact | same page, final paragraph of "Rule 3" |

Neither page contains a direct quotation from the note. The one blockquote on `concepts/packaged-size.md` (the `[!important]` callout) is the compiler's own wording, not a quote. So the *wording* of the source is lost; the *facts and numbers* the page used are preserved on the query page.

## What records the page's dependency on the missing note

1. `concepts/packaged-size.md` frontmatter `sources:` lists `Wonder/Other Team/IKC/Expo T-Shirt Size Optimization.md` (last entry), immediately after the Confluence URL `https://wonder.atlassian.net/wiki/spaces/~7120200ee1df0596dc4514b0733807c1362aa9/pages/5407965201/Expo+T-Shirt+Size+Optimization` — i.e. the user note was a local capture of that Confluence page.
2. `queries/expo-t-shirt-size-optimization-2026-06-24.md` states in its body: "Captured as a user note at `Wonder/Other Team/IKC/Expo T-Shirt Size Optimization.md`", and lists the same path in `sources:`. This is the clearest in-vault record of the dependency and of the note's origin.
3. The same path also appears in `sources:` of `queries/cookbook-packaged-size-warehouse-landing-2026-08-20.md` and `queries/kds-bag-recommendation-feature-and-algorithm-2026-07-22.md`; `entities/kds.md`, `queries/cookbook-physical-packaging-data-model-and-drone-eligibility-feasibility-2026-07-23.md`, `queries/cookbook-weight-and-dimension-warehouse-observability-2026-08-18.md`, and `queries/kds-pre-order-bag-recommendation-feasibility-2026-07-16.md` depend on it transitively via wikilinks to the query page.
4. `pilot/README.md` ("Excluded: … other teams' KBs"; "Many `sources:` entries and wikilinks point to files that were intentionally excluded") and `pilot/AUDIT.md` §7, §9, §10 record *why* it is absent: `Wonder/Other Team/*` is another team's KB and was deliberately excluded from this sanitized copy; only paths were kept, "No excluded file content was copied", and the repo was initialised from a single root commit so excluded files are not in history.

## What I could and could not establish

**Established**
- The note existed in the source vault and was the local capture of Jakob's Confluence page (Expo T-Shirt Size Optimization, 2026-06-24).
- The substantive content `packaged-size` relied on (thresholds, weights, SKU count, simulation results) — recovered as structured paraphrase from the compiled query page.
- The note is absent by design (other-team KB excluded from the pilot), not by accident, and is unrecoverable from git (`git log --all --name-only` contains no `Wonder/Other Team/` path; the only commits are `cf9e378` and `ec08c0c`).

**Not established**
- The verbatim text, headings, layout, or any prose of the original note.
- Whether the note was a full copy of the Confluence page or an excerpt/summary; whether it had its own frontmatter or commentary by the user.
- The full 34-SKU table (only the 5 outliers and per-size aggregates survive).
- Anything the note contained that the compiler chose not to carry onto the query page.
- Confluence itself was not consulted (no network allowed), so the Confluence URL cannot be used here to fill the gap.

## Files relied on (vault-relative)

- `AGENTS.md`
- `concepts/packaged-size.md`
- `queries/expo-t-shirt-size-optimization-2026-06-24.md`
- `queries/cookbook-packaged-size-warehouse-landing-2026-08-20.md` (citing context)
- `queries/kds-bag-recommendation-feature-and-algorithm-2026-07-22.md` (citing context)
- `queries/cookbook-physical-packaging-data-model-and-drone-eligibility-feasibility-2026-07-23.md` (citing context)
- `queries/cookbook-weight-and-dimension-warehouse-observability-2026-08-18.md` (citing context)
- `queries/kds-pre-order-bag-recommendation-feasibility-2026-07-16.md` (citing context)
- `entities/kds.md` (citing context)
- `pilot/README.md`
- `pilot/AUDIT.md`
- `pilot/FILES.txt` (grep only)
- `.gitignore`, `.knowlery/config.json`, `.knowlery/manifest.json`
- Read-only `git log --all` over `.git`

## Files changed

- `ANSWER.md` (this file) — created at the vault root because the task asked for it. No compiled page, user note, or `log.md` was created or modified. No Activity Ledger record was written because `.knowlery/activity-disabled` exists.
