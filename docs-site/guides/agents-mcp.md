# Agents & MCP

Any MCP-capable agent — Claude Desktop, Claude Code, Cursor, gemini-cli — can
talk to your knowledge bases directly. `knowlery mcp` runs an MCP server over
stdio: the agent starts it, discovers the tools, and your knowledge becomes
ambient in every conversation, with no per-conversation setup.

The server addresses knowledge bases by their **registry names** — register
each one first:

```bash
knowlery kb add work ~/vaults/work-kb
```

## Client setup

All clients use the same command: `knowlery mcp`. If `knowlery` isn't on the
PATH the client uses, install globally (`npm install -g knowlery`) or use the
absolute path shown by `which knowlery`.

### Claude Code

```bash
claude mcp add knowlery -- knowlery mcp
```

### Claude Desktop

Add to `claude_desktop_config.json` (Settings → Developer → Edit Config):

```json
{
  "mcpServers": {
    "knowlery": {
      "command": "knowlery",
      "args": ["mcp"]
    }
  }
}
```

### Cursor

Add to `~/.cursor/mcp.json` (global) or `.cursor/mcp.json` (per-project):

```json
{
  "mcpServers": {
    "knowlery": {
      "command": "knowlery",
      "args": ["mcp"]
    }
  }
}
```

### gemini-cli

```bash
gemini mcp add knowlery knowlery mcp
```

Or add the same `mcpServers` block to `~/.gemini/settings.json`.

## Tools

| Tool | Arguments | What it does |
| --- | --- | --- |
| `list_kbs` | — | Every registered KB with its path and live state |
| `query` | `kb`, `question`, `k?` | Deterministic retrieval; `kb: "*"` searches every KB with per-KB attribution |
| `stale` | `kb` | Compiled pages older than their sources, plus never-compiled notes |
| `health` | `kb` | Workspace integrity check |
| `list_bundles` | `kb` | Installed knowledge bundles with provenance |
| `init_kb` | `name`, `path`, `platform?` | Create and register a new KB — cold start from a conversation |
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

Exactly three tools write, and each is structurally bounded:

- **`init_kb`** creates at most one new directory (its parent must already
  exist), refuses non-empty targets, and registers the result. A failed init
  cleans up after itself — a directory that existed before init is never
  deleted.
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

## Troubleshooting

- **"Unknown knowledge base"** — the name isn't registered. `knowlery kb list`
  shows what is; `knowlery kb add <name> <path>` fixes it.
- **Tools discovered but every call fails** — check the KB states in
  `list_kbs`; `missing` means the folder moved, `uninitialized` means it was
  never set up (`knowlery init`).
- **Client can't start the server** — the client may not share your shell's
  PATH. Use the absolute path to `knowlery` in the config.
