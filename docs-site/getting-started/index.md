# Getting Started

Knowlery is a knowledge base built for agents — one workspace format served
by three shells: an **MCP server** and **CLI** for any agent, and an
**Obsidian plugin** that adds the richest human interface on top. Obsidian
maximizes Knowlery; it doesn't bound it.

That means there are two ways to start, and both end at the same place — a
plain-markdown knowledge base that every surface can serve.

## Path A: Start with your agent

*~5 minutes. No Obsidian required. Best if you live in Codex, Claude,
Cursor, or Antigravity.*

1. **Connect** — install the plugin (one action on Claude Code / Codex:
   `/plugin marketplace add JayJiangCT/knowlery` → `/plugin install
   knowlery`), or add one MCP config block to any client
   ([per-client guide](../guides/connect-your-agent)):

```json
{ "command": "npx", "args": ["-y", "knowlery@^1", "mcp"] }
```

2. **Create or register a KB — in conversation:**

> "Set up a knowledge base called `main` at ~/kb/main."
> — or, if you already have notes: "Register ~/vaults/my-notes as `main`."
> (A folder of existing notes needs one CLI command first:
> `npx -y knowlery@^1 init --dir ~/vaults/my-notes --platform claude-code --name "My KB"` —
> it scaffolds *around* your notes without touching them.)

3. **Use it — also in conversation:** "remember this", "what do I know
   about…", "give my KB a checkup". See
   [Talk to Your Knowledge Base](../guides/talk-to-your-kb) for the full
   set of natural-language workflows, and
   [CLI Workflows](../guides/cli-workflows) if you prefer the terminal.

Any KB you create this way opens in Obsidian later with zero migration —
install the plugin whenever you want the review dashboard.

## Path B: Start in Obsidian

*Best if you already have a vault, or want the visual review surface from
day one.*

Install the plugin from Community plugins, run the setup wizard, and get the
action-first dashboard, Knowledge health, and the bundle
sharing UI — the full walkthrough is at
[Start in Obsidian](./obsidian).

A vault set up this way is automatically available to your agents too: the
plugin registers it in the KB registry, so the MCP tools and CLI address it
by name from anywhere.

Prefer the bare `knowlery` command in your terminal? Per-OS install
tutorials (macOS one-liner, Windows npm/winget, WSL):
[Install the CLI](./install-cli).

## Either way, read next

- [Core Concepts](../concepts/) — the two-layer model (your notes vs
  compiled knowledge), retrieval, and skills.
- [Best Practices](../guides/best-practices) — the capture → cook → ask
  rhythm that keeps a KB healthy over months.
