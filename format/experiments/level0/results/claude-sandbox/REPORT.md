# Level 0 — claude-sandbox report (run 1 of each task, both arms)

**Harness:** sub-agents of a Claude session (`general-purpose`), model `claude-fable-5-1`, file tools + read-only git, no network, fresh agent per run, cwd = the built vault. **Token figure** = harness `subagent_tokens` (total per run, includes the ~400-token run prompt; instruction-file tokens not separable). **Kit:** `develop/2.0` @ `6cef470`; Pilot `cf9e378`. One repetition only; treat every number as a first observation.

## Pass table

| Task | Control | Test | Note |
|---|---|---|---|
| T01 Q&A | pass | **partial** | Test stopped at tier 3 and missed the Source-level 252/254 contradiction |
| T02 historical vs current | pass | pass | both found the disputing Source note |
| T03 evidence | pass | pass | Test reports sha256+blob; Control correctly says none recorded |
| T04 targeted update | pass | pass | **URR 0.77 vs 0.00** (below) |
| T05 conflict | pass | pass | Control touched 9 pages + new page; Test touched 2 files |
| T06 owner-edited Record | pass | pass | both refused to propagate the owner's edit as fact |
| T07 not recoverable | pass | pass | neither invented text |
| T08 frontmatter-only | pass | pass | neither edited; Test by digest, Control by git diff |
| T09 recover cited text | pass | pass | Test via `blob:` + digest match; Control via exhaustive git history |
| T10 unrelated claim on derived source | pass | pass | Test by fingerprint; Control by reading |
| T11 upstream disputed, text unchanged | pass | pass | Test surfaced the dispute through the `derived` link |
| T12 Source frontmatter withdrawn | pass | pass | both surfaced `decision_status: withdrawn` |

Correctness: 12/12 Control, 11/12 Test (one partial). Tokens: Control 1,632k total, Test 1,577k total (−3%); per task within ±15%, no consistent direction.

## Unnecessary Rewrite Rate (body lines rewritten that the input did not justify ÷ all body lines rewritten)

| Task | Control | Test |
|---|---|---|
| T04 | 10/13 = **0.77** — rewrote descriptions, a status table, two callouts and a "Sources:" line across 5 pages; prior text was kept but relabelled "historical" | 0/1 = **0.00** — moved ^c17 to History, added ^c36 + two Sources lines + ^q8; frozen Records got only `followed_by` and a History line; new Record created |
| T05 | 0 (annotations only, 9 pages) | 0 (annotations only, 1 page) |
| T06 | 0 | 0 |
| T08, T10 | 0 (no edits) | 0 (no edits) |

Unsupported Current Claim Rate (Test, pages edited in T04–T06): 0 — every edited page passes `tools/validate.py`.

## Findings (Format, not scoring)

1. **Tier-3 stopping hides compile-time errors (T01).** The Test Agent did what `CONVENTIONS.md` §3 says — answer from `## Current`, open Sources only when evidence is asked for — and therefore repeated a compiled claim its own cited Source contradicts. The Control Agent, following the 1.x "quote key passages" rule, opened the Source and caught it. When the question pointed at the conflict (T02, T05) the Test Agent found it immediately and handled it by the rules. Candidate rule: before citing a claim as an answer, read the first-listed Source of that claim when it is a vault file (cheap: one file), or let the compile step record a `source-checked` verification event that tier-3 readers can trust. To be decided after repetitions.
2. **Claim-level supersession produces the targeted update the project is after (T04).** One claim moved, one added, frozen Records untouched, Open question for what the new fact does not establish. The 1.x arm preserved history too, but by rewriting five pages.
3. **`derived` propagation worked in both directions (T10, T11)** — unchanged fingerprint → no edit; disputed upstream → surfaced downstream. The Test Agent also pointed out the representation gap: the dependent claim ^c17 is not itself marked `#disputed`, so a reader of only the Dispatch Portal page would not see it. Status propagation along `derived` remains an open design item, but the Agent compensated by following the link.
4. **Body-only evidence scope did not cause the feared T12 miss**, because the Agent read the Source's frontmatter anyway and reasoned that a withdrawal flag bears on the decision even though it is "not an evidence change". The Format currently leaves this to Agent judgment; one run is not enough to call it safe.
5. **1.x evidence-chain violation surfaced by migration and confirmed by the Test Agent (T02):** the 2026-07-30 contract page's frozen content had been rewritten in place on 2026-09-15 in 1.x. Under v0.3.1 that is exactly what `## History · revised by` lines are for.
6. **Kit:** Record digest scope corrected before run 1 of T02–T12 (see NOTES.md). The T01 Test run predates that fix; its answer is unaffected.

## What this does not show

Single repetition, single model, same model in both arms, sandbox harness. No atomic-write, concurrency or `protected` enforcement claims. Cross-harness results (Codex, Claude Code) are collected separately under `results/codex/` and `results/claude-code/`.
