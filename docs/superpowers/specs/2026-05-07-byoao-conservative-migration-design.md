# BYOAO Conservative Migration Design

## Goal

Add a one-click migration path for existing BYOAO vaults so beta users can adopt Knowlery without rerunning first-time setup or risking their existing knowledge base.

The migration should treat BYOAO as a legacy source and make Claude Code / Claudian the primary Knowlery target. It should preserve old BYOAO and OpenCode files for rollback.

## User Experience

When Knowlery opens in an uninitialized vault, it checks for legacy BYOAO signals before showing the normal setup flow.

Legacy signals include:

- `.byoao/manifest.json`
- `.opencode/skills/`
- `AGENTS.md` with BYOAO-oriented instructions
- Existing knowledge directories such as `entities/`, `concepts/`, `comparisons/`, or `queries/`

If a BYOAO vault is detected, the setup modal shows a migration-focused path:

- Title: `Migrate from BYOAO`
- Primary action: `Migrate to Knowlery`
- Secondary action: normal setup remains available only as an explicit alternative
- Preview summary shows what will be created, preserved, imported, and skipped

The migration runs after one confirmation click. The completion state should explain that the old BYOAO/OpenCode files were preserved.

## Migration Behavior

The migration is conservative:

- Create missing Knowlery infrastructure.
- Preserve existing knowledge files and directories.
- Preserve legacy BYOAO/OpenCode files.
- Do not delete `.byoao`, `.opencode`, `.opencode.json`, or `AGENTS.md`.
- Do not overwrite `SCHEMA.md`, `INDEX.base`, existing knowledge notes, existing skills, or existing rules.

The migration writes:

- `.knowlery/manifest.json`
- `KNOWLEDGE.md`, only if missing
- `.claude/CLAUDE.md`, generated or repaired for Claude Code
- `.claude/rules/`, with missing default rules added
- `.agents/rules/`, only when needed for internal consistency
- `.claude/skills/<name>/SKILL.md`, synced from `.agents/skills/<name>/SKILL.md`
- `skills-lock.json`, converted or repaired into Knowlery's expected shape

## Skill Import Rules

`.agents/skills/` is the canonical Knowlery source.

Import order:

1. Existing `.agents/skills/<name>/SKILL.md`
2. Legacy `.opencode/skills/<name>/SKILL.md` when the skill is missing from `.agents/skills`
3. Knowlery bundled skills when missing

If the same skill name exists in multiple sources, keep the existing `.agents/skills` copy. The preview should report the conflict as preserved, not overwritten.

Legacy skills that are not Knowlery built-ins should remain available and be recorded as custom legacy skills in `skills-lock.json`.

## Lock File Strategy

Knowlery currently expects `skills-lock.json` entries with:

- `source`
- `version`
- `disabled`
- optional `forkedFrom`
- optional `registryIdentifier`

BYOAO or external skills tooling may leave a different lock shape. The migration should read it best-effort, preserve useful registry metadata when possible, and rewrite the lock in Knowlery's schema.

Recommended source mapping:

- Knowlery bundled skill: `builtin`
- Imported legacy BYOAO/OpenCode skill: `custom`
- Existing non-bundled `.agents/skills` skill: `custom`
- Existing registry skill with recognized metadata: `registry`

All imported skills are enabled by default.

## Conflict Handling

The migration should be idempotent. Running it twice should not duplicate work or overwrite preserved files.

Conflicts are handled as follows:

- Existing root knowledge files are preserved.
- Existing `.agents/skills` copies win over `.opencode/skills`.
- Existing `.claude/rules` files are preserved; missing default rules are added.
- Existing `.claude/CLAUDE.md` is preserved if it appears user-edited; otherwise regenerated if missing or clearly Knowlery-generated.
- Invalid JSON in `.byoao/manifest.json` or `skills-lock.json` does not block migration; it appears as a warning in the preview and completion summary.

## Manual Verification Needed

After migration, users should manually verify:

- Claude Code can read the vault-level `.claude/CLAUDE.md`.
- Claudian can start a session in the vault.
- Important legacy skills still appear in Knowlery's skills UI.
- Existing BYOAO commands/workflows still work if the user wants temporary rollback.
- `INDEX.base` still opens correctly in Obsidian Bases.

## Implementation Shape

Add a dedicated migration module rather than folding this into first-time setup:

- `src/core/legacy-byoao-migration.ts`
  - detect legacy BYOAO vaults
  - build migration preview
  - execute conservative migration
  - normalize `skills-lock.json`

Extend the setup wizard so it can switch between:

- normal setup for empty vaults
- BYOAO migration for detected legacy vaults

Keep the public behavior small and explicit:

- `detectByoaoLegacyVault(app)`
- `buildByoaoMigrationPreview(app)`
- `executeByoaoMigration(app, options)`

## Testing

Unit-style tests should cover pure functions for:

- legacy signal detection
- skill source merge order
- lock file normalization
- idempotent preview output

Manual vault tests should cover:

- a BYOAO vault with `.opencode/skills` only
- a BYOAO vault with both `.agents/skills` and `.opencode/skills`
- a vault with conflicting skill names
- a vault with invalid legacy manifest JSON
- running migration twice
- opening Knowlery after migration and confirming setup is not shown again

## Non-Goals

This migration will not:

- delete or archive BYOAO files
- rename legacy skills
- rewrite existing knowledge pages
- force users from OpenCode to Claude Code by removing OpenCode config
- guarantee all old BYOAO commands continue to behave forever

The first release should make adoption safe. Cleanup can be a later explicit action.
