import { describe, expect, it } from 'vitest';
import { generateClaudeMd, generateKnowledgeMd, generateOpenCodeJson } from '../../src/assets/templates';
import { migrateFixedContextImports } from '../../src/core/migration';
import { CLAUDE_RULE_IMPORTS_START, CLAUDE_RULE_IMPORTS_END } from '../../src/core/rule-imports';

import { createMemoryFs } from '../mocks/memory-fs';

describe('slimmed templates (spec f4, §4.1)', () => {
  it('CLAUDE.md template imports the operating card and rules only', () => {
    const claudeMd = generateClaudeMd(['activity-ledger.md']);
    expect(claudeMd).toContain('@../KNOWLEDGE.md');
    expect(claudeMd).toContain('@rules/activity-ledger.md');
    expect(claudeMd).not.toContain('@../SCHEMA.md');
    expect(claudeMd).not.toContain('@../INDEX.base');
  });

  it('opencode.json template lists the operating card and rules only', () => {
    const parsed = JSON.parse(generateOpenCodeJson('My KB'));
    expect(parsed.instructions).toEqual(['KNOWLEDGE.md', '.agents/rules/*.md']);
  });

  it('KNOWLEDGE.md instructs reading SCHEMA.md before writing pages', () => {
    expect(generateKnowledgeMd('My KB')).toContain(
      'Read `SCHEMA.md` before creating or re-tagging knowledge pages',
    );
  });
});

describe('migrateFixedContextImports (spec f4, §4.2)', () => {
  const legacyClaudeMd = [
    '@../KNOWLEDGE.md',
    '@../SCHEMA.md',
    '@../INDEX.base',
    '',
    '# My own notes about this vault',
    'Keep answers short.',
    CLAUDE_RULE_IMPORTS_START,
    '@rules/activity-ledger.md',
    CLAUDE_RULE_IMPORTS_END,
    '',
  ].join('\n');

  it('removes exactly the two stale import lines and preserves everything else', async () => {
    const fs = createMemoryFs({ '.claude/CLAUDE.md': legacyClaudeMd });
    await migrateFixedContextImports(fs);

    const migrated = fs.files.get('.claude/CLAUDE.md')!;
    expect(migrated).toContain('@../KNOWLEDGE.md');
    expect(migrated).not.toContain('@../SCHEMA.md');
    expect(migrated).not.toContain('@../INDEX.base');
    expect(migrated).toContain('# My own notes about this vault');
    expect(migrated).toContain('Keep answers short.');
    expect(migrated).toContain(CLAUDE_RULE_IMPORTS_START);
    expect(migrated).toContain('@rules/activity-ledger.md');
  });

  it('is idempotent — the second run writes nothing', async () => {
    const fs = createMemoryFs({ '.claude/CLAUDE.md': legacyClaudeMd });
    await migrateFixedContextImports(fs);
    const writesAfterFirst = fs.writeLog.length;
    await migrateFixedContextImports(fs);
    expect(fs.writeLog.length).toBe(writesAfterFirst);
  });

  it('does not touch a CLAUDE.md where the user re-added nothing stale', async () => {
    const content = '@../KNOWLEDGE.md\n\n# Custom section\n';
    const fs = createMemoryFs({ '.claude/CLAUDE.md': content });
    await migrateFixedContextImports(fs);
    expect(fs.writeLog).toEqual([]);
    expect(fs.files.get('.claude/CLAUDE.md')).toBe(content);
  });

  it('filters only the instructions array in opencode.json, preserving other keys', async () => {
    const fs = createMemoryFs({
      'opencode.json': JSON.stringify({
        name: 'My KB',
        instructions: ['KNOWLEDGE.md', 'SCHEMA.md', 'INDEX.base', '.agents/rules/*.md'],
        customKey: { nested: true },
      }, null, 2),
    });
    await migrateFixedContextImports(fs);

    const parsed = JSON.parse(fs.files.get('opencode.json')!);
    expect(parsed.instructions).toEqual(['KNOWLEDGE.md', '.agents/rules/*.md']);
    expect(parsed.name).toBe('My KB');
    expect(parsed.customKey).toEqual({ nested: true });
  });

  it('leaves malformed opencode.json untouched', async () => {
    const broken = '{ this is not json';
    const fs = createMemoryFs({ 'opencode.json': broken });
    await migrateFixedContextImports(fs);
    expect(fs.writeLog).toEqual([]);
    expect(fs.files.get('opencode.json')).toBe(broken);
  });

  it('does nothing when neither file exists', async () => {
    const fs = createMemoryFs();
    await migrateFixedContextImports(fs);
    expect(fs.writeLog).toEqual([]);
  });
});
