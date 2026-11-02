# Level 0 — Combined results (run 1, two harnesses)

**Kit:** `develop/2.0` @ `c162a64` (post-gate). **Pilot:** `cf9e378`. **Harnesses:** `claude-sandbox` (cloud Claude Code session, sub-agents) and `claude-code-local` (local Claude Code session, sub-agents). Same model (`claude-fable-5-1`) in all four arm×harness cells; neither harness used the isolated config home of RUNBOOK §0 (both disclosed). Cursor and Codex CLIs were not usable on the operator's machine, so the cross-model dimension is **not covered** this round. One repetition per cell; everything below is a case finding, not a rate (PROTOCOL: 3/3 vs 0/3 would still be p≈0.10).

## 1. Pass table

| Task | sandbox C / T | local C / T |
|---|---|---|
| T01 Q&A | pass / pass | pass / pass |
| T02 historical vs current | pass / pass | pass / pass |
| T03 evidence | pass / pass | pass / pass |
| T04 targeted update | pass / pass | pass / pass |
| T05 conflict | pass / pass | pass / pass |
| T06 owner-edited Record | pass / pass | pass / pass |
| T07 not recoverable | pass / pass | pass / pass |
| T08 frontmatter-only | pass / pass | pass / pass |
| T09 recover cited text | pass / pass | pass / pass |
| T10 unrelated claim, derived | pass / pass | pass / pass |
| T11 upstream disputed | pass / pass | **partial** / pass |
| T12 Source frontmatter withdrawn | pass / pass | pass / pass |

47 of 48 cells pass. The one `partial` (local Control T11: answered "pre-custody reallocation" and declined the Portal page's post-custody line, while surfacing the dispute) is a scorer-variance item: the cloud scorer gave the same shape of answer a pass. Recorded, not adjudicated.

## 2. Unnecessary Rewrite Rate — one counting rule, both runs re-scored

The two scorers counted differently (0.77 vs 0.20 on the same task). Rule adopted here and proposed for RUNBOOK §3: *a rewritten body line is unjustified unless the new input changes what that line asserts; relabelling a callout "previous status", restructuring a list, rewriting a description or a Sources line, and bumping metadata are all unjustified; frontmatter dates are excluded from the denominator.*

| T04 Control | body lines rewritten | justified | **URR** |
|---|---|---|---|
| sandbox | 13 | 3 (the "still need testing" sentence, the 10-19 "Current status" callout, the Open question on sample approval) | **0.77** |
| local | 10 | 3 (the Open question on sample approval, the "Not Confirmed: Zipline test evidence" bullet, the Pack/SKU question) | **0.70** |
| T04 Test (both) | 1 | 1 (`^c17` moved to History) | **0.00** |

Under one rule the two Control runs agree (0.77 / 0.70) and the Test arm is 0.00 in both. T05/T06/T08/T10: 0 in all four cells (annotation-only or no edit).

## 3. Reading cost

| | sandbox C / T | local C / T |
|---|---|---|
| Tokens, 12 tasks | 1.59M / 1.64M (+3%) | 1.28M / 1.14M (−11%) |
| Files read (sandbox: distinct files; local: tool calls) | 151 / 112 (−26%) | not comparable |

Token totals point in opposite directions across harnesses; neither supports a claim. Files read fell 26% in the cloud run. Test agents spent tokens recomputing digests and blobs, which is work the Control arm has no way to do. The protocol-overhead ratio could not be measured (no instruction-token split).

## 4. Findings

**F1 — Tier-3 stopping hides compile-time errors: 2 of 3 Test runs.** Cloud pre-freeze and cloud post-gate Test T01 answered 254 mm from `^c16` without opening the cited Source; local Test T01 opened `s15` and surfaced the contradiction. All three Control runs opened the Source. When pointed at the conflict (T02, T05) every Test run found it at once and handled it by §8. So the behavior is run-variable under the current §3 wording, and the 1.x "quote key passages" rule pushes agents to the Source more reliably. **Decision needed on CONVENTIONS §3** (candidates: read the first vault-file Source of any claim you cite as an answer; or have compile write a `source-checked` verification event that tier-3 readers may trust).

**F2 — Claim-level supersession yields the targeted update.** URR 0.77/0.70 vs 0.00, three runs now (incl. pre-freeze). The Format's move-to-History rule did what §5 says; 1.x pages have no addressable unit so the agent rewrites prose around the new fact.

**F3 — Scope rules held (T08, T10) and the two boundary probes passed in all four cells (T11, T12).** In T12 both Test agents reasoned explicitly that a frontmatter-only `decision_status: withdrawn` is "not an evidence change under §7" yet bears on whether the decision stands. In T11 both Test agents reached the dispute through the `derived` link and both noted that the dependent claim `^c17` is not itself marked. Agents are compensating for two Format silences; the silences remain design items (status propagation along `derived`; semantic Source frontmatter).

**F4 — Recoverability mechanism works and is honest (T07, T09).** `blob:` gave a mechanical recovery with digest confirmation; `unverified` produced honest non-recovery; no run invented text. Control reached the same answers with history arguments.

**F5 — The Format makes 1.x practice visible.** Test agents in T01, T02, T03, T06, T12 independently flagged that 1.x cook runs had rewritten the frozen part of Records in place (§6). The 1.x arm cannot express this.

**F6 — Scorer variance is real and must be designed out.** T04 URR (0.77 vs 0.20 before the common rule) and T11 (pass vs partial) differed between operators scoring equivalent behavior. Rule in §2 fixes the first; the second needs a written rubric for "conditional answers".

## 5. Kit bugs (fixed after this round)

- `tools/digest.py` crashed when flags preceded the file path.
- `tools/validate.py` false positive on `[[#^qN]]` inside a History line.
- Fixture commits did not add History bookkeeping; a Test agent flagged it.

## 6. What remains before a decision record can close Hypotheses

- A second harness with a **different model** (Cursor/Codex were unavailable) — or an explicit decision that Level 0 is a single-model experiment.
- Repetitions (≥3 per cell) under the isolated config of RUNBOOK §0.
- Resolution of F1 in `CONVENTIONS.md`, then a re-run of T01 to see whether the fix removes the miss without raising cost.
- The granularity sub-experiment (deferred in PROTOCOL).


## Addendum 2026-11-02 — T13, F-008 regression (kit `2ba5db3`)

**Why:** the v1.0-rc review found the `source-checked` reuse rule unsafe in the event-only form: a Source edited after the check, with no Evolve run yet, leaves the History event matching the Wiki's own stale `## Sources` line. The rule was amended to also require that the Source's **current** digest equals the pinned version (`format/CONVENTIONS.md` §3, spec §7.0). T13 builds exactly that trap.

**Fixture:** both arms — one owner-committed correction line appended to the SP14 Meeting Summary Source (Grubhub-mediated 1P delivery back in scope), no Wiki update. Test arm additionally — a `source-checked · s3@<pinned sha>` History event matching the stale pin.

| Arm | Result | How it got there |
|---|---|---|
| Control (1.x) | pass | grep of Source + `git show`; surfaced the correction; leaned toward "treat as superseded" on a single appended line (caveated) |
| Test (v1.0-rc) | pass | `tools/digest.py` first → mismatch → `git diff <pinned blob> HEAD` (one line) → `#disputed` per §8, explicit refusal to supersede; Source body never loaded; named the stale `source-checked` event as non-vouching |

**Reading:** the amended F-008 behaves as intended in one cell per arm: the digest comparison is what caught the drift, and it cost a shell call rather than a Source read. Single model, single repetition — a case finding, like the rest of Level 0. The Control pass shows 1.x agents can also find such a correction by grepping, so the Format's gain here is the *mechanism* (deterministic check, no body read, dispute instead of resolution), not the detection itself.

**Fixture defect found by the Test agent and fixed:** the inserted event was dated before an existing History line (violating newest-first) and had no `log.md` entry; `build.py` now dates it 2026-10-27 and writes the log line. The run above was on the defective fixture; the defect does not touch what the task measures.
