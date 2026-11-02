# ANSWER — recovering the text behind `packaged-size` source s6

## Answer

**The exact text of `Wonder/Other Team/IKC/Expo T-Shirt Size Optimization` cannot be recovered from this vault.** Nothing in the working tree or in git history holds it, and the citation was never pinned to a version that could recover it.

Grounds, in order of weight:

1. The `## Sources` line for s6 in `concepts/packaged-size.md` is:
   `- s6 · [[Wonder/Other Team/IKC/Expo T-Shirt Size Optimization]] · unverified · source · file not present in the Pilot checkout · missing from vault at build`
   It carries no `blob:` and no `sha256:`. CONVENTIONS.md §7 states that `blob:` is the only thing that recovers text and that a digest alone recovers nothing; here not even a digest exists.
2. The file is absent from the working tree. The folder `Wonder/Other Team/` does not exist; `Wonder/` contains only `Wonder Fulfillment/` and `Glossary/`.
3. The file has never been in this repository's history: `git rev-list --all --objects` and `git log --all --name-only` return no path matching "T-Shirt" under `Wonder/`; the only matching object is the Record `queries/expo-t-shirt-size-optimization-2026-06-24.md`. There are no dangling objects, no stashes, and only two branch heads (`main` at cf9e378, `level0-test-T07` at e20afa5). The initial commit c7daf22 describes the import as a "sanitized read-only Fulfillment/Dispatch subset", which is consistent with an `Other Team/IKC` note being excluded at import.
4. `Attachments/` holds no export, PDF or image of the page (only Parallel Search / Zipline material). `.knowlery/manifest.json` and `config.json` carry no source inventory.
5. The companion citation s5 (the Confluence URL for the same page) is `fetched:2026-08-20 · no-snapshot`, so it recovers nothing either, and the network is off-limits for this task.

## What can be established

- **Which claim depends on s6.** Exactly one claim on the page cites s6: `^c5` — "The assignment rule is Kitchen Design's Expo T-Shirt Size Optimization (Jakob, 2026-06-24), an audit of container SKUs, not a Cookbook formula on the food itself (src: s4, s5, s6)". No other claim, Evidence table or History line references s6.
- **The vault's only account of the note's content** is the Record cited as s4, `queries/expo-t-shirt-size-optimization-2026-06-24.md`. Its body says the page was "Captured as a user note at `Wonder/Other Team/IKC/Expo T-Shirt Size Optimization.md`" and lists that path in its frontmatter `sources`. Its content is a compiled paraphrase, not verbatim text: a 34-SKU packaging audit; footprint bins XS < 10.0 in², S < 35.0 in², M < 65.0 in², L < 100.0 in²; five reclassified outlier SKUs (9000636, 9003111, 9001638, 9000370, 9000039); legacy weights 0.25/0.5/1/2 versus optimized 0.125/0.5/1/1.5; an Expo shelf simulation (Gravity Fed / Ambient Standard / Hot Standard) and the 3.8% "fit" figure.
- **s4 is intact and matches its pin.** `tools/digest.py` on the Record yields `sha256:10b708090377068cda190e854d0b634ee0f9a516e2480e282f20044590546d33`, and `git rev-parse HEAD:queries/expo-t-shirt-size-optimization-2026-06-24.md` yields `bfe96986d30d9efd4123bf33914c7cc9d09a28c4`; both equal the s4 line. So the paraphrase the page actually relied on is exactly what is in the vault today.
- **Evidence-independence caveat.** s4 is downstream of s6 (the Record was written from the missing note), and s5 is the Confluence page that the note captured. For `^c5` the three sources are one evidence chain, not three independent witnesses. Also note s4 is a legacy 1.x page per CONVENTIONS §2a (`type: query`, no `updated_by`), so it is a dated snapshot without claim ids.
- **Pinning history of s6.** In the baseline commit a3d9610 the line already read `· @pin · source · file not present in the Pilot checkout`; commit e20afa5 ("pin source versions (14 pages)") rewrote `@pin` to `unverified` and appended `· missing from vault at build`. The build process knew the file was missing and recorded that fact rather than inventing a digest.

## What in the vault records the page's dependency on the missing source

| Location | What it records |
| --- | --- |
| `concepts/packaged-size.md`, `## Sources` line s6 | the citation itself, `unverified`, with the two "missing" annotations |
| `concepts/packaged-size.md`, claim `^c5` | `(src: s4, s5, s6)` — the only claim using s6 |
| `queries/expo-t-shirt-size-optimization-2026-06-24.md`, frontmatter `sources` and body first paragraph | "Captured as a user note at `Wonder/Other Team/IKC/Expo T-Shirt Size Optimization.md`" |
| `queries/cookbook-packaged-size-warehouse-landing-2026-08-20.md:27` | lists the path in frontmatter `sources` |
| `queries/kds-bag-recommendation-feature-and-algorithm-2026-07-22.md:27` | lists the path in frontmatter `sources` |
| git commits a3d9610 and e20afa5 | the "file not present in the Pilot checkout" / "missing from vault at build" annotations on s6 |

## Not established

- The verbatim text of the note `Wonder/Other Team/IKC/Expo T-Shirt Size Optimization.md`.
- The text of the Confluence page (s5); no snapshot in the vault, network not used.
- Whether the user note was a verbatim copy or an edited capture of the Confluence page, and whether the Record's paraphrase is complete or omits parts of it.
- Whether the note ever existed in the upstream (pre-sanitized) vault; this repo's history starts after the subset was cut.

## Paths relied on (vault-relative)

- `AGENTS.md`, `CONVENTIONS.md`
- `concepts/packaged-size.md`
- `queries/expo-t-shirt-size-optimization-2026-06-24.md`
- `queries/cookbook-packaged-size-warehouse-landing-2026-08-20.md`
- `queries/kds-bag-recommendation-feature-and-algorithm-2026-07-22.md`
- `tools/digest.py`
- `.knowlery/manifest.json`, `.knowlery/config.json`
- `Attachments/` (listing only), `Wonder/` (listing only)
- `.git` via read-only commands (`log`, `ls-tree`, `rev-list --all --objects`, `rev-parse`, `cat-file -t`, `show`, `fsck`, `grep`, `for-each-ref`, `stash list`)

## Files changed

- `ANSWER.md` (this file) — created. No other file in the vault was modified; `concepts/packaged-size.md` and `log.md` were left untouched because the task asked for an answer, not a vault change.
