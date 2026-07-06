import { describe, expect, it } from 'vitest';
import { mkdtemp, readFile, readdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { executeSetup, isVaultInitialized } from '../../src/core/setup-executor';
import { nodeVaultFs } from '../../src/platform/node-fs';
import { createMemoryFs } from '../mocks/memory-fs';
import { BUNDLED_SKILLS } from '../../src/assets/skills';
import { KNOWLEDGE_DIRS } from '../../src/types';
import { RULE_TEMPLATES } from '../../src/assets/rules';

describe('isVaultInitialized', () => {
  it('returns true when only KNOWLEDGE.md exists (legacy vault without manifest)', async () => {
    const fs = createMemoryFs({ 'KNOWLEDGE.md': '# kb' });
    expect(await isVaultInitialized(fs)).toBe(true);
  });

  it('returns true when only .knowlery/manifest.json exists (new-style vault)', async () => {
    const fs = createMemoryFs({ '.knowlery/manifest.json': '{}' });
    expect(await isVaultInitialized(fs)).toBe(true);
  });

  it('returns false when neither KNOWLEDGE.md nor .knowlery/manifest.json exists', async () => {
    const fs = createMemoryFs();
    expect(await isVaultInitialized(fs)).toBe(false);
  });
});

describe('executeSetup over nodeVaultFs (spec 0.7 f1, §6.2)', () => {
  it('produces the full vault layout in a real temp directory', async () => {
    const root = await mkdtemp(join(tmpdir(), 'knowlery-setup-'));
    try {
      const steps: string[] = [];
      await executeSetup(nodeVaultFs(root), 'claude-code', 'Test KB', (step) => steps.push(step));

      expect(steps).toEqual([
        'directories',
        'knowledge-files',
        'skills',
        'platform-config',
        'lock-files',
      ]);

      // Root knowledge files
      expect((await readFile(join(root, 'KNOWLEDGE.md'), 'utf8'))).toContain('Test KB');
      await stat(join(root, 'SCHEMA.md'));
      await stat(join(root, 'INDEX.base'));

      // Knowledge directories
      for (const dir of KNOWLEDGE_DIRS) {
        expect((await stat(join(root, dir))).isDirectory()).toBe(true);
      }

      // Every bundled skill, in both skill dirs
      for (const skill of BUNDLED_SKILLS) {
        await stat(join(root, '.agents/skills', skill.name, 'SKILL.md'));
        await stat(join(root, '.claude/skills', skill.name, 'SKILL.md'));
      }

      // Rules and platform config
      for (const rule of RULE_TEMPLATES) {
        await stat(join(root, '.claude/rules', rule.filename));
      }
      const claudeMd = await readFile(join(root, '.claude/CLAUDE.md'), 'utf8');
      expect(claudeMd).toContain('@../KNOWLEDGE.md');
      expect(claudeMd).toContain('@rules/activity-ledger.md');

      // Lock, manifest, retrieval script
      const lock = JSON.parse(await readFile(join(root, 'skills-lock.json'), 'utf8')) as { skills: Record<string, unknown> };
      expect(Object.keys(lock.skills).sort()).toEqual(BUNDLED_SKILLS.map((s) => s.name).sort());
      const manifest = JSON.parse(await readFile(join(root, '.knowlery/manifest.json'), 'utf8')) as { platform: string; kbName: string };
      expect(manifest.platform).toBe('claude-code');
      expect(manifest.kbName).toBe('Test KB');
      const script = await readFile(join(root, '.knowlery/bin/query.mjs'), 'utf8');
      expect(script.length).toBeGreaterThan(1000);

      // Nothing unexpected at the vault root
      const rootEntries = (await readdir(root)).sort();
      expect(rootEntries).toEqual(
        [
          '.agents', '.claude', '.knowlery',
          'INDEX.base', 'KNOWLEDGE.md', 'SCHEMA.md',
          ...KNOWLEDGE_DIRS,
          'skills-lock.json',
        ].sort(),
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
