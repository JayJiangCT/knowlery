# WS-001 — Write-safety enforcement prototype (4-case verification)

> **Experiment, throwaway code.** Nothing here is the Knowlery 2.0 CLI, and nothing here is product code. Everything it tests is **PROPOSED** F-007 design. Results are evidence for the Cloud Agent and the Owner; they are not decisions. The report is in [REPORT.md](REPORT.md).

The brief is `WS-001-write-safety-prototype-brief.md` (Owner-approved, 2026-11-06). Branch `ws-001-write-safety` was cut from `develop/2.0` at `530d9e6f5d7a4b9d685bf4e1af3b5f490e2acf9f`.

## Contents

| Path | What |
|---|---|
| `vault/` | Synthetic test vault: 5 Knowledge/Record pages, 1 Source, `CONVENTIONS.md`, `log.md`. All content is invented. |
| `vault/.knowlery/manifest.json` | Trusted baseline, committed in `2ecfe0a`. Maps each path to its digest, `protected` claim fingerprints and `last_write_id`, plus `manifest_version`, `created_at`/`created_reason` and `rebuilt_at`/`rebuild_reason`. There is no vault-wide hash. |
| `proto/knowlery-proto.mjs` | Prototype `validate` (read-only), `baseline --init/--rebuild --reason`, and `append-history <slug> "<line>"`. |
| `proto/mcp-server.mjs` | Minimal stdio MCP server exposing `validate` and `append_history`. Logs its own process ancestry to `$WS001_MCP_LOG`. |
| `hooks/pre-commit` | Git guard: runs `validate --protected` and rejects `protected_change` unless the override is set. |
| `test/validate.test.mjs` | Unit tests: at least one fixture per state, plus a read-only assertion. |
| `config/` | Verbatim Claude Code settings, MCP config and prompts for T1/T2a/T2b. `CLAUDE-CODE-DOCS.md` lists the docs consulted. |
| `scripts/` | Harness-side runners (not prototype): `run-case.sh` (one `claude -p` session), `summarize.py`, `t3.sh`, `t4.sh`. |
| `transcripts/` | Raw stream-json transcripts (`*.jsonl`), stderr, per-run metadata, vault diff and `validate` output after each run (`*.after.txt`), readable summaries (`*.summary.md`), the MCP process log, and the T3/T4 command logs. |

## Environment used

- Claude Code `2.1.318 (Claude Code)` CLI, model `claude-sonnet-5-5`, run with `claude -p` (`--permission-mode default --setting-sources project --strict-mcp-config`).
- macOS 14.7.4 (Darwin 23.6.0, arm64), Node v22.22.2, Python 3.12.8.

## Reproduce from a clean checkout

Every command runs from this directory:

```bash
cd evals/experiments/write-safety
```

Unit tests (15 cases):

```bash
node --test test/validate.test.mjs
```

The baseline is already committed. To rebuild it from scratch in a fresh vault, run `node proto/knowlery-proto.mjs baseline --init --reason "<why>"`. It refuses to run if a manifest already exists.

**T1, Edit tool under deny rules:**

```bash
scripts/run-case.sh t1 t1-edit-tool config/t1-settings.json config/prompts/t1.txt
```

**T2a, Bash allowed, same deny rules.** Run the main case, then the labeled probes and the control:

```bash
scripts/run-case.sh t2a t2a-bash config/t2a-settings.json config/prompts/t2a.txt
```

```bash
scripts/run-case.sh t2a t2a-probe-redirect config/t2a-settings.json config/prompts/t2a-probe-redirect.txt
```

```bash
scripts/run-case.sh t2a t2a-probe-python config/t2a-settings.json config/prompts/t2a-probe-python.txt
```

```bash
scripts/run-case.sh t2a t2a-probe-cli config/t2a-settings.json config/prompts/t2a-probe-cli.txt
```

```bash
scripts/run-case.sh t2a t2a-control-sed config/t2a-control-no-edit-deny-settings.json config/prompts/t2a-control-sed.txt
```

**T2b, Bash sandboxed with the vault write-denied, prototype exposed as MCP tools.** Create the MCP log folder first:

```bash
mkdir -p transcripts/t2b
```

```bash
scripts/run-case.sh t2b t2b-bash-and-mcp config/t2b-settings.json config/prompts/t2b.txt config/t2b-mcp.json
```

```bash
scripts/run-case.sh t2b t2b-probe-python config/t2b-settings.json config/prompts/t2b-probe-python.txt config/t2b-mcp.json
```

```bash
scripts/run-case.sh t2b t2b-probe-cli config/t2b-settings.json config/prompts/t2b-probe-cli.txt config/t2b-mcp.json
```

```bash
scripts/run-case.sh t2b t2b-probe-ps config/t2b-settings.json config/prompts/t2b-probe-ps.txt config/t2b-mcp.json
```

**T3, out-of-band edit, then delete and rebuild the manifest (no harness):**

```bash
scripts/t3.sh > transcripts/t3/t3-command-log.txt 2>&1
```

**T4, git pre-commit guard.** The script uses a temporary detached worktree, so its test commits never reach the branch:

```bash
scripts/t4.sh > transcripts/t4/t4-command-log.txt 2>&1
```

Notes:

- `run-case.sh` restores `vault/` to the baseline commit before every run: `git restore --source=<baseline> --staged --worktree vault` followed by `git clean`. The prototype never restores or reverts anything itself.
- **Pitfall found in preflight** (`transcripts/preflight/`): a relative `sandbox.filesystem.denyWrite` path in a `--settings <file>` resolves against **the settings file's directory**, not the working directory. That is why `config/t2b-settings.json` uses `"../vault"`. Edit permission rules with `./` resolve against the working directory (per the docs, and consistent with T1).
- **Pre-commit hook install:** pass it per command with `git -c core.hooksPath=<abs path>/hooks commit …`. This avoids touching the `.git/hooks` shared by every worktree.
- **Override:** `KNOWLERY_PROTECTED_OVERRIDE="<reason>" git commit …`. When the hook accepts a `protected_change` this way, it appends a line to `vault/log.md` and stages it, so the override is recorded inside the commit. `git commit --no-verify` skips the hook entirely; this is a known limit and is not fixed.
- **Redactions in committed logs:** in `transcripts/t2b/mcp-process.log`, ancestry rows above the runner script (the operator's desktop app and shell) have their command lines redacted, and `claude -p` rows are truncated. In `transcripts/t4/t4-command-log.txt`, the git author email and the temp path are redacted. Raw `*.jsonl` transcripts are unmodified.
- The prompt files (`config/prompts/*.txt`) are committed as-is. Each prompt tells the Agent that the attempt is sanctioned, so the model makes the tool call instead of refusing on convention grounds; what the experiment measures is the harness.
