# Best Practices

Knowlery works best as a rhythm, not a tool you visit. This page collects the
practices that keep a knowledge base healthy over months — each one grounded
in how the system actually behaves.

## The core loop: capture → cook → ask

Everything else supports this loop.

1. **Capture without ceremony.** Raw notes, meeting scraps, clipped articles,
   MCP `capture` calls from conversations — they all land as plain user notes
   (or in `inbox/`). Don't organize at capture time; organization is what
   `/cook` is for. A messy inbox is normal; a lossy one is not.
2. **Cook in sessions, not continuously.** Run `/cook` when there's a batch of
   material worth compiling — after a project phase, a reading session, a week
   of captures. The staleness report (`knowlery stale`, or Knowledge health on
   the dashboard) tells you exactly what's waiting: stale pages first, then
   uncooked notes, most recent first.
3. **Ask against the compiled layer.** `/ask` and `knowlery query` answer from
   compiled pages, with citations. If answers feel thin, that's a cook-debt
   signal, not a retrieval problem.

## Trust the abstention

When retrieval says `No confident matches`, believe it. The engine abstains by
design when the question isn't sufficiently covered by any page — that is the
answer "your knowledge base doesn't know this yet", which is exactly what you
want to hear when it's true.

- Don't rephrase the question five ways to force a hit; if it matters, cook the
  material that should answer it.
- Agents should relay abstention verbatim rather than padding it with guesses —
  the built-in skills and MCP tool descriptions already say this, so an agent
  that hallucinates around an abstention is misconfigured, not misinformed.

## Keep the two-layer boundary clean

The single most important structural rule: **user notes are yours; the four
compiled directories are the agent's.**

- Never hand-write pages into `entities/`, `concepts/`, `comparisons/`,
  `queries/` in bulk. Edit compiled pages when they're wrong, but creation
  should flow through `/cook`, which keeps `sources` citations and `SCHEMA.md`
  taxonomy consistent.
- Never let an agent restructure your own notes. The built-in rules already
  enforce this; keep it that way when writing custom rules.
- `Library/` (installed bundles) is read-only reference material. When you want
  to own a bundle page, **fork it** into your own directories — don't edit it
  in place, or updates will refuse to overwrite your changes (by design).

## Citations are the fabric

Compiled pages cite their sources with `sources:` frontmatter and wikilinks.
This is not decoration — it is what makes the whole system mechanical:

- Staleness detection compares source mtimes against page mtimes; a page
  without citations can never be flagged stale.
- Retrieval credits a compiled page when a raw note it cites matches the
  question — cross-language questions reach compiled answers through this.
- `/challenge` walks citations to pressure-test claims; the staleness report flags pages whose sources moved on.

If you ever accept an agent-written page without citations, you've created a
page the machinery can't see. The "Citation required" rule exists for this.

## Run health after anything bulky

`knowlery health` (or Settings → Diagnostics) after imports, migrations,
platform switches, or big agent sessions. It's cheap, it's read-only, and it
catches the boring failures — missing skills, broken config, absent dirs —
before they turn into confusing agent behavior. `knowlery sync` fixes what
health reports; it's idempotent and write-on-change, so running it "just in
case" costs nothing.

## Schema discipline, lightly held

`SCHEMA.md` is a living convention file. Let `/cook` extend the tag and domain
taxonomy as new material arrives — that's its job — but review the diff
occasionally. Two smells worth acting on:

- **Synonym tags** (`ml`, `machine-learning`) — merge them; retrieval treats
  tags as evidence and synonyms split that evidence.
- **One-page domains** — usually a sign cook was too eager; fold them into an
  adjacent domain.

`/audit` reports structural drift (orphans, broken links, frontmatter gaps)
when you want a deeper pass.

## Sharing: review means reading

The export review gate shows you every page and every source that would ship,
with risk hints (emails, sensitive URLs, person pages, meeting-like notes).
The practices that keep this honest:

- **Read the checklist, don't skim it.** There is deliberately no approve-all
  flag. If an agent drives the review, it must present the full checklist
  verbatim before acting on your decisions — that conduct is written into the
  skill, so hold it to that.
- **Prefer private distribution by default.** A GitHub Release on a private
  repo with `gh`-authenticated installs covers most sharing; `--public` exists
  behind a second acknowledgment gate for a reason — a public release is
  permanent (assume anything published publicly is downloaded the moment it
  goes up).
- **Version deliberately.** Subscribers see your version numbers; bump patch
  for corrections, minor for new pages. The update pipeline refuses to
  downgrade and refuses to overwrite local modifications — work with that
  grain, not against it.

## Multiple KBs: split by audience, not by topic

Registry names (`kb add`) are cheap, but knowledge bases are not free — each
is a separate retrieval scope, cook scope, and sharing scope. A good split is
by *who may see it* (work / personal / a shared team KB), because that
boundary also decides export scope and remote exposure. Topics within one
audience usually belong in one KB, organized by domains — federated query
(`--kb '*'`) covers the "where did I write this" case across them.

## Agents: give them the front door

- Point agents at `KNOWLEDGE.md` first; it's written for them.
- Prefer the deterministic tools (`query`, `stale`, MCP tools) over letting an
  agent grep the vault — the engine's scoring, CJK handling, and abstention
  are all things ad-hoc grep lacks.
- For MCP write tools, the conduct is: writes act on *your words*, never on
  agent initiative. An agent that captures silently or inits directories
  without restating the path is out of contract — the tool descriptions say
  so, and you should too.
- Keep vaults in version control (or at least backups). Every Knowlery
  operation is designed to be non-destructive, but agents are agents.

## What not to do

- Don't cache retrieval results or build parallel indexes — every query is a
  live scan by design; there is nothing to invalidate and no index to drift.
- Don't hand-edit `.knowlery/` state files (`bundles.json`, `export-scope.json`,
  the registry) unless something is broken; they're contracts between shells.
- Don't run an old CLI against a workspace a newer version has synced — the
  downgrade guard will refuse, and the fix is `npm i -g knowlery@latest`, not
  forcing past it.
- Don't publish a bundle to a public repo "to test" — test with a private repo
  or a local zip; public is permanent.
