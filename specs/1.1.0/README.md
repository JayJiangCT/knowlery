# Knowlery 1.1.0 — Release Plan

**Theme:** knowledge in one install — Knowlery becomes an **agent plugin**.
Installing it in Claude Code or Codex wires up everything at once: the MCP
server (auto-provisioned via npx, no separate CLI install), the skills that
teach the agent to use it well, and the conduct that keeps it trustworthy.
The 1.0 stability contract is the foundation that makes this safe: what the
plugin wires up is frozen surface.

1.1 also completes the write path for shell-less clients: a Claude Desktop
user can now bring an *existing* knowledge base into the registry from a
conversation — the gap the plugin work surfaced (a plugin makes shell-less
clients first-class; `register_kb` makes them complete).

## Features

| # | Feature | Spec | Depends on |
|---|---------|------|------------|
| F1 | `register_kb` MCP tool: bring an existing initialized KB into the registry from a conversation; the shell-less brownfield story documented honestly | [f1-register-kb.md](./f1-register-kb.md) | 1.0 |
| F2 | The agent plugin: one plugin tree, manifests for **Claude Code + Codex + Cursor** (`.claude-plugin/`, `.codex-plugin/`, `.cursor-plugin/`), skills built from `BUNDLED_SKILLS`, MCP config provisioning the server via `npx -y knowlery@^1 mcp`; a new `knowlery-mcp` front-door skill + transport-aware revisions to existing skills | [f2-agent-plugin.md](./f2-agent-plugin.md) | 1.0 (F1 desirable first — ships in the plugin's tool surface) |
| F3 | Plugin distribution: release-workflow plugin assets, self-hosted `marketplace.json`, community-marketplace submissions, the "Install as a plugin" docs path | (spec pending) | F2 |

Execution order: F1 → F2 → F3. F1 is a small, contract-additive MCP tool
that should exist before the plugin snapshot freezes its tool list; F3 is
distribution mechanics over F2's artifact.

## Design principles (binding on F1–F3)

1. **The plugin is a distribution layer, not a fourth shell.** No new
   runtime, no new handlers: the plugin tree carries manifests, skills
   generated from the existing single source (`BUNDLED_SKILLS`), and an
   `.mcp.json` that starts the same `knowlery mcp` everyone else runs. If a
   behavior needs code, it lands in the core and every surface gets it.
2. **`npx -y knowlery@^1 mcp` is the provisioning trick.** Installing the
   plugin requires no separate npm step — the first MCP session pulls the
   package. The `^1` pin leans directly on the 1.0 stability contract:
   within 1.x, version skew between the plugin's pin and a user's global
   CLI is harmless by promise, not by luck. (Claude Code additionally gets a
   `bin/` shim so `knowlery` is on the agent's PATH while the plugin is
   enabled.)
3. **`register_kb` writes the registry, nothing else.** It validates that
   the target is an *already initialized* workspace (KNOWLEDGE.md or
   manifest present), canonicalizes the path (the F3-1.0 discipline), and
   adds the name — the MCP twin of `kb add`, with the same name-grammar
   rules; duplicate names hard-error like `init_kb` rather than inheriting
   `kb add`'s overwrite behavior (a conversation can ask; re-pointing a name
   stays an explicit CLI act). It does not scaffold, does
   not touch files inside the KB. Brownfield *initialization* over MCP stays
   refused (init_kb's non-empty refusal is a 1.0-frozen safety property);
   the honest answer for "turn this messy folder into a KB" remains the CLI,
   and the docs say so.
4. **Conduct carries over, and the plugin ships it.** register_kb acts on
   the user's words with the path restated first (the init_kb rule);
   plugin-shipped skills are the same set the MCP prompts expose, so an
   agent behaves identically whether skills arrived via plugin, vault
   install, or prompt loading.
5. **Skills close the MCP blind spot (maintainer decision at plan review).**
   The knowledge skills predate MCP: `ask`'s retrieval ladder teaches three
   transports (in-app command, global CLI, embedded script) a shell-less MCP
   client cannot execute, while the one transport it *can* use — the `query`
   tool — goes unnamed. Two moves, division of labor deliberate:
   - **Transport-aware revisions**: `ask`'s ladder (and the `stale`
     references in `cook`/`audit`) gain "if Knowlery MCP tools are present,
     they are step one" — one source (`BUNDLED_SKILLS`), all surfaces fixed
     at once.
   - **A new `knowlery-mcp` tooling skill** (twin of `knowlery-cli`, the
     plugin's front door): only what tool descriptions cannot carry — the
     tool-selection map (query vs stale vs health), the capture→cook loop
     as a cross-tool narrative, federation timing, and a readable conduct
     digest. Deliberately *not* per-tool parameter detail — that is the
     tool descriptions' job, and duplicating it manufactures drift.
6. **"Installed" means: MCP usable, skills live, the agent has the CLI.**
   The plugin performs no install scripts (the platforms' trust boundary,
   respected): MCP provisioning rides `.mcp.json` + npx; Claude Code gets a
   `bin/` shim putting `knowlery` on the agent's PATH while the plugin is
   enabled; Codex agents use the `npx -y knowlery@^1 <cmd>` form the skills
   teach. The one step left to the human — a global `npm i -g knowlery` for
   their own terminal — is exactly the one the trust model reserves for
   them, and the skills teach the agent to *suggest* it, never run it
   unasked.
7. **The contract grows additively.** New tool (`register_kb`) and new
   remote flag (`--allow-register`, if F1 lands remote exposure) are minor
   under the 1.0 freeze. The contract golden regenerates once per feature,
   deliberately, with the diff called out in review. Nothing existing
   changes shape.

## Open design questions (to settle in specs)

- **Skill dedupe/precedence**: plugin skills are session-global
  (`/knowlery:ask`), vault installs are per-KB. Both may be present. The F2
  spec must state the precedence story and make sure double-loading is
  harmless (identical content from one source makes this mostly moot, but
  it must be *stated*).
- **register_kb remote exposure**: does `mcp serve` get `--allow-register`,
  or is registration local-stdio-only in 1.1? (Leaning: own flag, same
  uniform rule as the other writes — but the registry is machine-global
  state, which is a stronger argument for local-only than capture had.)
- ~~**gemini-cli extensions**: third manifest in the same tree, or defer?~~
  **Resolved at plan amendment (maintainer decision, 2026-07-09):** gemini-cli
  is removed from the target set — Google replaced it with the Antigravity
  suite (desktop / CLI / IDE). The 1.1 targets are **Claude Code, Codex, and
  Cursor** (Cursor's plugin system — `.cursor-plugin/plugin.json` + `skills/`
  + `mcp.json`, Cursor Marketplace — verified structurally equivalent).
  **Antigravity** is a compatible candidate (its plugin shape is the same
  bundle idea: root `plugin.json` + `mcp_config.json` + `skills/<name>/SKILL.md`)
  recorded as a decision point in the F2 spec: a fourth manifest is cheap if
  wanted now, and the tree layout must not preclude it either way. Existing
  docs mentioning gemini-cli update as part of F2/F3.

## Non-goals for 1.1.0

- No new retrieval mechanics, no workspace-format changes (frozen).
- No filesystem scanning for "discovering" unregistered vaults — the
  registry remains the user's deliberate address book.
- No plugin-side state or configuration beyond what the manifests carry.
- No hosted marketplace of our own; we publish *to* existing marketplaces.
- No Obsidian-plugin changes beyond version lockstep.

## Carried policies

- Lockstep versioning; the full release-prep checklist, now enforced by the
  contract suite's version-coherence test.
- SDD unchanged: spec → maintainer acceptance → implementation → maintainer
  acceptance, branches `cursor/11-f<N>-<name>-92eb` from `main`.
- Docs are a gated deliverable per feature (en + zh).

## Backlog ledger (carried, schedulable opportunistically)

- `--platform codex` CLI adapter: **superseded by the plugin** for agent
  integration; a plain AGENTS.md generator remains a possible small feature
  if demand shows up (recorded, not scheduled).
- Settings fallback deletion + `minAppVersion` bump — still blocked on
  Obsidian 1.13 public release.
- `/explore` / `/ideas` retrieval-ladder adoption (0.7 F5 leftover).
- `no-explicit-any` tightening (0.8 F4).
- Ranking misses q-016 / q-020; all-latin exactly-half collision.
- Beyond 1.1: the hosted platform (the remote MCP endpoint as its product
  form). Recorded at 1.1 plan review: if the platform materializes, the thing
  that earns a real marketplace is **knowledge bundles** (browse / subscribe /
  paid distribution over the 0.9 publish-subscribe protocol) — not plugins.
  Plugin distribution stays catalog-file + community-marketplace submissions;
  Knowlery itself will not build or operate plugin-market infrastructure.
