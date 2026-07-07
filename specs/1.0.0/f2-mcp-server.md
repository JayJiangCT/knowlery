# F2 (1.0.0) — `knowlery mcp`: The Third Shell (stdio)

- **Status:** Draft — awaiting maintainer spec acceptance
- **Target release:** 1.0.0
- **Branch:** `cursor/10-f2-mcp-92eb`
- **Depends on:** F1 (the registry is the addressing layer — plan-binding), 1.0
  plan (read-wide-write-narrow, skills-as-prompts, stdio-full-featured — all
  binding)

## 1. Problem statement

Every MCP-capable local agent (Claude Desktop, Claude Code, Cursor, gemini-cli)
can already *shell out* to the CLI — but that requires the agent to have a
shell, to know the commands, and the user to have taught it. MCP inverts the
integration: Knowlery describes its own tools, the agent discovers them, and
the knowledge base becomes ambient — present in every conversation without
per-conversation setup. F2 delivers the read side plus the two protocol
surfaces nothing else offers: **skills as prompts** (four versions of
accumulated craft, machine-loadable) and **pages as resources** (the wikilink
graph made navigable, not just searchable).

## 2. Goals

```
knowlery mcp        # stdio server; runs until the client disconnects
```

1. **Read tools** over the F1 registry (the server itself is stateless; the
   registry is the addressing layer):
   - `list_kbs()` — names, paths, live states
   - `query({ kb, question, k? })` — the retrieval engine; `kb: "*"` federates
     with per-KB attribution; abstention is a structured verdict, not an error
   - `stale({ kb })` — the staleness report (work list for re-cooking)
   - `health({ kb })` — workspace integrity
   - `list_bundles({ kb })` — installed bundles with provenance
2. **Skills as MCP prompts**: a curated set of the built-in skills exposed via
   `prompts/list`/`prompts/get`, so any client can load the ask/cook/review
   craft on demand.
3. **Pages as MCP resources**: `knowlery://<kb>/<path>` reads any knowledge
   page; a resource template plus per-KB entry points keep the listing bounded.
4. Setup documentation for each local client (the "Agents & MCP" docs section
   opens).

## 3. Non-goals

- No write tools (F3: `init_kb`, `capture`, `sync`).
- No HTTP transport, no auth (F4).
- No unregistered-vault mode: the server addresses KBs by registry name only —
  `kb add` is one command away, and a nameless addressing mode would fork every
  tool's contract for marginal convenience. (The CLI's "registry never a
  prerequisite" contract is untouched — it is about `--dir` workflows, which
  MCP does not have.)
- No tool-side caching or indexing: every call is a live scan, same as every
  other transport (the 0.6 no-cache rationale applies unchanged).
- No plugin-side MCP server — `knowlery mcp` is a CLI subcommand; Obsidian
  users get MCP by having the npm package, like any other user.

## 4. Design

### 4.1 Server shape and dependency

- Official TypeScript SDK (`@modelcontextprotocol/sdk`) becomes a dependency of
  the npm package, bundled into `knowlery-cli.mjs` like everything else. The
  plugin bundle is unaffected (the server lives behind the `mcp` subcommand
  only).
- `src/cli/commands/mcp.ts` wires transport + lifecycle; tool/prompt/resource
  *handlers* live in `src/core/mcp/` (pure node, purity-guarded) so F4 can
  reuse them verbatim under the HTTP transport — the same
  shell-supplies-transport discipline as remote-source/publish.
- **Input validation is contract, not courtesy** (the F1 arity lesson): every
  tool declares a zod schema; unknown fields are rejected; `kb` names resolve
  through the registry with the F1 error (listing what exists) passed through
  to the client as a tool error, never a crash.

### 4.2 Tool results

Tools return both a human-readable text block (what the shells already print —
shared formatters) and `structuredContent` mirroring the `--json` shapes the
CLI has carried since 0.7 — the schemas that already exist become the MCP
contract.

**Findings are data; only broken calls are errors** (maintainer P2 at spec
review, generalizing the abstention rule): a query abstention
(`verdict: "no-confident-match"`, with the consulted-KBs list when federated),
an unhealthy `health` report (`structuredContent.healthy: false` — where the
CLI exits 1, MCP returns a successful result carrying the finding), and a
stale-heavy `stale` report are all **successful tool results**. Tool errors
are reserved for invalid input, unknown `kb` names, and I/O failures. Tool
descriptions state this so agents relay findings instead of retrying.

### 4.3 Skills as prompts

Curated exposure — the knowledge-workflow skills whose content stands without
Obsidian: `ask`, `cook`, `explore`, `challenge`, `ideas`, `audit`, `organize`,
`vault-conventions`, `knowlery-cli`. Excluded: `obsidian-cli`,
`obsidian-markdown`, `obsidian-bases`, `json-canvas`, `defuddle` (tool-specific
to the Obsidian shell). Each prompt returns the skill body; descriptions come
from the skill's own frontmatter. **Decision point for spec review:** curated
list vs. all-14.

### 4.4 Pages as resources

- URI scheme: `knowlery://<kb>/<vault-relative-path>` (e.g.
  `knowlery://work/concepts/backpressure.md`).
- Listing follows the protocol's split (maintainer P2 at spec review — MCP
  keeps concrete resources and templates on separate methods):
  **`resources/list`** returns exactly one concrete resource per registered KB
  (its `KNOWLEDGE.md` entry point); **`resources/templates/list`** exposes the
  `knowlery://{kb}/{+path}` resource template. The listing stays bounded
  regardless of vault size; agents reach specific pages through query results
  and wikilinks, instantiating the template.
- **Readable-path allowlist (maintainer P1 at spec review — the product
  boundary that free-form notes stay yours):** resource reads serve only the
  *curated knowledge surface* —
  `KNOWLEDGE.md`, the four compiled dirs (`entities/`, `concepts/`,
  `comparisons/`, `queries/`), and installed-bundle pages under `Library/`.
  Everything else (`Daily/`, `Projects/`, arbitrary `.md`) is refused with an
  explanation. This creates a deliberate asymmetry with `query`, which
  surfaces user-tier pages by 0.6 design: an agent may *discover* a raw note's
  existence (path, title, description — retrieval metadata), but reading its
  full content over MCP is out of bounds; the refusal message says so and
  points at `/cook` as the way content is promoted into the readable layer.
- Reads additionally canonicalize and **prefix-check against the KB root** (no
  traversal, no symlink escape — the `init_kb` discipline applied to reads),
  refuse non-markdown binaries, and pass through allowed `.md` content
  verbatim.

### 4.5 Client setup docs

The docs site opens **"Agents & MCP"** (en + zh): config snippets for Claude
Desktop / Claude Code / Cursor / gemini-cli, the tool reference, and the
conduct notes (abstention is an answer; `stale` output is a work list, not an
alarm). The `knowlery-cli` skill's command table gains the `mcp` row.

### 4.6 The freeze runway

Tool names, input schemas, and structured-output shapes land marked
"1.0-frozen-candidate"; F5 ratifies them into the stability contract. Renames
after F2 acceptance need maintainer sign-off — the contract effectively starts
now.

## 5. Safety properties, restated as tests

1. Protocol round trip over the SDK's in-memory transport (no subprocess in
   unit tests): initialize → `tools/list` (exact five tools, schemas present) →
   each tool called happy-path against registered fixture KBs.
2. Validation: unknown `kb` → tool error listing registered names; malformed
   arguments (missing question, extra fields) → schema rejection; the server
   never crashes on bad input (the F1 lesson, protocol edition).
3. Resources: traversal attempts (`../`, absolute paths, symlink out of the
   KB) are refused; **a user-tier note (`Projects/…`, `Daily/…`) is refused
   with the boundary explanation even though `query` can surface it**; a
   compiled page and a `Library/` bundle page read verbatim; **`resources/list`
   carries exactly the per-KB entry points and `resources/templates/list`
   carries the template — asserted as two separate protocol calls**, never one
   entry per page.
4. Result-vs-error semantics: an unhealthy `health` and an abstaining `query`
   come back as successful results with the finding in `structuredContent`;
   unknown `kb` and malformed input come back as tool errors.
5. Prompts: the curated set is exactly present; each returns non-empty content
   matching the bundled skill.
6. Federated query via MCP matches the CLI's federated output for the same
   fixture registry (shared-core proof).
7. Smoke: the built `knowlery-cli.mjs` speaks real stdio JSON-RPC — spawn,
   initialize, `tools/list`, one `query` call, clean shutdown.

## 6. Acceptance criteria

1. §5 green; purity guard covers `core/mcp/`; no existing test modified.
2. Docs: "Agents & MCP" section (both locales) with working client configs;
   `docs:build` green; skill assertions updated.
3. `npm test`, lint, build, eval `--assert-baseline` green.
4. Manual §7 passes on at least two real clients.

## 7. Maintainer self-test checklist (acceptance round)

1. Wire `knowlery mcp` into Claude Desktop (or Claude Code) and Cursor via the
   documented configs; confirm tool discovery.
2. Real conversations: "query my <kb> for …" (attribution correct), a
   federated "which KB has …", a `stale` check on your real vault, and one
   deliberate unanswerable question — the agent should relay abstention, not
   hallucinate.
3. Load the `ask` prompt from the client's prompt picker; confirm it's the
   skill verbatim.
4. Ask the agent to read a page it found via query (resource read); then ask
   it to read `../../etc/hosts` — refused.
5. `npm test && npm run eval -- --assert-baseline` — green.
