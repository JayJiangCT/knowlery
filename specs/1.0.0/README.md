# Knowlery 1.0.0 — Release Plan

**Theme:** the memory layer — `knowlery mcp` makes the knowledge base something
every agent can cold-start faster and maintain more easily: initialize a KB from
any conversation, feed it as you talk, query it from anywhere, and keep it healthy
without opening a terminal or Obsidian. One core, three shells — and a major
version that means it: the workspace format, the CLI surface, and the MCP tool
contracts freeze under semver.

## Features

| # | Feature | Spec | Depends on |
|---|---------|------|------------|
| F1 | KB registry: named knowledge bases (`kb add/list/remove`), `--kb` across all commands, federated query with source attribution | (spec pending) | — |
| F2 | `knowlery mcp` (stdio): read tools (`list_kbs`, `query`, `stale`, `health`, `list_bundles`), skills as MCP prompts, pages as MCP resources | (spec pending) | F1 |
| F3 | The write path: `init_kb` (cold start from a conversation), `capture` (inbox-only), `sync`; agent conduct for writes | (spec pending) | F2 |
| F4 | Remote mode (self-hosted): Streamable HTTP + token auth, read-only by default, tunnel guidance, the per-agent access matrix | (spec pending) | F2 |
| F5 | The 1.0 stability contract: format/CLI/MCP-contract freeze, contract tests, docs finalization | (spec pending) | F1–F4 |

Execution order: F1 → F2 → F3 → F4 → F5. F1 is pure CLI groundwork (valuable
alone, MCP is its second consumer); F5 is the release itself wearing a spec.

## The product story (maintainer framing, binding on F2/F3 design)

Knowlery MCP exists to make the KB **faster to cold-start and easier to
maintain**:

- **Cold start**: "帮我建个知识库" in any MCP-connected conversation →
  `init_kb(name, path)` registers and scaffolds it; `capture` feeds it from the
  same conversation; the first `/cook` turns captures into compiled knowledge.
  The empty-vault problem dissolves — a KB is born *inside* the workflow that
  needs it.
- **Maintenance**: `health`, `stale`, and `sync` sit one tool call away from
  every agent, so "is my KB current?" is something agents check and report
  proactively instead of something the user remembers to run.

## MCP design principles (binding on F2–F4)

1. **The registry is the addressing layer.** Every MCP tool takes a `kb` name
   resolved through the F1 registry; the MCP server holds no per-vault state of
   its own. Federated query (`kb: "*"`) is registry iteration + result merging
   with per-KB attribution.
2. **Read wide, write narrow.** Read tools cover the whole surface. Writes are
   exactly three, each with a structural safety argument: `init_kb` creates only
   new directories (never touches existing content), `capture` appends **only to
   the inbox** (the compiled layer is reachable only through `/cook`'s reviewed
   pipeline — the same gate philosophy as export review), `sync` is the existing
   idempotent, downgrade-guarded operation.
3. **Skills become prompts; pages become resources.** The 14 built-in skills map
   onto MCP prompts (the retrieval ladder, cook discipline, review conduct — the
   accumulated craft ships with the tools, not just the tools). Knowledge pages
   expose as browsable resources (`knowlery://<kb>/concepts/...`), so agents can
   follow the wikilink graph, not just search it.
4. **stdio is full-featured; remote is opt-in and read-only by default.** The
   local server (Claude Desktop, Claude Code, Cursor, gemini-cli) gets
   everything. `knowlery mcp serve --http` requires an explicit flag, a
   locally-generated bearer token, and grants reads only — `--allow-capture` and
   `--allow-init` opt writes in individually. Knowlery still never *manages*
   credentials: the token is generated and configured by the user, verified by
   comparison, stored nowhere else.
5. **The remote protocol is the platform's dress rehearsal.** A future hosted
   platform's product form is exactly "a remote MCP endpoint over your KBs" —
   F4's tool contracts and auth boundary are designed so the platform is a
   second host, not a redesign (the publish-target / upstream-protocol
   discipline, applied a third time).

## Scope decision: cloud agents (maintainer, at plan discussion)

The per-agent reality, documented rather than papered over:

| Agent class | 1.0 answer |
|---|---|
| Local MCP clients (Claude Desktop/Code, Cursor, gemini-cli) | stdio — full support |
| Cloud agents **with a shell** (Cursor Cloud Agent, Codex-style) | already served: the CLI + 0.9's bundle distribution |
| Web-only cloud agents (ChatGPT connectors, Gemini web, Claude web) | **out of scope for 1.0** — self-hosted remote mode + a tunnel works for the determined; the zero-setup answer is the hosted platform (Beyond-1.0) |

No ChatGPT-connector-specific adaptation ships in 1.0; the access matrix in the
docs states each path honestly.

## Non-goals for 1.0.0

- No hosted infrastructure of any kind (the platform stays a recorded
  trajectory).
- No MCP writes into the compiled knowledge layer — `capture` ends at the inbox
  by design; cooking remains a reviewed, human-in-the-loop act.
- No OAuth/identity provider integration in remote mode (bearer token only;
  identity is the platform's problem).
- No new retrieval mechanics; the engine is consumed as-is.
- No breaking changes to the workspace format — 1.0 *freezes* it.

## Carried policies

- Lockstep versioning; the full release-prep checklist (manifest / package /
  package-lock / versions.json / bundle stamp).
- SDD process unchanged: spec → maintainer acceptance → implementation →
  maintainer self-test, per feature, branches `cursor/10-f<N>-<name>-92eb` cut
  from `main` after the previous feature merges.
- Docs are a gated deliverable per feature (the 0.9 discipline): the docs site
  gains an "Agents & MCP" section growing with F2–F4.

## Backlog ledger (carried into 1.0, schedulable opportunistically)

- Settings fallback deletion + `minAppVersion` bump — still blocked on Obsidian
  1.13 reaching public release.
- `/explore` / `/ideas` adopting the retrieval ladder (0.7 F5 leftover).
- `no-explicit-any` tightening (0.8 F4 recorded).
- Ranking misses q-016 / q-020; all-latin exactly-half collision (recorded,
  never observed).
- Beyond 1.0: the hosted platform (remote MCP endpoint as its product form;
  paid publishing/subscription per the 0.9 note).
