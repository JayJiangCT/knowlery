# Operator prompt — Claude Code harness (paste verbatim into a Claude Code session opened at the `knowlery` repo root)

You are the operator of the Level 0 experiment for the Claude Code harness. You do not answer the experiment's tasks yourself; you run each task in a **fresh, isolated headless Claude Code session**, collect what it did, score it against the task file, and write the report. Read `format/experiments/level0/RUNBOOK.md` and `PROTOCOL.md` first and follow them where this prompt is silent.

## Inputs
- This repo on branch `develop/2.0` (kit). Record `git rev-parse --short HEAD` as the kit commit; if the tag `level0-frozen-2` exists, record it as `kit_tag`, otherwise use the commit.
- `Knowlery-Pilot` checked out at `cf9e378` — ask me for its path if you cannot find it.

## Step 1 — isolated harness config (once)
```
export CLAUDE_CONFIG_DIR=$HOME/.level0-claude   # empty dir, experiment only
mkdir -p "$CLAUDE_CONFIG_DIR"
```
Tell me to run `claude` once inside that config dir and `/login`, then wait for my confirmation. Then verify: `CLAUDE_CONFIG_DIR=$HOME/.level0-claude claude -p "say ok" --strict-mcp-config` must answer.

## Step 2 — build
```
cd format/experiments/level0
python3 tools/build.py <pilot-path> --out ./work
tools/extract-prompts.sh
```
Check: `git -C work/test/T01 log --oneline | head -3` shows `pin source versions` and `baseline`; `grep -c "@pin" work/test/T01/concepts/*.md` is 0 everywhere; `work/control/T01/AGENTS.md` starts with the CONTROL ARM note.

## Step 3 — pre-flight probe (once per arm)
Run from `work/test/T01` and from `work/control/T01`:
```
CLAUDE_CONFIG_DIR=$HOME/.level0-claude claude -p "Do not use any tools. Answer in 4 short lines: (1) which instruction/memory files are loaded in your context, by path; (2) does your context contain any instructions from outside this folder? yes/no; (3) names of skills available to you; (4) names of MCP servers or mcp__ tools available." --strict-mcp-config --model <MODEL>
```
Pass = only the vault's `.claude/CLAUDE.md` (and what it imports), no user-level files, no user skills/plugins, no MCP servers. Save both replies to `results/claude-code/PROBE.md`. If it fails, stop and show me. Rebuild `work/test/T01` and `work/control/T01` afterwards (`rm -rf` them, rerun build with `--tasks T01`).

## Step 4 — run the 24 tasks
Pick ONE model and use it for every run (`--model <MODEL>`; record it). Order: control T01, test T01, control T02, test T02, … T12. For each:
```
cd work/<arm>/<task>
CLAUDE_CONFIG_DIR=$HOME/.level0-claude claude -p "$(cat ../../../tasks/<task>-prompt.txt)" --strict-mcp-config --model <MODEL> --output-format json > ../../../results/claude-code/<arm>/<task>/run1/transcript.json
cd ../../..
tools/collect.sh work/<arm>/<task> results/claude-code/<arm>/<task>/run1
```
Rules: never run two tasks in one session; never reuse a vault after a run (rebuild with `--tasks <task> --arms <arm>` if you must rerun); do not answer the task yourself if the session fails — record `abstained` with the error. From the JSON transcript, record input/output token totals and the number of files read into `results/claude-code/scores.csv` (header from `results/scores-template.csv`, plus `kit_tag`).

## Step 5 — score
For each run read `ANSWER.md` and `changes.diff` against the task's **Pass criteria** and **Record per run** in `tasks/<task>.md`. Fill the row: result, parts correct, Unnecessary Rewrite Rate (T04/T05/T06/T08/T10 — lines rewritten that the fixture did not justify ÷ all rewritten lines, from the diff), Unsupported Current Claim Rate (Test arm T04–T06 — run `python3 tools/validate.py` on the edited pages), silent_resolution, history_preserved, notes. T01 also records "Source-level 252/254 conflict noticed y/n" (not scored). Scoring is not blind; say so.

## Step 6 — report
Write `results/claude-code/REPORT.md` per RUNBOOK §4: harness + model + exact command line, pass table task × arm, the three rates, one example transcript each of a clean pass / a silent resolution / an unnecessary rewrite (if any), and every place the Agent misread `CONVENTIONS.md` or the Pilot rules. Commit `results/claude-code/` on a branch `level0/results-claude-code` and open a PR to `develop/2.0`. Do not edit anything under `test/`, `tasks/`, or `tools/`; if you find a kit bug, describe it in the PR instead.
