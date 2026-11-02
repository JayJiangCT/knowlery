# ANSWER — owner edit to the 2026-07-30 Zipline partner-contract Record

## What changed

Commit `7e01dd5` ("Partner contract: dimensions also required (owner edit)", author Jay Jiang, `human:jay`) changed one sentence in the `## Summary` of `records/zipline-mvp-partner-confirmed-contract-2026-07-30.md`:

- before: "A fulfillment-capable direct-order Quote requires valid mass before Delivery Intent creation"
- after: "A fulfillment-capable direct-order Quote requires valid mass **and outer dimensions** before Delivery Intent creation"

Nothing else in the file changed. The Summary is inside the Record's frozen evidence scope (CONVENTIONS §6), so this is an evidence change:

| | before (pinned by citing pages) | after (HEAD) |
|---|---|---|
| evidence-scope digest | `sha256:980486cf4584dcfc03f4b58f2c58330c23e6098b72bb14db5127e717ff28be2a` | `sha256:9dc23efb43893253e334e409774fd52a34760179d2003d08c7524a708f047e00` |
| whole-file blob | `9fef7255…` (pin commit `6bc42c3`) / `e23d5c6f…` (parent of the edit; same digest) | `aaf3640da0e5b644c63538ba2764b2eea51046c3` |

## What it means for the vault

The edit is not supported by anything else in the vault, and it is contradicted by three things:

1. The same Record's `## Detail` table ("Quote mass by lifecycle role") still says a fulfillment Quote "requires valid package mass" and nothing about dimensions. The Record now disagrees with itself.
2. The Create Quote API schema (`Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Zipline API Doc/Create Quote.md`) has a `mass_grams` field and no dimension fields.
3. The sandbox evidence (`Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Zipline Sandbox Quote Mass Validation Evidence - 2026-08-11.md`) shows Delivery Intent being gated on mass only.

Under §8 this is a single human statement against documents, which is not something to resolve on my own. So I did not undo the edit, did not propagate "dimensions required" into any Knowledge page, and did not supersede any claim. I surfaced the conflict: the one claim that depends on the changed sentence is now `#disputed` with an `## Open` question, and the Record carries a History line saying its frozen scope was revised.

Only two pages cite the Record with a pinned version (`sha256:980486cf…`):

- `concepts/drone-delivery-integration-strategy.md` (migrated Knowledge page, source `s10`). Claims citing s10: `^c10`, `^c13`, `^c16`, `^c19`, `^c20`, and question `^q6`. They cite it for provider-contract gaps, Pack, the package envelope, custody, and drop-off; the edit touches none of those, so they hold. `^c18` ("A direct-order Quote requires reliable mass …", src s10 only) is the claim whose source sentence changed, and the new wording is contested by the evidence above, so it is marked `#disputed` rather than superseded.
- `records/drone-mvp-medium-bag-outer-package-decision.md` (Record, source `s7`). Cites the partner Record only for the 338 × 254 × 205 mm / 2495 g envelope, which did not change. Reviewed, unaffected; new version appended as `s15`.

Roughly 25 other pages under `queries/`, `records/` and `Wonder/` link to the Record by plain wikilink or in a legacy `sources:` frontmatter list. Those are relationships, not versioned evidence (§1, §2a), and the legacy `queries/` pages are dated snapshots that must not be restructured. Left unchanged.

The `derived` fingerprint of `^c18` is unchanged by adding `#disputed` (`sha256:9fbfaedc…`); no page cites `[[drone-delivery-integration-strategy#^c18]]` anyway.

## Files changed

| File | Why |
|---|---|
| `records/zipline-mvp-partner-confirmed-contract-2026-07-30.md` | §6: appended a `## History` line recording that the owner revised the frozen scope (commit, old → new digest, the contradiction, "citing pages need review"). Set `updated: 2026-11-02`, `updated_by: human:jay` so provenance matches the actual last content change. Summary, Detail, Sources, status and verified fields untouched. |
| `concepts/drone-delivery-integration-strategy.md` | Appended `#disputed` to `^c18` (id kept as last token); added `^q12` in `## Open` describing the three-way conflict and pointing at `[[#^c18]]`; appended `s33` in `## Sources` for the new Record version (`sha256:9dc23efb…`, `blob:aaf3640d…`); added a History line listing the reviewed, unaffected claims; bumped `updated`/`updated_by` to `claude/fable-5.1` and the `description` as-of date to 2026-11-02. Page `status` was already `disputed`. |
| `records/drone-mvp-medium-bag-outer-package-decision.md` | Append-only: `s15` for the new Record version and a History "reviewed, envelope citation unaffected" line. Summary/Detail/`updated` untouched (frozen Record; digest verified unchanged). |
| `log.md` | New `## 2026-11-02` section, one line per write, newest first. |
| `ANSWER.md` | This file. |

No `git commit` or push; working tree left modified.

## Paths relied on

- `AGENTS.md`, `CONVENTIONS.md`, `tools/digest.py`
- `records/zipline-mvp-partner-confirmed-contract-2026-07-30.md` (HEAD and `6bc42c3` / `e23d5c6` versions via git)
- `concepts/drone-delivery-integration-strategy.md`
- `records/drone-mvp-medium-bag-outer-package-decision.md`
- `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Zipline API Doc/Create Quote.md`
- `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Zipline Sandbox Quote Mass Validation Evidence - 2026-08-11.md`
- `log.md`

## Not established

- Whether Zipline actually said outer dimensions are required for a fulfillment Quote. The Record's primary source (`s1`) is a Google Doc cited `fetched:2026-07-30 · no-snapshot`, so it cannot be re-read offline; nothing in the vault supports the new wording. Only the owner can confirm what prompted the edit.
- Whether "outer dimensions" means a Quote request field (none exists in the API doc), a Wonder-side eligibility precondition (which `^c16` already covers as the 338 × 254 × 205 mm envelope), or a Pack-path requirement (Pack does take item dimensions). If it is the second or third, the Summary sentence is a wording conflation rather than a new provider fact, and `^c18` could be un-disputed without a new claim.
- The pinned `blob:9fef7255…` on the old citations differs from the pre-edit blob `e23d5c6f…` although both have the same evidence digest (frontmatter-only difference between the baseline and pin commits). Not an error; noted so nobody "fixes" it.
- None of this is enforced by any tool (§9); `protected` is absent on all three pages, so no protected claim was touched.
