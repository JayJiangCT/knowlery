#!/bin/sh
# WS-001 case runner (harness side, not prototype). Usage, from evals/experiments/write-safety:
#   scripts/run-case.sh <case> <run-name> <settings.json> <prompt.txt> [mcp.json]
# Restores vault/ to the baseline commit, runs one non-interactive Claude Code session, captures raw
# stream-json, stderr, the vault diff and a validate report into transcripts/<case>/.
set -u
CASE=$1; NAME=$2; SETTINGS=$3; PROMPT=$4; MCP=${5:-}
BASELINE_COMMIT=${BASELINE_COMMIT:-$(git log -1 --format=%H -- vault/.knowlery/manifest.json)}
OUT=transcripts/$CASE; mkdir -p "$OUT"
git restore --source="$BASELINE_COMMIT" --staged --worktree vault && git clean -fdq vault
{
  echo "case=$CASE run=$NAME date=$(date -u +%FT%TZ)"
  echo "repo_head=$(git rev-parse HEAD) baseline_commit=$BASELINE_COMMIT"
  echo "claude_version=$(claude --version)"
  echo "os=$(sw_vers -productName) $(sw_vers -productVersion) ($(uname -srm))"
  echo "settings=$SETTINGS mcp=${MCP:-none} prompt=$PROMPT"
} > "$OUT/$NAME.meta.txt"
set -- -p "$(cat "$PROMPT")" --model claude-sonnet-5-5 --permission-mode default \
  --settings "$SETTINGS" --setting-sources project --strict-mcp-config \
  --output-format stream-json --verbose --no-session-persistence
[ -n "$MCP" ] && set -- "$@" --mcp-config "$MCP"
echo "command: claude -p \"\$(cat $PROMPT)\" --model claude-sonnet-5-5 --permission-mode default --settings $SETTINGS --setting-sources project --strict-mcp-config --output-format stream-json --verbose --no-session-persistence ${MCP:+--mcp-config $MCP}" >> "$OUT/$NAME.meta.txt"
claude "$@" < /dev/null > "$OUT/$NAME.jsonl" 2> "$OUT/$NAME.stderr.txt"
echo "claude_exit=$?" >> "$OUT/$NAME.meta.txt"
{
  echo "## git status --short vault (after run)"; git status --short vault
  echo; echo "## git diff vault (after run)"; git diff vault
  echo; echo "## validate (after run)"; node proto/knowlery-proto.mjs validate; echo "validate_exit=$?"
} > "$OUT/$NAME.after.txt" 2>&1
python3 -I scripts/summarize.py "$OUT/$NAME.jsonl" > "$OUT/$NAME.summary.md"
cat "$OUT/$NAME.summary.md"; cat "$OUT/$NAME.after.txt"
