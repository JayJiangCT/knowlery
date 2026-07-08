# F4 (1.0.0) — Remote Mode (Self-Hosted): Streamable HTTP + Token Auth

- **Status:** Draft — awaiting maintainer spec acceptance
- **Target release:** 1.0.0
- **Branch:** `cursor/10-f4-remote-mode-92eb`
- **Depends on:** F2 (the handlers, reused verbatim — the shell-supplies-
  transport discipline pays out here), F3 (the write tools and their
  structural bounds), 1.0 plan §"MCP design principles" 4 (stdio full-featured,
  remote opt-in read-only, per-write opt-in flags — binding) and the `init_kb`
  `--kb-root` confinement (plan principle 2, binding)

## 1. Problem statement

stdio serves every agent that runs on the user's machine. It cannot serve the
other machine: a home server hosting the KBs, a laptop reaching them from
elsewhere, a shell-less cloud agent given a tunnel URL. F4 is the self-hosted
answer — the same server core behind an HTTP transport, guarded by a bearer
token, **read-only unless each write is individually switched on**. It is also
the platform's dress rehearsal (plan principle 5): a future hosted product is
exactly this endpoint operated by someone else, so the auth boundary and
access flags must be right, not convenient.

## 2. Goals

```
knowlery mcp serve --port 8787                # reads only; token required to start
knowlery mcp serve --port 8787 \
  --allow-capture --allow-sync \
  --allow-init --kb-root ~/kbs               # writes, each individually opted in
```

1. **Streamable HTTP transport** (the SDK's `StreamableHTTPServerTransport`,
   stateless mode) wrapping the **unchanged** F2/F3 handler core.
2. **Bearer token auth**: required to start, verified on every request by
   constant-time comparison, configured by the user (env var or file) — never
   generated, stored, or managed by Knowlery.
3. **Read-only by default**: without flags, `tools/list` contains exactly the
   five read tools. Each write is its own flag — `--allow-capture`,
   `--allow-init`, `--allow-sync` — one uniform rule, no implicit bundling.
4. **`init_kb` confinement**: `--allow-init` is only accepted together with
   `--kb-root <dir>`; remote-initiated KBs must resolve under that root.
5. **Docs**: the "Agents & MCP" section grows remote setup (token, tunnel
   guidance, the per-agent access matrix stated honestly).

## 3. Non-goals

- No OAuth/OIDC/identity integration — bearer token only; identity is the
  platform's problem (plan non-goal, verbatim).
- No TLS termination in-process: localhost binding + a tunnel (or a reverse
  proxy) owns the wire; the docs say so plainly and recommend tunnels that
  encrypt (cloudflared, tailscale, ssh -L).
- No multi-user or per-token scoping: one token, one owner — this is
  *self-hosted, single-operator* mode. Scoping is platform territory.
- No rate limiting, no audit log beyond the transport's own request handling.
- No session resumption/event store (stateless mode); no SSE long-poll
  guarantees beyond what the SDK's transport provides.
- No change to stdio mode: `knowlery mcp` keeps all eight tools with no flags
  — the local caller already owns the machine.

## 4. Design

### 4.1 Command shape and lifecycle

- `knowlery mcp serve` is a subcommand of `mcp` (positional arity: exactly
  one, the literal `serve`). Flags: `--port <n>` (required — no default port;
  an operator should choose deliberately), `--host <addr>` (default
  `127.0.0.1`; anything else prints a bind warning naming the tunnel
  alternative), `--allow-capture`, `--allow-sync`, `--allow-init`,
  `--kb-root <dir>`.
- The token comes from `KNOWLERY_MCP_TOKEN` or `--token-file <path>`
  (whichever is set; both set is an error — ambiguity refused, the F1 --kb/--dir
  lesson). **Never a bare CLI argument** — argv is world-readable in `ps`.
  Empty or missing token → the server refuses to start (exit 2) with
  generation guidance (`openssl rand -hex 32`). Tokens shorter than 16 bytes
  are refused as guessable.
- On startup the server prints: bind address, the access mode line
  ("reads only" or the enumerated writes), and the kb-root if set. It runs
  until SIGINT/SIGTERM.

### 4.2 Auth: verify by comparison, store nowhere

- Every HTTP request must carry `Authorization: Bearer <token>`. Verification
  is `timingSafeEqual` over hashes of the two values (hashing first makes
  length-mismatch constant-time too). Failure → `401` with a JSON-RPC error
  body and `WWW-Authenticate: Bearer`; nothing about the expected token is
  ever echoed.
- The token is held in server memory for the process lifetime; it is never
  written to disk, logs, or error messages (the "Knowlery never manages
  credentials" 0.9 discipline, applied to our own endpoint).

### 4.3 Access flags are structural, not behavioral

- The flags decide **which tools get registered** on the server instance —
  a disallowed write is not "present but refusing": it is absent from
  `tools/list`, unknown to `tools/call`, invisible in every way. There is no
  runtime permission check to get wrong.
- `buildMcpServer` gains an `access` option:
  `{ writes?: { capture?: boolean; sync?: boolean; init?: { kbRoot: string } | false } }`
  — defaulting to *all enabled, unconfined* for stdio (F2/F3 behavior,
  unchanged, asserted by the existing tests).
- `--allow-init` without `--kb-root` is a startup error (exit 2), not a
  runtime refusal — the operator must state where remote-born KBs may live
  before the server will offer the tool at all.

### 4.4 `init_kb` under `--kb-root`

- The F3 path contract runs unchanged, with one additional rule inserted
  after the canonical candidate is formed: the candidate must lie under the
  canonicalized kb-root (`realpath(--kb-root)` at startup; startup fails if it
  doesn't exist). Refusal names the configured root.
- The kb-root confinement composes with (never replaces) the F3 rules: parent
  exists, one new leaf, empty target, not inside a registered KB, cleanup
  semantics — all identical, one test asserts a representative F3 refusal
  through the HTTP transport to prove the same code ran.

### 4.5 Transport details

- SDK `StreamableHTTPServerTransport` in **stateless mode**
  (`sessionIdGenerator: undefined`): the server holds no per-session state —
  the registry is the addressing layer (plan principle 1), so statelessness
  is free and restart-safe.
- **The stateless lifecycle is per-request, and that is implementation
  contract, not an option** (maintainer P2 at spec review — the SDK's own
  constraint): the `node:http` server is long-lived, but **each incoming MCP
  request constructs a fresh `buildMcpServer(access)` + fresh
  `StreamableHTTPServerTransport({ sessionIdGenerator: undefined })`**,
  handles the request, and closes both when the response closes. Reusing one
  transport/server pair across requests causes message-ID collisions the
  moment there is a second request or a second client (SDK 1.29 documented
  behavior). Handler registration is cheap (schema objects + closures; every
  tool call is a live scan anyway per the no-cache rationale), so per-request
  construction costs nothing that matters.
- One `node:http` server; the MCP endpoint is `POST /mcp` (plus the
  transport's own `GET`/`DELETE` handling); everything else → `404`. No
  Express — the SDK transport works against plain node req/res.
- Binding defaults to loopback. The docs' remote story is **tunnel-first**:
  cloudflared / tailscale serve / ssh -L, each with a copy-paste snippet, all
  keeping the bind on `127.0.0.1`.

### 4.6 Client setup docs and the access matrix

"Agents & MCP" (en + zh) gains a "Remote access (self-hosted)" section:

- Start-the-server walkthrough (token generation, systemd/launchd hint,
  tunnel snippets).
- Client config for remote MCP (Claude Code `--transport http`, Cursor `url`
  entries) with the Authorization header.
- The per-agent access matrix from the plan, stated honestly: local MCP
  clients → stdio; shell-having cloud agents → CLI + bundles; web-only cloud
  agents (ChatGPT connectors, Gemini web, Claude web) → out of scope for 1.0,
  self-hosted remote + tunnel for the determined, hosted platform as the
  recorded trajectory.
- Conduct notes carry over unchanged (abstention is an answer; write conduct
  per F3) — remote changes *where* the server runs, not how agents should
  behave toward it.

### 4.7 The freeze runway

`serve` flags and the HTTP auth contract join the 1.0-frozen-candidate set;
F5 ratifies. Tool names/schemas are already frozen candidates from F2/F3 and
are untouched here.

## 5. Safety properties, restated as tests

1. **Auth gate**: no header, wrong token, malformed header → `401` with
   `WWW-Authenticate`, and no tool ever executes; correct token → full round
   trip (SDK HTTP client against a real server on an ephemeral port).
2. **Startup refusals**: no token source → exit 2 with guidance; both token
   sources → exit 2; token under 16 bytes → exit 2; `--allow-init` without
   `--kb-root` → exit 2; missing/nonexistent kb-root → exit 2. (Unit-level:
   the option-resolution function; one spawn test for the no-token shape.)
3. **Read-only default**: default flags → `tools/list` is exactly the five
   read tools; `tools/call capture` → unknown-tool error, and the disk shows
   no write. Each `--allow-*` flag adds exactly its tool; all three → eight.
4. **kb-root confinement**: remote `init_kb` inside the root succeeds
   (registered, scaffolded); outside the root refused naming the root; a
   representative F3 refusal (non-empty target) reproduces through HTTP —
   same core, same message.
5. **Stateless lifecycle, same process**: sequential requests within one
   server process answer correctly (the per-request transport contract —
   this is the test that fails if an implementation reuses one
   transport/server pair); **two concurrent clients** each complete a full
   round trip against the same process without message-ID interference.
6. **Stateless restart**: server restarted between two calls; the second call
   (new process, same registry) answers identically — no session coupling.
7. **stdio unchanged**: the existing F2/F3 test files pass unmodified (the
   `access` default proves itself).
8. **Token hygiene**: server startup output and error responses never contain
   the token string (asserted over captured stdout/stderr and 401 bodies).
9. **Smoke**: the built artifact starts `mcp serve` with a token file, serves
   one authorized `query` over real HTTP, rejects one unauthorized call, and
   shuts down cleanly on SIGTERM.

## 6. Acceptance criteria

1. §5 green; purity guard covers new core modules; stdio suites untouched.
2. Docs: remote section + access matrix (both locales); `docs:build` green.
3. `npm test`, lint, build, eval `--assert-baseline` green.
4. Manual §7 passes with one real remote client through a tunnel.

## 7. Maintainer self-test checklist (acceptance round)

1. Generate a token, start `knowlery mcp serve --port 8787` (reads only),
   tunnel it (cloudflared or tailscale), and wire a real client from the
   docs' remote config; confirm tool discovery shows five tools.
2. Real conversation over the tunnel: a `query` with attribution and one
   deliberate unanswerable (abstention relayed).
3. Call `capture` from the client — the client should report the tool doesn't
   exist. Restart with `--allow-capture`; capture works and lands in inbox/.
4. Restart with `--allow-init --kb-root <dir>`; init a KB inside the root
   (works) and ask for one outside it (refused, root named).
5. Hit the endpoint with `curl` and no token — `401`, nothing leaks.
6. `npm test && npm run eval -- --assert-baseline` — green.
