# Connect Your Agent

One server, every client: `knowlery mcp` speaks MCP over stdio, so any
MCP-capable agent can host your knowledge base. This page has a section per
client. Everything after connection is the same everywhere — see
[Talk to Your Knowledge Base](./talk-to-your-kb).

::: tip The fastest path: install the plugin
The Knowlery **agent plugin** collapses the setup below into one install
action — MCP server (auto-provisioned via npx) plus all fifteen skills:

- **Claude Code**: `/plugin marketplace add JayJiangCT/knowlery` →
  `/plugin install knowlery`
- **Codex**: `codex plugin marketplace add <source>` →
  `codex plugin add knowlery@<marketplace>`
- **Cursor**: install from a checkout's `plugin/` dir or the release zip
  (until the marketplace listing lands)

Details in [Install as a plugin](./agents-mcp#install-as-a-plugin). The
manual MCP config below remains fully supported — use it when you want the
server without the skills, or on clients without a plugin system.
:::

## Before you start

Two equivalent ways to provide the server; every section below works with
either:

```jsonc
// A. Zero-install (recommended): npx fetches the package on first run
{ "command": "npx", "args": ["-y", "knowlery@^1", "mcp"] }

// B. Installed CLI: one line, PATH handled with your consent
//    curl -fsSL https://jayjiangct.github.io/knowlery/install.sh | sh
{ "command": "knowlery", "args": ["mcp"] }
```

The installer puts the CLI in an isolated prefix (`~/.knowlery/cli`, no
sudo, no global npm), links it into `~/.local/bin`, and — only if that
directory isn't on your PATH — shows the exact line and **asks** before
touching any shell config. Re-running it upgrades in place.
(`npm i -g knowlery` works too, with the usual global-prefix PATH caveats.)

One caveat worth knowing for **GUI clients** (Claude Desktop, IDEs): they
often don't inherit your shell's PATH, so `npx`/`knowlery` may not resolve
if node was installed via nvm/homebrew. The bulletproof form is absolute
paths: `"command": "/absolute/path/to/node", "args":
["/absolute/path/to/knowlery-cli.mjs", "mcp"]` — or at least the absolute
path to `npx` (`which npx`).

## At a glance

| Client | Config location | Notes |
| --- | --- | --- |
| Claude Code | `claude mcp add` | full support |
| Claude Desktop | `claude_desktop_config.json` | shell-less: `register_kb` is how existing KBs join |
| Codex CLI | `~/.codex/config.toml` | config shared with the Codex app |
| Codex (app / IDE extension) | same `config.toml`, or Plugins | shell-having: CLI also works |
| OpenCode | `~/.config/opencode/opencode.json` | first-class Knowlery platform — see the config-ownership note |
| Cursor | `~/.cursor/mcp.json` or deeplink | project-level `.cursor/mcp.json` also supported |
| Antigravity Desktop / CLI / IDE | `~/.gemini/config/mcp_config.json` | one config serves all three |

## Claude Code

```bash
claude mcp add knowlery -- npx -y knowlery@^1 mcp
```

Restart the session; the tools appear automatically. Claude Code also reads
vault-installed skills when you open a Knowlery workspace folder.

## Claude Desktop

Settings → Developer → Edit Config, then add **at the top level** of
`claude_desktop_config.json` (not inside `preferences`):

```json
{
  "mcpServers": {
    "knowlery": {
      "command": "npx",
      "args": ["-y", "knowlery@^1", "mcp"]
    }
  }
}
```

Quit fully (Cmd+Q) and relaunch — the config is read at startup. Knowlery
appears under Connectors. Claude Desktop has no shell, which is exactly what
the MCP surface is for: `register_kb` brings existing KBs in from the
conversation, and the nine tools cover the daily loop end to end.

Note: the "Managed MCP servers" settings page is for org-pushed *remote*
servers (it requires a URL) — local stdio servers go in the JSON config
above.

## Codex CLI

Add to `~/.codex/config.toml`:

```toml
[mcp_servers.knowlery]
command = "npx"
args = ["-y", "knowlery@^1", "mcp"]
```

Restart `codex`. Since Codex has a shell, the `knowlery` CLI works alongside
the MCP tools — the `knowlery-cli` skill teaches the command surface.

## Codex (app / IDE extension)

The app shares `~/.codex/config.toml` with the CLI — the block above serves
both. Once the Knowlery plugin ships (1.1), the `/plugins` browser becomes
the one-click path; skills will be invocable as `@knowlery`.

## OpenCode

OpenCode's config shape differs from the Claude family — the top-level key
is `mcp` (not `mcpServers`), each entry declares `"type": "local"`, and
`command` is a **single array** carrying the binary and its arguments
together (there is no separate `args` field):

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "knowlery": {
      "type": "local",
      "command": ["npx", "-y", "knowlery@^1", "mcp"],
      "enabled": true
    }
  }
}
```

Add this to the **global** config at `~/.config/opencode/opencode.json`
(or run the interactive `opencode mcp add`). Verify with `opencode mcp list`.

::: warning Put the MCP block in the global config, not the vault's
OpenCode is a first-class Knowlery platform: `knowlery init --platform
opencode` generates the workspace's own `opencode.json` (plus rules under
`.agents/rules/`), and Knowlery **regenerates that file** on "Regenerate
agent config" and platform switches. An MCP block added to the vault-level
`opencode.json` would be overwritten — the global config is the durable
home, and it serves every project at once.
:::

OpenCode agents have a shell, so the `knowlery` CLI works alongside the MCP
tools; the vault's `.agents/rules/` and skills (installed by
`init`/`sync`) already teach the retrieval conduct.

## Cursor

Add to `~/.cursor/mcp.json` (global) or `.cursor/mcp.json` (per-project):

```json
{
  "mcpServers": {
    "knowlery": {
      "command": "npx",
      "args": ["-y", "knowlery@^1", "mcp"]
    }
  }
}
```

Reload the window (Cmd+Shift+P → "Reload Window"); check Settings → MCP for
the server and its tools. Cursor agents have a shell, so the CLI form works
too.

## Antigravity 2.0 (Desktop, CLI, and IDE)

The Antigravity suite shares one MCP configuration across all three
surfaces. Add to `~/.gemini/config/mcp_config.json`:

```json
{
  "mcpServers": {
    "knowlery": {
      "command": "npx",
      "args": ["-y", "knowlery@^1", "mcp"]
    }
  }
}
```

- **Desktop / IDE**: restart; the tools attach to agent sessions.
- **CLI (`agy`)**: run `/mcp` to confirm the server and inspect its tools.
- Shared skills (loadable across the suite) live under `~/.gemini/skills/` —
  the Knowlery plugin will target this layout when it ships.

## Remote (any client, another machine)

All of the above run the server locally. To reach KBs hosted elsewhere, run
`knowlery mcp serve` on the host behind a tunnel and point the client at the
URL with a bearer token — see
[Remote access](./agents-mcp#remote-access-self-hosted).

## Verify the connection

In any connected client, ask:

> List my knowledge bases.

You should get the registry listing (or "No knowledge bases registered" on a
fresh machine — then say "set up a knowledge base for me" and go from
there). If the server doesn't appear at all: check JSON/TOML syntax, use
absolute paths (the GUI PATH caveat above), and confirm Node.js ≥ 18 is
installed.
