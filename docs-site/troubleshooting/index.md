# Troubleshooting

Use this page when setup, skills, platform config, or vault health does not look right.

## The Dashboard Says the Vault Is Not Set Up

Knowlery checks for `.knowlery/manifest.json` or `KNOWLEDGE.md`.

If the vault should already be initialized:

1. Confirm `.knowlery/manifest.json` or `KNOWLEDGE.md` exists.
2. If the manifest exists, confirm it contains valid JSON.
3. Reopen the dashboard.
4. If it is missing or corrupted, run setup again or use maintenance actions from settings.

## Node.js Is Not Detected

Node.js is required for skill registry browsing and optional tooling preparation.

Try this:

1. Install Node.js from the official Node.js website.
2. Restart Obsidian.
3. Use the Node.js auto-detect button in Knowlery settings.
4. If auto-detect fails, enter the Node.js path manually.

On macOS and Linux, GUI apps sometimes do not inherit the same shell PATH as your terminal. Manual path entry can be necessary.

## Skill Browser Does Not Work

The skill browser depends on Node.js, npm, and the external skills CLI path used through `npx skills`.

Check:

- Node.js is installed and detected.
- npm is available.
- The search term is not empty.
- Network access is available.
- The external skills registry is reachable.

If the registry cannot be used, built-in and custom skills still work.

## Built-In Skills Are Missing

Open **Settings -> Knowlery**, then check **Skills installed** in Diagnostics.

Built-in skills are expected at `.agents/skills/<name>/SKILL.md`.

If some are missing:

1. Re-run setup in a test vault to compare expected output.
2. Use the Skills section in settings to re-enable disabled skills when possible.
3. Use maintenance actions to re-initialize or repair the vault if the installation is incomplete.

## Agent Config Is Missing

Whichever platform is selected, Knowlery expects:

- `AGENTS.md` at the vault root
- `.claude/CLAUDE.md`
- `.agents/rules/`
- `.agents/skills/`

Use settings to regenerate agent config.

## An Agent Ignores the Vault Rules

Every agent starts from the same three sources: your `KNOWLEDGE.md` (what the
knowledge base is), the rules in `.agents/rules/`, and Knowlery's operating
rules for the installed version (Obsidian CLI use, retrieval procedure,
skills — rendered from the template, so fixes reach every vault). There are
two entry files, each with a `<!-- Knowlery managed:start/end -->` block:

- `AGENTS.md`, read by Codex, OpenCode, and Cursor. Those harnesses have no
  import syntax, so the block opens with a **Read First** section telling the
  agent to read `KNOWLEDGE.md` and each listed rule file before anything
  else, then carries the operating rules. If a Codex/OpenCode session skips
  that read, the vault description is simply not in its context — check the
  session's first tool calls.
- `.claude/CLAUDE.md`, read by Claude Code. Its block `@`-imports
  `KNOWLEDGE.md` first, inlines the operating rules, and `@`-imports every
  rule file, so Claude gets the same context as hard injection. It does not
  import `AGENTS.md`.

`KNOWLEDGE.md` is never copied into either file. Both blocks are regenerated
on plugin load, rule add/remove, and `knowlery sync`, so edit `KNOWLEDGE.md`
or the rule files, not the blocks. Anything you write outside the markers is
kept.

Upgrading from a pre-1.5 vault:

- **`KNOWLEDGE.md` still carries the old operating rules.** Templates before
  1.5 wrote `## Operating Rules`, `## Knowledge Retrieval`, and
  `## Available Skills` into `KNOWLEDGE.md`; Knowlery now supplies them in
  the entry files, so those sections are stale duplicates. Health shows a warning
  while they remain. Delete the three sections (keep your title, intro,
  Vault Structure, and any sections of your own — if you nested your own
  notes under one of them, move them out first). `KNOWLEDGE.md` is yours, so
  Knowlery does not do this for you.
- If the vault already had a hand-written `AGENTS.md`, the managed block is
  placed first and your text follows it. Much of that older text is usually
  redundant with `KNOWLEDGE.md` now; **Settings → Regenerate agent config →
  Reset AGENTS.md** discards everything outside the block (after a
  confirmation). Move anything worth keeping — say, an MCP source-priority
  rule — back in below the block afterwards.
- Rules that lived in `.claude/rules/` are **copied** into `.agents/rules/`
  (never deleted). Claude Code also auto-loads `.claude/rules/`, so until you
  remove that directory Claude sees those rules twice — harmless, but noisy.
  Delete `.claude/rules/` once you have confirmed `.agents/rules/` holds
  everything.
- `.claude/CLAUDE.md` is converged in place: the 1.5 `@../AGENTS.md` import
  and the older loose `@../KNOWLEDGE.md` / `@rules/*.md` imports are replaced
  by the managed block; your own text stays after it.
- A Knowlery-written `opencode.json` is retired: OpenCode V2 no longer loads
  its `instructions` array, so `knowlery sync` removes the two Knowlery
  entries (and the file when nothing you added remains).

Codex caps the combined project instructions at 32 KiB by default
(`project_doc_max_bytes`); the generated block is around 6 KB.

## Broken Wikilinks

Broken wikilinks mean Obsidian cannot resolve a link target.

Common causes:

- The target note was renamed or deleted.
- The link text has a typo.
- A note exists in a different folder with an unexpected title.

Fix the link or restore the target note, then run diagnosis again.

## Orphan Notes

Orphan notes have no incoming wikilinks.

This is not always bad. Daily notes, inbox notes, or temporary notes can be orphaned by design. For knowledge pages, orphans often mean the page has not been connected back into the map.

## Missing Frontmatter

Knowlery checks frontmatter only in the knowledge directories.

If a file in `entities/`, `concepts/`, `comparisons/`, or `queries/` has missing frontmatter, compare it with `SCHEMA.md` and add the missing fields.

## Optional Installs Failed

Optional installs run local commands on your machine.

If an install fails:

1. Check that Node.js is detected when the item requires Node.
2. Try the equivalent install command in a terminal.
3. Restart Obsidian after installing external tools.
4. Reopen setup or settings and re-run detection.

## A Knowledge Bundle Will Not Install

Install validates the bundle before writing anything.

Common causes:

- The `.zip` or folder does not contain a `knowlery-bundle.json` manifest at its root.
- The bundle id is path-unsafe, or an entry path tries to escape `Library/<bundle-id>/`.
- The same bundle is already installed at the same or a newer version — updates require a newer bundle version.
- The bundle has conformance errors — installing past them requires explicit acknowledgement in the install preview.

Ask the sender to re-export with a current Knowlery version if the manifest or paths look wrong.

## Installed Bundle Knowledge Does Not Show Up in Answers

The `/ask` skill reads `.knowlery/bundles.json` and each relevant bundle's `agent-index.json` under `Library/<bundle-id>/`.

Check:

1. The bundle appears in the Bundles section on the dashboard.
2. `.knowlery/bundles.json` lists the bundle.
3. `KNOWLEDGE.md` contains the installed-bundles pointer block.
4. The vault's `/ask` skill is current — bundled skills refresh automatically when the plugin version changes.

## When to File an Issue

Open a GitHub issue when you can reproduce the problem in a clean test vault and can include:

- Knowlery version.
- Obsidian version.
- Operating system.
- Active platform, either Claude Code or OpenCode.
- Steps to reproduce.
- Any relevant console errors.
