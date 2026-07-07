# Working with Multiple Knowledge Bases

One vault for work, one for personal research, one for a side project — as soon
as there is more than one, "which folder am I in?" becomes friction. The **KB
registry** gives knowledge bases names.

```bash
knowlery kb add work ~/vaults/work-kb
knowlery kb add personal ~/vaults/personal

knowlery query --kb work "what did we decide about the rollout?"
knowlery stale --kb personal
```

`--kb <name>` works on every command that operates on an existing KB, from any
directory. `--dir` keeps working exactly as before — `--kb` is a convenience on
top, and the registry is never required (`init` doesn't take `--kb`: initialize
first, then register).

## The registry

A plain address book at `~/.config/knowlery/registry.json` — names and paths,
nothing else.

- `knowlery kb list` shows each KB's live state: `ok`, `uninitialized` (folder
  exists, not a workspace), or `missing` (moved/deleted — entries are flagged,
  never auto-removed).
- `knowlery kb remove <name>` removes the registry entry only; the knowledge
  base's files are untouched.
- If the registry file is ever corrupted, Knowlery reports it loudly and does
  **not** reset it — it's your list of your knowledge bases.

## Searching everything at once

```bash
knowlery query --kb '*' "where did I write about backpressure?"
```

Runs the retrieval engine over every registered KB and merges the results by
score, each line naming its KB:

```
  31.42  work: concepts/backpressure.md — Backpressure
   8.91  personal: concepts/flow-control.md — Flow Control
```

Unreachable or uninitialized KBs are skipped with a note; if nothing answers
confidently anywhere, the abstention message lists which KBs were consulted.

## Vaults in Obsidian register themselves

A vault set up with the Knowlery plugin registers itself under its knowledge
base name (a numeric suffix is added if the name is taken). The settings toggle
**"Register vault for CLI/agent access"** controls this; turning it off removes
only the entry the plugin itself created — a name you registered manually is
never touched.
