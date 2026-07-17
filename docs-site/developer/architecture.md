# Architecture

How Knowlery is put together: one platform-agnostic core, three thin shells,
and a workspace format on plain markdown that all of them share.

## One core, three shells

```
                    ┌─────────────────────────────┐
                    │        src/core/            │
                    │  retrieval · staleness ·    │
                    │  sync · setup · bundles ·   │
                    │  kb-registry · mcp handlers │
                    └──────┬───────┬───────┬──────┘
                           │       │       │
              ┌────────────┴─┐  ┌──┴────┐  └──────────────┐
              │ Obsidian     │  │ CLI   │  │ MCP server    │
              │ plugin       │  │       │  │ (stdio/HTTP)  │
              │ (main.js)    │  │       │  │               │
              └──────────────┘  └───────┘  └───────────────┘
```

- **The core** (`src/core/`) contains all lifecycle logic: setup, sync,
  retrieval, staleness, bundle export/install/publish/update, the KB registry,
  and the MCP tool handlers. It never imports Obsidian APIs as values — a test
  (`tests/core/core-purity.test.ts`) enumerates the inverted modules and fails
  on any `import ... from 'obsidian'` that isn't type-only.
- **The Obsidian plugin** (`src/main.ts`, views, modals) adds the review UI:
  dashboard, export/install modals, settings.
- **The CLI** (`src/cli/`) is a thin argv/prompt/output layer. Commands parse
  flags and delegate; no lifecycle logic lives in the shell.
- **The MCP server** (`src/core/mcp/`) exposes the same operations as tools,
  prompts, and resources. The stdio shell (`knowlery mcp`) and the HTTP shell
  (`knowlery mcp serve`) supply transports; the handlers don't know which one
  is running.

Two esbuild bundles come out of one repository: `main.js` (plugin) and
`knowlery-cli.mjs` (CLI + MCP). The MCP SDK is bundled into the CLI artifact
only — the plugin bundle contains no MCP code.

## The file-system inversion

The core reaches disk through a `VaultFs` interface (`src/core/vault-fs.ts`)
with two implementations:

| Implementation | Backing | Used by |
| --- | --- | --- |
| `obsidianVaultFs` | Obsidian `App` vault API | plugin |
| `nodeVaultFs` | `node:fs` | CLI, MCP, tests |

`loggingVaultFs` wraps either to record which paths a sync actually wrote —
that's how `sync` reports its file list and proves idempotence in tests.
Wikilink resolution has the same split: the plugin uses Obsidian's
`metadataCache`; headless code scans files, and ambiguous basenames resolve to
nothing rather than guessing.

## The workspace format

A Knowlery workspace is a plain folder:

```
KNOWLEDGE.md          # the agent-facing operating guide
SCHEMA.md             # living taxonomy conventions
INDEX.base            # Obsidian Bases index
entities/ concepts/ comparisons/ queries/    # compiled layer (agent-tier)
inbox/                # MCP capture landing zone (user-tier, created on demand)
Library/<bundle-id>/  # installed bundles (read-only reference)
.knowlery/            # manifest, bundles.json, exports, activity, reports
.agents/skills/ .claude/skills/              # installed skill packages
```

Pages are markdown with frontmatter. The scanner (`src/core/query/scan.ts`)
classifies every page into a tier: `agent` (the four compiled dirs), `user`
(everything else), or bundle material under `Library/`. That tier drives
retrieval weighting, staleness, and the MCP resource allowlist.

The manifest (`.knowlery/manifest.json`) records platform, KB name, and
`lastSyncedBy` — the version stamp behind the downgrade guard.

## The retrieval engine

`src/core/query/` is pure TypeScript with no I/O beyond the initial scan:

1. **Tokenize** the question: latin words with light stemming variants, CJK
   substrings and phrases.
2. **Score** every page with field weights — title and aliases dominate, then
   tags, description, body. A compiled page is credited when a raw note it
   cites (via `sources:`) matches the question, which is how cross-language
   questions reach compiled answers.
3. **Gate** the result: the top candidate must clear a confidence bar —
   structured-field hits with sufficient specificity-weighted term coverage,
   strong prose coverage, or pure source-graph reach. Otherwise the verdict is
   `no-confident-match` and the engine abstains rather than ranking noise.

There is deliberately **no cache and no index**: every query is a live scan.
Vault-scale corpora scan in milliseconds, and statelessness removes the entire
invalidation problem — the same property that later made the MCP server
restart-safe for free.

The same snapshot feeds **staleness** (`staleness.ts`): a compiled page is
stale when a cited source's mtime is newer than the page's; user notes cited
by nothing are "uncooked"; citations pointing at missing files are dangling.
Everything is computed fresh from mtimes — no bookkeeping state.

Retrieval quality is **measured, not asserted**: `evals/` contains fixture
vaults and a golden question set; CI runs recall@10 / MRR against a frozen
baseline and fails any change that drops below it.

## Knowledge bundles (OKF)

A bundle is a zip of approved compiled pages plus `knowlery-bundle.json`
(manifest: id, version, creator, content hash), `index.md` and
`agent-index.json` for navigation, approved raw sources under `_sources/`, and
a schema scoped to the tags the bundle actually uses.

The pipeline (`src/core/okf/`) is gate-shaped:

- **Export**: seed topic → graph closure → per-item review (approve/flag with
  content hashes, so edits re-invalidate approval) → risk scan (emails,
  sensitive URLs, credential patterns, person pages) → compile → zip.
- **Publish**: `gh` CLI creates a GitHub Release with a SHA-256 in the notes;
  public repos require a second acknowledgment of every risk item.
- **Install**: local path or URL; private release assets download through the
  user's `gh` login; `--verify <sha256>` checks integrity; conformance
  validates structure before anything is written.
- **Update**: `check-updates` reads release feeds read-only; `update` requires
  a version increase, stages the new content in a temp directory, detects
  local modifications by hash, and performs an atomic swap with a backup.

## The KB registry

`~/.config/knowlery/registry.json` maps names to canonical paths — nothing
more. All shells share it: the CLI's `--kb`, the plugin's self-registration
(ownership-tracked so it never removes a user's entry), and the MCP server's
addressing layer. Names are validated at write *and* at read (a hand-edited
invalid entry is a loud error, never silent data loss). Federated query
iterates the registry, runs the engine per KB, and merges by score with per-KB
attribution.

## The MCP server

`src/core/mcp/server.ts` registers everything on an SDK `McpServer`:

- **Eight tools** — five reads (`list_kbs`, `query`, `stale`, `health`,
  `list_bundles`) and three writes (`init_kb`, `capture`, `sync`) — each with
  zod input schemas (strict: unknown fields rejected) and `structuredContent`
  mirroring the CLI's `--json` shapes.
- **Prompts**: nine curated skills served verbatim.
- **Resources**: `knowlery://{kb}/{+path}` with a read allowlist covering only
  the curated surface (`KNOWLEDGE.md`, compiled dirs, `Library/`) —
  canonicalize-then-prefix-check, so traversal and symlink escapes are refused.

Access is **structural**: the `access` option decides which write tools get
registered at all. stdio registers everything (the caller owns the machine);
the HTTP shell fails closed and registers only what `--allow-*` flags opted
into.

The HTTP shell (`http-server.ts`) keeps one long-lived `node:http` server but
builds a **fresh McpServer + stateless transport pair per request**, closing
both with the response — the SDK's stateless-mode contract. Auth is a bearer
token compared with `timingSafeEqual` over hashes; the token is never stored
or logged.

## Testing strategy

| Layer | Approach |
| --- | --- |
| Core logic | Unit tests on pure functions (engine, staleness, zip, registry) |
| Command handlers | In-memory `VaultFs` + temp dirs; injected failures for cleanup paths |
| MCP | Protocol round trips over the SDK's in-memory transport — no subprocesses |
| Built artifact | A smoke test builds `knowlery-cli.mjs` with the release entry point and drives it end to end: init → sync → query → bundles → remote install → registry → MCP stdio → HTTP serve |
| Retrieval quality | The eval harness with a CI-enforced baseline |
| Purity | The inverted-module list, enforced by test |

## Versioning and release

Plugin and CLI version in lockstep (one `package.json`). Releases run on
version tags; npm publishing uses OIDC trusted publishing (no tokens in CI)
with provenance, and is idempotent — a re-run of a tag that already published
skips green. The workspace format, CLI surface, and MCP tool contracts freeze
at 1.0 under semver.
