# Stability Contract

As of 1.0.0, the surfaces below are frozen under semver: **breaking any of
them requires a major version**. Minor and patch updates may add to these
surfaces but never change or remove existing meaning. Every promise on this
page is pinned by contract tests in the repository (`tests/contract/`) — the
freeze is enforced by CI, not by good intentions.

## What a 1.x update may do to you

Add new commands, flags, tools, optional fields, and optional files. Improve
retrieval scores. Fix bugs. Refresh skill content.

## What a 1.x update may never do to you

Remove or rename a command, flag, or tool; change the meaning of an existing
file or field; change JSON output keys; break a workspace or bundle created
by 1.0.0.

## Frozen surfaces

### Workspace format

- The meaning and location of `KNOWLEDGE.md`, `SCHEMA.md`, `INDEX.base`, the
  four compiled directories (`entities/`, `concepts/`, `comparisons/`,
  `queries/`), `inbox/`, and `Library/<bundle-id>/`.
- `.knowlery/manifest.json` (existing fields) and `.knowlery/bundles.json`
  (schemaVersion 1). Any 1.x reads state written by 1.0.0, forever.
- The page tier rules (compiled dirs are agent-tier; everything else is
  user-tier).

### CLI surface

- Every command and subcommand shipped in 1.0, their positional arities, and
  their flags.
- `--json` output shapes: existing keys never change; additive keys are minor.
- Exit-code semantics: `0` success — **including findings** (an abstaining
  query, an empty report); `1` operational failure; `2` usage error.
- The `--kb` / `--dir` resolution rules: `--kb` resolves through the registry,
  `--dir` works forever, passing both is an error, and the registry is never
  a prerequisite.

### MCP contracts

- The eight tool names (`list_kbs`, `query`, `stale`, `health`,
  `list_bundles`, `init_kb`, `capture`, `sync`), their input schemas
  (required fields and types; new *optional* inputs are minor), and their
  `structuredContent` shapes (existing keys). The advertised schemas carry
  the frozen keys — what a client introspects via `tools/list` is the
  contract, and the server validates every result against it at runtime.
- Findings-vs-errors semantics: abstention, `healthy: false`, and stale-heavy
  reports are successful results; tool errors are reserved for broken calls.
- The nine prompt names, the `knowlery://{kb}/{+path}` resource scheme, and
  the readable-surface allowlist boundary.
- `knowlery mcp serve` flags and the auth contract (bearer token, 401 shape).

### Bundle format (OKF)

- `knowlery-bundle.json` schemaVersion 1 fields and the zip layout
  (`index.md`, `agent-index.json`, `_sources/`, the update log).
- Install/update gate semantics: version-increase requirement and
  local-modification refusal.

### KB registry

- `registry.json` schemaVersion 1, the name grammar
  (`[a-z0-9][a-z0-9-_]`, max 64 chars), reserved names (`*`, `all`), and the
  corrupt-is-loud rule (a damaged registry is reported, never silently reset).

## Explicitly not frozen

Stated just as plainly, so absence of a promise is never mistaken for one:

- **Retrieval ranking internals.** Scores, ordering among candidates, and the
  confidence-gate thresholds may improve in any release. The contract is the
  *shape* of results and the abstention verdict string
  (`no-confident-match`), not the numbers.
- **Skill prose.** Skill content evolves; skill *names* are contract.
- **The inner keys of `health`'s `config` object.** Individual check fields
  may be added, renamed, or retired as the health checker evolves — freezing
  them would freeze the checks themselves. Its contract is `healthy`
  (boolean) plus the presence of a `config` object.
- **Plugin UI** (dashboard layout, modals, settings organization), **docs**,
  and **eval thresholds**.
- Private state under `.knowlery/` not listed above (activity receipts,
  reports).
- TypeScript internals: `src/` is not a public API; importing from the
  package is unsupported.

## Deprecation path

A surface can gain a successor (a new flag, a new tool) in a minor release;
the old one keeps working until a major version removes it. Aliases are not
breaks.
