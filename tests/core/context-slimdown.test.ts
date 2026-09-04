import { describe, expect, it } from 'vitest';
import { generateKnowledgeMd } from '../../src/assets/templates';
import { migrateFixedContextImports, migrateOpenCodeUnrecognizedKeys } from '../../src/core/migration';

import { createMemoryFs } from '../mocks/memory-fs';

describe('slimmed templates (spec f4, §4.1)', () => {
  it('KNOWLEDGE.md instructs reading SCHEMA.md before writing pages', () => {
    expect(generateKnowledgeMd('My KB')).toContain(
      'Read `SCHEMA.md` before creating or re-tagging knowledge pages',
    );
  });
});

describe('migrateFixedContextImports (spec f4, §4.2) — opencode.json half; CLAUDE.md is covered by claude-md.test', () => {
  it('filters only the instructions array in opencode.json, preserving other keys', async () => {
    const fs = createMemoryFs({
      'opencode.json': JSON.stringify({
        name: 'My KB',
        instructions: ['KNOWLEDGE.md', 'SCHEMA.md', 'INDEX.base', '.agents/rules/*.md'],
        customKey: { nested: true },
      }, null, 2),
    });
    await migrateFixedContextImports(fs);

    const parsed = JSON.parse(fs.files.get('opencode.json')!) as { instructions: string[]; name: string; customKey: unknown };
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

describe('migrateOpenCodeUnrecognizedKeys (issue #72)', () => {
  it('strips the rejected top-level name key and preserves everything else', async () => {
    const fs = createMemoryFs({
      'opencode.json': JSON.stringify({
        name: 'My KB',
        instructions: ['KNOWLEDGE.md', '.agents/rules/*.md'],
        customKey: { nested: true },
      }, null, 2),
    });
    await migrateOpenCodeUnrecognizedKeys(fs);

    const parsed = JSON.parse(fs.files.get('opencode.json')!) as {
      instructions: string[];
      name?: string;
      customKey: unknown;
    };
    expect(parsed).not.toHaveProperty('name');
    expect(parsed.instructions).toEqual(['KNOWLEDGE.md', '.agents/rules/*.md']);
    expect(parsed.customKey).toEqual({ nested: true });
  });

  it('is idempotent — the second run writes nothing', async () => {
    const fs = createMemoryFs({
      'opencode.json': JSON.stringify({
        name: 'My KB',
        instructions: ['KNOWLEDGE.md'],
      }, null, 2),
    });
    await migrateOpenCodeUnrecognizedKeys(fs);
    const writesAfterFirst = fs.writeLog.length;
    await migrateOpenCodeUnrecognizedKeys(fs);
    expect(fs.writeLog.length).toBe(writesAfterFirst);
  });

  it('leaves malformed opencode.json untouched', async () => {
    const broken = '{ this is not json';
    const fs = createMemoryFs({ 'opencode.json': broken });
    await migrateOpenCodeUnrecognizedKeys(fs);
    expect(fs.writeLog).toEqual([]);
    expect(fs.files.get('opencode.json')).toBe(broken);
  });

  it('does nothing when opencode.json is absent', async () => {
    const fs = createMemoryFs();
    await migrateOpenCodeUnrecognizedKeys(fs);
    expect(fs.writeLog).toEqual([]);
  });
});
