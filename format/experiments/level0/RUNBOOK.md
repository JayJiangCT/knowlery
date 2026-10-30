# Level 0 — Runbook (Codex, Claude Code, or any file-tool Agent)

This kit is deterministic: anyone with the Pilot checkout at `cf9e378` and this directory builds the same working copies and runs the same prompts. Results from different harnesses are comparable only if the steps below are followed exactly.

## 0. Prerequisites

- `git`, Python 3.8+ (stdlib only; `pyyaml` only for `tools/validate.py`).
- The Pilot checkout: `git clone https://github.com/JayJiangCT/Knowlery-Pilot && git -C Knowlery-Pilot checkout cf9e378`.
- A harness that can run an Agent with **file tools only** (read, search, edit, shell for `sed`/`sha256sum`/`git` read commands) and **no network**. Record its name, model id, and any system prompt it injects.
- The kit at tag `level0-frozen-1` (`git checkout level0-frozen-1`). Put the tag in the `kit_tag` column of every row.
- **An isolated harness config.** A local harness otherwise loads the operator's own instructions, skills, plugins, memory and MCP servers, which neither the other harnesses nor the other arm see. Checked on 2026-10-30 (Claude Code 2.1.314, codex-cli 0.144.1):
  - Claude Code: `--setting-sources project,local` is **not enough**; the user-level `~/.claude/CLAUDE.md` still loads. `--bare` and `--safe-mode` go too far: they also drop the vault's own `.claude/CLAUDE.md`. Use a fresh config home instead, log in to it once, and run every task from it:
    ```
    export CLAUDE_CONFIG_DIR=$HOME/.level0-claude   # empty directory, used only for this experiment
    claude                                          # once: run /login inside, then exit
    claude --strict-mcp-config                      # each run, from work/<arm>/<task>/
    ```
  - Codex: `~/.codex` holds a global `AGENTS.md`, skills and MCP servers. Use a fresh home holding only your login:
    ```
    export CODEX_HOME=$HOME/.level0-codex   # empty directory, used only for this experiment
    codex login                             # once
    codex                                   # each run, from work/<arm>/<task>/; do not pass --search
    ```
  - **Pre-flight probe** (once per harness, in a throwaway build such as `work/test/T01`, which you rebuild afterwards). Send: *"Do not use any tools. Answer in 4 short lines: (1) which instruction/memory files are loaded in your context, by path; (2) does your context contain any instructions from outside this folder? yes/no; (3) names of skills available to you; (4) names of MCP servers or mcp__ tools available."* Pass: only the vault's own files (Claude Code: `.claude/CLAUDE.md` and what it imports; Codex: `AGENTS.md`), no user-level instructions, no user skills or plugins, no MCP servers. The harness's built-in skills are fine. Save the reply with the report.

  Record the exact command line and the probe reply in `REPORT.md`.

## 1. Build the working copies

```
cd format/experiments/level0
python3 tools/build.py /path/to/Knowlery-Pilot --out ./work
```

Produces `work/<arm>/<task>/` for `control` and `test` × `T01..T12`. Each is an independent git repo: baseline commit(s) + the task's fixture commit. Rebuild between repetitions (`rm -rf work/<arm>/<task>` then rerun with `--tasks TNN --arms <arm>`); never reuse a vault an Agent has already edited.

What the arms contain:

| | Control | Test |
|---|---|---|
| Pages | Pilot as is | Pilot with the 14 scoped pages replaced by `test/` (queries → `records/`), `tools/digest.py` added |
| Instructions | Pilot `AGENTS.md` / `.claude/CLAUDE.md` made headless: read-only banner replaced by an experiment header (Agent-Maintained Pages rules in force, user notes read-only), Obsidian CLI rules and the Skills section removed | `CONVENTIONS.md`; `AGENTS.md` / `.claude/CLAUDE.md` point to it |
| Removed | `.claude/skills`, `.agents/skills`, `.knowlery/bin`; Activity Ledger off | `.claude`, `.agents`, `.knowlery/bin`, 1.x `AGENTS.md`/`KNOWLEDGE.md`/`SCHEMA.md`/`INDEX.base` |
| Extra | the T10/T11 "custody → recovery" sentence appended to the Dispatch Portal concept page | the same fact as claim ^c17 with a `derived` source |

## 2. Run one task

1. Open a **fresh** Agent session with the working directory set to `work/<arm>/<task>/`. No memory from earlier runs, no other folders.
2. Paste the task's prompt from `tasks/<task>.md` verbatim as the first and only user message. Do not add guidance.
3. Let it finish without intervention. If it asks a question, answer only "Use your judgment and finish." once; a second question ends the run as *abstained*.
4. Save the transcript, then collect:
   ```
   tools/collect.sh work/<arm>/<task> results/<harness>/<arm>/<task>/run<N>
   ```
   which copies `ANSWER.md`, the diff of everything the Agent changed (new files included), `git status`, and the list of files it touched.
5. Fill the run's row in `results/<harness>/scores.csv` using the task's **Pass criteria** and **Record per run** sections. Token numbers come from the harness; record input tokens total and, where the harness exposes it, tokens attributable to reading the instruction files (`AGENTS.md` + rules / `CONVENTIONS.md`).

Repetitions: 3 per task per arm where budget allows; the same model for both arms. No token cap is set: both arms run with the harness defaults, and tokens are recorded, not limited. Order: alternate arms (control T01, test T01, control T02, …) so drift affects both equally.

## 3. Scoring rules

- **Pass / partial / fail** per the task file. "Partial" is allowed only where the task file defines it.
- **Unnecessary Rewrite Rate (T04, T05, T06, T08, T10):** from the collected diff, count modified lines the fixture did not justify ÷ all modified lines. Moving a claim to History per the rules is justified; rewording an untouched claim is not.
- **Unsupported Current Claim Rate (Test arm, T04–T06):** run `python3 tools/validate.py` on the edited pages; claims in `## Current` without `(src:)` or with a `(src:)` id that does not exist count as unsupported ÷ all current claims on those pages.
- **Protocol overhead ratio:** instruction-file tokens ÷ total input tokens, when the harness exposes it; otherwise estimate from the transcript (bytes of instruction files read ÷ bytes of all files read).
- **Abstained:** counts as fail for correctness, but note it separately.
- Blind scoring is not achievable: citation style (`[[slug#^cN]]` vs page + section) and page layout reveal the arm. Score from `ANSWER.md` and the diff against the task's written criteria, and say in `REPORT.md` that scoring was not blind.
- T03, T07, T09 and T10 define a different correct answer per arm. Report their pass rates per arm; do not compare them across arms as if the task were the same.

## 4. Reporting

Write `results/<harness>/REPORT.md`: harness, model and the exact command line (§0); a table task × arm with pass rate over repetitions; the three rates above; notable transcripts (one example each of a clean pass, a silent resolution, an unnecessary rewrite); and every place the Agent misread `CONVENTIONS.md` or the Pilot rules, because those are Format findings. Do not edit any file under `test/` or `tasks/` during the experiment; file Format gaps in the report.

## 5. Known constraints

- Level 0 tests behavior under conventions only. Nothing here proves atomic writes, concurrent-edit safety, or enforcement of `protected`.
- Three runs per arm cannot show a pass-rate difference: even 3/3 vs 0/3 gives Fisher's exact p ≈ 0.10. Report results as case findings (what the Agent did and why) and Format findings, not as pass-rate differences.
- T11 and T12 are boundary probes; a Test-arm miss is expected to be possible and is a Format finding, not a scoring defect.
- The Test vault is a mixed vault (14 migrated pages among ~180 legacy 1.x pages); `CONVENTIONS.md` §2a tells the Agent how to treat legacy pages. Confusion there is also a finding.
