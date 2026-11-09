#!/bin/sh
# WS-001 T4 — git pre-commit guard. Runs in a temporary detached worktree so test commits never reach the branch.
# Run from evals/experiments/write-safety:  scripts/t4.sh > transcripts/t4/t4-command-log.txt 2>&1
set -u
EXP_REL=evals/experiments/write-safety
BASELINE_COMMIT=${BASELINE_COMMIT:-$(git log -1 --format=%H -- vault/.knowlery/manifest.json)}
ORIG=$(pwd)
TMP=$(mktemp -d "${TMPDIR:-/tmp}/ws001-t4.XXXXXX")
git worktree add --detach "$TMP/wt" HEAD >/dev/null 2>&1 || { echo "worktree add failed"; exit 1; }
cd "$TMP/wt/$EXP_REL" || exit 1
HOOKS="$TMP/wt/$EXP_REL/hooks"
START=$(git rev-parse HEAD)
run() { echo "\$ $*"; "$@"; echo "[exit=$?]"; echo; }
commit() { run git -c core.hooksPath="$HOOKS" commit "$@"; }
reset_vault() { run git restore --source="$BASELINE_COMMIT" --staged --worktree vault; git clean -fdq vault; }
edit_protected() { run sed -i '' 's/it never returns to the kitchen (src: s3) ^c2/it may return to the kitchen if the drone aborts (src: s3) ^c2/' vault/entities/skylark.md; }
echo "# T4 command log  date=$(date -u +%FT%TZ) head=$(git rev-parse HEAD) baseline_commit=$BASELINE_COMMIT"
echo "# scratch worktree: <tmp>/wt (detached at HEAD; removed at the end). Hook installed per command via core.hooksPath."; echo
echo "## (a) commit the T3 protected-claim edit -> expected rejected"
reset_vault; edit_protected
run git add vault
commit -m "T4a: protected claim edit"
run git log -1 --format='HEAD now: %h %s'
echo "## (b) same change with the documented override -> expected accepted, override recorded"
run env KNOWLERY_PROTECTED_OVERRIDE="owner decision recorded for WS-001 T4b" git -c core.hooksPath="$HOOKS" commit -m "T4b: protected claim edit with override"
run git log -1 --format='HEAD now: %h %s'
run git show --stat --format='%h %s' HEAD
run git show HEAD -- vault/log.md
echo "## (c) legal append-history on an unprotected page -> expected accepted (scratch HEAD reset to the starting commit first, dropping the a/b test commits)"
run git reset -q --hard "$START"
reset_vault
run node proto/knowlery-proto.mjs append-history charging-window "2026-11-08 · [[#^c1]] verified by human:test-owner"
run git add vault
commit -m "T4c: legal append-history on charging-window"
run git log -1 --format='HEAD now: %h %s'
run git show --stat --format='%h %s' HEAD
echo "## (d) protected edit with --no-verify -> expected accepted (hook bypassed; known limit)"
run git reset -q --hard "$START"
reset_vault; edit_protected
run git add vault
commit --no-verify -m "T4d: protected claim edit with --no-verify"
run git log -1 --format='HEAD now: %h %s'
echo "## (d') after the bypass, validate still reports the change against the committed manifest"
run node proto/knowlery-proto.mjs validate
echo "## cleanup"
cd "$ORIG" && git worktree remove --force "$TMP/wt" && rmdir "$TMP"
echo "scratch worktree removed"
