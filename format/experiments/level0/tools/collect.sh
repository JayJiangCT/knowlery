#!/usr/bin/env bash
# Usage: tools/collect.sh <vault-dir> <results-dir>
# Copies the Agent's ANSWER.md, its uncommitted changes (diff, including new files), status and touched-file list.
# Uses a throwaway index so new files appear in the diff and the vault's own index is left as the Agent left it.
set -euo pipefail
V="$1"; R="$2"; mkdir -p "$R"
cp "$V/ANSWER.md" "$R/ANSWER.md" 2>/dev/null || echo "(no ANSWER.md)" > "$R/ANSWER.md"
IDX="$(mktemp)"; trap 'rm -f "$IDX"' EXIT
cp "$(git -C "$V" rev-parse --absolute-git-dir)/index" "$IDX"
GIT_INDEX_FILE="$IDX" git -C "$V" add -A
GIT_INDEX_FILE="$IDX" git -C "$V" --no-pager diff --cached -- . ':!ANSWER.md' > "$R/changes.diff"
GIT_INDEX_FILE="$IDX" git -C "$V" --no-pager diff --cached --stat -- . ':!ANSWER.md' > "$R/changes.stat"
git -C "$V" status --porcelain --untracked-files=all > "$R/status.txt"
GIT_INDEX_FILE="$IDX" git -C "$V" --no-pager diff --cached --name-only -- . ':!ANSWER.md' > "$R/touched.txt"
git -C "$V" --no-pager log --oneline -5 > "$R/fixture-commits.txt"
echo "collected into $R"; cat "$R/changes.stat"
