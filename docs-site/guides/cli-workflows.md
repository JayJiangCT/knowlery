# CLI Workflows

End-to-end walkthroughs for running Knowlery entirely from the command line —
no Obsidian required. Every folder these workflows produce opens in Obsidian
later with zero migration.

Install once:

```bash
npm install -g knowlery
knowlery --version
```

## From zero to a working knowledge base

```bash
# 1. Initialize a workspace
knowlery init --dir ~/kb/research --platform claude-code --name "Research KB"

# 2. Register it so every later command (and MCP) can address it by name
knowlery kb add research ~/kb/research

# 3. Verify
knowlery health --kb research
```

`init` scaffolds the four compiled directories, `KNOWLEDGE.md`, `SCHEMA.md`,
`INDEX.base`, the built-in skills, and the agent platform config. From here,
drop raw notes anywhere in the folder and let an agent `/cook` them.

## The daily loop, headless

```bash
# What's waiting?
knowlery stale --kb research

# Ask a question (from any directory)
knowlery query --kb research "what did we decide about the rollout?"

# Search everything you have
knowlery query --kb '*' "where did I write about backpressure?"
```

`stale` is a work list: compiled pages whose cited sources changed, plus notes
never compiled. Cook selectively — many notes are legitimately never compiled.

Abstention (`No confident matches`) is a result, exit 0. Scripts can rely on
`--json` for stable shapes on every command that reports.

## After an upgrade

```bash
npm i -g knowlery@latest
knowlery sync --kb research        # refreshes skills + instruction files
```

`sync` is idempotent and write-on-change; it refuses to run if the workspace
was last synced by a *newer* version (the downgrade guard), so a stale global
install can never damage an upgraded workspace.

## Share a slice of your knowledge

```bash
# 1. See what a topic's graph-closure would ship
knowlery bundle export retrieval-engine --kb research
# -> exits 1 with the review checklist: nothing ships unreviewed

# 2. Record your review decisions (there is deliberately no approve-all)
knowlery bundle review retrieval-engine --kb research --list --json
knowlery bundle review retrieval-engine --kb research \
  --approve concepts/retrieval-engine concepts/scoring --flag Projects/meeting-notes

# 3. Export, then publish to a GitHub Release
knowlery bundle export retrieval-engine --kb research --zip
knowlery bundle publish retrieval-engine --kb research --repo you/knowledge-shelf
```

`publish` creates the Release with a SHA-256 checksum in its notes and prints
an **audience statement** — exactly who can download this and how to grant
access. Publishing to a public repo requires re-acknowledging the risk items
(`--acknowledge-risks`) — a public release is permanent.

## Install and stay subscribed

```bash
# Install from a URL (private repos work through your gh login)
knowlery bundle install https://github.com/you/knowledge-shelf/releases/download/v1.0.0/bundle.zip \
  --kb research --verify <sha256>

# Later: is anything newer?
knowlery bundle check-updates --kb research     # read-only, never auto-updates
knowlery bundle update some.bundle --kb research
```

Updates go through the full gate pipeline: version must increase, conformance
is checked, and local modifications to installed bundle files make the update
refuse (with the file list) unless you pass `--force`.

## Serve your KBs to agents

```bash
# Local agents (Claude Desktop/Code, Codex, Cursor, Antigravity): stdio
claude mcp add knowlery -- knowlery mcp

# Another machine: HTTP behind a tunnel
openssl rand -hex 32 > ~/.knowlery-mcp-token
knowlery mcp serve --port 8787 --token-file ~/.knowlery-mcp-token
cloudflared tunnel --url http://127.0.0.1:8787
```

See [Agents & MCP](./agents-mcp) for the full tool reference, write-access
flags, and client configs.

## Scripting notes

- Every command takes `--dir <path>` (default: cwd) or `--kb <name>` — never
  both. The registry is never required; `--dir` workflows work forever.
- `--json` is available on every reporting command; shapes are frozen as part
  of the 1.0 contract.
- Exit codes: `0` success (including abstention and empty reports), `1`
  operational failure (unhealthy workspace, failed gate), `2` usage error
  (bad flags, missing arguments).
- Output is pipe-safe: `knowlery query ... | head -1` works; an early-closed
  pipe is a normal end of conversation, not an error.
