# Agents & MCP

Any MCP-capable agent — Claude Desktop, Claude Code, Codex, Cursor, the
Antigravity suite — can talk to your knowledge bases directly. `knowlery mcp`
runs an MCP server over stdio: the agent starts it, discovers the tools, and
your knowledge becomes ambient in every conversation, with no
per-conversation setup.

The server addresses knowledge bases by their **registry names** — register
each one with `knowlery kb add work ~/vaults/work-kb`, or from a
conversation with the `register_kb` tool.

## Client setup

Per-client configuration (Claude Code, Claude Desktop, Codex & Codex CLI,
Cursor, Antigravity Desktop/CLI/IDE) lives in
**[Connect Your Agent](./connect-your-agent)** — one section per client,
with the zero-install `npx` form and the GUI-PATH caveats. For what to do
once connected, see **[Talk to Your Knowledge Base](./talk-to-your-kb)**.

This page is the reference underneath both: the tool contract, the conduct,
the readable-surface boundary, and remote access.

## Tools

| Tool | Arguments | What it does |
| --- | --- | --- |
| `list_kbs` | — | Every registered KB with its path and live state |
| `query` | `kb`, `question`, `k?` | Deterministic retrieval; `kb: "*"` searches every KB with per-KB attribution |
| `stale` | `kb` | Compiled pages older than their sources, plus never-compiled notes |
| `health` | `kb` | Workspace integrity check |
| `list_bundles` | `kb` | Installed knowledge bundles with provenance |
| `init_kb` | `name`, `path`, `platform?` | Create and register a new KB — cold start from a conversation |
| `register_kb` | `name`, `path` | Bring an already-initialized KB into the registry (local stdio only) |
| `capture` | `kb`, `content`, `title?` | Save conversation content as a new note in the KB's `inbox/` |
| `sync` | `kb` | Refresh built-in skills and instruction files to the installed version |

Every tool returns both readable text and structured JSON (the same shapes the
CLI's `--json` flags have carried since 0.7).

**Findings are data.** A query abstention (`verdict: "no-confident-match"`), an
unhealthy `health` report, and a long `stale` list are all *successful*
results — they are the answer, and a well-behaved agent relays them instead of
retrying or guessing. Tool errors are reserved for actual breakage: unknown KB
names, malformed input, unreadable disks.

- **Abstention is an answer.** "The knowledge base has no confident match" is
  precisely what you want to hear when it's true.
- **`stale` output is a work list, not an alarm.** It tells you what to
  re-cook when you next tend the vault.

## The write path

Four tools write, and each is structurally bounded:

- **`init_kb`** creates at most one new directory (its parent must already
  exist), refuses non-empty targets, and registers the result. A failed init
  cleans up after itself — a directory that existed before init is never
  deleted.
- **`register_kb`** brings an *existing, already-initialized* KB into the
  registry — it writes the registry file and nothing else, and a taken name
  is a hard error, not an auto-rename. It is not offered by `mcp serve`: the
  registry is machine-global state, so editing it stays a local act. Honest
  note: turning a folder of existing notes *into* a KB still needs the CLI
  (`knowlery init` works brownfield; MCP's `init_kb` deliberately refuses
  non-empty directories) — register it afterwards from the conversation.
- **`capture`** appends one new note to `inbox/` — filenames are constructed
  from a timestamp and a slug, never taken from the caller, and nothing is
  ever overwritten. Captures show up as *uncooked notes* in `stale` and are
  findable by `query` immediately; `/cook` treats `inbox/` as first-priority
  material. This is the "remember this" loop: capture in conversation, compile
  when you next cook.
- **`sync`** writes only content determined by the installed Knowlery version —
  the caller supplies nothing. The downgrade guard (workspace last synced by a
  newer version) is a tool error with the upgrade command in the message.

Nothing writes the compiled layer (`entities/`, `concepts/`, `comparisons/`,
`queries/`, `Library/`, `KNOWLEDGE.md`). Content is promoted there only through
`/cook`'s reviewed pipeline — the same gate philosophy as bundle export review.

**Write conduct** (also stated in each tool's description): write tools act on
the user's words, not the agent's initiative. Capture only what the user asked
to save, and echo back the written path. Restate the resolved path *before*
calling `init_kb` — creating a directory is the user's decision. Report sync's
file list after running it.

## Skills as prompts

The knowledge-workflow skills are exposed as MCP prompts, loadable from the
client's prompt picker: `ask`, `cook`, `explore`, `challenge`, `ideas`,
`audit`, `organize`, `vault-conventions`, `knowlery-cli`. Each returns the
skill body verbatim — the same craft the Obsidian plugin installs, now
machine-loadable anywhere.

## Pages as resources

Knowledge pages are readable at `knowlery://<kb>/<path>`, e.g.
`knowlery://work/concepts/backpressure.md`. The resource list shows one entry
point per KB (its `KNOWLEDGE.md`); agents reach specific pages through query
results and wikilinks.

Only the **curated knowledge surface** is readable: `KNOWLEDGE.md`, the
compiled directories (`entities/`, `concepts/`, `comparisons/`, `queries/`),
and installed-bundle pages under `Library/`. Free-form notes (`Daily/`,
`Projects/`, anything else) are refused — `query` may surface a raw note's
title and path, but its content stays yours until you promote it with `/cook`.

## Remote access (self-hosted)

`knowlery mcp serve` runs the same server over Streamable HTTP — for reaching
your KBs from another machine: a home server hosting them, a laptop away from
home, a cloud agent given a tunnel URL.

```bash
# 1. Generate a token (Knowlery never generates or stores it for you)
openssl rand -hex 32 > ~/.knowlery-mcp-token

# 2. Start the server — reads only, loopback bind
knowlery mcp serve --port 8787 --token-file ~/.knowlery-mcp-token
```

The token can also come from the `KNOWLERY_MCP_TOKEN` environment variable
(one source only — setting both is an error; it is never accepted as a bare
CLI argument). Tokens under 16 bytes are refused. Every request must send
`Authorization: Bearer <token>`; failures get a `401` that reveals nothing.

**Writes are off by default.** Each write tool has its own flag — no bundling:

```bash
knowlery mcp serve --port 8787 --token-file ~/.knowlery-mcp-token \
  --allow-capture --allow-sync \
  --allow-init --kb-root ~/kbs
```

A write that isn't switched on is not present at all — it doesn't appear in
`tools/list` and can't be called. `--allow-init` requires `--kb-root`:
remote-initiated KBs may only be created under that directory.

**Keep the bind on `127.0.0.1` and put a tunnel in front** — the server does
no TLS; the tunnel owns the wire:

```bash
cloudflared tunnel --url http://127.0.0.1:8787   # quick tunnel
tailscale serve 8787                             # tailnet-only
ssh -L 8787:127.0.0.1:8787 my-server             # plain SSH
```

Client config for a remote server (Cursor shown; Claude Code:
`claude mcp add --transport http knowlery <url> --header "Authorization: Bearer <token>"`):

```json
{
  "mcpServers": {
    "knowlery-remote": {
      "url": "https://your-tunnel-host/mcp",
      "headers": { "Authorization": "Bearer <token>" }
    }
  }
}
```

### Which agents can reach your knowledge, honestly

| Agent class | 1.0 answer |
| --- | --- |
| Local MCP clients (Claude Desktop/Code, Codex, Cursor, Antigravity) | `knowlery mcp` over stdio — full support, all nine tools |
| Cloud agents with a shell (Cursor Cloud Agent, Codex-style) | already served: the CLI + bundle distribution |
| Web-only cloud agents (ChatGPT connectors, Gemini web, Claude web) | out of scope for 1.0 — self-hosted remote + a tunnel works for the determined; the zero-setup answer is a hosted platform, which is a recorded trajectory, not a 1.0 deliverable |

## Troubleshooting

- **"Unknown knowledge base"** — the name isn't registered. `knowlery kb list`
  shows what is; `knowlery kb add <name> <path>` fixes it.
- **Tools discovered but every call fails** — check the KB states in
  `list_kbs`; `missing` means the folder moved, `uninitialized` means it was
  never set up (`knowlery init`).
- **Client can't start the server** — the client may not share your shell's
  PATH. Use the absolute path to `knowlery` in the config.
