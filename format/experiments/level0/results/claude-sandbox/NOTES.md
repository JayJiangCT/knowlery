# claude-sandbox — run notes

Harness: this Claude session's sub-agents (general-purpose), model claude-fable-5-1, file tools only, no network, one fresh agent per run, working directory = the built vault. Token figures are the harness's `subagent_tokens` (total, includes the run prompt; instruction-file tokens not separable here).

All runs in this directory (T01–T12, run 1) are pre-freeze calibration data; see the banner in `REPORT.md`.

## T01 run 1 (smoke test, 2026-10-30) — pre-freeze, not scored

Ran before the Record-scope fix and before the Control overlay was made headless (the Pilot banner still suspended Control's page-writing rules). Its Q1 outcome is also the predicted effect of the two instruction files (CONVENTIONS §3 "Stop at tier 3" vs Control's "Quote key passages"), not yet evidence about the Format. Kept as a debugging record; rerun on `level0-frozen-1`.

- Control: pass. Read the compiled pages, then followed the citation to the slide Source note and its two PNG attachments; reported the vault's own contradiction (compiled 254 mm vs Source 252 mm) and answered 252 mm as the only partner-stated numeric limit.
- Test: partial. Answered 254 mm from `drone-delivery-integration-strategy#^c16` and the Record, did not open the cited Source (s15), so did not see the contradiction. Everything else correct, citations resolve to claim anchors.
- Observation (Format finding, not scored): the Test arm stopped at tier 3 exactly as `CONVENTIONS.md` §3 tells it to, which is cheaper but hides a compile-time error that only the Source reveals. The Control arm's 1.x rule "quote key passages" pushed it to the Source. Whether tier-3 stopping is right depends on how often compiled claims are wrong; T05 measures the behavior when the conflict is pointed at.
- Kit bug found and fixed after this run: a Record's digest included its own `## Sources` lines, so pinning changed the pinned Record. Evidence scope for Records now ends at `## Sources` (CONVENTIONS §6–7, spec §7.2/§8). Test run 1 reported "digest drift" because of this; the rest of its answer is unaffected.
