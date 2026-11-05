# T0 — Archive and privacy preflight (CLI-002 Round 2)

Date: 2026-11-05 (UTC). Read-only audit. Full evidence, paths and hashes are in the private preflight folder, not here.

## Result

No frozen Round 1 artifact is missing or mismatched. The private store is outside every public checkout. One artifact class has no prior integrity record.

| Artifact class | Result | Note |
|---|---|---|
| G0 raw vault | PASS | 809 of 809 files match the frozen manifest; no extras; read-only on disk |
| G1 compiled vault | PASS | 1015 of 1015 files match; no extras. Not write-protected on disk |
| Benchmark v2 | PASS | Hash matches the freeze record; file is read-only |
| v2 errata | PASS | Manifest and member match. Not write-protected |
| Round 1 answers | PASS | 450 of 450 match. Not write-protected |
| Round 1 tool traces | NEEDS-EVIDENCE | Counts match (150 traces plus 150 stderr logs per arm). No earlier manifest exists, so integrity since Round 1 cannot be proven. A new private baseline was recorded |
| Scores | PASS | Both files match. The expected values exist only in the task brief |
| E-1 archive | PASS | Archive hash matches the value in `docs/2.0/VALIDATION.md`; 4 of 4 members match |
| Setup-log manifests | PASS | All three verify against their targets |
| Private store isolation | PASS | Canonical path, no symlinks, mode 700, outside all 14 registered worktrees, not in a synced folder |
| No changes to frozen files | PASS | 3214 files: same mode, size, mtime and hash before and after this audit |

## Findings for the Owner

1. **Frozen means hash-frozen, not write-protected.** Most Round 1 artifacts are still writable on disk. Only the G0 vault, the benchmark file, the eval protocol and three of four E-1 files are read-only. Integrity rests on the hashes.
2. **One written record does not hold.** `docs/2.0/VALIDATION.md` says all four E-1 files were set read-only. The script is still writable. Its hash matches, so its content is unchanged.
3. **Tool traces have no prior integrity record.** See the table.

## Verification

Ran:

- `check_baseline.py --exact` on the G0 vault.
- `shasum -a 256 -c` for the G1, errata, answers, E-1 and setup-log manifests, from the folder each manifest expects.
- Two-way comparison of manifest entries against files on disk for G1 and answers.
- `shasum -a 256` on each manifest, the benchmark and the score files; mode checks for write access.
- File counts per arm for tool traces, plus a search for any existing trace manifest.
- `realpath`, `git rev-parse`, `git worktree list`, symlink, permission, iCloud and other sync checks on the private store.
- A hash, mode, size and mtime snapshot of every frozen file before and after the audit.

Did not:

- Open or read benchmark questions, gold labels, answers, trace contents or vault notes.
- Repair, re-freeze, change permissions on, or re-hash any frozen artifact.
- Check the G1 vault against the G0 baseline.
- Check Time Machine. OneDrive non-sync is inferred from folder layout, not read from OneDrive settings.
- Decide whether any later gate may proceed.
