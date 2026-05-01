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

## Manage Skills

Open the Skills tab to inspect installed skills.

Built-in skills can be disabled or forked. Forking creates a custom variant that you can edit without changing the built-in copy. Custom skills can be edited or deleted.

Registry skills can be discovered through the skill browser when Node.js and the external skills tooling are available.

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

Open the Health tab and click **Run diagnosis**.

Knowlery checks:

- Orphan notes with no incoming wikilinks.
- Broken wikilinks that do not resolve to existing files.
- Missing frontmatter in `entities/`, `concepts/`, `comparisons/`, and `queries/`.

Health output is advisory. Review findings before restructuring a real vault.

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
