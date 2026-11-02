# ANSWER — recovering the missing source behind `packaged-size`

## Answer

**The exact text cannot be recovered.** On `concepts/packaged-size.md` the missing note is cited as source `s6`:

```
- s6 · [[Wonder/Other Team/IKC/Expo T-Shirt Size Optimization]] · unverified · source · file not present in the Pilot checkout · missing from vault at build
```

Per `CONVENTIONS.md` §7, the only thing that recovers a cited resource's text is its `blob:<40 hex>` (`git cat-file -p <blob>`); a `sha256:` alone recovers nothing, and `s6` has neither a `blob:` nor a `sha256:` — its version is `unverified`. I also checked every commit in the repository (`git rev-list --all` + `git ls-tree -r`) and `git fsck --lost-found`: no path under `Wonder/Other Team/` has ever been committed, and there are no dangling objects. The `Wonder/` folder in the working tree contains only `Glossary` and `Wonder Fulfillment`. So the source text does not exist anywhere in this vault or its git history, and I will not reconstruct it.

### What the page relied on `s6` for

`s6` backs exactly one claim, and never alone:

- `[[packaged-size#^c5]]`: "The assignment rule is Kitchen Design's Expo T-Shirt Size Optimization (Jakob, 2026-06-24), an audit of container SKUs, not a Cookbook formula on the food itself (src: s4, s5, s6)".

Its co-sources are `s4` — the Record `[[expo-t-shirt-size-optimization-2026-06-24]]` (`sha256:10b708…46d33`, `blob:bfe96986…28c4`) — and `s5`, the Confluence URL (`fetched:2026-08-20`, `no-snapshot`). So `^c5` keeps two other sources; losing `s6` weakens but does not orphan it.

### What *can* be established about the missing note's content (indirectly)

The closest surviving account is the Record `queries/expo-t-shirt-size-optimization-2026-06-24.md` (a legacy 1.x compiled page: no `updated_by`, so read as a dated snapshot per §2a). It is intact and verifiable:

- `python3 -I tools/digest.py queries/expo-t-shirt-size-optimization-2026-06-24.md` → `sha256:10b708090377068cda190e854d0b634ee0f9a516e2480e282f20044590546d33`, matching `s4` on the page.
- `git rev-parse HEAD:queries/expo-t-shirt-size-optimization-2026-06-24.md` → `bfe96986d30d9efd4123bf33914c7cc9d09a28c4`, matching `s4`'s `blob:`.

That Record states it was compiled from the missing note ("Jakob's Kitchen Design page under *Expo Discussion Notes - 6/24/26*. Captured as a user note at `Wonder/Other Team/IKC/Expo T-Shirt Size Optimization.md`") and lists the note in its frontmatter `sources`. Its content — the 34-SKU audit, footprint bins (XS < 10.0 in², S < 35.0, M < 65.0, L < 100.0), 5 outlier SKUs, legacy vs optimized weights (0.25/0.5/1/2 vs 0.125/0.5/1/1.5), the Expo shelf simulation and the 3.8% fit figure — is therefore a **compiled paraphrase** of the source, not the source. It is evidence for what the page *understood* the note to say; it is not the note's exact text, and I cannot verify that it is a faithful rendering.

### What in the vault records the dependency

1. `concepts/packaged-size.md` — `## Sources` line `s6` (quoted above), with the explicit note `file not present in the Pilot checkout · missing from vault at build`; `(src: … s6)` on `^c5`; and `## History` line "2026-08-20 · [[#^c1]] to [[#^c25]] added · src: s1 to s11 · by process:cook".
2. Git history of that page:
   - `cf9e378` (pilot): the legacy page's frontmatter `sources` list did **not** include the IKC note (it cited the three `queries/` pages, the KDS Java files and the PRD URL).
   - `a314bc2` (baseline): migrated page carried `- s6 · [[Wonder/Other Team/IKC/Expo T-Shirt Size Optimization]] · @pin · source · file not present in the Pilot checkout`.
   - `f734e7f` ("pin source versions"): `@pin` resolved to `unverified` and `missing from vault at build` was appended — i.e. the build process itself recorded that it could not digest the file.
3. Legacy pages whose frontmatter `sources` list `Wonder/Other Team/IKC/Expo T-Shirt Size Optimization.md`: `queries/expo-t-shirt-size-optimization-2026-06-24.md` (also names it in its body), `queries/cookbook-packaged-size-warehouse-landing-2026-08-20.md`, `queries/kds-bag-recommendation-feature-and-algorithm-2026-07-22.md`.
4. `log.md` (2026-10-30): the vault was "built from Pilot cf9e378 + v0.3.1 overlay" — the Pilot checkout is the sanitized derivative from which the IKC note was excluded.

### Summary of what I can and cannot establish

| Can establish | Cannot establish |
|---|---|
| The note was a user-captured copy of Jakob's Kitchen Design Confluence page "Expo T-Shirt Size Optimization" (per `s5` URL and the Record's own statement). | Any exact sentence, table cell, or wording of the note. |
| The page relied on it only for `^c5`, alongside `s4` and `s5`. | Whether the note differed from the Confluence page or from the Record's paraphrase. |
| It has never been in this repository's git history; `s6` was marked unverifiable by the build itself. | A digest or blob to pin it to; whether a later version exists elsewhere (network use is forbidden here). |
| The Record `expo-t-shirt-size-optimization-2026-06-24` is intact and its digest/blob match `s4`. | That the Record is a faithful rendering of the missing note. |

Recommendation (not performed, since the task did not ask for vault changes): `^c5` stays `current` on the strength of `s4`+`s5`; if the owner wants the dependency resolved, re-add the note under `Wonder/Other Team/IKC/` and re-pin `s6` with `sha256:` and `blob:` per §7.

## Vault-relative paths relied on

- `AGENTS.md`
- `CONVENTIONS.md`
- `.claude/CLAUDE.md`
- `log.md`
- `concepts/packaged-size.md` (working tree, and at commits `cf9e378`, `a314bc2`, `f734e7f` via `git show`)
- `queries/expo-t-shirt-size-optimization-2026-06-24.md`
- `tools/digest.py` (run, not read)
- `.knowlery/manifest.json`
- Grep hits only (not read in full): `entities/kds.md`, `queries/cookbook-packaged-size-warehouse-landing-2026-08-20.md`, `queries/kds-bag-recommendation-feature-and-algorithm-2026-07-22.md`, `queries/cookbook-physical-packaging-data-model-and-drone-eligibility-feasibility-2026-07-23.md`, `queries/cookbook-weight-and-dimension-warehouse-observability-2026-08-18.md`, `queries/kds-pre-order-bag-recommendation-feasibility-2026-07-16.md`

## Files changed

- `ANSWER.md` — created (this file), as the task required.
- `log.md` — one line appended under a `## 2026-11-02` heading per CONVENTIONS §10, recording the ANSWER.md write.

No knowledge pages, Records or Sources were modified.
