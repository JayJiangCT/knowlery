# ANSWER — owner edit to the 2026-07-30 Zipline partner-contract Record

## What changed

Commit `f09aba1` ("Partner contract: dimensions also required (owner edit)", author Jay Jiang, 2026-10-30) changed one sentence in the frozen `## Summary` of `records/zipline-mvp-partner-confirmed-contract-2026-07-30.md`:

- before: "A fulfillment-capable direct-order Quote requires valid mass before Delivery Intent creation"
- after:  "A fulfillment-capable direct-order Quote requires valid mass **and outer dimensions** before Delivery Intent creation"

Nothing else changed: no new `## Sources` line, no History line, frontmatter untouched (`updated` still said 2026-09-15 / process:cook). The Record's evidence-scope digest moved from `sha256:980486cf…` (identical at baseline `77a8727` and pin commit `c298e4b`) to `sha256:9dc23efb43893253e334e409774fd52a34760179d2003d08c7524a708f047e00`; blob `9fef7255…` / `e23d5c6f…` → `aaf3640d…`.

## What it means

1. **It is an edit to the frozen part of a Record** (CONVENTIONS §6). The rule is: do not undo it, append `revised by` to its History, and treat every page citing it as needing review. Done.
2. **It is an unsupported claim change, not a mere wording fix.** Inside the same Record, the Detail table ("Quote mass by lifecycle role") and the eligibility rule still say mass only; the Create Quote API doc (`Wonder/.../Zipline API Doc/Create Quote.md`) has `mass_grams` and no dimension fields; the 2026-08-11 sandbox evidence gates Intent on mass only. Dimensions are inputs to the separate Pack endpoint (`/v1/pack/`, `width_mm`/`height_mm`…), so the edit may conflate the Pack path with the Quote path, or may reflect a newer partner answer that is not in the vault. Per §8 (single human statement against documents, no rankable source) this is a finding to surface, not a choice to resolve.
3. **Citing pages.** Two migrated pages pin this Record's version:
   - `concepts/drone-delivery-integration-strategy.md` (s10) — claim `^c18` ("A direct-order Quote requires reliable mass…") is directly affected: marked `#disputed`, question `^q8` opened, new version pinned as s33, Create Quote doc pinned as s34 for the counter-evidence. Claims `^c10`, `^c13`, `^c19`, `^c20` also cite s10 but the statements they rely on (single-delivery gap, Pack not mandatory, custody boundary, drop-off not exposed) are unchanged in the new version, so they stand.
   - `records/drone-mvp-medium-bag-outer-package-decision.md` (s7) — cites the Record only for the 338 × 254 × 205 mm / 2495 g envelope, which is unchanged; review note appended, new version pinned as s15, no content revision.
   The many legacy `queries/*.md` pages and Sources that wikilink the Record are plain links (not versioned evidence) and legacy pages are not restructured (§2a); several still say "Quote requires mass" and would need attention if the dimensions requirement is confirmed.

## Files changed and why

| File | Change |
|---|---|
| `records/zipline-mvp-partner-confirmed-contract-2026-07-30.md` | `updated: 2026-10-30`, `updated_by: human:jay` (provenance of the actual last change); History line `2026-10-30 · revised by human:jay · …` describing the frozen-part edit and digest change. Colleague's Summary text kept as is. |
| `concepts/drone-delivery-integration-strategy.md` | `^c18` → `(src: s10, s33) #disputed`; `^q8` added to `## Open`; `s33` (new Record version, sha256:9dc23efb…, blob aaf3640d…) and `s34` (Create Quote API doc, sha256:059b57ec…, blob c664f361…) appended; History line; frontmatter `updated`/`updated_by` set to 2026-10-30 / claude-code/fable-5.1 (status already `disputed`). |
| `records/drone-mvp-medium-bag-outer-package-decision.md` | `s15` appended pinning the new Record version; History review line stating the envelope claim is unaffected (Sources/History appends only; evidence scope untouched). |
| `log.md` | Four lines under `## 2026-10-30` for the writes above. |
| `ANSWER.md` | This file. |

## Paths relied on

- `AGENTS.md`, `CONVENTIONS.md`, `.claude/CLAUDE.md`, `log.md`, `tools/digest.py`
- `records/zipline-mvp-partner-confirmed-contract-2026-07-30.md` (HEAD and `git show 77a8727:` / `c298e4b:` / `f09aba1`)
- `concepts/drone-delivery-integration-strategy.md`
- `records/drone-mvp-medium-bag-outer-package-decision.md`
- `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Zipline API Doc/Create Quote.md`
- `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Zipline API Doc/Pack items into deliveries.md` (grep only)
- grep across `Wonder/`, `records/`, `queries/`, `concepts/` for citations of the Record

## Not established

- **Why** the owner made the edit and on what evidence: the commit carries no source; no Source note in the vault dated after 2026-09-15 mentions a dimensions requirement for Quote. Only human:jay can answer `^q8`.
- Whether `^c18` should be superseded (if a partner answer confirms dimensions are required for Quote) or the Summary sentence should itself be corrected (if it conflated Pack with Quote). I did neither.
- The legacy `queries/` pages that restate "Quote requires mass" were not modified (§2a legacy rule; the dispute is unresolved).
- Nothing enforces freezing or `protected` here (§9); the edit was only detectable via git history.
