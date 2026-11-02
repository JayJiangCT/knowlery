#!/usr/bin/env bash
# Writes the verbatim prompt of each task to tasks/TNN-prompt.txt (the fenced block in tasks/TNN.md).
set -euo pipefail
cd "$(dirname "$0")/.."
for f in tasks/T*.md; do
  t="${f%.md}"; sed -n '/^```$/,/^```$/p' "$f" | sed '1d;$d' > "$t-prompt.txt"
done
ls tasks/*-prompt.txt | wc -l
