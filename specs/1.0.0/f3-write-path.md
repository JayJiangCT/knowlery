# F3 (1.0.0) — The Write Path: `init_kb`, `capture`, `sync`

- **Status:** Accepted 2026-07-08 (one finding at spec review: init_kb canonicalization redefined for a not-yet-existing leaf — parent realpath + canonical candidate; three decision points confirmed) — implementation in progress
- **Target release:** 1.0.0
- **Branch:** `cursor/10-f3-write-path-92eb`
- **Depends on:** F2 (the server, the findings-are-data semantics, the
  `defineTool` strict-input discipline — all binding), 1.0 plan §"MCP design
  principles" 2 (read wide, write narrow; the `init_kb` path contract frozen at
  plan review — binding verbatim)

## 1. Problem statement

F2 made the knowledge base ambient for reading. But the cold-start problem —
the reason a KB doesn't exist yet — lives on the write side: today "帮我建个知
识库" requires leaving the conversation for a terminal, and "remember this"
requires the user to transcribe their own conversation into a note. F3 closes
the loop with exactly three writes, each carrying a structural safety argument
rather than a behavioral promise: `init_kb` creates at most one new directory,
`capture` appends only to the inbox, `sync` writes only binary-determined
content. The compiled knowledge layer remains reachable **only** through
`/cook`'s reviewed pipeline — same gate philosophy as export review.

## 2. Goals

Three new MCP tools on the F2 server (stdio; remote exposure is F4's flags):

1. **`init_kb({ name, path, platform? })`** — cold start from a conversation.
   Scaffolds a workspace (the CLI `init` pipeline) at `path` and registers it
   as `name`. The one exception to the addressing rule: it takes a path and
   *creates* the registry entry.
2. **`capture({ kb, content, title? })`** — "remember this". Writes one new
   note under `inbox/` in the named KB. Never overwrites, never touches any
   other directory.
3. **`sync({ kb })`** — workspace maintenance one tool call away. The existing
   idempotent, downgrade-guarded `runSync`; the caller supplies zero content.

Plus: agent conduct for writes (tool descriptions + docs), and the inbox
convention documented.

## 3. Non-goals

- **No write access to the compiled layer.** No tool creates or edits pages
  under `entities/`, `concepts/`, `comparisons/`, `queries/`, `Library/`, or
  `KNOWLEDGE.md`. Compilation is `/cook`'s reviewed job, on every transport.
- No `cook` tool: compilation is judgment, not mechanics — it stays a
  skill/prompt driving the agent, not a tool the agent fires blindly.
- No remote exposure in this feature: F4 adds `--allow-init`,
  `--allow-capture`, `--allow-sync` (one uniform rule, no implicit bundling).
  F3 is stdio-only, where the caller already owns the machine.
- No `capture` batching, tagging, or routing options — the inbox is
  deliberately dumb; organization happens at cook time.
- No delete/rename/uninstall tools of any kind.

## 4. Design

### 4.1 The inbox convention

`capture` writes to **`inbox/`** at the KB root — a new, deliberately dumb
convention with three structural properties:

- **It is user-tier by construction**: `scanVault` classifies any directory
  outside the four compiled dirs as `user`, so captures appear in the
  staleness report as *uncooked notes* and in `query` results (0.6 design)
  with zero new mechanism. The loop closes by itself: capture → uncooked →
  `stale` surfaces it → `/cook` compiles it.
- **Created on demand** by the first capture. It is *not* added to the init
  scaffold, the health check's required dirs, or `KNOWLEDGE.md` — an empty
  inbox is not a state worth manufacturing. (Decision point for spec review.)
- The `/cook` skill gains one line naming `inbox/` as the capture landing
  zone, so compilation knows where conversation-born material accumulates.

### 4.2 `capture` — append-only, path-sealed

- File shape: `inbox/<YYYY-MM-DD-HHmmss>-<slug>.md`, where `<slug>` is the
  title lowercased and reduced to `[a-z0-9-]` (empty slug → `note`). The
  filename is **constructed, never caller-supplied** — no path separators can
  survive slugging, so escape is structurally impossible rather than filtered.
- Collision (same second, same slug): a numeric suffix is appended;
  `capture` **never overwrites any existing file**.
- Note shape: frontmatter (`title`, `captured` ISO timestamp,
  `source: conversation`) + the content verbatim. Content must be non-empty;
  no upper bound (the inbox is the user's own disk).
- Result (data): the written path, the title, and one reminder line that the
  note is uncooked until `/cook` runs.
- `kb` resolves through the registry (F1 error on unknown); `kb: "*"` is
  invalid here — writes take exactly one KB.

### 4.3 `init_kb` — the plan-frozen path contract, implemented

Input: `name` (registry-valid), `path` (absolute or `~`-expanded), `platform`
(optional, `claude-code` | `opencode`, default `claude-code`).

Order of operations — **all validation before any write**:

1. `name` passes `validateKbName` and is not already registered (hard error
   listing existing names — no auto-suffix; the agent should surface the
   conflict, not silently pick a new name. Decision point: this is stricter
   than the Obsidian plugin's self-registration suffix behavior, deliberately —
   a conversation can ask, a plugin boot cannot).
2. **Canonicalization, defined so it works for a leaf that does not exist
   yet** (maintainer P1 at spec review — a missing target cannot be
   realpath'd, and skipping canonicalization to make the happy path pass
   would gut the symlink/prefix checks): expand the path (`~`, relative →
   absolute); **canonicalize the parent** (which must exist — rule 3) via
   realpath; the **target canonical candidate** is
   `join(parentReal, basename(target))`. If the target itself already exists
   (the pre-existing-empty-dir case), realpath it too and **require it to
   equal the candidate** — a target that is itself a symlink is refused. All
   subsequent prefix and internal-path checks run against the candidate.
3. The parent directory must already exist and be user-writable — `init_kb`
   creates **at most one new leaf directory**, never a recursive tree.
4. The target must not exist, or must be an empty directory; a non-empty
   directory is refused (stricter than CLI `init --force` — MCP offers no
   force).
5. The target must not lie inside an existing registered KB (prefix check
   against every registered real path), and never inside Knowlery-internal
   paths (the config dir holding the registry).
6. Scaffold via the platform-neutral `executeSetup` pipeline (same files as
   CLI `init`), then register via `addKb`.
7. **Failure cleanup** (the plan's newly-created/pre-existing distinction):
   init records whether it created the target directory. On any failure after
   writing begins, a **newly-created** target is removed entirely; a
   **pre-existing empty** target has only this run's written contents rolled
   back — the user's directory itself is never deleted. No partial state
   outside the target either way; a failure after scaffold but before
   registration also cleans up (an unregistered scaffold is invisible to MCP
   and would be half-born).

Result (data): the registered name, the canonical path, the platform, and the
suggested next step (`capture` or `/cook`).

### 4.4 `sync` — the write whose content the caller cannot choose

- Resolves `kb`, runs the existing `runSync` over `nodeVaultFs` — idempotent,
  write-on-change, downgrade-guarded. The caller supplies zero content;
  everything written is determined by the installed binary (the reason F4 can
  even consider offering this remotely).
- Result (data): the updated-file list, or "no changes".
- The **downgrade guard trips as a tool error** (not a finding): "workspace
  was last synced by a newer Knowlery" means *this call cannot proceed as
  asked* — that is a broken call, with the fix (`npm i -g knowlery@latest`) in
  the message. (Decision point: this is the one place refusal-as-error vs
  finding-as-data needed a judgment call; `health`'s unhealthy verdict remains
  data because reporting is the point of that tool, whereas sync's point is
  the write it refused to make.)

### 4.5 Agent conduct for writes

Written into tool descriptions (the only channel every client honors) and the
docs' conduct section:

- **`capture`**: only on the user's ask ("save this", "remember that") or
  their yes to an offer. Echo back the written path and what was captured.
  Never silently capture in the background.
- **`init_kb`**: only on explicit request; restate the resolved path in
  conversation *before* calling — a directory creation is the user's decision.
- **`sync`**: run when the user asks, or after they accept a suggestion (e.g.
  when `health` reports missing skills). Report the file list.
- The shared rule, stated once in docs: **write tools act on the user's
  words, not the agent's initiative** — same rule the bundle review/publish
  conduct established.

### 4.6 Contract surface

Three new tool names + input schemas join the 1.0-frozen-candidate set (F2
§4.6); the F5 ratification covers all eight. `tools/list` grows from five to
eight — the F2 test asserting *exactly five* tools is updated to *exactly
eight*, and this spec sanctions that one existing-test modification explicitly
(it is the assertion doing its job).

## 5. Safety properties, restated as tests

1. **capture round trip**: note lands under `inbox/` with frontmatter and
   verbatim content; result names the path; the note then appears in `stale`'s
   `uncookedNotes` and is findable by `query` (the self-closing loop, asserted
   end to end over the in-memory transport).
2. **capture is sealed**: a title of `../../etc/passwd` (and separators,
   backslashes, dots) produces a slug-safe filename *inside* `inbox/`;
   same-title-same-second collisions get suffixes, never overwrites; empty
   content → tool error; `kb: "*"` → tool error; unknown `kb` → F1 error.
3. **init_kb happy path**: scaffold matches CLI `init` (manifest, KNOWLEDGE.md,
   skills), the registry gains the name, and the new KB immediately serves
   `query`/`health` on the same server session (no restart needed).
4. **init_kb path contract**: missing parent refused; a path needing two new
   levels refused; non-empty target refused; target inside a registered KB
   refused; **a missing leaf under a symlinked parent resolves through the
   parent's realpath** (created at the real location, and the prefix checks
   see the real location); an existing target that is itself a symlink
   refused; duplicate name refused **before any write** (target directory
   untouched).
5. **init_kb cleanup**: a failure injected after scaffolding begins (e.g.
   registration failing on an unwritable config dir) removes a newly-created
   target entirely, but for a pre-existing empty target removes only the
   written contents and leaves the directory standing.
6. **sync semantics**: no-change run returns "no changes" (data, twice in a
   row — idempotence); after deleting a built-in skill file, sync restores it
   and names it in the file list; a manifest marked by a newer version → tool
   error naming the upgrade path.
7. **The read/write boundary**: `tools/list` is exactly the eight; no tool
   input accepts a path into the compiled dirs (structurally — capture has no
   path parameter at all); F2's resource/prompt surfaces are untouched.
8. **Smoke**: the built artifact does one `init_kb` → `capture` → `query`
   (finds the capture) → `sync` sequence over real stdio JSON-RPC.

## 6. Acceptance criteria

1. §5 green; purity guard covers any new core module; the only modified
   existing test is the tools/list count (sanctioned in §4.6).
2. Docs: "Agents & MCP" gains the write tools + conduct (both locales);
   `docs:build` green.
3. `npm test`, lint, build, eval `--assert-baseline` green.
4. Manual §7 passes on at least one real client.

## 7. Maintainer self-test checklist (acceptance round)

1. In a real client conversation: "帮我建个知识库叫 scratch 放在 ~/tmp/scratch"
   — the agent restates the path before calling; the KB exists, is registered,
   and `list_kbs` shows it.
2. "把刚才讨论的结论存进 scratch" — the capture lands in `inbox/`, the agent
   echoes the path; `stale` on scratch lists it as uncooked.
3. Ask to init into the same name again — the agent surfaces the conflict
   instead of working around it.
4. Ask to init into a non-empty directory (e.g. `~/Documents`) — refused, no
   files touched.
5. Delete a skill file from the scratch KB, then "sync scratch" — the file is
   restored and named.
6. `npm test && npm run eval -- --assert-baseline` — green.
