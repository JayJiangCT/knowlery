# Claude Code documentation consulted (WS-001)

Read on 2026-11-08 for Claude Code 2.1.318. The pages were fetched by a sub-agent that quoted short verbatim phrases. Items marked [summary] came from the fetch tool's model summary, not from verbatim page text.

| Topic | Page | Statement used |
|---|---|---|
| Rule syntax | https://code.claude.com/docs/en/permissions | "Permission rules follow the format `Tool` or `Tool(specifier)`." |
| Path anchors | same | `path` or `./path` is "Path relative to current directory". `/path` is "Path relative to the settings source". `//path` is an absolute path. |
| Edit covers Write | same | "`Edit` rules apply to all built-in tools that edit files." A `Write(...)` rule is not a separate matcher. |
| Edit deny vs Bash | same | Read/Edit deny rules do apply to some Bash file commands ("cat, head, tail, sed, and tee") and to redirect targets. They do not apply "to arbitrary subprocesses that read or write files indirectly, like a Python or Node script that opens files itself". The page adds: "For OS-level enforcement that blocks all processes from accessing a path, enable the sandbox." |
| Rule order | same | "Rules are evaluated in order: deny, then ask, then allow." |
| Sandbox scope | https://code.claude.com/docs/en/sandboxing | "The sandbox covers shell commands only. Claude's file tools, MCP servers, and hooks run outside it." |
| Sandbox mechanism (macOS) | same | "sandboxing uses the built-in Seatbelt framework." |
| Sandbox write keys | same | `sandbox.filesystem.denyWrite` / `denyRead` "Block subprocess access to specific paths". By default the working directory is writable. |
| Sandbox paths | same | "Sandbox filesystem paths use standard conventions: `/tmp/build` is absolute and `~/.kube` is relative to your home directory." The page does not say what a relative `./x` path in a `--settings` file resolves against; that was measured in `transcripts/preflight/`. |
| Rules merged into the sandbox | same | "Paths and domains from both sandbox settings and permission rules are merged into the final sandbox configuration." |
| Escape hatch | same | Claude "may retry the command with the `dangerouslyDisableSandbox` parameter". With `"allowUnsandboxedCommands": false`, "Claude Code ignores the `dangerouslyDisableSandbox` parameter". |
| MCP config | https://code.claude.com/docs/en/cli-reference | `--mcp-config`: "Load MCP servers from JSON files or strings". `--strict-mcp-config`: only use servers from `--mcp-config` [summary; the local `claude --help` for 2.1.318 says the same]. |
| MCP permission names | https://code.claude.com/docs/en/mcp | "`mcp__puppeteer__*` matches every tool from the `puppeteer` server". |
| Headless prompts | https://code.claude.com/docs/en/headless | "In a Manual mode `claude -p` run, a call that needs approval is denied unless something approves it." |
| PreToolUse hooks | https://code.claude.com/docs/en/hooks | "A hook that blocks by exiting 2 routes the same way as `"deny"`". This experiment does not use a Claude Code hook. The T4 hook is a git hook. |
| Not found | — | Whether deny rules still apply under `bypassPermissions`. Whether an empty `--setting-sources` value is valid; the runs use `--setting-sources project`. |
