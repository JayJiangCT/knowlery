import { describe, expect, it } from 'vitest';
import { generateClaudeMd } from '../../src/assets/templates';
import { CLAUDE_AGENTS_IMPORT, mergeClaudeMd, syncClaudeMd } from '../../src/core/claude-md';
import { createMemoryFs } from '../mocks/memory-fs';

describe('CLAUDE.md is the documented one-line bridge to AGENTS.md', () => {
  it('a fresh file imports AGENTS.md and nothing else — the rules already live inside it', () => {
    expect(generateClaudeMd()).toBe('@../AGENTS.md\n');
    expect(mergeClaudeMd(null)).toBe(generateClaudeMd());
  });

  it('converges a pre-1.5 file: KNOWLEDGE.md import becomes the AGENTS.md import, rule imports go, user text stays', () => {
    const legacy = [
      '@../KNOWLEDGE.md',
      '@../SCHEMA.md',
      '@../INDEX.base',
      '',
      '# My own notes about this vault',
      'Keep answers short.',
      '<!-- Knowlery rule imports:start -->',
      '@rules/activity-ledger.md',
      '@rules/citation-required.md',
      '<!-- Knowlery rule imports:end -->',
      '',
    ].join('\n');

    const merged = mergeClaudeMd(legacy);

    expect(merged.startsWith(`${CLAUDE_AGENTS_IMPORT}\n`)).toBe(true);
    expect(merged).not.toContain('@../KNOWLEDGE.md');
    expect(merged).not.toContain('@../SCHEMA.md');
    expect(merged).not.toContain('@../INDEX.base');
    // Without this, Claude would load every rule twice (AGENTS.md + .claude/rules auto-load).
    expect(merged).not.toContain('@rules/');
    expect(merged).not.toContain('Knowlery rule imports');
    expect(merged).toContain('# My own notes about this vault\nKeep answers short.');
  });

  it('adds the import to a hand-written CLAUDE.md that never had Knowlery imports', () => {
    const merged = mergeClaudeMd('# Claude-only notes\n\nPrefer terse replies.\n');
    expect(merged).toBe('@../AGENTS.md\n\n# Claude-only notes\n\nPrefer terse replies.\n');
  });

  it('keeps Claude-specific instructions the user wrote below the import', () => {
    const current = '@../AGENTS.md\n\n# Claude only\n\nUse the Task tool for long searches.\n';
    expect(mergeClaudeMd(current)).toBe(current);
  });

  it('is idempotent on disk (no mtime churn on plugin load)', async () => {
    const fs = createMemoryFs({ '.claude/CLAUDE.md': '@../KNOWLEDGE.md\n@rules/a.md\n' });
    await syncClaudeMd(fs);
    const first = fs.files.get('.claude/CLAUDE.md');
    expect(first).toBe('@../AGENTS.md\n');

    const writes = fs.writeLog.length;
    await syncClaudeMd(fs);
    expect(fs.writeLog.length).toBe(writes);
  });

  it('creates the file (and .claude/) when missing, for every platform', async () => {
    const fs = createMemoryFs();
    await syncClaudeMd(fs);
    expect(fs.files.get('.claude/CLAUDE.md')).toBe('@../AGENTS.md\n');
  });
});
