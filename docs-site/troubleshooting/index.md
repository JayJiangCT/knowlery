# Troubleshooting

Use this page when setup, skills, platform config, or vault health does not look right.

## The Dashboard Says the Vault Is Not Set Up

Knowlery checks for `.knowlery/manifest.json`.

If the vault should already be initialized:

1. Confirm `.knowlery/manifest.json` exists.
2. Confirm it contains valid JSON.
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

Open Health and check **Skills installed**.

Built-in skills are expected at `.agents/skills/<name>/SKILL.md`.

If some are missing:

1. Re-run setup in a test vault to compare expected output.
2. Use the Skills tab to re-enable disabled skills when possible.
3. Use maintenance actions to re-initialize or repair the vault if the installation is incomplete.

## Claude Code Config Is Missing

For Claude Code, Knowlery expects:

- `.claude/CLAUDE.md`
- `.claude/rules/`
- `.agents/skills/`

Use settings to regenerate agent config. If you switched from OpenCode, confirm the active platform is Claude Code.

## OpenCode Config Is Missing

For OpenCode, Knowlery expects:

- `opencode.json`
- `.agents/rules/`
- `.agents/skills/`

Use settings to regenerate agent config. If you switched from Claude Code, confirm the active platform is OpenCode.

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

## When to File an Issue

Open a GitHub issue when you can reproduce the problem in a clean test vault and can include:

- Knowlery version.
- Obsidian version.
- Operating system.
- Active platform, either Claude Code or OpenCode.
- Steps to reproduce.
- Any relevant console errors.
