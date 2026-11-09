#!/bin/sh
# WS-001 T3 — detection outside the harness. Run from evals/experiments/write-safety:
#   scripts/t3.sh > transcripts/t3/t3-command-log.txt 2>&1
BASELINE_COMMIT=${BASELINE_COMMIT:-$(git log -1 --format=%H -- vault/.knowlery/manifest.json)}
run() { echo "\$ $*"; "$@"; echo "[exit=$?]"; echo; }
fp() { echo "\$ (sha256 of every file under vault/, to prove validate wrote nothing)"; find vault -type f -print0 | sort -z | xargs -0 shasum -a 256 | shasum -a 256; echo; }
echo "# T3 command log  date=$(date -u +%FT%TZ) head=$(git rev-parse HEAD) baseline_commit=$BASELINE_COMMIT"; echo
run git restore --source="$BASELINE_COMMIT" --staged --worktree vault
run git clean -fdq vault
echo "## Step 1: edit a protected claim directly (plain sed, no harness)"
run sed -i '' 's/it never returns to the kitchen (src: s3) ^c2/it may return to the kitchen if the drone aborts (src: s3) ^c2/' vault/entities/skylark.md
run git diff --stat vault
echo "## Step 2: validate against the committed baseline"
fp; run git status --short vault
run node proto/knowlery-proto.mjs validate
fp; run git status --short vault
echo "## Step 3: delete the manifest, validate again (must not create one)"
run rm vault/.knowlery/manifest.json
fp; run node proto/knowlery-proto.mjs validate
fp; run ls -la vault/.knowlery/
run git status --short vault
echo "## Step 3b: baseline without an explicit mode flag or reason is refused"
run node proto/knowlery-proto.mjs baseline
run node proto/knowlery-proto.mjs baseline --rebuild
echo "## Step 4: explicit rebuild"
run node proto/knowlery-proto.mjs baseline --rebuild --reason "test"
run node proto/knowlery-proto.mjs validate
fp; run node proto/knowlery-proto.mjs validate --json
fp; run git diff vault/.knowlery/manifest.json
echo "## Restore"
run git restore --source="$BASELINE_COMMIT" --staged --worktree vault
run git status --short vault
