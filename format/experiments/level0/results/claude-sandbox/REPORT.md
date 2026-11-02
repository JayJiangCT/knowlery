# Level 0 — claude-sandbox report

**Harness:** sub-agents (`general-purpose`) of a cloud Claude Code session, model `claude-fable-5-1`, file tools + read-only git, no network (prompt-enforced, not sandbox-enforced), one fresh agent per run, cwd = the built vault. **Kit:** `develop/2.0` @ `c162a64` (after the signed equivalence gate; tag `level0-frozen-1` predates the Test-page fixes). **Pilot:** `cf9e378`. **Tokens** = harness `subagent_tokens` per run (includes the ~400-token run prompt). One repetition per task per arm. Scoring by the operator against `tasks/*.md`; not blind.

**Deviations from RUNBOOK §0:** no isolated config home and no pre-flight probe (sub-agents inherit the session's tool set; they were told which directory is the vault and not to read outside it, and every report lists files read); tasks were run sequentially by task but not alternating arms within a task; `files_read` is the count the agent reported.

Rows marked `pre-freeze` in `scores.csv` are the 2026-10-30 calibration runs on the earlier kit and are not scored here.

## Pass table (run 1, post-gate)

| Task | Control | Test | Note |
|---|---|---|---|
| T01 Q&A | pass | pass* | *Source-level 252/254 detection (recorded, not scored): Control **yes**, Test **no** — identical to the pre-freeze run |
| T02 historical vs current | pass | pass | both found the Source note disputing the change |
| T03 evidence | pass | pass | Test reports sha256+blob; Control says none recorded; both flag "re-Quote" as a compiled inference |
| T04 targeted update | pass | pass | **URR Control 0.77 vs Test 0.00** |
| T05 conflict | pass | pass | Control annotated 11 pages + sidecar; Test touched 2 files |
| T06 owner-edited Record | pass | pass | neither reverted nor propagated the edit as fact |
| T07 not recoverable | pass | pass | neither invented text |
| T08 frontmatter-only | pass | pass | neither edited; Test by digest, Control by git diff |
| T09 recover cited text | pass | pass | Test via `blob:` + digest match; Control via exhaustive history |
| T10 unrelated claim on derived source | pass | pass | Test by fingerprint |
| T11 upstream disputed, text unchanged | pass | pass | both surfaced the dispute; Test also named the propagation gap on ^c17 |
| T12 Source frontmatter withdrawn | pass | pass | both surfaced `decision_status: withdrawn` |

Correctness 12/12 both arms. Tokens: Control 1,592,277; Test 1,637,929 (+2.9%). Files read: Control 151, Test 112 (−26%).

## Rates

| Metric | Control | Test |
|---|---|---|
| Unnecessary Rewrite Rate, T04 | 10/13 = 0.77 (callouts relabelled, status table, Short Answer and a Sources line rewritten across 6 files; old text kept as "previous status") | 0/1 = 0.00 (one claim moved to History; new claim, new Record, pointers on frozen Records) |
| Unnecessary Rewrite Rate, T05 / T06 / T08 / T10 | 0 / 0 (3 in-place annotations, justified) / 0 / 0 | 0 / 0 / 0 / 0 |
| Unsupported Current Claim Rate, Test T04–T06 | — | 0 (validator OK; one false positive, see kit bugs) |

## Findings

1. **Tier-3 stopping hides compile-time errors — reproduced.** Test T01 again answered 254 mm from `^c16` without opening the cited Source; Control again followed the citation and caught the contradiction. Two for two on this model. Same Test Agent found it immediately in T02 and T05 when pointed at it. Candidate rule stands: before citing a claim as an answer, read its first vault-file Source, or let compile record a `source-checked` verification event.
2. **Claim-level supersession produced the targeted update (T04, again).** Control rewrote 13 body lines across 6 files to express one new fact; Test moved one claim. This is the second observation at the same magnitude (0.77 vs 0.00).
3. **Scope rules behaved as designed (T08, T10) and the two boundary probes passed again (T11, T12)**, with the Test Agent in T12 explicitly reasoning "frontmatter-only, not an evidence change under §7, but a human withdrawal flag bears on the decision" — i.e. judgment compensating for the Format's silence. Status propagation along `derived` (T11) and semantic Source frontmatter (T12) remain open design items, now with two clean runs each suggesting Agents compensate.
4. **Honesty tasks (T07, T09)** pass in both arms; the Test arm's `blob:` mechanism gave a mechanical proof where Control needed a history argument.
5. **Records revised in place by 1.x cook runs** were flagged independently by the Test Agent in T01, T02, T03 and T12 as §6 violations. The Format makes a 1.x practice visible that 1.x itself could not express.
6. **Token cost did not fall** this run (+2.9% Test) even though Test read 26% fewer files: Test agents spent tokens verifying digests and blobs. Files read is the better proxy for retrieval efficiency; token efficiency needs the instruction-file split the harness cannot give.

## Kit bugs found during the run (fix after the run, not during)

- `tools/digest.py` crashes when flags precede the file path (`digest.py --claim ^c16 file.md`); file-first works.
- `tools/validate.py` false positive: a `[[#^q12]]` link inside a History line trips the "id not at end of line" check.
- Fixture commits (T10) do not bump `updated` or add a History line; a Test Agent noticed and reported it as a bookkeeping gap on the strategy page.

## What this does not show

Single repetition, one model, same model in both arms, no isolated harness config, no second harness yet. Cross-harness comparison waits on the local Claude Code run with an isolated config (RUNBOOK §0). Nothing here speaks to atomic writes, concurrency or `protected` enforcement.
