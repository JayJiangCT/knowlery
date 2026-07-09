# F1 (1.1.0) — `register_kb`: The Registry Reaches Shell-less Clients

- **Status:** Draft — awaiting maintainer spec acceptance
- **Target release:** 1.1.0
- **Branch:** `cursor/11-f1-register-kb-92eb`
- **Depends on:** 1.1 plan principle 3 (writes the registry, nothing else —
  binding), 1.0 stability contract (additive growth; the golden regenerates
  once, deliberately)

## 1. Problem statement

A Claude Desktop user (MCP-only, no shell) can *create* a KB from a
conversation (`init_kb`) but cannot bring an **existing** one into the
registry — `kb add` lives on the CLI side only. The gap surfaced during the
1.1 plugin planning: the plugin makes shell-less clients first-class, and
this tool makes them complete. One user sentence should work:
"把 ~/kb/research 注册为 research" — with the agent restating the path first.

## 2. Goals

One new MCP tool on the existing server:

```
register_kb({ name, path })
```

Registers an **already initialized** Knowlery workspace under a name. The
MCP twin of `kb add`: same name grammar, same duplicate-name hard error, same
canonicalization, same registry file.

## 3. Non-goals

- No scaffolding, no file writes inside the target — `register_kb` writes
  the registry file and nothing else (plan principle 3, binding).
- No brownfield initialization over MCP: `init_kb`'s non-empty refusal is a
  1.0-frozen safety property and stands. "Turn this messy folder into a KB"
  remains the CLI's job (`knowlery init` + `kb add`), and the docs say so.
- No `unregister_kb` / removal tool: removal is destructive to the address
  book and stays a deliberate CLI act (`kb remove`). An agent that can add
  *and* remove can also "clean up" — no.
- No filesystem discovery ("scan my disk for vaults") — the registry remains
  the user's deliberate address book.
- No remote exposure in 1.1 (§4.4).

## 4. Design

### 4.1 Core: a thin wrapper over what exists

`runRegisterKb(name, rawPath)` in `core/mcp/write-tools.ts`:

1. Expand the path (`~`, relative → absolute — the F3-1.0 expansion).
2. **The target must be an initialized workspace**: reuse the registry's own
   state logic — the check is exactly "would `kb list` show this path as
   `ok`" (`KNOWLEDGE.md` or `.knowlery/manifest.json` present). Not
   initialized → tool error naming the two ways to fix it (`init_kb` for an
   empty dir, CLI `knowlery init` for a folder with existing notes).
   `kbState` is exported from `kb-registry.ts` for this — the MCP tool and
   `kb list` can never disagree about what "initialized" means.
3. Delegate to **`addKb`** — name grammar, duplicate handling, realpath
   canonicalization, and the `alsoRegisteredAs` warning all come from the
   existing core; the tool adds nothing of its own.
4. **Duplicate name is a hard error** (diverging from `addKb`'s
   silent-overwrite, matching `init_kb`'s decision): a conversation can ask;
   re-pointing a name is an explicit CLI act. Checked before `addKb` runs.
   Same-path-different-name is fine and reports `alsoRegisteredAs` as data.

### 4.2 The tool

- Input schema: `{ name: string, path: string }` (strict, as all tools).
- Result (data): `{ name, path (canonical), alsoRegisteredAs }`, with the
  text noting the KB is immediately queryable by name.
- Errors: invalid name (grammar message), unknown/uninitialized path (with
  the fix-it guidance), duplicate name (listing registered names — the F1-1.0
  error shape), registry corruption (the loud error, passed through).
- Description carries the conduct (the init_kb rule, applied): only on the
  user's explicit ask; **restate the resolved path in conversation before
  calling**; report the registered name and canonical path after.

### 4.3 Contract impact

`tools/list` grows 8 → 9 — additive, minor under the 1.0 freeze. The
contract golden regenerates **once** in this feature's PR with the diff
called out; the mcp-contract count assertions update in the same commit
(sanctioned here, the F3-1.0 precedent).

### 4.4 Remote exposure: not in 1.1 (decision point for spec review)

`register_kb` is **local-stdio-only**: `mcp serve` does not register it,
under any flag. The argument is stronger than capture's was: the registry is
*machine-global* state — a remote caller editing the address book reshapes
what every other tool on this machine can reach (federation scope, resource
listing). capture/init at least confine their writes to one KB (or one
kb-root). If demand materializes, a `--allow-register` flag is additive
later; shipping the restriction first is reversible, shipping the exposure
first is not.

## 5. Safety properties, restated as tests

1. Happy path over the in-memory transport: register an initialized fixture
   KB → result carries canonical path; `list_kbs` shows it `ok`; `query` by
   the new name answers on the same session.
2. Refusals: nonexistent path; existing-but-uninitialized dir (error names
   both fix-it routes); duplicate name → hard error listing registered names,
   registry file unchanged; invalid name grammar; symlinked path registers
   its realpath (the `addKb` canonicalization, asserted through the tool).
3. Registry-only writes: after a successful register, the target directory's
   contents are byte-identical (no file created, none touched).
4. `alsoRegisteredAs`: registering the same path under a second name succeeds
   and reports the first name as data.
5. Contract: `tools/list` is exactly nine, golden regenerated, stdio-only —
   the HTTP shell's `tools/list` does **not** contain `register_kb` under any
   flag combination.
6. Smoke: the built artifact registers a pre-initialized directory over real
   stdio JSON-RPC and immediately queries it by name.

## 6. Acceptance criteria

1. §5 green; the golden diff is exactly the one new tool; no other existing
   test modified except the sanctioned count updates.
2. Docs: "Agents & MCP" tool table + write-path section gain the row (both
   locales), including the brownfield honesty note; `docs:build` green.
3. `npm test`, lint, build, eval `--assert-baseline` green.
4. Maintainer §7 passes on one real shell-less client.

## 7. Maintainer self-test checklist (acceptance round)

1. In Claude Desktop (or another MCP-only client): "把 <已有知识库路径> 注册为
   test-reg" — the agent restates the path before calling; `list_kbs` then
   shows it; a query by name answers with citations.
2. Ask to register a plain folder (not a workspace) — refused, and the agent
   relays both fix-it routes rather than improvising.
3. Ask to register an already-taken name — the agent surfaces the conflict,
   does not work around it.
4. Start `mcp serve` with every `--allow-*` flag; confirm `register_kb` is
   absent from the remote `tools/list`.
5. `npm test && npm run eval -- --assert-baseline` — green.
