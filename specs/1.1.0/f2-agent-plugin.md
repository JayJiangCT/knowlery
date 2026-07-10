# F2 (1.1.0) — The Agent Plugin: Knowledge in One Install

- **Status:** Done — maintainer acceptance passed 2026-07-09 (spec review: Antigravity deferral + all-three-platforms bar; implementation review: four doc-consistency rounds; §7: Claude Code live session incl. shim, Codex temp-home install, Cursor confirmed, cold npx provisioning, MCP smoke 9 tools / 10 prompts. **Post-release recheck recorded:** `npx knowlery@^1` pulls the published 1.0.0 until 1.1.0 ships — rerun §7.5 against the published package after the release)
- **Target release:** 1.1.0
- **Branch:** `cursor/11-f2-agent-plugin-92eb`
- **Depends on:** F1 (register_kb ships in the plugin's tool surface), 1.1
  plan principles 1–2 and 5–6 (distribution-layer-not-a-shell, npx
  provisioning, the skill blind spot, no-install-scripts — all binding), 1.0
  contract (what the plugin wires up is frozen surface)

## 1. Problem statement

Today a user assembles Knowlery by hand: install the CLI, wire the MCP
config, hope the agent knows the conduct. The plugin collapses that to one
install action per platform — MCP server auto-provisioned, skills live,
conduct shipped — on the three platforms the maintainer targets (plan
amendment 2026-07-09): **Claude Code, Codex, Cursor**. Their plugin systems
have converged on the same bundle idea, which is why one tree can serve all:

| | manifest | skills | MCP config |
| --- | --- | --- | --- |
| Claude Code | `.claude-plugin/plugin.json` | `skills/<name>/SKILL.md` | `.mcp.json` |
| Codex | `.codex-plugin/plugin.json` | `skills/<name>/SKILL.md` | `.mcp.json` (via manifest path) |
| Cursor | `.cursor-plugin/plugin.json` | `skills/<name>/SKILL.md` | `mcp.json` |

## 2. Goals

1. **One committed plugin tree** (`plugin/` at repo root) carrying three
   manifests, the generated `skills/`, both MCP config filenames, and the
   Claude Code `bin/` shim.
2. **Generated, drift-guarded**: `skills/` is built from `BUNDLED_SKILLS` by
   a build script; CI fails if the committed tree differs from a fresh build
   (the `query-script.generated` precedent, applied again).
3. **The `knowlery-mcp` front-door skill** (plan principle 5): the workflow
   layer tool descriptions can't carry.
4. **Transport-aware revisions**: `ask`'s retrieval ladder and the `stale`
   references in `cook`/`audit` name the MCP tools as step one when present.
5. Version lockstep: manifest versions pinned to the package version by the
   contract suite.

## 3. Non-goals

- No new runtime, no new handlers (plan principle 1) — the plugin starts the
  same `knowlery mcp` everyone runs.
- No install scripts or lifecycle hooks (plan principle 6) — provisioning is
  `.mcp.json` + npx, nothing executes at install time.
- No marketplace files or submissions — that is F3 (this feature delivers
  the installable artifact; F3 makes it discoverable).
- No per-platform skill variants: one `skills/` tree, byte-identical content
  across platforms and with `BUNDLED_SKILLS`.
- No plugin-side settings/state.

## 4. Design

### 4.1 The tree

```
plugin/
├── .claude-plugin/plugin.json     # name, version, description; components at root by convention
├── .codex-plugin/plugin.json      # + interface metadata (display name, category, prompts)
├── .cursor-plugin/plugin.json     # name + component paths
├── skills/                        # GENERATED from BUNDLED_SKILLS — do not edit
│   ├── ask/SKILL.md … (all 15)
├── .mcp.json                      # Claude Code + Codex:  npx -y knowlery@^1 mcp
├── mcp.json                       # Cursor (same content, its expected filename)
└── bin/knowlery                   # Claude Code shim: exec npx -y knowlery@^1 "$@"
```

- The `^1` pin leans on the 1.0 freeze (plan principle 2); the two MCP config
  files are generated from one template — they cannot diverge.
- The shim is POSIX shell, two lines, executable bit set; Codex/Cursor agents
  reach the CLI through the `npx` form the skills teach.
- **Decision point resolved (Antigravity — maintainer decision at spec
  review):** Defer Antigravity from the F2 committed artifact. Its bundle
  shape appears compatible, so the `plugin/` layout must not preclude a
  later root `plugin.json` + `mcp_config.json`, but F2 only ships the
  accepted target set: Claude Code, Codex, and Cursor. Antigravity remains
  a follow-up/F3 candidate once its install flow and manifest schema are
  manually verified (real install path, manifest fields, `mcp_config.json`
  shape, one clean install) — "one install, verified platform" stays the
  promise; three-stable-plus-one-experimental would dilute it.

### 4.2 Generation and the drift guard

- `scripts/build-plugin.mjs` (run via `npm run build:plugin`): emits
  `skills/<name>/SKILL.md` from every `BUNDLED_SKILLS` entry (frontmatter =
  the skill's own `content`, which already carries it), the manifests
  (version injected from `package.json`), both MCP configs from one template,
  and the shim.
- The tree is **committed** (marketplace installs are git-based on all three
  platforms — the artifact must exist in the repo, not only in releases).
- CI: a `plugin-drift` check runs the builder into a temp dir and diffs
  against `plugin/` — byte-identical or fail (the exact discipline that
  guards `query-script.generated.ts` today).

### 4.3 The `knowlery-mcp` skill

New `BUNDLED_SKILLS` entry (`kind: 'tooling'`), and added to
`MCP_PROMPT_SKILLS` — it is precisely the skill an MCP client should be able
to load. Content: only what per-tool descriptions cannot carry (plan
principle 5, division of labor binding):

- The tool-selection map: query for questions, stale before cooking, health
  after bulk changes, list_bundles for provenance — with the one-line "why"
  for each.
- The capture → cook loop as a cross-tool narrative (capture lands in
  inbox/, surfaces as uncooked, /cook compiles — "remember this" is a loop,
  not a call).
- Federation timing: when to use `kb: "*"` vs a named KB.
- A readable conduct digest (findings are data; abstention is an answer;
  writes act on the user's words) — consistent with, not duplicating, the
  descriptions.
- Explicitly absent: per-tool parameter documentation.

Counts move: skills 14 → 15, prompts 9 → 10. Both additive; the smoke skill
count, the prompt-list assertion, and the contract golden regenerate once —
sanctioned here (the F3-1.0 precedent).

### 4.4 Transport-aware skill revisions

- `ask`: the retrieval ladder gains step zero — "if Knowlery MCP tools are
  available, `query` *is* the ladder: call it with the KB name; only walk
  the command ladder when no MCP tools are present."
- `cook` / `audit`: the stale-report references gain the MCP `stale` tool as
  the first-listed transport.
- `knowlery-cli`: gains one line pointing MCP-only agents at the
  `knowlery-mcp` skill.
- One source, all surfaces: vault installs, MCP prompts, and the plugin tree
  all pick these up in the same release.

### 4.5 Skill dedupe/precedence (plan open question 1, resolved)

Plugin skills are session-global and platform-namespaced (the exact slash
form varies by client — e.g. Claude exposes
`/mcp__plugin_knowlery_knowlery__ask`); vault-installed skills are
workspace-level plain names (`/ask`). Both may be visible in a vault-opened
session. The resolution is
**identity, not priority**: both copies are generated from the same
`BUNDLED_SKILLS` at the same version, so whichever the agent loads, the
content is the same. Version skew between plugin and vault is bounded by the
sync discipline (vault skills refresh on `sync`; plugin skills refresh on
plugin update) and is harmless within 1.x by the stability contract. The
docs state this plainly; no mechanism is built.

## 5. Safety properties, restated as tests

1. **Drift**: the committed `plugin/` tree equals a fresh
   `build-plugin` output byte-for-byte (CI check + unit test).
2. **Parity**: every `plugin/skills/<name>/SKILL.md` equals the
   corresponding `BUNDLED_SKILLS` content exactly; the set of directories
   equals the set of skill names — no extras, none missing.
3. **Manifests**: all three parse as
   JSON, carry `name: "knowlery"`, and their `version` equals
   `package.json`'s (wired into the version-coherence contract test).
4. **MCP configs**: `.mcp.json` and `mcp.json` are content-identical and
   specify exactly `npx -y knowlery@^1 mcp`; the shim is executable and
   contains the same pin.
5. **knowlery-mcp content**: names all nine read/write tools it maps, the
   capture→cook loop, and the conduct lines (skill-content assertions, the
   established pattern).
6. **Transport revisions**: `ask` names the `query` tool before the command
   ladder; `cook`/`audit` name the `stale` tool (assertions).
7. **Counts**: prompts list is exactly the 10; installed-skill count
   assertions updated to 15 — the sanctioned changes, nothing else modified.
8. **No-execution**: the plugin tree contains no hooks file and no code
   outside `bin/` (asserted structurally — the no-install-scripts principle
   as a test).

## 6. Acceptance criteria

1. §5 green; golden/count regenerations are exactly the sanctioned ones.
2. Docs: "Agents & MCP" gains "Install as a plugin" (per-platform, en+zh);
   gemini-cli references replaced per the plan amendment; the
   dedupe-precedence statement included.
3. `npm test`, lint, build, `docs:build`, eval `--assert-baseline` green.
4. Manual §7 green on all three committed platforms: Claude Code, Codex, and Cursor.

## 7. Maintainer self-test checklist (acceptance round)

1. Claude Code: `/plugin marketplace add <local path>` → install → new
   session: nine tools discovered without any manual MCP config; the
   plugin-provided ask skill loads (exact slash form varies by client —
   Claude exposes it as `/mcp__plugin_knowlery_knowlery__ask`; wording fixed
   at acceptance); `knowlery --version` works in the Bash tool (the shim).
2. Codex: install the plugin (local marketplace entry) → `@knowlery` skills
   present; MCP tools live; ask a question against a registered KB.
3. Cursor: install from the plugin directory → MCP tools present in the
   agent; a skill invocation works.
4. In one client with **no prior knowlery install**: confirm the first MCP
   session provisions via npx (cold start, no global npm install present).
5. Load `knowlery-mcp` from a prompt picker; confirm the tool-selection map
   reads correctly and matches the live tool surface.
6. `npm test && npm run eval -- --assert-baseline` — green.
