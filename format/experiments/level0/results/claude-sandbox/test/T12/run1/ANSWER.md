# ANSWER — MVP outer package for Zipline drone orders, and whether the decision stands

Date of this answer: 2026-11-02. Read-only task; the only file written is this one.

## Short answer

**What the vault records as current:** the MVP default outer package is the **new Medium Wonder bag, nominal 12 × 8.5 × 13 in**, per Rob Knudson's Weight and Dimension Eligibility PRD v26 as read 2026-10-19. Small may be used at IKC staff discretion; Large is out of scope. The original 2026-08-12 direction ("use the existing Medium bag because it fits the 3D-printed Pod sample", IKC Ops / Stephen Acciaioli) is already classed as historical by the Record itself.
— `records/drone-mvp-medium-bag-outer-package-decision.md` (`status: current`, `updated: 2026-10-19`), Summary and the "Current status (2026-10-19)" callout; source `s1` (PRD v26, `fetched:2026-10-19`, `no-snapshot`).

**Is it still in force?** The vault **does not establish that it is.** Three independent things cut against treating it as settled, and under CONVENTIONS §8 ("two sources that contradict each other are a finding to surface, never a choice to make silently") I am surfacing them rather than ranking them:

1. **A human marked the decision withdrawn on 2026-11-02, in a way the digest chain cannot see.** Commit `ec3f9eb` (Jay Jiang, "Medium bag note: decision withdrawn (frontmatter)") added `decision_status: withdrawn` to the frontmatter of the Source note `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Slack Clarification - Drone MVP Medium Bag Selection - 2026-08-12.md`. Per §7 a frontmatter-only change is *not* an evidence change: I recomputed the body digest with `tools/digest.py` and it is still `sha256:79548617cec2…`, matching `s2` in the Record and `s17` in `concepts/drone-delivery-integration-strategy.md`; only the blob moved (`deaef9a…` → `d07a7b6…`). So no digest-driven absorb would ever flag this. The flag gives no reason, date or scope: it is unclear whether it withdraws only the 2026-08-12 "existing Medium" direction (which the Record already calls historical) or the PRD v26 new-Medium default. It is a single human signal against a `current` Record — exactly the §8 case to stop and ask.

2. **A later-updated Source says the bag is not final.** `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/PRD/Drone Eligibility Check - MVP Plan - 2026-09-17.md` (`status: draft`, `updated: 2026-10-27`, i.e. eight days *after* the Record's PRD v26 reading) states in §2.1: "Zipline rejected Wonder's medium bag on 2026-09-17 and a replacement is being sourced; the plan … uses the dropbox interior as the envelope until then", and in risk 10: "**Bag not final.** Zipline rejected the medium bag; the replacement's inner dimensions and empty weight are unknown." This Source is cited by no Record or Knowledge page. It *may* be reconcilable (the rejected bag = the old existing Medium; v26 validated a different, new Medium), but the 2026-10-27 text still treats the bag as open, so I cannot rank it against the Record's `s1`.

3. **The Record's own evidence is weak for the current claim.** `s1` (PRD v26) is a URL with `no-snapshot`; nothing in the vault can recover what v26 said. The Record also lists under "Not Confirmed": the Zipline test report, the SKU, tare, fill/fold limits, and a signed physical profile.

## Further evidence bearing on whether the decision stands

- **Record integrity (§6):** `records/drone-mvp-medium-bag-outer-package-decision.md` is dated 2026-08-12 but its frozen Summary/Detail were rewritten (History: "2026-10-19 · revised by process:cook · Current status (2026-10-19)" and "2026-08-20 · revised by process:cook …") instead of a new Record with `followed_by`. §6 says every page citing it then needs review: `records/1p-drone-delivery-checkout-package-dimensions-contract-2026-07-16.md` (s15), `records/zipline-pack-as-eligibility-oracle-direction-2026-08-20.md` (s7), `concepts/drone-delivery-integration-strategy.md` (s18). The Record's evidence-scope digest today (`sha256:fd7e1f24…`) matches those citations, so the pins were taken after the rewrite.
- **Citing pages disagree with each other:**
  - `concepts/drone-delivery-integration-strategy.md` `^c17` (status of page: `disputed`, but the dispute is about launch dates, `^c24`/`^q1`, not the bag) still says the outer package "is the existing Medium bag … bag and guest-packaging samples still need testing" — the 2026-08-12 state.
  - `records/1p-drone-delivery-checkout-package-dimensions-contract-2026-07-16.md` (`updated: 2026-09-29`) carries a 2026-09-20 warning: "The earlier existing-Medium direction is no longer a final package decision. Stephen has requested two new bag sizes …", and its History has "2026-09-29 · contradiction recorded in 1.x against [[drone-mvp-medium-bag-outer-package-decision]] · kept in Detail".
  - `records/zipline-pack-as-eligibility-oracle-direction-2026-08-20.md` repeats the PRD v26 new-Medium default (2026-10-19).
- **Planning sources:** `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/CrossTeam/1P Drone Delivery MVP Iteration Plan SP20-SP23 - 2026-09-18.md` lists "Finalize bag/provider configuration" as TBD for Ops / Rob / Zipline.
- **What the Slack Source itself claims (unchanged body):** it "selects the existing Wonder Medium bag as the preferred MVP outer package and rejects a newly produced drone-specific bag", and explicitly does not pin which Medium, a folded height, fill line, or complete the sample test.
- **Unaffected by all this:** the Zipline provider envelope `338 × 254 × 205 mm / 2495 g` (`records/zipline-mvp-partner-confirmed-contract-2026-07-30.md`, cited as s7) is a separate fact and is not touched by the bag question.

## Digest / version checks performed

All `## Sources` lines of the Record that point into the vault still match: s2 `79548617…`, s3 `b4e93403…`, s4 `a3275215…`, s5 `508fb12c…`, s6 `f6ed62d1…`, s7 `980486cf…`, s8 `811e891e…`, s13 `933f991a…` (recomputed with `python3 -I tools/digest.py`). Blobs for s5/s7/s13 differ from the pinned blobs only because commit `e9f53e9` ("pin source versions") rewrote their `## Sources` lines, which §7 says is not an evidence change.

## Recommendation (not performed — the task did not ask for vault changes)

Mark the "new Medium 12 × 8.5 × 13 in default" conclusion `#disputed`, open a question on `records/drone-mvp-medium-bag-outer-package-decision.md` / `concepts/drone-delivery-integration-strategy.md#^c17` citing (a) commit `ec3f9eb`'s `decision_status: withdrawn` as a `human:jay` attestation `stated:2026-11-02`, and (b) the MVP Plan's 2026-10-27 "Bag not final"; then ask Jay / Rob Knudson / Stephen Acciaioli what "withdrawn" covers and whether PRD v26's new Medium still stands.

## Files relied on (vault-relative)

- `AGENTS.md`, `CONVENTIONS.md`, `.claude/CLAUDE.md`, `log.md`
- `records/drone-mvp-medium-bag-outer-package-decision.md`
- `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Slack Clarification - Drone MVP Medium Bag Selection - 2026-08-12.md` (and its git history: commit `ec3f9eb`)
- `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/PRD/Drone Eligibility Check - MVP Plan - 2026-09-17.md`
- `records/1p-drone-delivery-checkout-package-dimensions-contract-2026-07-16.md`
- `records/zipline-pack-as-eligibility-oracle-direction-2026-08-20.md` (grep of bag passages and Sources)
- `concepts/drone-delivery-integration-strategy.md`
- `concepts/packaged-size.md` (checked; confirms it does not cover drone outer-package eligibility)
- `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/CrossTeam/1P Drone Delivery MVP Iteration Plan SP20-SP23 - 2026-09-18.md` (grep)
- `Wonder/Wonder Fulfillment/Sprints/2026/SP20-21/Agenda/Meeting Notes - 20260929.md`, `…/Speaking Notes - 2026-09-30.md`, `Wonder/…/Raw/Investigation - Cookbook Weight and Dimension Backfill Review - 2026-10-26.md` (grep only; no bag-decision content)
- `tools/digest.py` (run, not edited); git log/show of commits `ec3f9eb`, `e9f53e9`

## Unable to establish

- Whether `decision_status: withdrawn` refers to the 2026-08-12 existing-Medium direction only or to the current new-Medium default, and why it was set.
- The content of PRD v26 (`s1` is `no-snapshot`), hence whether "new Medium 12 × 8.5 × 13 in validated by Zipline" and the MVP Plan's "Zipline rejected the medium bag / bag not final" describe the same or different bags.
- The bag SKU, tare, tested fill/fold limits and the Zipline test report (the Record itself lists these as Not Confirmed).
