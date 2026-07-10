---
name: knowlery-mcp
description: Work a Knowlery knowledge base through its MCP tools — choose the right tool for the job, run the capture-to-cook loop, and behave well while doing it. Use when Knowlery MCP tools (query, capture, stale, health, init_kb, register_kb, sync, list_kbs, list_bundles) are available in the session, especially in clients without a shell.
---

# Knowlery over MCP

The knowlery MCP server exposes a knowledge base as nine tools. Each tool's
own description carries its parameters — this skill carries what those
descriptions cannot: which tool fits which moment, how the tools chain into
loops, and the conduct that keeps you trustworthy.

## Choosing the right tool

| The moment | Tool | Why this one |
| --- | --- | --- |
| Any question about the user's prior work, decisions, or knowledge | `query` | Deterministic retrieval with citations — never answer such questions from general knowledge without checking first |
| "Which of my KBs has this?" / unsure which KB | `query` with `kb: "*"` | Federation searches every registered KB, each hit labeled with its source |
| Before proposing or starting a cook session | `stale` | The exact work list: stale pages first, then uncooked notes — scope from this, not from guessing |
| After bulk changes, or when tools behave oddly | `health` | Integrity check; unhealthy is a finding to relay with a suggested `sync` |
| "What knowledge bases do I have?" | `list_kbs` | The registry with live states — also your first move in a fresh session if the user references a KB you haven't seen |
| "Give me the lay of the land" / browsing, not searching | the `knowlery://<kb>/index` resource | A live orientation map of the compiled layer + installed bundles — browse first, query second |
| "Where did this shared knowledge come from?" | `list_bundles` | Installed bundles with version and provenance |
| "Set up a knowledge base" (new, empty) | `init_kb` | Creates and registers in one step |
| "Register my existing KB" | `register_kb` | Address-book entry only — never touches files inside |
| After an upgrade, or when health reports gaps | `sync` | Refreshes skills/instructions; content is version-determined, never yours to choose |

## The capture → cook loop

"Remember this" is a loop, not a call:

1. `capture` writes the note to the KB's `inbox/` — echo the path back.
2. The capture immediately shows up in `stale` as an *uncooked note* and is
   findable by `query` — nothing is lost while it waits.
3. When the user asks to cook (or accepts your offer), the /cook skill
   compiles inbox material into cited knowledge pages — inbox items are
   first-priority cook material.

Abstentions from `query` accumulating around a topic are the natural signal
to suggest a cook session — the knowledge exists in captures but hasn't been
compiled yet.

## The wiki is a graph — navigate it

Compiled pages interlink with `[[wikilinks]]`. After reading a page as a
resource, follow the links that bear on the task: resolve a link's text with
the `query` tool (title/alias matching is the resolver — it returns the
path), then read `knowlery://<kb>/<path>`. Browse from the `index`
resource, enter a page, walk one or two hops — the wiki is a graph, not a
pile of files. A page's `sources:` are visible as query evidence, but raw
source content stays out of bounds over MCP until /cook compiles it.

When summarizing the map, **quote aggregate numbers directly from
`counts`** (compiled / bundles / uncooked / stale) — never recompute a
total from the group sections you happened to read; partial re-addition
misreports the vault.

## Federation timing

Use a named KB when the user names one or context makes it obvious. Use
`kb: "*"` when the question is "where did I write…" across their life, or
when a named-KB query abstains and the user suspects it lives elsewhere.
Don't federate by default — attribution noise costs more than it saves.

## Conduct

- **Findings are data.** An abstention, an unhealthy report, a long stale
  list — these are answers to relay, not errors to retry. Never pad an
  abstention with guesses.
- **Writes act on the user's words.** Capture only what they asked to save
  (echo the path); restate a resolved path before `init_kb` or
  `register_kb`; report `sync`'s file list. Never write on your own
  initiative.
- **Surface conflicts, don't route around them.** A taken KB name, a
  non-empty target, an uninitialized folder — relay the refusal and its
  fix-it guidance; the decision is the user's.
- Reading a page `query` surfaced? Compiled pages are readable as MCP
  resources; free-form notes are not — that boundary is the product, not a
  bug to work around.
