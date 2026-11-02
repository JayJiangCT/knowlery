# Level 0 — claude-code-local report (run 1 of each task, both arms)

**Harness:** sub-agents of a Claude Code session (`general-purpose`), model `claude-fable-5-1`, file tools + read-only git, one fresh agent per run, working directory = the built vault under the session scratchpad (outside the kit repo). **Kit:** `kit_tag = c162a64`. The runs were built from `336c701`; kit content (`test/`, `tasks/`, `tools/`) is identical at `336c701` and `c162a64`, only `operator/` prompts differ. Later than tag `level0-frozen-1`; includes the 36 signed equivalence fixes to the Test pages. Pilot `cf9e378`. One repetition only; treat every number as a first observation. **Scoring is not blind.** This is a **local** Claude Code session's sub-agents, a different harness from the cloud-session `results/claude-sandbox/`; the two are kept separate (RUNBOOK §4) so their agreement or disagreement is data.

## Deviations from RUNBOOK (read before comparing with other harnesses)

- **No isolated config home and no pre-flight probe.** Sub-agents inherit this session's tool set, user-level instructions and skills; "no network" is an instruction in the prompt, not enforced. Not comparable to the Claude Code CLI / Cursor / Codex runs the RUNBOOK describes.
- Each agent's prompt was a two-sentence wrapper (vault path, "read your task from `prompts/TNN-prompt.txt`, do not touch anything else, do not ask questions") pointing at a byte-identical copy of `tasks/TNN-prompt.txt`; the task text itself was not pasted as the first message.
- 24 agents ran in two parallel batches (T01–T04, then T05–T12), not alternating control/test.
- Token figure = harness `subagent_tokens` (total per run). Instruction-file tokens are not separable, so the protocol overhead ratio is not reported. `files_read` holds the agent's tool-call count (column header says so), an upper bound, not a count of distinct files.
- Kit commit (`336c701` ≡ `c162a64`), not tag `level0-frozen-1`: the tag predates the signed equivalence gate (decision made with the operator).

## Pass table

| Task | Control | Test | Note |
|---|---|---|---|
| T01 Q&A | pass | pass | both opened the slide Source and reported the 252/254 conflict; the pre-freeze Test run did not |
| T02 historical vs current | pass | pass | 4/4 each |
| T03 evidence | pass | pass | Test reported `sha256:d7ccd152…` / `blob:dd2a7955…`; Control said no version recorded |
| T04 targeted update | pass | pass | URR ≈0.20 (estimate) vs 0.00 |
| T05 conflict | pass | pass | Control touched 12 files, Test 2; neither changed the number |
| T06 owner-edited Record | pass | pass | both kept the edit, neither propagated it as fact |
| T07 not recoverable | pass | pass | no invention |
| T08 frontmatter-only | pass | pass | no edits |
| T09 recover cited text | pass | pass | Test via `blob:`; Control via git history, version inferred |
| T10 unrelated claim, derived source | pass | pass | no edits |
| T11 upstream disputed | **partial** | pass | see Findings 2 |
| T12 frontmatter meaning | pass | pass | both surfaced `decision_status: withdrawn` |

Correctness: Control 11 pass + 1 partial, Test 12/12. Tokens: Control 1,284,823 total, Test 1,139,010 (−11%); per task within about −30% to +14%, Test lower on 10 of 12.

## Unnecessary Rewrite Rate (removed existing lines the input did not justify ÷ all removed lines, from `changes.diff`)

**Counting rule used here:** only lines *removed* in `changes.diff` count (an added line never counts); a removed line is justified if the input's new information changes it, including `updated`/`freshness_*` bumps, Sources-line extensions and open questions the update answers. The cloud run counted 13 rewritten body lines across 6 files with about 3 justified (0.77). The rules differ in what counts as rewritten, which is a RUNBOOK §3 ambiguity as well as possible run variance; the two numbers should not be compared until §3 fixes one rule.

| Task | Control | Test |
|---|---|---|
| T04 | ≈2/10 = **0.20** — table header retitled, one page `description` rewritten; date bumps, Sources-line extension and annotated open questions counted as justified (judgment call; a stricter reading gives a higher number) | 0/4 = **0.00** |
| T05 | 0 (annotations, `contradictions:` and `freshness_status` only; 12 files) | 0 (2 files) |
| T06 | 0 (pointer sentences appended to 5 sibling pages) | 0 |
| T08, T10 | 0 (no edits) | 0 (no edits) |

Unsupported Current Claim Rate (Test, T04–T06): 0 — `tools/validate.py` returns OK on all three edited vaults.

## Findings (Format and task, not scoring)

1. **Tier-3 stopping did not recur (T01).** With the fixed Test pages the Test agent opened the pinned slide Source and reported the conflict, so the pre-freeze partial is gone. One run cannot say whether the earlier miss was the Format or run-to-run variation.
2. **T11 Control answer diverges from the task's expected answer.** Control read the vault's DELI-4662/4665/4673/4681 pages and concluded a same-order Ground job after Zipline is a pre-custody reallocation, and declined the Portal page's "post-custody recovery" sentence as an over-generalization. It did surface the PICKED_UP-vs-IN_PROGRESS dispute. I scored it `partial` against the written criterion; the operator reviewed this call on 2026-11-02 and confirmed `partial`. The Test agent gave a conditional answer (reallocation if pre-custody, recovery if after `IN_PROGRESS`) and noted `^c17`'s `derived` cite carries no independent evidence.
3. **Body-only digests do not see semantic frontmatter (T12).** The Test agent found `decision_status: withdrawn` by reading the Source, not through the digest; §7 would not flag it. Already a known Format gap per the task.
4. **Vault content issues found by agents (not scored):** compiled pages and Records carry "254 mm" against their own cited slide note (T01, T02, T05); frozen Record scopes show post-date `revised by` History lines (T02, T03, T12); the medium-bag update equates "new August 2026 Medium" with "PRD v26 default" although the vault records different nominal sizes (T04, both arms).
5. **Harness effect:** Control T05 (65 tool calls, 12 files edited) and T04 (35) were the most expensive runs; Test T05 used 22 calls and 2 files for the same finding.

## Examples
- Clean pass: `test/T05/run1` — `^c16` `#disputed`, `^q12`, History line, `log.md`, two files, number untouched.
- Silent resolution: none in either arm.
- Unnecessary rewrite: `control/T04/run1/changes.diff` (retitled table header; rewritten description).
