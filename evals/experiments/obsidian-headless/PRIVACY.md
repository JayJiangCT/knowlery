# Privacy — what is published here and what stays local

The benchmark ran on a private Work Vault that contains employer-internal material. This repository is
**public**. Only scrubbed artifacts are committed.

## Committed (public)

| File | Contents | Why it is safe |
|---|---|---|
| `REPORT.md`, `METHOD.md`, `PRIVACY.md` | Method, aggregate metrics, case analysis | Cases are referenced by question ID (`G0xx`) and category, and described by retrieval mechanism only. No question text, page titles, names, project or partner names, or excerpts. |
| `results.json` | Per-question ranks and metrics for every group | Question IDs, category, confidence; pages are pseudonyms (`P0001`…) plus a coarse class (`compiled:entities`, `user-note`, `reference:team-kb`, `bundle`, `root`). No paths, terms or text. |
| `scripts/*.ts` | Runners, shared plan, scorers | No vault content. Private locations are CLI arguments, not constants. |
| `fixture-results/` | Headless run on the repo's own synthetic fixture | Fixture paths are already public. Absolute local paths were replaced with `<fixture-copy>`, `<repo>`, `<local>`. |

## Kept local only (never committed, never uploaded)

Stored in a private folder outside any repository on the Owner's machine:

- The snapshot vault (3,934 Markdown files) and its sha256 manifests (pre-run, after-plugin, post-run).
- Work Vault `.md` hash manifests (pre- and post-run).
- Golden set with questions, real paths, key claims and labeling notes (`golden.local.yaml`), the frozen
  scoring form (`golden.frozen.json`), runner input (`questions.runner.json`), freeze hashes and timestamp.
- Raw runner output for every group and pass, including commands and query terms (`runs/**`), plus logs.
- `scored.pass1.local.json` (per-question results with real paths) and `pseudonyms.local.json`
  (the `P####` → path mapping).

The Owner can re-identify any public row using `pseudonyms.local.json`. A Cloud reviewer cannot, by design.

## Scanning performed before commit

1. `results.json`: a structural audit walked every key and string value. Every value matched a whitelist
   (question IDs, `P####`, category and class labels, confidence levels, schema id, timestamp). There were
   0 non-matching strings.
2. Every committed file: a scripted scan for the private folder and home paths; for every compiled page
   slug and person-name token in the vault (370 terms); for employer, partner and product names
   (case-insensitive, plus a case-sensitive pass for capitalized product names); for ticket-ID patterns;
   and for CJK characters. The only remaining matches are generic English words (for example "agent",
   "post") and the public fixture's own content (CJK file names, "enterprise"). One domain-specific probe
   term in `run-obsidian.ts` was found and redacted.
3. The branch adds a single commit on top of `develop/2.0`, so the staged-diff scan is also the history
   scan.

## Residual risk

- Aggregate numbers and category counts reveal the vault's approximate size (3.9k Markdown files) and
  that it covers delivery and product work. The Owner accepted this level by asking for a public PR.
- Case descriptions mention generic roles ("a person page", "project hub pages"). They do not name them.
