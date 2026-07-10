# Install the CLI

The `knowlery` CLI (which also carries the MCP server) installs differently
per platform — this page has one section per OS. Either way, verify with:

```bash
knowlery --version
```

::: tip Don't need the command on your PATH?
Every use of `knowlery <cmd>` also works as `npx -y knowlery@^1 <cmd>` with
zero installation — and MCP client configs can use the npx form directly.
Installing is for people who want the bare command in their terminal.
:::

## macOS (and Linux)

**Requirement:** Node.js ≥ 18 (`node -v` to check; install via
[nodejs.org](https://nodejs.org), Homebrew, or nvm).

**Recommended — the one-line installer:**

```bash
curl -fsSL https://jayjiangct.github.io/knowlery/install.sh | sh
```

What it does (and deliberately doesn't):

- installs into an isolated prefix (`~/.knowlery/cli`) — no `sudo`, no
  global npm involvement;
- links the command into `~/.local/bin`;
- if that directory isn't on your PATH, it shows the exact line and **asks
  before touching your shell config** — decline and it prints the manual
  instruction instead. Nothing is ever modified silently.
- re-running the same line upgrades in place.

Open a new terminal afterwards and run `knowlery --version`.

**Alternative — npm global:**

```bash
npm install -g knowlery
```

Works when your npm global-prefix `bin` is on PATH (nvm users: always true).
If you get `command not found` afterwards, that's the exact problem the
one-line installer exists to solve — use it instead.

**Uninstall (installer method):** `rm -rf ~/.knowlery/cli ~/.local/bin/knowlery`,
plus the one marked line in your shell config if you approved it.

## Windows

**Requirement:** Node.js ≥ 18 — install with either:

```powershell
winget install OpenJS.NodeJS.LTS
```

or the installer from [nodejs.org](https://nodejs.org). Both wire npm's
global directory (`%AppData%\npm`) onto your PATH automatically — which is
why the plain npm route is the smooth path on Windows:

```powershell
npm install -g knowlery
knowlery --version
```

Open a **new** terminal after installing Node before running npm.

**If `knowlery` isn't recognized** after install: check that
`%AppData%\npm` is on your PATH (Settings → System → About → Advanced
system settings → Environment Variables), add it if missing, then open a
new terminal.

**WSL users:** inside WSL you're on Linux — use the macOS/Linux one-line
installer above.

**MCP configs on Windows** use the same JSON as everywhere; if you point at
absolute paths, remember they look like
`C:\\Users\\you\\AppData\\Roaming\\npm\\knowlery.cmd` (escaped backslashes
in JSON), or sidestep paths entirely with the `npx` form.

> A native PowerShell one-line installer is a recorded candidate, not yet
> shipped — on Windows the npm route needs no PATH surgery, so the gap is
> smaller than on macOS.

## After installing, on any OS

```bash
knowlery init --dir ~/kb/main --platform claude-code --name "My KB"
knowlery kb add main ~/kb/main
knowlery index --kb main
```

Then [connect your agent](../guides/connect-your-agent) — or if you came
from Obsidian, your existing vault is already compatible:
`knowlery kb add <name> <vault-path>` and every command works against it.
