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

Knowlery now centers on one action-first dashboard:

| Section | What to do there |
| --- | --- |
| Today's move | Start with the current activity state and pick one small next move |
| Suggested moves | Copy or send reusable prompts such as Process new material, Connect related notes, Challenge an idea, Fix note metadata, or Draft an output |
| Knowledge health | Open Freshness Review when suggestions are waiting |
| This note | Review the active Markdown note and ask for related connections |
| Recent activity | Inspect recent private activity receipts |
| This week | Generate a weekly summary or send a polish request |

Use the refresh button when recent activity or vault changes need to be reflected. Use **View all** links for longer move and activity lists.

## Work with Today's Move

Today's move is the quickest way to understand what Knowlery thinks is happening in your vault.

1. Open the dashboard.
2. Read the current summary and the highlighted next move.
3. Use the copy or send action if you want an agent prompt.
4. Use Add reflection if you want to record a private note about your own work.

If you already have activity receipts, Knowlery will show active knowledge threads and likely next moves. If you do not, it will steer you toward the first cook or a small setup step.

## Review a Note

Open a Markdown note and look at the This note section on the dashboard.

Knowlery will try to identify the active note, relate it to recent knowledge activity, and prepare a focused prompt. Use this when you want to ask an agent to connect one note to older material, comparisons, or reusable structures.

## Generate a Weekly Summary

Use This week when you want a broader summary.

1. Use **Generate summary** to create a local HTML report in `.knowlery/reports/latest.html`.
2. Use **Open last report** to open that file outside Obsidian.
3. Use **Send for review** when you want a companion agent to write a more polished review summary.
4. Use **Check result** to refresh the request/result state.

The report also saves a dated snapshot under `.knowlery/reports/weekly/`.

## Use Suggested Moves

Suggested moves are the place to start from product-language actions instead of raw skill names.

The move catalog includes:

| Move | What it is for |
| --- | --- |
| Process new material | Turn rough notes, clips, or conversations into durable knowledge pages |
| Connect related notes | Find older notes, adjacent themes, and reusable patterns |
| Challenge an idea | Check assumptions, missing evidence, counterexamples, and risks |
| Fix note metadata | Review drift, duplicates, frontmatter gaps, broken links, and index hygiene |
| Draft an output | Turn a mature topic into a checklist, outline, template, proposal, or decision memo |

Open a move to copy its prompt or send it to your configured agent chat. Open **Settings -> Knowlery -> Skills** to inspect, create, fork, edit, disable, or delete the underlying skills.

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

1. Open **Settings -> Knowlery**.
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

Open **Settings -> Knowlery**, then use the Diagnostics section and click **Run diagnosis**.

Knowlery checks:

- Orphan notes with no incoming wikilinks.
- Broken wikilinks that do not resolve to existing files.
- Missing frontmatter in `entities/`, `concepts/`, `comparisons/`, and `queries/`.

Health output is advisory. Review findings before restructuring a real vault.

## Run Freshness Review

Use Freshness Review when you want an agent to check whether compiled knowledge pages are outdated or superseded.

1. Open Knowledge health from the dashboard.
2. Use **Prepare request** to write a request JSON file under `.knowlery/freshness/requests/`.
3. Copy the prompt and run the agent separately.
4. Put the result JSON where the request asks, then use **Import results**.
5. Review each suggestion before applying, dismissing, or marking it incorrect.

Knowlery only patches scalar freshness frontmatter after approval. It does not call a model API for this workflow.

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
