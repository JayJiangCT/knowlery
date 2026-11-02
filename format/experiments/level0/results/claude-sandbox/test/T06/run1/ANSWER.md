# ANSWER — owner edit to the 2026-07-30 Zipline partner-contract Record

## What changed

Commit `244084f` ("Partner contract: dimensions also required (owner edit)", author Jay Jiang / `human:jay`, 2026-11-02) changed one sentence in the **frozen Summary** of `records/zipline-mvp-partner-confirmed-contract-2026-07-30.md`:

- before: "A fulfillment-capable direct-order Quote requires valid mass before Delivery Intent creation"
- after: "A fulfillment-capable direct-order Quote requires valid mass **and outer dimensions** before Delivery Intent creation"

Nothing else in the file changed: the Detail table still says "A Quote used for direct-order fulfillment requires valid package mass", no new `## Sources` line was added, frontmatter was untouched. The Record's evidence-scope digest moved from `sha256:980486cf…` (blob `e23d5c6f…`) to `sha256:9dc23efb…` (blob `aaf3640d…`), so every page pinning the old version was out of date.

## What it means for the vault

1. **It is an edit to a frozen Record (§6).** The Record is `status: current`, not `draft`, so its Summary/Detail should never be rewritten; new facts belong in a new Record with `followed_by`. The edit is not undone (per the task), but it is recorded in the Record's `## History` as `revised by human:jay`, and every citing page was reviewed.
2. **The new statement conflicts with current evidence in the vault.**
   - The Record's own Detail table (unchanged) says mass only.
   - The Create Quote API source (`Wonder/…/Zipline API Doc/Create Quote.md`) exposes `mass_grams` and no dimension fields; `records/zipline-drone-quote-and-package-eligibility-contract-2026-07-02.md` states "Quote accepts optional total mass but not dimensions".
   - The only artifact that takes dimensions is Pack (`Pack items into deliveries`), which is a separate call from Quote.
   - No partner source for "outer dimensions required at Quote" exists in the vault; the edit cites none.
   Per §8 (two current sources conflict and cannot be ranked; a single human edit against a document), this is a finding to surface, not a choice to make: the affected claim is marked `#disputed` and an Open question is raised. Nothing was superseded.
3. **Pages citing the Record as versioned evidence** (grep of `## Sources` lines): only two.
   - `concepts/drone-delivery-integration-strategy.md` (s10) — claims c10, c13, c16, c18, c19, c20 and open item q6. Only **c18** ("A direct-order Quote requires reliable mass…") is touched by the changed sentence; it is now `#disputed`. c10/c13/c16/c19/c20/q6 rely on parts of the Record the edit did not change and still hold.
   - `records/drone-mvp-medium-bag-outer-package-decision.md` (s7) — cites the Record only for the 338 × 254 × 205 mm / 2495 g envelope, which is unchanged; History line appended, no content change.
   All other references (legacy `queries/*` pages, Source notes, other Records) are plain wikilinks or legacy frontmatter `sources` lists, i.e. relationships rather than versioned evidence, and legacy pages are not restructured (§2a). Several legacy query pages still say "direct-order Quote requires mass" (e.g. `queries/zipline-sandbox-quote-mass-gating-contract.md`, `queries/1p-drone-delivery-eligibility-evaluation-trigger-and-revalidation-contract-2026-07-16.md`); they are consistent with the pre-edit Record and the API doc and were left alone.

## What the owner should do

Confirm whether Zipline actually stated that a fulfillment Quote needs outer dimensions (and cite the source), or whether the intent was "the package must be within the dimension envelope / Pack needs dimensions". If confirmed, the right move is a new Record (with `followed_by` on the 2026-07-30 Record) and a superseding claim for `^c18`; if not, the Summary sentence should be reverted by the owner. Until then `^c18` stays `#disputed` and `^q12` stays open.

## Files changed

| File | Why |
| --- | --- |
| `records/zipline-mvp-partner-confirmed-contract-2026-07-30.md` | §6: appended `2026-11-02 · revised by human:jay …` History line with old/new digests and blobs; frontmatter `updated`/`updated_by` set to `2026-11-02` / `human:jay` to reflect the actual last content change (provenance only). Summary/Detail left exactly as the colleague wrote them. |
| `concepts/drone-delivery-integration-strategy.md` | `^c18` marked `#disputed`; `^q12` opened in `## Open`; `s33` (the revised Record, new digest/blob) and `s34` (Create Quote schema, digest/blob) appended to `## Sources`; History line recording the review of c10/c13/c16/c19/c20/q6; frontmatter `updated`/`updated_by` set. Page `status` was already `disputed`. |
| `records/drone-mvp-medium-bag-outer-package-decision.md` | History line only: s7 version changed, cited envelope unaffected. |
| `log.md` | One line per write above, plus an after-the-fact line for the owner's unlogged commit. |
| `ANSWER.md` | This file. |

No git commit or push was made; the changes are in the working tree.

## Files read (vault-relative)

- `AGENTS.md`, `CONVENTIONS.md`, `.claude/CLAUDE.md`, `log.md`, `tools/digest.py`
- `records/zipline-mvp-partner-confirmed-contract-2026-07-30.md` (HEAD and `857de1b`/`573a3b6` versions via `git show`/`git rev-parse`)
- `concepts/drone-delivery-integration-strategy.md`
- `records/drone-mvp-medium-bag-outer-package-decision.md`
- `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Zipline API Doc/Create Quote.md` (field grep)
- `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Zipline API Doc/Zipline API Documentation Runtime Annotations - 2026-08-27.md` (grep)
- `records/zipline-drone-quote-and-package-eligibility-contract-2026-07-02.md` (grep)
- git history: `git log --stat`, `git show 244084f`
- vault-wide grep for `zipline-mvp-partner-confirmed-contract-2026-07-30` and for Quote/dimension requirement statements

## Not established

- Whether Zipline really requires dimensions on a fulfillment Quote. The cited Google Doc (s1 of the Record) is `no-snapshot`, so it cannot be re-read offline; the vault has no source supporting the new sentence.
- Why the owner made the edit (no commit body, no new source). The `updated_by` field I set is provenance from git, not proof of authorization or correctness (§4).
- Whether the Production Quote API differs from the documented/sandbox schema (already an open point in the runtime annotations).
