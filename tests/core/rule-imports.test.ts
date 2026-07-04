import { describe, expect, it } from 'vitest';
import { generateClaudeMd } from '../../src/assets/templates';
import { generatePlatformConfig } from '../../src/core/platform-adapter';
import { deleteRule, installDefaultRules, writeRule } from '../../src/core/rule-manager';
import { syncClaudeRuleImports } from '../../src/core/rule-imports';
import { createMemoryFs } from '../mocks/memory-fs';

describe('Claude rule imports', () => {
  it('renders explicit imports for every Claude rule file', () => {
    const claudeMd = generateClaudeMd([
      'activity-ledger.md',
      'frontend/testing.md',
    ]);

    expect(claudeMd).toContain('@rules/activity-ledger.md');
    expect(claudeMd).toContain('@rules/frontend/testing.md');
  });

  it('regenerates Claude config with installed rules and keeps OpenCode glob instructions', async () => {
    const fs = createMemoryFs();
    await installDefaultRules(fs, 'claude-code');
    await generatePlatformConfig(fs, 'claude-code', 'My KB');

    expect(fs.files.get('.claude/CLAUDE.md')).toContain('@rules/activity-ledger.md');
    expect(fs.files.get('.claude/CLAUDE.md')).toContain('@rules/citation-required.md');

    await generatePlatformConfig(fs, 'opencode', 'My KB');
    expect(fs.files.get('opencode.json')).toContain('.agents/rules/*.md');
  });

  it('syncs Claude rule imports after custom rules are added and deleted', async () => {
    const fs = createMemoryFs({
      '.claude/rules/activity-ledger.md': '# Activity Ledger',
      '.claude/CLAUDE.md': generateClaudeMd(['activity-ledger.md']),
    });

    await writeRule(fs, 'claude-code', 'custom-review.md', '# Custom Review');
    expect(fs.files.get('.claude/CLAUDE.md')).toContain('@rules/custom-review.md');

    await deleteRule(fs, 'claude-code', 'activity-ledger.md');
    const claudeMd = fs.files.get('.claude/CLAUDE.md');
    expect(claudeMd).not.toContain('@rules/activity-ledger.md');
    expect(claudeMd).toContain('@rules/custom-review.md');
  });

  it('does not rewrite an already-synced Claude config (no mtime churn on reload)', async () => {
    const fs = createMemoryFs({
      '.claude/rules/activity-ledger.md': '# Activity Ledger',
    });
    await syncClaudeRuleImports(fs);
    const synced = fs.files.get('.claude/CLAUDE.md');

    const writesBefore = fs.writeLog.length;
    await syncClaudeRuleImports(fs);
    expect(fs.writeLog.length).toBe(writesBefore);
    expect(fs.files.get('.claude/CLAUDE.md')).toBe(synced);
  });

  it('upgrades an existing Claude config without requiring manual regeneration', async () => {
    const fs = createMemoryFs({
      '.claude/rules/activity-ledger.md': '# Activity Ledger',
      '.claude/rules/custom-review.md': '# Custom Review',
      '.claude/CLAUDE.md': [
        '@../KNOWLEDGE.md',
        '@../SCHEMA.md',
        '@../INDEX.base',
        '',
      ].join('\n'),
    });

    await syncClaudeRuleImports(fs);

    const claudeMd = fs.files.get('.claude/CLAUDE.md');
    expect(claudeMd).toContain('@../KNOWLEDGE.md');
    expect(claudeMd).toContain('@rules/activity-ledger.md');
    expect(claudeMd).toContain('@rules/custom-review.md');
  });
});
