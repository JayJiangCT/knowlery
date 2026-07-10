# Talk to Your Knowledge Base

Once your agent is [connected](./connect-your-agent), everything below is a
conversation — no commands, no file paths to remember. Each scenario shows
what you say, what the agent does, and what a *well-behaved* agent looks like
(the conduct is built into the tools and skills, so you can hold it to this).

## "Set up a knowledge base for me"

> **You:** Set up a knowledge base called `research` at ~/kb/research.
>
> **A good agent:** restates the resolved path — *"I'll create
> `/Users/you/kb/research` and register it as `research`. Go ahead?"* — and
> only then calls `init_kb`. It reports back the registered name and path.

Creating a directory is your decision; an agent that initializes without
restating the path first is out of contract. The new KB is immediately
queryable, and it opens in Obsidian later with zero migration.

## "I already have one — register it"

> **You:** Register /Users/you/vaults/work-kb as `work`.
>
> **A good agent:** restates the path, calls `register_kb`, and confirms:
> *"Registered `work` → /Users/you/vaults/work-kb. It's immediately
> queryable."*

Registration writes the address book only — nothing inside your vault is
touched. Two refusals you may see, both correct:

- **The folder isn't a Knowlery workspace yet.** The agent should relay both
  fixes: an empty folder can be created with `init_kb`; a folder with
  existing notes needs one CLI command first (`knowlery init` works on
  brownfield folders without touching your notes), then register.
- **The name is taken.** The agent should surface the conflict and ask —
  never silently pick another name.

## "Remember this"

> **You:** Save our conclusion about the caching strategy to `work`.
>
> **A good agent:** calls `capture` and echoes the path — *"Captured to
> `inbox/2026-07-09-143012-caching-strategy.md`. It's uncooked until the next
> /cook."*

Captures land in `inbox/` — never in your compiled knowledge. They are
immediately findable by search and show up as *uncooked notes* in the
staleness report, so nothing captured is ever lost, just not yet compiled.
An agent should never capture silently in the background: only what you
asked to save, always with the path echoed back.

## "What do I know about…?"

> **You:** What did we decide about the rollout? Check `work`.
>
> **The agent** calls `query` and answers from compiled pages, with the
> source paths cited.
>
> **You:** Not sure which KB it's in — search everything.
>
> **The agent** queries with `kb: "*"` — results merged across every
> registered KB, each hit labeled with its KB.

And the answer you should *want* to hear sometimes:

> **The agent:** Your knowledge base has no confident match for this.

That is the retrieval engine's abstention — a real answer, not a failure. A
good agent relays it instead of padding it with guesses. If the question
matters, the material that should answer it needs cooking.

## "How's my knowledge base doing?"

> **You:** Give `work` a checkup.
>
> **The agent** runs `health` (workspace integrity) and `stale` (what's
> waiting to be compiled) and summarizes: *"Healthy. 2 compiled pages have
> changed sources; 5 captures are waiting to be cooked."*
>
> **You:** Fix what's fixable.
>
> **The agent** runs `sync` (if health reported missing skills or outdated
> files) and reports exactly which files were updated. For the stale pages
> and uncooked captures, it offers a `/cook` session — compilation stays a
> reviewed, human-in-the-loop act, so it won't cook without you.

`stale` output is a work list, not an alarm — it tells you what to re-cook
when you next tend the vault. Many notes are legitimately never compiled.

## "Compile my notes"

> **You:** Cook the new material in `work`.
>
> **The agent** loads the `cook` skill, reads the staleness report to scope
> the session (inbox captures first — they were captured precisely to be
> compiled), distills notes into compiled pages with `sources:` citations,
> and keeps `SCHEMA.md`'s taxonomy in sync.

This is the one place agent judgment is *supposed* to be exercised — which
is why it's a skill guiding the agent, not a tool it fires blindly.

## The loop, end to end

A week with a knowledge base looks like:

1. Conversations produce **captures** ("remember this") — zero friction.
2. Questions get **answers with citations** — or honest abstentions.
3. When abstentions accumulate around a topic, that's the signal to
   **cook** — the captures and notes become compiled pages.
4. An occasional **checkup** keeps the workspace healthy.

Everything above also works from the CLI (`knowlery query`, `knowlery
stale`, …) — same engine, same answers. See [CLI Workflows](./cli-workflows)
for the terminal-first version, and [Agents & MCP](./agents-mcp) for the
full tool reference and conduct notes.
