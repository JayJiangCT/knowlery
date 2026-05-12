# Guides

These guides cover the everyday workflows that Knowlery supports.

## Initialize a Vault

1. Open the command palette.
2. Run **Knowlery: Initialize vault**.
3. Choose Claude Code or OpenCode.
4. Review the files, skills, and configuration Knowlery will create.
5. Optionally select missing tool preparation steps.
6. Run setup.
7. Open the dashboard when setup completes.

Use a test vault first if you are evaluating Knowlery. Setup writes several top-level files and folders.

## Read the Dashboard

Knowlery now centers on five dashboard surfaces:

| Surface | What to do there |
| --- | --- |
| Today | Start with the current activity state and pick one small next move |
| This note | Review the active Markdown note and ask for related connections |
| Weekly Review | Generate a local atlas or send a polish request |
| Review Menu | Browse source skills and copy reusable review prompts |
| System | Run diagnostics and open the underlying config files |

The dashboard opens to Today. Use the refresh button when recent activity or vault changes need to be reflected.

## Work with Today

Today is the quickest way to understand what Knowlery thinks is happening in your vault.

1. Open the Today tab.
2. Read the current summary and the highlighted next move.
3. Use the copy or send action if you want an agent prompt.
4. Use Add reflection if you want to record a private note about your own work.

If you already have activity receipts, Today will show active knowledge threads and likely next moves. If you do not, it will steer you toward the first cook or a small setup step.

## Review a Note

Open a Markdown note and switch to This note.

Knowlery will try to identify the active note, relate it to recent knowledge activity, and prepare a focused prompt. Use this when you want to ask an agent to connect one note to older material, comparisons, or reusable structures.

## Generate a Weekly Atlas

Open Weekly Review when you want a broader summary.

1. Use **Generate atlas** to create a local HTML atlas in `.knowlery/reports/latest.html`.
2. Use **Open latest** to open that file outside Obsidian.
3. Use **Send polish request** when you want a companion agent to write a more polished review summary.
4. Use **Check result** to refresh the request/result state.

The atlas also saves a dated snapshot under `.knowlery/reports/weekly/`.

## Use the Review Menu

Review Menu is the place to browse source skills without turning the dashboard into a giant raw skill list.

The menu is organized around two ideas:

| Area | What it is for |
| --- | --- |
| Suggested next moves | Small prompts inferred from recent activity threads |
| Review moves | Reusable prompts like digest, connect, pressure-test, clean, and create |

Open a move to copy its prompt or send it to your configured agent chat. Open Source skills to inspect, create, fork, edit, disable, or delete the underlying skills.

### Recommended Skill Flow

| Goal | Skill |
| --- | --- |
| Process raw notes | `cook` |
| Ask what the vault already knows | `ask` |
| Find bridges between topics | `explore` |
| Review assumptions | `challenge` |
| Generate synthesis ideas | `ideas` |
| Check for structural problems | `audit` |
| Clean up organization | `organize` |

## Add or Edit Rules

Rules guide agent behavior in this vault.

1. Open the Config tab.
2. Use **Add rule** to create a new rule.
3. Give the rule a focused filename and title.
4. Write plain markdown instructions.
5. Save and verify the rule appears in the rules list.

Good rules are short and enforceable. Prefer “Always cite source notes using wikilinks” over a broad essay about writing style.

## Switch Platforms

Use the settings tab to switch between Claude Code and OpenCode.

Knowlery will:

- Create the target rules directory if needed.
- Copy markdown rule files from the old platform directory to the new one.
- Regenerate the platform configuration file.
- Optionally clean up the previous platform config.

Review generated config after switching platforms, especially if you have custom rules.

## Run a Health Diagnosis

Open the System tab and click **Run diagnosis**.

Knowlery checks:

- Orphan notes with no incoming wikilinks.
- Broken wikilinks that do not resolve to existing files.
- Missing frontmatter in `entities/`, `concepts/`, `comparisons/`, and `queries/`.

Health output is advisory. Review findings before restructuring a real vault.

## Capture Reflection

Use **Add reflection** from the command palette or dashboard when you want to capture a private summary of what happened in an agent session or a manual review.

The reflection lives in the Activity Ledger, not in a normal vault note.

## Regenerate Agent Config

If your agent instructions drift or a config file is accidentally edited, use the settings tab to regenerate platform config.

This is useful after changing the knowledge base name, switching platforms, or repairing a partially initialized vault.

## Work Safely With Agents

Use these conventions when asking an agent to work in a Knowlery vault:

- Ask the agent to read `KNOWLEDGE.md` first.
- Keep source notes separate from compiled knowledge pages.
- Ask for citations with `[[wikilinks]]`.
- Review generated knowledge pages before relying on them.
- Run Health after large imports, migrations, or agent-generated changes.
