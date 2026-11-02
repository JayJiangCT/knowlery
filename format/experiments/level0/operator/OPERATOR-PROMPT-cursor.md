# Operator prompt — Cursor harness (paste verbatim into a Cursor Agent chat with the `knowlery` repo open; or run it through `agent` interactively)

You are the operator of the Level 0 experiment for the Cursor harness. You do not answer the experiment's tasks yourself; you run each task in a **fresh headless Cursor CLI session** (`agent -p`), collect what it did, score it against the task file, and write the report. Read `format/experiments/level0/RUNBOOK.md` and `PROTOCOL.md` first and follow them where this prompt is silent.

## Inputs
- This repo on branch `develop/2.0` (kit). Record `git rev-parse --short HEAD`; if tag `level0-frozen-2` exists use it as `kit_tag`, otherwise the commit.
- `Knowlery-Pilot` checked out at `cf9e378` — ask me for its path if you cannot find it.

## Step 1 — isolation (once; I do the settings, you verify)
Ask me to confirm, in Cursor Settings: all **User Rules** disabled; **Memories** off; all **MCP servers** disabled. Then verify from the shell: `~/.cursor/mcp.json` has no servers (or is absent); no `.cursor/` directory exists in the built vaults; `agent --list-models` works. Pick ONE model with me and use it for every run (`--model <MODEL>`); never `Auto`.

## Step 2 — build
```
cd format/experiments/level0
python3 tools/build.py <pilot-path> --out ./work
tools/extract-prompts.sh
```
Check: `git -C work/test/T01 log --oneline | head -3` shows `pin source versions` and `baseline`; `grep -c "@pin" work/test/T01/concepts/*.md` is 0 everywhere; `work/control/T01/AGENTS.md` starts with the CONTROL ARM note.

## Step 3 — pre-flight probe (once per arm)
From `work/test/T01` and from `work/control/T01`:
```
agent -p "Do not use any tools. Answer in 4 short lines: (1) which instruction/memory files are loaded in your context, by path; (2) does your context contain any instructions from outside this folder? yes/no; (3) names of skills available to you; (4) names of MCP servers or mcp__ tools available." --model <MODEL> --output-format text --trust --sandbox enabled
```
Pass = only the vault's `AGENTS.md` (Test arm also `CONVENTIONS.md`), no User Rules, no Memories, no MCP. Save both replies to `results/cursor/PROBE.md`. If it fails, stop and show me. Rebuild `work/test/T01` and `work/control/T01` afterwards.

## Step 4 — run the 24 tasks
Order: control T01, test T01, control T02, test T02, … T12. For each:
```
cd work/<arm>/<task>
agent -p "$(cat ../../../tasks/<task>-prompt.txt)" --model <MODEL> --output-format json --trust --sandbox enabled > ../../../results/cursor/<arm>/<task>/run1/transcript.json
cd ../../..
tools/collect.sh work/<arm>/<task> results/cursor/<arm>/<task>/run1
```
Never pass `--approve-mcps`, `--force`, `--yolo`, `--cloud`, `--worktree`, `--continue` or `--resume`. Never run two tasks in one session; never reuse a vault after a run (rebuild with `--tasks <task> --arms <arm>` to rerun). If a session fails, record `abstained` with the error; do not answer the task yourself. If the JSON exposes token usage record it, otherwise write `not exposed` and record files read from the transcript.

## Step 5 — score
For each run read `ANSWER.md` and `changes.diff` against the task's **Pass criteria** and **Record per run** in `tasks/<task>.md`. Fill `results/cursor/scores.csv` (header from `results/scores-template.csv`, plus `kit_tag`): result, parts correct, Unnecessary Rewrite Rate (T04/T05/T06/T08/T10 — rewritten lines the fixture did not justify ÷ all rewritten lines), Unsupported Current Claim Rate (Test arm T04–T06 — `python3 tools/validate.py` on edited pages), silent_resolution, history_preserved, notes. T01 also records "Source-level 252/254 conflict noticed y/n" (not scored). Scoring is not blind; say so.

## Step 6 — report
Write `results/cursor/REPORT.md` per RUNBOOK §4: harness (Cursor CLI version from `agent --version`) + model + exact command line + confirmation that indexing/User Rules/Memories/MCP were off, pass table task × arm, the three rates, example transcripts (clean pass / silent resolution / unnecessary rewrite, if any), and every place the Agent misread `CONVENTIONS.md` or the Pilot rules. Commit `results/cursor/` on a branch `level0/results-cursor` and open a PR to `develop/2.0`. Do not edit anything under `test/`, `tasks/` or `tools/`; describe kit bugs in the PR instead.
