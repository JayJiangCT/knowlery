# CLI-004 — Write Safety Level 1 and Access Modes (F-007 design after WS-001)

- **Status:** ACCEPTED · 2026-11-09 (Owner approved in conversation; recorded by Agent on Owner's authorization, same convention as the KF v1.0 and CLI-003 records). §6 items remain OPEN; F-007 remains PARTIAL until §7 passes.
- **Refines:** Architecture Baseline L2 ("CLI is the primary interface; MCP is an optional thin wrapper"), CLI-001 (guarantees apply only to writes through the controlled path; external writes are detected, not prevented), KF v1.0 §10 (`protected`), CLI-003 (per-file manifest shared with the derived index).
- **Evidence:** WS-001, PR #97 (merged, `956c4e8`), `evals/experiments/write-safety/REPORT.md` and transcripts. One harness (Claude Code 2.1.318, macOS Seatbelt), one model, one run per case; all observations are scoped to that configuration. Level 0 experiment (`format/experiments/level0/RESULTS.md`): agents following `CONVENTIONS.md` alone located and updated the correct claim in 24/24 Test cells, on two harnesses including `claude-sandbox`.
- **Reviews:** Cloud Agent acceptance of WS-001 (2026-11-08); Local Agent review (2026-11-09); Owner direction on access modes (2026-11-09).
- **Suggested location:** `docs/2.0/decisions/2026-11-09-write-safety-level1-and-access-modes.md`; `CLI-004` row in `DECISIONS.md`; F-007 row gains "design: CLI-004", status stays PARTIAL.

---

## 1. Problem

The CLI can guarantee write safety only for writes that pass through it (CLI-001). In harnesses that give the Agent file tools and a shell, nothing in the CLI prevents a Skill from writing a Knowledge file directly. WS-001 tested what harness configuration, a trusted manifest and a commit hook can prevent or detect, and what each costs.

## 2. What WS-001 established

| Finding | Case | Label |
|---|---|---|
| File-tool deny rules refuse the Edit and Write tools. | T1 | OBSERVED |
| Deny rules partially reach into Bash on 2.1.318 (`sed -i`, redirect targets refused) but do **not** close the Bash path: a `python3 -c` script wrote a protected claim. | T2a | OBSERVED |
| Under deny rules the controlled CLI run through Bash has no privilege over any other script; both write. Permission rules therefore cannot distinguish the controlled path. | T2a `probe-cli` | OBSERVED |
| With an OS shell sandbox denying writes to the vault and the CLI exposed as MCP tools, every Bash write (`sed`, `python3`, CLI-in-Bash) got EPERM; only the MCP tool wrote. The MCP process runs outside the sandbox. | T2b | OBSERVED |
| `validate` against a trusted manifest reports `protected_change` on a protected-claim edit, `clean` elsewhere; is read-only; reports `baseline_unavailable` with no manifest and never creates one silently. | T3 | OBSERVED |
| Rebuilding the manifest converts whatever is on disk into trusted state; earlier detection is lost. | T3 | OBSERVED |
| A pre-commit hook rejects a protected change, admits a legal History append, accepts an explicit override, is bypassed by `--no-verify`. | T4 | OBSERVED |
| A relative `sandbox.filesystem.denyWrite` path resolves against the settings file's directory; a wrong path leaves the vault silently writable. | preflight | OBSERVED |

Design classification: T1 PASS, **T2a FAIL** (Bash path open — the brief's expected result), T2b PASS, T3 PASS, T4 PASS. The one path WS-001 proved enforceable (T2b) is also the most configuration-heavy and the most harness-dependent.

## 3. Decision (proposed)

### 3.1 Default mode: Agent Skills + Knowlery CLI

The default write path for any Agent with an execution environment — a local harness (Claude Code, Codex, Cursor, OpenCode, …) or a cloud sandbox that has cloned the vault — is **the CLI invoked from the Agent's shell, directed by Skills**. No MCP, no sandbox configuration, no per-harness setup.

Guarantees in default mode:

| Layer | What it provides | Enforced by |
|---|---|---|
| CLI write operations (L4) | Atomic write, expected-version precondition, refusal to alter a `protected` claim, `log.md` line, manifest update, post-write validate — **for writes through the CLI** | CLI (CLI-001) |
| L2 manifest validation | Any out-of-band change (Agent bypass, human edit, other tool) is reported as `external_change` / `protected_change` **before the next CLI write operation**, because every write operation runs `validate` on its target first and refuses on anything but `clean` | CLI |
| L3 commit guard | A pre-commit hook reusing `validate` rejects `protected_change` without a logged override | git hook |
| Recovery | Pre-change content is recoverable from git | git |

**Explicitly not guaranteed in default mode:** that a Skill cannot bypass the CLI. Bypass is a convention violation, detected and recoverable, not prevented. The rule "write Knowledge files only through the CLI" lives in the Skills and in `CONVENTIONS.md` §7.

Why this is the default: it is the Baseline L2 position; it is portable to every harness and to cloud sandboxes with no configuration; the Level 0 experiment shows convention compliance is high (24/24); the residual damage is bounded by git; and WS-001 showed the alternative (T2b) is fragile to configure.

### 3.2 Hardened mode (optional): sandbox + MCP write profile

The T2b configuration remains available as an opt-in for users and harnesses that want prevention, not only detection: OS shell sandbox denying writes to the **whole vault root** (manifest, `log.md`, `CONVENTIONS.md`, `sources/` included — the manifest is the trust anchor), file-tool deny rules on the same scope, and the CLI's write operations exposed to the Agent as MCP tools (`knowlery mcp --profile write`). To the Skill this is transparent: the same operations, reached through a tool instead of a command.

Hardened mode holds only under preconditions that must be **verified at runtime**, not read from configuration: a self-check attempts a sandboxed shell write to the vault and expects EPERM. If it succeeds, or the sandbox is unavailable, the system reports that hardened mode is **inactive** and runs in default mode. It never reports "protected" from configuration alone. This covers the relative-path trap, user/managed settings overriding project settings, permission-bypass flags and harness version drift.

Hardened mode is promoted from optional to recommended only on the evidence of §7 A11.

### 3.3 Remote mode: MCP read profile

For Agents **without an execution environment** (chat surfaces such as the Claude web or desktop app without code execution, ChatGPT), the only access path is the Knowlery MCP server in read profile: `search`, `explore`, `inspect`, `read_source`, `validate`. No write operations, no `baseline`, no shell. This is the sole deployment in which MCP is required rather than optional.

Remote deployment shape: a read-only mirror of the vault on an always-on host (VPS or home server), synchronized by `git pull`; the authoritative vault stays with the user. Authentication is mandatory. The mirror is derived state in the CLI-001 sense: discardable and rebuildable; never a second writable vault.

### 3.4 Access modes summary

| Agent environment | Access path | MCP needed | Writes |
|---|---|---|---|
| Local harness with shell | Skills + CLI | no | yes (default mode); hardened mode optional |
| Cloud sandbox with cloned vault | Skills + CLI, CLI installed from the repo | no | yes, as default mode; results may return as commits/PRs for human review (future, not decided here) |
| Chat surface, no execution environment | MCP read profile on a remote mirror | **yes** | no |

## 4. Constraints the implementation must satisfy

1. **Every CLI write operation validates first.** `validate` on the target file runs inside each write operation; any state other than `clean` aborts with the state reported. This is what makes default-mode detection "before the next operation" rather than "whenever someone runs validate".
2. **Vault under version control is a requirement of default mode.** Install and `validate` warn when the vault is not a git repository, because detection without recovery only reports damage.
3. **`validate` is read-only and never creates or rebuilds a manifest.** `baseline --init` / `--rebuild --reason` are explicit, flagged, and recorded (`rebuilt_at`, reason); `validate` prints when it is trusting by rebuild. Rebuild is never exposed through MCP in any profile; it is a human action.
4. **`protected_change` semantics (implementation, not KF).** A manifest-recorded protected claim's fingerprint changed, the claim left `## Current`, or the file disappeared. Fingerprints live in the manifest, so removing a page's `protected:` key does not unprotect the claim. The page-level digest scope (body after frontmatter) is an implementation choice for `validate`; a normative page-level evidence scope would be a KF change and is not made here.
5. **Detection never auto-reverts.** On `external_change` / `protected_change` the system preserves the file, reports the diff and affected claims, and stops. A human or a user-initiated session decides.
6. **L3 validates the staged index**, not the working tree. `--no-verify` and the unauthenticated override are recorded limits: L3 guards against mistakes, not adversaries.
7. **`inspect` returns `source_checked`.** F-008's digest comparison is mechanical and is performed server-side: each returned claim carries `source_checked: verified | stale | never` (verified = a `source-checked` History event exists for the claim at the recorded Source version *and* the Source's current digest equals that version). An Agent answers from `verified` claims directly and reads the Source otherwise. This applies in every mode; in remote mode it is the only way F-008 is honored, since the Agent has no Skill.
8. **`search` returns Tier 1/2 only, with section of origin** (`current` / `history` / `open` / `evidence`) per hit, so History hits are never mistaken for current knowledge. Bodies are not returned by `search`.
9. **MCP server `instructions` and tool descriptions carry the reading rules** (CONVENTIONS §4: search → inspect → read Source when `source_checked` is not `verified`; state disputes; use History only for evolution questions). The same text goes into any chat Project's instructions as a fallback.
10. **CLI installable offline from the vault repository** (single-file script or vendored package under the repo), because cloud sandboxes commonly block package registries. Without it, cloud sandboxes fall to Level 0, which must still work.
11. **One manifest, two uses** (CLI-003): the per-file digest manifest serves both change detection and index invalidation. Never a single vault-wide hash.
12. **Harness support is tiered, not assumed.** A harness is Tier 1 only after §7 passes on it. Others are "usable in default mode; hardened mode unverified". Claims in product documentation follow the tier, never the design.

## 5. Alternatives rejected

| Alternative | Why |
|---|---|
| Permission/deny rules alone as prevention | T2a: cannot distinguish the controlled CLI from any script; reach into Bash is version-dependent. |
| MCP as the mandatory write path in local harnesses | Deviates from Baseline L2; per-harness sandbox + MCP configuration is fragile (preflight trap) and not portable; benefit (prevention) is bounded by what git already recovers. Kept as hardened mode. |
| Automatic rollback on detected change | Destroys user edits; violates human-control baseline. |
| String-matching deny rules for shell commands | Fragile; bypassed by any interpreter. |
| Writable remote mirror | Creates a second authoritative vault (CLI-003 Alternative C). |

## 6. Open

- Skill bypass rate in default mode on the real vault (§7 A11) — the only evidence that would promote hardened mode.
- Second harness behavior (Codex, OpenCode, …): untested; governed by §4.12.
- Git-mediated writes from cloud sandboxes (commit/PR back to the authoritative vault): plausible, auditable, not designed here.
- Remote host as scheduled autonomous-maintenance runner: not designed here.
- Index file layout, parser complexity: deferred to the CLI Pilot (CLI-003 §5).

## 7. Acceptance for closing F-007 to ACCEPTED

**Default mode (required on each Tier 1 harness, with the real Agent Plugin, not the WS-001 prototype):**

| # | Test | Pass condition |
|---|---|---|
| A3 | CLI write op on a `clean` page | succeeds; History, `log.md`, manifest updated; `validate` clean |
| A4 | CLI write op on a page with `external_change` | refused with the state reported |
| A7 | Out-of-band protected edit → `validate` | `protected_change`; no file modified by `validate` |
| A8 | Manifest deleted → `validate`; rebuild without flag; rebuild with flag | `baseline_unavailable`; refused; rebuilt and flagged |
| A9 | Pre-commit with staged content differing from working tree | validates the staged content |
| A11 | Real-vault observation over ≥ 1 month | `external_change` events attributable to an Agent session (no `log.md` entry, during a session) are counted and reported; the count is the evidence for §3.2 promotion |
| A12 | `inspect` on a claim whose Source changed since its `source-checked` event | `source_checked: stale` |
| A13 | `search` hit inside `## History` | `section: history` on the hit |

**Hardened mode (required only to claim it on a harness):**

| # | Test | Pass condition |
|---|---|---|
| A1 | Edit/Write tool on any vault file | refused |
| A2 | Bash write via `sed`, redirect, `python3`, CLI-in-Bash to a Knowledge file and to `manifest.json` | all EPERM |
| A5 | Explicit sandbox-disable attempt | refused; vault unchanged |
| A6 | Self-check with denyWrite path deliberately wrong, and with sandbox disabled by a user-level setting | hardened mode reported inactive; default mode announced |

**Remote mode:**

| # | Test | Pass condition |
|---|---|---|
| A14 | Read profile tool surface | exactly `search / explore / inspect / read_source / validate`; no write or baseline tool present |
| A15 | 10–20 real-vault questions through a chat surface | answers cite claims; no claim with `source_checked ≠ verified` is answered without `read_source`; no History claim presented as current |

WS-001's remaining OPEN items are closed by A5, A6 and A12; no WS-002 is opened.

## 8. Status discipline

All of §3–§4 is PROPOSED. WS-001 results are OBSERVED for one configuration and are not a general guarantee. KF v1.0 is unchanged. F-007 remains PARTIAL until §7's default-mode rows pass on at least one Tier 1 harness.
