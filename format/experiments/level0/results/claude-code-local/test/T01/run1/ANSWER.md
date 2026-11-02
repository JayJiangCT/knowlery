# ANSWER — three Zipline questions (answered from this vault only, 2026-11-02)

Method: read `AGENTS.md` and `CONVENTIONS.md`; found candidate pages by grepping `description:`; read `## Current` / `## Summary` / `## Detail`; followed `## Sources` to the cited Source where the answer hinged on it; verified one Source version with `tools/digest.py` and `git rev-parse HEAD:<path>`. No network. No commit. No vault page was edited; the only new file is this one.

---

## Q1. Single-Zip width: 252 mm or 254 mm? Can a direct-order Quote omit mass?

### Width — the vault's current layer says 254 mm, but the Source it cites says 252 mm. I am surfacing this as a conflict rather than picking.

**What the Record / Knowledge layer currently states (254 mm, replacing 252 mm on 2026-09-15):**

- `records/zipline-mvp-partner-confirmed-contract-2026-07-30.md`, "Current Payload Envelope (Week of 2026-09-07)": "Width is the only metric change: `252 mm` → `254 mm`. Length and height stay `338 mm` and `205 mm`." The rule block there is `width_mm <= 254`. The "Single-Zip package" row of the Confirmed Contract table says the 2026-07-30 dimensions "were `338 mm L × 252 mm W × 205 mm H`" and "The current hardware envelope revises width to `254 mm`."
- `records/zipline-drone-quote-and-package-eligibility-contract-2026-07-02.md`, "Cook Refresh (2026-09-15)": "Current Eligibility / Quote comparison uses width `254 mm`. The 2026-07-30 partner QA width `252 mm` is retained as historical."
- `concepts/drone-delivery-integration-strategy.md` claim `[[drone-delivery-integration-strategy#^c16]]`: "The current single-Zip provider limit, the current hardware maximum, is 2495 g and 338 × 254 × 205 mm" (src: s15, s16, s10). Note this concept page is `status: disputed`.
- `records/1p-drone-delivery-checkout-package-dimensions-contract-2026-07-16.md`: "That July width is superseded. The current hardware envelope is `338 × 254 × 205 mm / 2495 g`."

**Earlier answer the vault says was replaced:** 252 mm, from the 2026-07-30 partner QA (`records/zipline-mvp-partner-confirmed-contract-2026-07-30.md`, "Canonical Dual-Unit Package Limits (2026-07-30)": "Maximum width | `252 mm` | `9.92 in`"). Also stated in the superseded draft `records/zipline-mvp-final-partner-qa-working-draft-2026-07-26.md`: "`338 × 252 × 205 mm`".

**The conflict:** every 254 mm statement above traces, directly or via `queries/zipline-wonder-weekly-deck-readout-2026-09-15.md` line 92 (which itself cites the slide page), to one Source, `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Zipline Payload Dimensions Slide - Week of 2026-09-07.md`. That Source, in the exact version the Records pin, says the opposite:

> "The Envelope card states: `338 × 252 × 205 mm`. The Envelope card is the numeric payload envelope. It matches the 2026-07-30 partner QA of `338 × 252 × 205 mm`. The 3D width label `10 in / 254 mm` is a rounded-imperial pairing (`10 in = 254 mm`), not a 2 mm hardware change. ... **Do not treat `254 mm` as a superseding envelope width.**"

Verification that this is the same version the Records cite (not a later edit):
- `tools/digest.py` on the Source → `sha256:811e891e6b30a6ed6851a7b4fde7a026fbde7c7c7ac3387a2b9f109147770f0d`; matches s6 of the 07-30 Record, s13 of the 07-02 Record, s15 of the concept page.
- `git rev-parse HEAD:<path>` → `9b5a9ac7e6f58d29e933c6bf2c93b1a820f33e4c`; matches the `blob:` on the same three Source lines.
- The embedded images exist in the vault and are consistent with the Source text: `Attachments/zipline-payload-dimensions-wk-of-2026-09-07/payload-envelope-card-338-252-205.png` reads "Envelope 338 × 252 × 205 mm"; `.../payload-dimensions-3d-wk-of-2026-09-07.png` labels the bay `13.25" 338mm`, `10" 254mm`, `8" 205mm`. So the raw artifacts show both numbers; the Source author's reading is that the envelope card (252) is the limit and 254 is a rounded-inch label. The Records adopted the 3D label instead and do not mention the envelope card.

**My reading of what this means:** under CONVENTIONS §1 the Source is the evidence root and the Records' 254 mm is a derivation that its own cited Source contradicts. Under §8 two contradicting current statements are "a finding to surface, never a choice to make silently." So: the vault's **current recorded answer is 254 mm**; the **last width the cited evidence actually supports is 252 mm** (partner-confirmed 2026-07-30, and re-affirmed by the Source page's reading of the week-of-9/7 Envelope card). Whether Zipline intended a 2 mm hardware change is not established by anything in this vault. A human (Jay, who supplied the slide) should decide; the practical difference is whether a package 252–254 mm wide is eligible — and that is exactly the case in play: `records/drone-mvp-medium-bag-outer-package-decision.md` (`status: current`) says the August 2026 new Medium bag is `330 × 254 × 330 mm`, "matches envelope width exactly" against 254 mm, but "against the earlier 2026-07-30 envelope (`338 × 252 × 205 mm`) the same bag was 2 mm over on width." So the chosen outer bag is width-eligible only if 254 mm is right.

I also checked the other pages that mention 252/254 (`concepts/packaged-size.md` — the hit is a sha256 prefix, not a width; `records/packaging-signature-…-2026-08-13.md`, `records/drone-mvp-weight-gate-…-2026-08-18.md` — no width values). No current Knowledge-page claim states 252 mm, so the Knowledge layer is not split against itself; the split is Records/Knowledge (254) versus their pinned Source (252).

Supporting note: the 07-30 Record's `## History` shows its frozen Detail was "revised by process:cook" on 2026-09-15 (and 08-03, 08-04). §6 says an edited frozen scope means every page citing it needs review. The concept page cites it as s10 at `sha256:980486cf…` / `blob:9fef7255…`; today's scope digest is still `980486cf…` (match) but the HEAD blob is `e23d5c6f…` (differs). Per §7 that pattern means only non-evidence parts (frontmatter / Sources / History) changed after citation, so the concept page's citation is still evidence-valid.

### Mass — No, a direct-order (fulfillment) Quote cannot omit mass. The API will create a Quote without mass, but that Quote cannot be used for a Delivery Intent.

- `records/zipline-mvp-partner-confirmed-contract-2026-07-30.md`, Confirmed Contract row "Quote mass by lifecycle role": "A Quote used for direct-order fulfillment requires valid package mass. Create Quote also accepts omitted or `null` mass for the earlier RDP discovery use case." Source-precedence callout: "Create Quote accepts an omitted or `null` mass for non-binding discovery, but the resulting Quote must not be used for Delivery Intent."
- `records/zipline-drone-quote-and-package-eligibility-contract-2026-07-02.md`, "No-Mass Quote Semantics": "Create Quote accepts omitted or `null` mass for the RDP discovery request, while Create Delivery Intent rejects a Quote that lacks usable mass." Sandbox callout (2026-08-11): "Zipline staging created Quotes whose mass was `null` or `0`, but Create Delivery Intent rejected those Quote IDs."
- Primary Source `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Zipline API Doc/Create Quote.md`, line 4 annotation: "Although the OpenAPI schema makes `mass_grams` optional/nullable, Wonder must send an integer from `1` through `2495`. The sandbox created Quotes for omitted, `null`, `0`, and `2496`, but Create Delivery Intent rejected those Quote IDs."
- Legacy page (no `updated_by`, cite as record/unverified): `queries/zipline-discovery-vs-fulfillment-quote-mass-contract.md` adds that PRD v19 removed the no-mass RDP discovery use case from MVP scope, so in current product scope every Quote Wonder makes should carry valid positive mass.

**Earlier answer replaced:** the pre-2026-07-30 assumption that a no-mass Quote could be used for direct-order fulfillment. The 07-30 Record: "These 2026-07-30 partner answers supersede the assumption that a no-mass Quote can be used for direct-order fulfillment." The 07-26 draft `records/zipline-mvp-final-partner-qa-working-draft-2026-07-26.md` is `status: superseded` → `superseded_by` the 07-30 Record; it had posed the question open ("Please confirm whether a no-mass Quote can later create a Delivery Intent") and recorded the answer "Direct-order Quote requires `mass_grams`; a no-mass Wonder Quote is not supported." The 07-30 Record then narrowed that wording: mass-optional is a real API behaviour for discovery, just never for Intent.

---

## Q2. Drone Loading vs Dropbox Loading trade-off at a store

Page: `comparisons/zipline-loading-methods.md` (`type: comparison`, `status: current`, updated/verified 2026-09-15). No earlier replaced answer: its `## History` has only the 2026-09-15 "c1 to c19 added" line.

**Current answer (claims cited by id):**

- Trade-off in one line: Drone Loading is "operationally flexible and more tolerant of large payloads in the September test, but it requires a longer, precisely timed associate handoff" `[[zipline-loading-methods#^c1]]`; Dropbox Loading "shortens the associate action and is the intended repeatable infrastructure model, but it adds equipment, approvals, construction dependencies, and a demonstrated large-payload fit risk" `[[zipline-loading-methods#^c2]]`.
- Staff time: 2–3 minutes (Drone) vs about 1 minute (Dropbox) `[[#^c6]]`; Drone Loading must sync with aircraft arrival and the "load now" signal, Dropbox waits for a ready state `[[#^c7]]`.
- Infrastructure cost: Drone Loading needs no permanent equipment `[[#^c3]]` and only partner approval; Dropbox needs an installed Dropbox and partner, landlord and city approval `[[#^c4]]`, plus possible window/footing/curb/awning/roof work by site `[[#^c9]]`.
- Reliability: Drone Loading 12 of 12 deliveries across three payloads; Dropbox largest payload failed 3 of 6 pickups `[[#^c10]]`; the current Wonder bag/large packout needs a mitigation before Dropbox is operationally equivalent `[[#^c13]]`; do not generalize the test into a universal failure rate `[[#^c12]]`.
- Scaling: Dropbox has the stronger long-term store-labor model `[[#^c14]]`, but only after four conditions (site built and approved, package fits with buffer, Loading Manager exposes readiness/exceptions, store has a queue/exception process) `[[#^c15]]`; Drone Loading is the fallback / launch bridge `[[#^c16]]`.
- Decision rule: prefer Dropbox when site and bag are validated and the goal is repeatable low-touch handoff `[[#^c17]]`; prefer Drone Loading during early launch, construction dependency or payload-fit uncertainty `[[#^c18]]`; do not use packout discipline as the primary mitigation for a marginal Dropbox fit `[[#^c19]]`.

Evidence caveat: s1 is the Google Slides deck at `fetched:2026-09-15 · no-snapshot` (text not recoverable from the vault; the slide image `Attachments/zipline-x-wonder-weekly-2026-09-15/slide-03-loading-methods.png` is present); s2 is the legacy readout `queries/zipline-wonder-weekly-deck-readout-2026-09-15.md` (no `updated_by`). The readout's point 1 and the "Loading" section agree with the comparison page.

---

## Q3. What package does Zipline guarantee to carry in a single Zip, and when does Zipline take custody?

**Guarantee (current):** one approved standard outer package within all four limits — gross mass ≤ 2495 g, length ≤ 338 mm, width ≤ 254 mm per the Records / 252 mm per their Source (see Q1 conflict), height ≤ 205 mm — "uses exactly one initial Zip." Replacement after a failure is outside the guarantee, and Pack is not required to prove it.

- `records/zipline-mvp-partner-confirmed-contract-2026-07-30.md`, "Single-Zip package" row: "Maximum gross weight is `2495 g` ... One approved outer package within all four limits uses exactly one initial Zip. ... Operational replacement after a failure is outside this guarantee." Eligibility Service Impact: "The MVP does not need Zipline Pack merely to prove one-Zip capacity. Delivery Intent may still assert `expected_number_of_deliveries == 1` as a defensive provider-contract invariant."
- `records/zipline-drone-quote-and-package-eligibility-contract-2026-07-02.md`, "Partner-Confirmed Mass And Single-Zip Contract (2026-07-30)": "One approved outer package within all limits is guaranteed to use exactly one initial Zip; failure replacement is outside that guarantee."
- `[[drone-delivery-integration-strategy#^c16]]`: "one approved package within it guarantees one initial Zip."

**Earlier answers replaced:**
- Before 2026-07-30 there was no guarantee: the 07-02 Record's "Single-Delivery MVP Guardrail (2026-07-15)" says "Static Wonder weight and dimension rules are useful coarse filters, but the current documentation does not make them a single-delivery guarantee," and the strongest signal was Pack returning `metadata.total_deliveries = 1`. The 07-30 partner answer replaced this.
- The PRD loader reference `12.5 × 9.5 × 7.75 in` (= 317.5 × 241.3 × 196.85 mm) is "a superseded PRD loader reference, not a current maximum package envelope" (07-30 Record, Canonical Dual-Unit section); PRD v16 (2026-08-11) adopted `13.31 × 9.92 × 8.07 in` = 338 × 252 × 205 mm.
- Width 252 → 254 mm on 2026-09-15 per the Records; disputed by their own Source (Q1).

**Custody (current):** Zipline takes custody when the webhook reports `DELIVERY_INTENT_STATUS_IN_PROGRESS`, which "confirms successful P2 loading and transfer of custody to Zipline"; it is irreversible. After it the package is delivered or, on failure, taken near a Zipline charging site and discarded; it never returns to Wonder.

- `records/zipline-mvp-partner-confirmed-contract-2026-07-30.md`, "Custody transfer" row: "`DELIVERY_INTENT_STATUS_IN_PROGRESS` confirms successful P2 loading and transfer of custody to Zipline. | Persist this as the authoritative irreversible custody boundary and gate cancel, modify, address change, dining-option change, and original-package Reallocation."
- `records/zipline-dropbox-lock-custody-and-failure-disposition-contract-2026-07-28.md`, "Partner-Confirmed API Boundary (2026-07-30)": "Zipline confirmed that `DELIVERY_INTENT_STATUS_IN_PROGRESS` is the authoritative event that the P2 package was successfully loaded and custody transferred to Zipline. This closes the earlier open lock-event mapping." Summary: "The package is never returned to Wonder or placed back in the Dropbox, so the Zipline API wording that a failed delivery is returned to the Partner is misleading."
- `[[drone-delivery-integration-strategy#^c19]]`: "`DELIVERY_INTENT_STATUS_IN_PROGRESS` is the authoritative, irreversible custody boundary; food that fails after custody is discarded near a Zipline charging site and never returns to Wonder."

**Earlier answer replaced:** the 07-28 Record originally established only the physical rule (Rob Knudson attestation s2, 2026-07-28: Dropbox lock is irreversible) and listed the API event as open under "Remaining P0 API Contract": "Which API status/event is the authoritative Dropbox-lock and custody-transfer signal? Does `DELIVERY_INTENT_STATUS_IN_PROGRESS` exactly represent that boundary?" The 2026-07-30 partner answer closed it. Also replaced: the Zipline ReadMe's statement that a failed delivery is returned to the partner — "Dated direct Zipline answers override the incorrect return-to-partner statement" (07-30 Record, API documentation authority row; confirmed again 2026-08-04).

---

## Paths relied on (vault-relative)

- `AGENTS.md`, `CONVENTIONS.md`
- `records/zipline-mvp-partner-confirmed-contract-2026-07-30.md` (Q1, Q3)
- `records/zipline-drone-quote-and-package-eligibility-contract-2026-07-02.md` (Q1, Q3)
- `records/zipline-mvp-final-partner-qa-working-draft-2026-07-26.md` (superseded; Q1, Q3 earlier answers)
- `records/zipline-dropbox-lock-custody-and-failure-disposition-contract-2026-07-28.md` (Q3)
- `records/1p-drone-delivery-checkout-package-dimensions-contract-2026-07-16.md` (Q1 width, read via grep only)
- `records/drone-mvp-medium-bag-outer-package-decision.md` (Q1 width impact on the Medium bag, read via grep only)
- `concepts/packaged-size.md`, `records/packaging-signature-configuration-space-for-drone-eligibility-2026-08-13.md`, `records/drone-mvp-weight-gate-status-and-discrete-pivot-2026-08-18.md` (checked via grep for 252/254; no width claims)
- `concepts/drone-delivery-integration-strategy.md` (^c16, ^c19; page is `status: disputed`)
- `comparisons/zipline-loading-methods.md` (Q2)
- `queries/zipline-wonder-weekly-deck-readout-2026-09-15.md` (legacy; Q2 corroboration, Q1 width)
- `queries/zipline-discovery-vs-fulfillment-quote-mass-contract.md` (legacy; Q1 mass)
- `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Zipline Payload Dimensions Slide - Week of 2026-09-07.md` (Q1 width — the contradicting Source)
- `Wonder/Wonder Fulfillment/Projects/1P Drone Delivery/Zipline API Doc/Create Quote.md` (Q1 mass, line 4 annotation)
- `Attachments/zipline-payload-dimensions-wk-of-2026-09-07/payload-envelope-card-338-252-205.png`, `.../payload-dimensions-3d-wk-of-2026-09-07.png` (Q1 width, viewed)
- `tools/digest.py` (version check); `git rev-parse`, `git log` (read-only)

## Unable to establish

1. **Whether the single-Zip width limit is 252 mm or 254 mm.** The vault's Records say 254; their sole cited Source (verified same digest and blob) says 252 and explicitly rejects 254. The underlying slide images show both numbers (envelope card 252, 3D render label 10 in / 254 mm). Nothing in the vault records Zipline stating a hardware change. The weekly deck (readout s1) is `no-snapshot`, so an independent deck slide showing 254 mm cannot be ruled out, only not found. Needs a human ruling; under §8 the `^c16`-type claims should be marked `#disputed` with an `## Open` question, which I did not do because this task did not ask me to change the vault.
2. **Custody event for direct Drone Loading.** The confirmed `IN_PROGRESS` custody boundary is framed around P2/Dropbox loading. The vault does not separately confirm that the same event and irreversibility apply when an associate loads the aircraft directly.
3. **Mass limit on the week-of-9/7 slide.** Neither slide artifact shows a mass; 2495 g rests on the 2026-07-30 partner QA alone (Google Doc s1, `no-snapshot`, text not recoverable from the vault).
4. **Q2 deck text.** The weekly deck (s1) is `no-snapshot`; only slide images and the legacy readout are in the vault.
5. The 07-30 Record's frozen Detail was revised in place several times (its own History says so), which §6 says should trigger a review of citing pages. I did not perform that review beyond confirming the concept page's digest for it still matches.

## Files changed

- `ANSWER.md` (this file) — created. No other file was created or modified; `log.md` was not appended because no wiki page was written.
