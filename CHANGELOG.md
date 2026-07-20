# Changelog

## [1.2.5] — 2026-07-19

### Fixes

- **Agent skills now handle Obsidian's hidden-path boundary explicitly.**
  Obsidian CLI commands backed by the vault index — including `read` and
  `create`, even with `path=` — cannot reach dot-directories such as
  `.claude/`, `.knowlery/`, `.agents/`, and `.obsidian/`. Agents now use file
  tools directly for those paths, treat `Error:` output as failure even when
  the CLI exits with status 0, and require a `Created: <path>` result for
  successful short-note creation.
- **Full pages avoid the fragile `content=` transport.** Notes containing
  frontmatter plus body, Mermaid or other charts, code fences, tables, or
  quoted prose are written directly as Markdown files; `obsidian create`
  remains the shortcut for short content. Rule-loading guidance is now
  platform-scoped: Claude Code and OpenCode load configured rules at session
  start, while Codex follows `AGENTS.md` and reads relevant hidden rule files
  directly.

## [1.2.4] — 2026-07-17

### Brand

- **The Atlas Fold identity ships.** Knowlery's new brand system — a K-shaped
  route connecting source, structure, and retrieval, drawn in graphite and
  paper with a single Knowledge Lime signal — now carries the public surfaces:
  - **README**: light/dark lockup header, the brand voice lines, and a Brand
    section with the position/character/difference pillars; the full guide
    and assets live under `design/brand/`.
  - **Docs site (en+zh)**: full retheme from the warm chef-pot palette to
    graphite/paper with Knowledge Lime as the only live signal; flat
    structure-over-spectacle surfaces; light/dark Atlas Fold marks for the
    nav and favicon; the pot logo retired.
  - **Codex install surface**: the plugin manifest's `interface` gains
    `brandColor`, `composerIcon`, `logo`, and `logoDark`, with 512px PNGs
    rendered from the brand SVGs shipped in `plugin/assets/` (drift-guarded,
    byte-equality asserted).
  - The Obsidian community directory and Claude Code marketplaces carry no
    logo mechanism today (verified against both manifest schemas) — nothing
    to upload there yet.

### Internal

- 1.3.0 F2 groundwork: the cook-eval spec and its deterministic checker with
  golden fixtures land in the eval harness (no runtime changes).

## [1.2.3] — 2026-07-17

### Fixes

- **Skills: the write path is chosen by operation, not environment.** Full
  knowledge pages are written directly to their exact path (Obsidian indexes
  new files automatically); `obsidian create`/`append` remain for short
  content, now always taught with `path=`; `obsidian rename` stays mandatory
  for renames/moves, where wikilink rewriting is the real benefit. An explicit
  failure branch ends the escaping fights agents used to lose: if `create`
  fails once on content escaping, write the file directly and verify with
  `obsidian read` or `knowlery health`. The obsidian-cli skill gains a
  "Writing long or complex content" section naming the bash hazards
  (backticks, `$`, nested quotes).
- **Skills: reference hygiene.** Phantom references to skills removed in
  v0.3.4 are gone (`/trace` → `/explore`, `/connect` → `/challenge`
  suggestions, `/wiki` → "edit INDEX.base per the obsidian-bases skill");
  invalid CLI syntax fixed (`search query=`, no OR operator, `tags` misuse →
  `search:context`); naming conventions unified to SCHEMA.md's
  lowercase-hyphen for agent pages with user notes explicitly hands-off.
  All of it content-asserted in CI.
- **Docs: Freshness Review retired.** README and the docs site (en+zh)
  described a Freshness Review workflow that does not exist in the shipped
  plugin; those sections now describe the real staleness-report workflow.
  The reference gains the missing `knowlery-mcp` skill row (15 total) and
  current settings sections including the 1.2.2 Language setting.

## [1.2.2] — 2026-07-13

### New features

- **Simplified Chinese UI.** The Obsidian dashboard and the plugin settings
  tab are now internationalized, with Simplified Chinese as the first
  localized language. A new **Language** setting offers `Follow Obsidian`
  (default — resolves via Obsidian's own language selection), `English`, and
  `中文`. Localized surfaces include every dashboard screen (today card,
  suggested moves, knowledge health, weekly summary, bundles), the full
  settings tab with diagnostics, rules, and the skills library, command
  palette entries, file-menu items, and notices. Translation catalogs are
  typed so English/Chinese key parity is enforced at compile time.
- Deliberately unchanged: agent-facing prompts stay English (they cooperate
  with the English skill set), skill names and descriptions are content
  rather than UI copy, and the weekly report already renders bilingual
  panels. Modal dialogs (setup wizard, bundle export/install, skill and rule
  editors) remain English in this release and are the planned follow-up.

## [1.2.1] — 2026-07-10

### Fixes

- **The `vault-conventions` skill sheds its legacy BYOAO branding.** Its
  frontmatter `name` now matches the directory name (`vault-conventions`), so
  plugin skill lists no longer show a confusing "Byoao Conventions" entry, and
  its title becomes "Vault Document Conventions". The description keeps a
  deliberate "(formerly BYOAO)" pointer so agents in legacy BYOAO vaults still
  activate the skill. Existing vaults pick up the new content in place on the
  next sync — the directory name, `skills-lock.json` key, and MCP prompt name
  are unchanged, and forked or custom copies are never touched. A new
  regression test pins every bundled skill's frontmatter name to its directory
  name.

## [1.2.0] — 2026-07-10

Theme: the orientation map — Karpathy's Index.md insight delivered as a live
view rather than another file that can drift. Agents can now browse what a
knowledge base contains before they search it. Developed spec-first; the
accepted spec lives in `specs/1.2.0/`.

### New features

- **A live orientation map.** `knowlery index --kb <name> [--json]` and the
  virtual MCP resource `knowlery://<kb>/index` render the same fresh vault
  snapshot: compiled pages grouped by directory, installed bundles, and
  `compiled`, `bundles`, `uncooked`, and `stale` counts. The map is read-only
  and never creates or updates an `index.md`; `INDEX.base` remains the Obsidian
  rendering.
- **Browse-first agent navigation.** Overview questions such as "give me the
  lay of the land" start from the map rather than forcing a narrow retrieval
  query. The `ask` and `knowlery-mcp` skills teach agents to follow
  `[[wikilinks]]` through title/alias resolution; `organize` and `ideas` begin
  vault mapping from the same live index. Aggregate counts are quoted directly
  from `map.counts`, never recomputed from rendered sections.

### Documentation

- Added OpenCode to the agent integration guides in English and Chinese,
  including its `mcp` / `type: "local"` / command-array schema, interactive
  `opencode mcp add` and `list` commands, and the warning to keep MCP config in
  `~/.config/opencode/opencode.json` because Knowlery owns and regenerates the
  vault-level `opencode.json`.

## [1.1.0] — 2026-07-09

Theme: knowledge in one install — Knowlery becomes an agent plugin. Installing
it in Claude Code, Codex, or Cursor wires up everything at once: the MCP
server (provisioned via npx, no separate install), the skills, and the
conduct. Developed spec-first; the accepted specs live in `specs/1.1.0/`.

### New features

- **`register_kb` MCP tool.** Shell-less clients (Claude Desktop and friends)
  can bring an *existing* initialized knowledge base into the registry from a
  conversation — the MCP twin of `kb add`. It writes the registry file and
  nothing else; duplicate names hard-error (a conversation can ask;
  re-pointing a name stays a CLI act); an uninitialized folder is refused
  with both fix-it routes. Local stdio only — the registry is machine-global
  state, so `mcp serve` never offers it.
- **The agent plugin.** One committed `plugin/` tree serves three platforms
  (`.claude-plugin/`, `.codex-plugin/`, `.cursor-plugin/`): all fifteen
  skills generated from the single source, MCP configs provisioning the
  server via `npx -y knowlery@^1 mcp` (zero-install), and a Claude Code
  `bin/` shim putting `knowlery` on the agent's PATH. The plugin runs no
  install scripts; a CI drift check holds the committed tree to its
  generator. The repo itself is a marketplace:
  `/plugin marketplace add JayJiangCT/knowlery` → `/plugin install knowlery`.
- **The `knowlery-mcp` front-door skill** (15th builtin, 10th MCP prompt):
  the workflow layer tool descriptions can't carry — a tool-selection map for
  all nine tools, the capture→cook loop as a cross-tool narrative, federation
  timing, and a conduct digest. Existing skills became transport-aware:
  `ask`'s retrieval ladder gains Transport 0 ("if the MCP query tool is
  present, it *is* the ladder"), `cook`/`audit` name the MCP `stale` tool
  first.
- **Plugin release asset.** Releases ship `knowlery-plugin-<version>.zip`
  with the tree's contents at the archive root — unzip anywhere and point a
  plugin-dir install at it; the shim's executable bit survives.

### Docs

- New guides: Connect Your Agent (per-client setup: Claude Code/Desktop,
  Codex, Cursor, Antigravity), Talk to Your Knowledge Base
  (conversation-driven use cases). Agent-first entry funnel; gemini-cli
  retired in favor of the Antigravity suite.

## [1.0.0] — 2026-07-08

Theme: the memory layer — `knowlery mcp` makes every knowledge base something
any agent can cold-start faster and maintain more easily, and a major version
that means it: the workspace format, the CLI surface, and the MCP tool
contracts freeze under semver. Developed spec-first; the accepted specs live
in `specs/1.0.0/`.

### New features

- **Named knowledge bases.** `knowlery kb add/list/remove` maintains a global
  registry (`~/.config/knowlery/registry.json`); `--kb <name>` works on every
  command that operates on an existing KB, from any directory. `--dir` keeps
  working forever, and the registry is never a prerequisite.
  `knowlery query --kb '*'` searches every registered KB at once, merged by
  score with per-KB attribution. Vaults set up in Obsidian register
  themselves (ownership-tracked — a name you registered manually is never
  touched).
- **`knowlery mcp` — the third shell.** An MCP server over stdio for Claude
  Desktop/Code, Cursor, and gemini-cli: five read tools (`list_kbs`, `query`
  incl. federation, `stale`, `health`, `list_bundles`), nine skills exposed
  as prompts, and knowledge pages as `knowlery://<kb>/<path>` resources.
  Reads are allowlisted to the curated surface — free-form notes stay yours;
  `query` may surface them, reading them is out of bounds until `/cook`
  promotes the content. Findings are data: abstention, unhealthy, and
  stale-heavy reports are successful results agents relay, not errors they
  retry.
- **The write path.** Three writes, each structurally bounded: `init_kb`
  cold-starts a KB from a conversation (canonicalize-first path contract, at
  most one new directory, non-empty targets refused, failure cleanup that
  never deletes a pre-existing directory); `capture` appends to `inbox/`
  only (constructed filenames, `wx`-flag writes, symlinked inboxes refused);
  `sync` writes only binary-determined content. The compiled layer remains
  reachable only through `/cook`'s reviewed pipeline. Captures surface as
  uncooked notes in `stale` and are findable by `query` immediately.
- **Remote mode (self-hosted).** `knowlery mcp serve --port <n>` serves the
  same handlers over Streamable HTTP behind a bearer token (env or file,
  never argv; constant-time comparison; never logged). Read-only by default:
  each write is its own flag (`--allow-capture`, `--allow-sync`,
  `--allow-init --kb-root <dir>`), and a write not switched on is not
  registered at all. Fresh server+transport per request (stateless), tunnel-
  first deployment guidance, and shutdown that exits promptly even with a
  client attached.
- **The stability contract.** `docs: Reference → Stability Contract` states
  what is frozen (workspace format, CLI surface incl. `--json` shapes and
  exit codes, MCP contracts, OKF bundle format, KB registry) and what is
  deliberately not (ranking internals, skill prose, plugin UI,
  `health.config` inner keys). A dedicated `tests/contract/` suite pins every
  frozen surface — golden MCP schema snapshot, CLI flag/arity/key-set checks,
  format fixtures that must parse forever, and version-stamp coherence.
  MCP output schemas advertise the frozen keys (passthrough tightened at
  ratification), validated by the server at runtime.

### Docs

- New guides: Agents & MCP (client setup, tools, conduct, remote access with
  the honest per-agent access matrix), Best Practices, CLI Workflows.
- New developer pages: Architecture, Design Decisions.

## [0.9.0] — 2026-07-07

Theme: knowledge that travels — the sharing loop 0.8.0 completed mechanically gains
its last mile: bundles move over the network, subscribers pull updates, and public
publishing is guarded in proportion to its irreversibility. Developed spec-first;
the accepted specs live in `specs/0.9.0/`.

### New features

- **Install from URLs.** `knowlery bundle install <url>` downloads and runs the
  identical local pipeline — same conformance, version, and path-safety gates.
  Public sources fetch anonymously; a private GitHub release retries through your
  own `gh` login automatically, with a browser-download path when `gh` is absent.
  `--verify <sha256>` checks the raw bytes before anything is unpacked. The
  Obsidian install dialog accepts the same URLs.
- **Publish with one command.** `knowlery bundle publish <seed>` runs the export
  review gate, compiles, and creates a GitHub Release in your remembered per-bundle
  repo — then prints the complete message to forward: asset URL, its SHA-256, and
  the **audience statement** (who can install, how to grant access — publishing
  and access are separate steps, and the tooling now says so). Private is the
  default everywhere; a missing repo is created private. Publishing **publicly**
  passes a second gate: approved items carrying risk hints are re-listed for
  separate informed consent, with the permanence of public releases stated
  outright. The export modal gains the same publish panel.
- **Subscribe & update.** `knowlery bundle check-updates` asks each installed
  bundle's source for newer versions (strictly read-only, honest about what it
  can't check); `knowlery bundle update <id> | --all` installs them through the
  full gate pipeline. Local edits inside an installed bundle refuse the update,
  naming exactly which files changed. The dashboard gets Check-updates and
  per-bundle Update buttons. Pull-based by design — no daemon, no notifications.
- **Retrieval: the exactly-half boundary closes.** Coverage in the abstention gate
  is now specificity-weighted (a CJK chunk weighs its length), so short-title
  collisions like "斑马的移动端路线图" abstain instead of ranking noise — with
  zero new constants and latin-only behavior provably unchanged.

### Improvements

- **Sharing Knowledge documentation** — a new docs-site section (English and
  Chinese) covering the full journey: export & review, publish, grant access
  (with the recommended org-shelf team setup), install from URL, subscribe &
  update, and troubleshooting starting with "the link 404s = access, not a broken
  link".
- **Risk scanning grows credential patterns**: API-key shapes, private key blocks,
  private IPs, phone numbers — surfaced at export review and re-confirmed at
  public publish; evidence is redacted so hints never repeat a secret.
- The `knowlery-cli` skill teaches agents the full sharing surface with strict
  conduct: never `--public`, `--acknowledge-risks`, or `update` on the agent's own
  initiative.

### Under the hood

- **Staged bundle replacement**: installs and updates write to a staging dir and
  swap — a failure at any point leaves the previous version in place (previously a
  mid-write failure could lose it).
- `gh` binary resolution through common install locations, so the Obsidian plugin
  (whose Electron process lacks the shell PATH) sees the same `gh` as the
  terminal.
- The upstream version-check protocol is host-agnostic by construction — GitHub
  Releases is its first implementation.

## [0.8.0] — 2026-07-07

Theme: close the sharing loop, pay the quality debt — knowledge bundle **export** goes
headless (completing OKF end to end), the retrieval engine learns to give an honest
"no", and two release cycles of engineering debt are cleared. Developed spec-first;
the accepted specs live in `specs/0.8.0/`.

### New features

- **Headless bundle export** — `knowlery bundle export <seed>` and
  `knowlery bundle review <seed>` complete the sharing loop from the terminal:
  - `export` walks links from a seed concept and compiles the reviewed scope into a
    shareable bundle (`--zip` optional) — or, if anything in scope is unreviewed,
    prints the review checklist with per-item risk hints and refuses (exit 1, nothing
    written). "Nothing ships unreviewed" is unchanged; there is deliberately no
    approve-all flag.
  - `review --approve/--flag <id>...` records enumerated decisions with content
    hashes; editing an approved page automatically re-invalidates it.
  - The review state is the same `.knowlery/export-scope.json` the plugin's export
    modal edits — start reviewing in Obsidian, compile from the terminal, or the
    reverse. For identical approvals the two shells produce byte-identical bundles.
- **`knowlery-cli` skill** (builtin #14): teaches agents the full CLI command surface
  and the export review conduct — present the full checklist to the human verbatim,
  translate only their stated decisions into enumerated calls, never approve on the
  agent's own initiative.
- **Score-quality abstention.** The retrieval engine now reasons about *query
  coverage* instead of mere match existence: a single common word colliding with one
  field no longer defeats abstention ("mobile app roadmap" matching a page that
  mentions "roadmap" now abstains instead of ranking noise). Calibrated against an
  expanded golden set (8 unanswerable collision shapes, accuracy 1.000 from 2/3) with
  zero regression on any answerable category; the thresholds are CI-enforced.

### Improvements

- **Settings tab modernized** for Obsidian 1.13's declarative settings API (search
  integration included) with a fallback renderer for current public releases —
  one definitions array drives both, `minAppVersion` stays 1.12.2.
- **CLI is pipe-friendly**: `knowlery query ... | head -1` and friends exit 0 quietly
  when the consumer closes the pipe early, instead of dying with an EPIPE stack.
- **CI now runs lint and the full test suite on every PR**, and the eslint setup
  covers `tests/` and `evals/` with typed rules — repo-wide `eslint .` runs clean.

### Under the hood

- Export-side core (`collect`/`export-scope`/`compile`) inverted onto `VaultFs` plus a
  new `LinkResolver` abstraction; headless wikilink resolution matches the
  metadata-cache closure on the eval fixture (parity-tested).
- npm publishing migrated to **OIDC Trusted Publishing** — no long-lived token
  anywhere; provenance attestations generated automatically; the release workflow is
  idempotent on re-runs.
- The 0.6-era lint debt is paid: eight typed rules re-enabled at error severity
  (~107 violations fixed across src and tests), obsidian typings pinned exactly,
  `bin` path warning fixed.

## [0.7.0] — 2026-07-04

Theme: one core, two shells — Knowlery's knowledge-base lifecycle is now available as
a standalone CLI, while the Obsidian plugin remains the premium shell over the same
core and the same workspace format. Developed spec-first; the accepted specs live in
`specs/0.7.0/`.

### New features

- **The `knowlery` CLI** (`npm i -g knowlery`). The full workspace lifecycle without
  Obsidian:
  - `knowlery init` scaffolds a workspace — byte-for-byte the same file tree the
    plugin's setup wizard produces, verified by test. A folder initialized by the CLI
    opens in Obsidian with zero migration, and vice versa.
  - `knowlery sync` applies the same skill/rule/migration updates the plugin runs on
    upgrade (one shared implementation, so the shells cannot drift), reporting exactly
    which files changed; running it twice is a true no-op.
  - `knowlery health` checks config integrity plus knowledge-page counts, with CI-ready
    exit codes and `--json`.
  - `knowlery query` / `knowlery stale` expose the deterministic retrieval and
    staleness engines — output byte-identical to the in-app commands and the
    vault-embedded script.
  - `knowlery bundle install|list|uninstall` brings the receiving side of knowledge
    bundles to the CLI, with every 0.5.0 safety property intact (path-safety, version
    gate, conformance gate).
- **Environment-adaptive skills.** `/ask` and `/cook` teach a three-transport retrieval
  ladder (in-app command → global CLI → embedded script); `/cook`, `/organize`, and
  `vault-conventions` keep preferring Obsidian CLI but gain a headless write path with
  the same conventions; `/audit` now uses `obsidian orphans`/`unresolved`/`deadends`
  and the staleness report's dangling-sources category instead of manual traversal.
- **Retrieval-aware compiling.** `/cook` records nicknames, abbreviations, and
  cross-language titles into `aliases` frontmatter — names that are written down can be
  found, closing the alias and cross-language retrieval gaps the 0.6.0 evaluation
  quantified.
- **Sync downgrade guard.** The workspace records which Knowlery version last synced
  it; an older plugin or CLI refuses to sync rather than silently downgrade skill
  content a newer one already upgraded.

### Improvements

- Lifecycle logic (init, skill/rule sync, migrations, health, bundle install) is
  inverted onto a platform-neutral file interface with an Obsidian implementation and
  a node implementation — a pure refactor with zero behavior change, guarded by a
  purity test over the whole inverted set.
- Optional tool installs (Claudian, agent CLIs) moved from the shared setup logic into
  the Obsidian setup wizard where they belong.

### Compatibility notes

- The npm package ships only the CLI; the Obsidian plugin continues to install from
  the community directory or GitHub releases. Plugin and CLI share one version number
  and always release together.
- The `aliases` compiling convention and the updated skills reach existing vaults
  through the normal builtin-skill auto-sync; custom or forked skills are untouched.

## [0.6.1] — 2026-07-04

Community plugin review compliance release. Functionally identical to 0.6.0.

### Fixes

- Removed the dynamic-code patterns the plugin scanner flagged in bundled dependency
  internals: legacy-browser polyfills in jszip's dependency chain (`<script>`-element
  fallbacks), js-yaml's `!!js/function` type, and gray-matter's eval-based JS
  frontmatter engine are replaced at build time with inert shims — none of that code
  was ever executed by Knowlery.
- Removed every `eslint-disable` directive from the source: the live snapshot now uses
  window timers through an injectable indirection, and the generated retrieval-script
  module lints clean without a blanket disable.
- **`minAppVersion` raised to 1.12.2** (the Obsidian version that introduced the CLI
  handler API behind `knowlery:query` / `knowlery:stale`), replacing rule suppressions
  with an accurate requirement.
- Releases now ship with build provenance attestations and a changelog-derived
  description.

## [0.6.0] — 2026-07-03

Theme: deterministic retrieval, measurable quality — the core retrieval loop moves from
"described in prompts" to "guaranteed by code and proven by evals". Developed
spec-first; the accepted specs live in `specs/0.6.0/`.

### New features

- **Deterministic retrieval engine.** Candidate location for `/ask` is now one
  deterministic command instead of a six-step prompt-driven waterfall. The engine
  live-scans the vault (compiled pages, user notes, and installed bundles), scores with
  field weights (title/aliases > tags/basename > description > body), matches light
  morphological variants and CJK phrases, credits compiled pages when the raw notes
  they cite match (**source-graph boost**), tolerates close abbreviations against
  titles, and returns an explicit `No confident matches` verdict instead of noise.
- **Two transports, one engine.** `obsidian knowlery:query question="..." [k=<n>] [json]`
  runs in-app over a live in-memory snapshot (registered through Obsidian 1.12's CLI
  handler API, feature-detected). `node .knowlery/bin/query.mjs "..."` is the headless
  path that works with Obsidian closed — the script ships inside the plugin and is
  written to the vault on setup and on version upgrades. Both print identical output.
- **Mechanical staleness dirty-flags.** `obsidian knowlery:stale` /
  `query.mjs --stale` deterministically report compiled pages whose cited sources
  changed after the page was last written, user notes cited by no compiled page
  (candidate new material), and dangling `sources` references — no model, no persisted
  state. The dashboard gains a **Knowledge health** section with a drill-in and a
  "Copy re-cook prompt" action. `/cook`'s incremental scope now comes from this report;
  `log.md` is append-only history.
- **Retrieval evaluation harness.** `evals/` holds a 30-case golden set over a fixture
  vault, a frozen baseline of the old `/ask` waterfall, and `npm run eval` reporting
  recall@5/10 and MRR per category. The new engine scores recall@10 0.926 / MRR 0.846
  against the baseline's 0.778 / 0.428, with no category regression — and CI enforces
  both the frozen baseline and the engine thresholds on every pull request.

### Improvements

- **Slimmer fixed context.** `.claude/CLAUDE.md` and `opencode.json` now inject only
  `KNOWLEDGE.md` plus rules. `SCHEMA.md` (whose taxonomy tables grow with every cook)
  becomes an on-demand read with an explicit read-before-writing instruction, and
  `INDEX.base` stays available as an on-demand `base:query` tool. Existing vaults are
  migrated non-destructively: exactly the two stale import lines/entries are removed,
  once per version — if you re-add them afterwards, they stay.
- `/ask` Step 2 collapsed to one retrieval call with a degraded-mode fallback; `/cook`
  reads its incremental scope from the staleness report.
- `log.md`, `KNOWLEDGE.md`, and `SCHEMA.md` are treated as system files: never
  retrieval candidates, never "uncooked" material.
- `.claude/CLAUDE.md` is no longer rewritten on every plugin load when its content is
  already in sync.
- Vault health checks the retrieval script's presence.

### Compatibility notes

- **`minAppVersion` is now 1.12.2** (the version that introduced the CLI handler API
  the `knowlery:query` / `knowlery:stale` commands are built on). Obsidian older than
  1.12.2 will not offer this update. Using the CLI commands additionally requires the
  command line interface to be enabled in Obsidian's settings; the headless
  `query.mjs` script works regardless.
- Custom or forked `/ask` and `/cook` skills are not overwritten by the auto-sync, so
  they keep the old waterfall until you update them manually.

## [0.5.0] — 2026-07-03

### New features

- **Share knowledge bundles.** The new **Share knowledge bundle** command (also on the dashboard) compiles selected knowledge pages into a portable OKF v0.1 bundle: pick a seed topic, review the graph-closure of connected pages and raw sources item by item, and export only what you explicitly approve. The compiler converts wikilinks, projects a static `index.md` plus a structured `agent-index.json`, copies approved raw sources into `_sources/`, writes a recipient README, and can save the result as a `.zip`.
- **Share-safe review gate.** Nothing ships unreviewed: every page and raw source in scope is unreviewed / approved / flagged, and an automated risk scanner highlights emails, sensitive URLs, person pages, and meeting-like notes before export. Each topic keeps its own saved scope, so unrelated exports from the same vault never clobber each other.
- **Bundle-scoped SCHEMA.md.** When "Include SCHEMA.md" is on, the bundle ships a schema scoped to the tags and domains the exported pages actually use — never the vault-wide taxonomy.
- **Install knowledge bundles.** The new **Install knowledge bundle** command (also a dashboard card) installs a bundle from a `.zip` or folder into `Library/<id>/`, with a manifest and conformance preview first. Installed bundles are listed on the dashboard and tracked in `.knowlery/bundles.json`; uninstall removes the bundle and its registry entry.
- **Fork to my knowledge.** A file-menu action on installed bundle concept pages copies a page from `Library/` into your own knowledge directories so you can evolve it as your own.
- **Bundle-aware `/ask`.** The `/ask` skill now explicitly checks `.knowlery/bundles.json`, filters installed bundles by relevance, and reads the matching `agent-index.json` — installed knowledge is retrieved deliberately instead of being stumbled on by fallback search. Independent lookup steps are marked parallel-safe.

### Safety

- Install refuses path-unsafe bundle ids and validates every entry path before touching the vault; updates validate the incoming bundle before deleting the existing version.
- Installing past a conformance failure requires explicit acknowledgement.
- Only newer bundle versions install over an existing bundle.
- Exported links are emitted relative so they resolve after install.

### Improvements

- Installing a bundle adds a retrieval pointer block to `KNOWLEDGE.md` (removed again when the last bundle is uninstalled), and that block now refreshes its wording on plugin upgrade.
- **Fork to my knowledge** is only offered for actual concept pages.
- Bundle discovery uses the vault's actual config directory (via `app.vault.configDir`) instead of hardcoding `.obsidian`, so vaults with a custom config directory are handled correctly.

## [0.4.0] — 2026-06-02

### Improvements

- **Redesigned dashboard — one action-first column instead of five tabs.** Replaced the Today / This note / Weekly Review / Review Menu / System tabs with a single calm, scrolling layout focused on the moves you actually make: Today's move, Suggested moves, This note, Recent activity, and a weekly summary. Growing lists are capped to the top few with a "View all" drill-in, so the home stays about one screen no matter how large the vault gets.
- **Configuration moved into Obsidian Settings.** Diagnostics (vault health + content stats), Agent Rules, schema-file shortcuts, and the Skills library now live in the Knowlery settings tab instead of crowding the dashboard.
- **Plain-language naming.** Review moves renamed for clarity — Process new material, Connect related notes, Challenge an idea, Fix note metadata, Draft an output — and the weekly report is now "Weekly summary."
- **Auto-refresh on return.** The dashboard quietly re-reads the vault when Obsidian regains focus or you switch panes, so it reflects an agent's latest work without a manual refresh.
- Theme-adaptive styling throughout (Obsidian CSS variables only), visible focus states, and accessible labels on icon-only controls.

### Bug Fixes

- Vaults set up by older versions are no longer wrongly prompted to re-initialize — initialization is now detected from `KNOWLEDGE.md` in addition to the internal manifest.
- Fixed the Refresh button hanging when used on a drill-in sub-screen.
- Settings-mounted views now show focus rings; removed dead tab CSS and a stale `tabpanel` ARIA role.

### Infrastructure

- Removed the legacy per-tab view components after recomposing the dashboard; extracted a shared request-actions helper and the move catalog (`src/core/moves.ts`).
- Added tests for `isVaultInitialized`; aligned today-model and weekly-bake tests with the new copy.

## [v0.3.5] — 2026-05-11

### Improvements

- Auto-syncs bundled skill content on plugin load when the plugin version changes, so existing users receive skill updates without re-initializing.
- Migrates SCHEMA.md non-destructively on version upgrade — inserts missing anchor sections (Tag Taxonomy, Domain Taxonomy, Agent Page Conventions, Frontmatter Schema, Page Thresholds, Custom Fields) without overwriting existing user content.
- Tracks `lastSyncedVersion` in plugin settings to ensure migrations run once per version, not on every load.

### Compatibility notes

- Custom and forked skills are never overwritten by the auto-sync. Only `source: 'builtin'` skills are updated.
- Disabled builtin skills get updated content on disk but remain disabled (not copied to `.claude/skills/`).
- Users whose SCHEMA.md already has all anchor sections (e.g., from a recent initialize) will see no changes.

## [v0.3.4] — 2026-05-11

### Skills

- Replaces all bundled skill stubs (marketing descriptions only) with full operational content from `docs/files/skills/`, enabling the complete cook pipeline including SCHEMA.md taxonomy sync.
- Total bundled skills: 13 (7 knowledge + 6 tooling).

### Improvements

- Enhances `generateSchemaMd()` template with Tag Taxonomy table, Domain Taxonomy table, Agent Page Conventions, Frontmatter Schema reference, Page Thresholds, and Custom Fields — giving the cook skill proper anchor sections from day one.
- Updates the KNOWLEDGE.md skill table with corrected skill names and all new skills.

### Bug Fixes

- Fixes SCHEMA.md never being updated after `/cook` — the deployed cook skill now contains the full 7-step pipeline including Step 5 (Sync SCHEMA.md) instead of a marketing stub with no operational instructions.

## [v0.3.3] — 2026-05-08

### Fixes

- Fixes Windows 11 install failures where `npx skills`, `npm install -g opencode-ai`, and `<tool>.cmd --version` calls aborted with `EINVAL` (Node 18.20.2+ refuses to spawn `.cmd`/`.bat` via `execFile` after CVE-2024-27980). All `.cmd`/`.bat` invocations now go through `cmd.exe /d /s /c` with proper Windows argument quoting in `environment-install.ts`, `cli-detect.ts`, and the skill browser modal.
- Switches the Windows Claude Code installer to `winget install --id Anthropic.ClaudeCode` (with `--silent --accept-source-agreements --accept-package-agreements`) and falls back to the documented `irm https://claude.ai/install.ps1 | iex` script only when winget is unavailable, matching Anthropic's official Windows setup guidance.
- Verifies Claude Code on Windows by checking `%USERPROFILE%\.local\bin\claude.exe` directly before falling back to PATH lookup, since both winget and the irm script land the binary there but PATH may not refresh in the current Obsidian process (anthropics/claude-code issues #11571, #27634, #27867).

## [v0.3.2] — 2026-05-08

### Fixes

- Makes agent handoff prompts end with a verifiable Activity Ledger checklist.
- Requires agents to report whether the receipt was written or skipped, the path used, and a short reason.
- Keeps the checklist compact without embedding the full Activity Ledger JSON schema in every prompt.

## [v0.3.1] — 2026-05-08

### Fixes

- Restores Active threads for knowledge-analysis receipts that include maintenance follow-up work.
- Accepts `analysis` as an Activity Ledger record type and dimension so agent receipts from real cook sessions are not dropped.
- Keeps explicit `source.surface: "system"` and `type: "maintenance"` records out of Active threads while allowing `source.surface: "knowledge"` records to remain visible.
- Clarifies the Activity Ledger rule so evidence review and incident/document analysis should be logged as knowledge analysis, not system maintenance.

## [v0.3.0] — 2026-05-08

### Release

- Promotes the internal review-space beta to the stable v0.3.0 release after multi-day vault testing.
- Adds the new Knowlery dashboard: Today, This note, Weekly Review, Review Menu, and System.
- Introduces Activity Ledger receipts, active knowledge threads, manual reflections, and next-move recommendations.
- Adds Weekly Review Atlas generation and optional daily review polishing with agent output cards.
- Adds conservative BYOAO migration for existing vaults, preserving user files and custom skills.
- Improves Claudian handoff prompts and keeps maintenance/system receipts out of active knowledge threads.
- Explicitly imports Claude Code rules from `.claude/rules/*.md` into `.claude/CLAUDE.md`, including future user-added rules, while preserving OpenCode compatibility through `.agents/rules/*.md`.

### Compatibility notes

- Existing Claude Code vaults will sync Knowlery-managed rule imports into `.claude/CLAUDE.md` when the plugin loads.
- Activity written by external agents may still require pressing Refresh if Obsidian does not emit a vault change event for hidden `.knowlery` files.

## [v0.3.0-beta.4] — 2026-05-07

### Internal beta

- Keeps maintenance and system activity receipts out of Today active knowledge threads while still counting them as recent agent work.
- Adds `source.surface` to activity receipts so agents can distinguish user knowledge work from system, setup, audit, and maintenance logs.
- Makes agent handoff prompts append a compact Activity Ledger reminder without exposing JSONL schema in Claudian.
- Accepts both proper JSONL and pretty-printed activity receipt objects when reading `.knowlery/activity`.
- Tightens first-cook prompts so agents summarize maintenance findings in chat instead of creating report notes by default.
- Strengthens Obsidian CLI guidance and Activity Ledger rules for Claude Code.
- Polishes Today suggested-step buttons into compact action rows.

### Beta notes

- This prerelease is intended for Jay WorkSpace validation of first-cook, Claudian handoff, Activity Ledger receipts, and Today state boundaries.
- After updating through BRAT or release assets, reload Obsidian/Knowlery before testing Claudian handoff behavior.

## [v0.3.0-beta.3] — 2026-05-07

### Internal beta

- Adds a one-click conservative migration path for legacy BYOAO vaults, preserving existing files while configuring Knowlery for Claude Code.
- Imports legacy OpenCode skills into `.agents/skills`, syncs missing Claude skill copies, and normalizes Knowlery skill lock metadata.
- Replaces legacy BYOAO `.claude/CLAUDE.md` guidance with the Knowlery include-based Claude config when migration detects old BYOAO instructions.
- Fixes Today quick actions so `Scan vault health` opens System diagnostics and starts a health scan.
- Polishes Today suggested-step button layout inside Obsidian so labels and helper text render cleanly.

### Beta notes

- This prerelease is intended for internal BYOAO migration testing through BRAT and GitHub prerelease assets.
- Feedback should focus on migration safety, legacy skill preservation, Claude Code config correctness, and Today/System workflow polish.

## [v0.3.0-beta.2] — 2026-05-06

### Internal beta

- Fixes Today quick-action tooltip rendering by switching to Obsidian-native tooltips instead of custom CSS pseudo-elements.
- Keeps the local build flow convenient by copying release assets into the default Test Vault only when that vault exists.

### Beta notes

- This prerelease is intended for internal testing through BRAT and GitHub prerelease assets.
- Feedback should focus on dashboard polish, tooltip reliability, and the end-to-end beta install/update experience.

## [v0.3.0-beta.1] — 2026-05-05

### Internal beta

- Repositions Knowlery from a one-time vault setup utility into a personal knowledge review space.
- Adds the new dashboard structure: Today, This note, Weekly Review, Review Menu, and System.
- Introduces lightweight activity receipts, active knowledge trails, manual reflections, and next-move recommendations.
- Adds explicit agent handoff flows for copying review prompts or sending them to Claudian when available.
- Upgrades weekly reporting into a local Knowledge Review Atlas with an English default, Chinese toggle, knowledge hexagon, timeline, topic constellation, extensions, and next batch prompts.
- Hides raw source skills behind the Review Menu so users can start from natural language workflows.
- Adds internal beta testing guidance for fresh, existing, and returning vault testers.

### Beta notes

- This prerelease is intended for internal testing through BRAT and GitHub prerelease assets.
- Do not treat this as the final public 0.3.0 release.
- Beta feedback should focus on first-use clarity, review workflow usefulness, Claudian handoff reliability, and Knowledge Review Atlas quality.

## [v0.2.0] — 2026-04-30

### New features

- Setup wizard now detects Claude Code, OpenCode, Node.js, Claudian, and skills tooling before setup.
- Optional onboarding installs can prepare missing agent tools, warm up `npx skills`, and install Claudian directly into the vault without BRAT.
- Node.js recovery flow includes auto-detect, manual path entry, and an official download link.

### Improvements

- Installed tools are shown as read-only status rows, while only missing optional tools can be selected.
- Optional install selection no longer re-runs environment checks on every checkbox click.
- Running setup now uses compact circular progress indicators for queued, running, and verifying install work.
- Setup wizard styling was tightened to match Knowlery and Obsidian UI conventions.

### Compatibility notes

- Existing users are not migrated automatically. Optional tool installation only runs from the setup wizard after explicit selection.
- Existing vault files and agent configuration remain unchanged unless users re-run setup or maintenance actions.
- Network and local command use remain user-initiated and are documented in the README.

## [v0.1.1] — 2026-04-22

### Documentation

- README: **static** release and license badges (works while the repo is private; bump the badge text when you ship a new version).
- Stop tracking **`plan.md`**; it remains available locally via `.gitignore` for maintainers.
- **Getting started** embeds the walkthrough as an **MP4** from Releases (`knowlery-walkthrough.mp4` via `latest/download`); inline `<video>` on github.com with a direct-link fallback.
- **BRAT** links the upstream repo ([`TfTHacker/obsidian42-brat`](https://github.com/TfTHacker/obsidian42-brat)) and optional companion plugins: [Claudian](https://github.com/YishenTu/claudian) and [obsidian-agent-client](https://github.com/RAIT-09/obsidian-agent-client).

### Infrastructure

- Add optional **`playwright`** devDependency for local HTML → MP4 recording (e.g. guidance storyboard export); not required to build the plugin.

## [v0.1.0] — 2026-04-22

### New features

- Dashboard (side pane) with **Skills**, **Config**, and **Health** tabs for agent-oriented vault workflows.
- **Setup wizard** to scaffold `KNOWLEDGE.md`, `SCHEMA.md`, content folders, `.knowlery/`, and agent config for Claude Code or OpenCode.
- **Skill browser** and editors to install, browse, and edit bundled and registry skills; **rule editor** for agent rules.
- **Vault health** panel with path-level diagnostics; **Node.js / CLI** detection and safe command execution.
- **Platform adapter** to sync skills and rules between the vault, `.agents/`, and `.claude/`.

### Skills and rules

- Default bundled **knowledge and workflow** skills (for example *cook*, *ask*, *brat*, *init*), editable from the app.
- Rule templates and vault templates in `src/assets` for consistent agent bootstrapping.

### Improvements and fixes

- UI pass across the dashboard, modals, and tabs (precision layout, skill detail flow).
- `gray-matter` import fix for esbuild interop; styles aligned with Obsidian CSS variables and RTL-friendly logical properties.
- `LICENSE`, `README` documentation, and a GitHub **Actions** workflow for future releases (`.github/workflows/release.yml`).

### Infrastructure

- TypeScript, Zod, React 18, esbuild bundle to `main.js` + `styles.css`; `minAppVersion` **1.7.2**.
