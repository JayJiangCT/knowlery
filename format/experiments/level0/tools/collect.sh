#!/usr/bin/env bash
# Usage: tools/collect.sh <vault-dir> <results-dir>
# Copies the Agent's ANSWER.md, its uncommitted changes (diff), status and touched-file list.
set -euo pipefail
V="$1"; R="$2"; mkdir -p "$R"
cp "$V/ANSWER.md" "$R/ANSWER.md" 2>/dev/null || echo "(no ANSWER.md)" > "$R/ANSWER.md"
git -C "$V" --no-pager diff > "$R/changes.diff"
git -C "$V" --no-pager diff --stat > "$R/changes.stat"
git -C "$V" status --porcelain > "$R/status.txt"
git -C "$V" status --porcelain | awk '{print $2}' > "$R/touched.txt"
git -C "$V" --no-pager log --oneline -5 > "$R/fixture-commits.txt"
echo "collected into $R"; cat "$R/changes.stat"
