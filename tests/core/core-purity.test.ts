import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Spec 0.7 f1, §4.4: the modules the CLI shell depends on must never gain a value
 * import from 'obsidian'. Type-only imports are erased at compile time and allowed
 * (matching how cli-handler.ts consumes CliData). Generalizes the 0.6.0 engine-purity
 * guard to the full inverted set.
 */

const INVERTED_MODULES = [
  'core/vault-fs.ts',
  'core/vault-sync.ts',
  'core/vault-config-health.ts',
  'core/setup-executor.ts',
  'cli/main.ts',
  'cli/commands/shared.ts',
  'cli/commands/init.ts',
  'cli/commands/sync.ts',
  'cli/commands/health.ts',
  'cli/commands/query.ts',
  'cli/commands/stale.ts',
  'cli/commands/bundle.ts',
  'cli/commands/bundle-export.ts',
  'cli/commands/bundle-publish.ts',
  'core/okf/zip.ts',
  'core/okf/publish.ts',
  'core/okf/remote-source.ts',
  'core/okf/collect.ts',
  'core/okf/export-scope.ts',
  'core/okf/compile.ts',
  'core/okf/link-resolver.ts',
  'core/activity-ledger.ts',
  'core/skill-manager.ts',
  'core/rule-manager.ts',
  'core/rule-imports.ts',
  'core/migration.ts',
  'core/platform-adapter.ts',
  'core/query-script.ts',
  'core/okf/registry.ts',
  'core/okf/install.ts',
  'core/okf/uninstall.ts',
  'core/okf/knowledge-md-bundles.ts',
  'core/query/engine.ts',
  'core/query/scan.ts',
  'core/query/tokenize.ts',
  'core/query/format.ts',
  'core/query/staleness.ts',
];

describe('core purity (spec 0.7 f1, §4.4)', () => {
  it.each(INVERTED_MODULES)('%s has no obsidian value import', (module) => {
    const source = readFileSync(join(__dirname, '..', '..', 'src', module), 'utf8');
    // Value imports: `import { x } from 'obsidian'` or `import x from 'obsidian'`.
    // Type-only imports (`import type { ... } from 'obsidian'`) are erased and allowed.
    const valueImport = /import\s+(?!type\b)[^;]*from\s+['"]obsidian['"]/;
    expect(source).not.toMatch(valueImport);
  });
});
