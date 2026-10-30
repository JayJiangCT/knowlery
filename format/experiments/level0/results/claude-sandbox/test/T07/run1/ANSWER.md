# ANSWER — recovering the missing source on `packaged-size`

## Answer

**The exact text of `Wonder/Other Team/IKC/Expo T-Shirt Size Optimization` cannot be recovered from this vault.** Nothing in the vault holds a copy, a digest, or a git blob of it, so I cannot state what the source said; I can only state what the page relied on it for and what the vault records about that dependency.

### What can be established

1. **The dependency is recorded on the page itself.** `concepts/packaged-size.md` cites the note as source `s6`:
   `- s6 · [[Wonder/Other Team/IKC/Expo T-Shirt Size Optimization]] · unverified · source · file not present in the Pilot checkout · missing from vault at build`
   The version is `unverified` and there is no `blob:` field. Per CONVENTIONS §7, only a `blob:` recovers text; `unverified` recovers nothing. The compiler (`process:cook`, 2026-08-20) already knew the file was absent when it cited it.

2. **Only one claim depends on s6.** `^c5`: "The assignment rule is Kitchen Design's Expo T-Shirt Size Optimization (Jakob, 2026-06-24), an audit of container SKUs, not a Cookbook formula on the food itself (src: s4, s5, s6)". s6 is one of three sources for that claim; s4 and s5 are independent of it. No other claim, the Evidence tables included, cites s6. So the missing note does not leave any claim unsupported — `^c5` still rests on s4 (verified) and s5 (URL, `fetched:2026-08-20`, no snapshot).

3. **The source is confirmed absent, now and historically.** `Wonder/Other Team/` does not exist in the working tree; `git ls-tree -r HEAD` lists no path under it; `git log --all --name-only` shows the path was never committed in the available history (the clone is shallow, grafted at `cf9e378`, so pre-pilot history is unavailable); `git fsck --lost-found` finds no dangling blobs. `.knowlery/manifest.json` and `config.json` contain nothing about it.

4. **The closest surviving material is the legacy compiled page `queries/expo-t-shirt-size-optimization-2026-06-24.md`** (cited by `packaged-size` as `s4`, `sha256:10b7…6d33`, `blob:bfe96986…`). I recomputed its digest with `tools/digest.py` and checked `git rev-parse HEAD:<path>`; both match the s4 line exactly, so s4 is verified. That page lists the missing note in its frontmatter `sources` and says in its body: "Jakob's Kitchen Design page under *Expo Discussion Notes - 6/24/26*. Captured as a user note at `Wonder/Other Team/IKC/Expo T-Shirt Size Optimization.md`." It is a legacy 1.x page (no `updated_by`), i.e. a dated *summary* of the Confluence page / user note, not a copy of it. It carries the content `packaged-size` relies on (34-SKU audit; footprint bins XS <10 / S <35 / M <65 / L <100 in²; 5 outlier SKUs; legacy weights 0.25/0.5/1/2 vs optimized 0.125/0.5/1/1.5; Expo shelf simulation; 3.8% fit / 96.2% overflow). This is the best available proxy for what the note said, but it is a paraphrase by a compile process, not source text.

5. **Other pages also recorded the dependency** (frontmatter `sources` or body references to the same path): `queries/kds-bag-recommendation-feature-and-algorithm-2026-07-22.md`, `queries/cookbook-packaged-size-warehouse-landing-2026-08-20.md`, and `queries/expo-t-shirt-size-optimization-2026-06-24.md`. None quotes the note.

### What cannot be established

- The note's actual wording, structure, author attribution, or capture date.
- Whether the note was a verbatim capture of the Confluence page (s5) or Jay's own notes on it — the vault only asserts it was "captured as a user note".
- Whether the note contained anything beyond what `queries/expo-t-shirt-size-optimization-2026-06-24.md` summarises.
- Whether s5 (Confluence URL) still says what the summary says; it is `no-snapshot` and the network is off-limits here.

### Recommendation (not performed; vault unchanged)

If the note is needed as evidence, it must be re-supplied by its owner (restore the file or re-capture from the Confluence page, `s5`). Until then the honest state of `^c5` is: supported by s4 + s5, with s6 as an acknowledged, unrecoverable citation. No supersession or `#disputed` is warranted, since the two remaining sources agree and are not contradicted.

## Files relied on (vault-relative)

- `AGENTS.md`
- `CONVENTIONS.md`
- `.claude/CLAUDE.md`
- `concepts/packaged-size.md`
- `queries/expo-t-shirt-size-optimization-2026-06-24.md`
- `log.md`
- `tools/digest.py` (run, read-only, on the s4 page)
- `.knowlery/manifest.json` (grep only)
- `entities/kds.md`, `queries/kds-bag-recommendation-feature-and-algorithm-2026-07-22.md`, `queries/kds-pre-order-bag-recommendation-feasibility-2026-07-16.md`, `queries/cookbook-packaged-size-warehouse-landing-2026-08-20.md` (grep / single-line reads for references to the missing path)
- git metadata, read-only: `git log --all --name-only`, `git ls-tree -r HEAD`, `git cat-file -t`, `git rev-parse HEAD:<path>`, `git fsck --lost-found`, `.git/shallow`

## Files changed

- `ANSWER.md` — created (this file). No other file was created, edited, moved or deleted; nothing was committed.
