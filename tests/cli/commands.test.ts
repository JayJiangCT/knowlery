import { describe, expect, it } from 'vitest';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runInit } from '../../src/cli/commands/init';
import { runSync } from '../../src/cli/commands/sync';
import { runHealth } from '../../src/cli/commands/health';
import { CliError } from '../../src/cli/commands/shared';
import { nodeVaultFs } from '../../src/platform/node-fs';
import { executeSetup } from '../../src/core/setup-executor';
import { generateClaudeMd } from '../../src/assets/templates';
import { BUNDLED_SKILLS } from '../../src/assets/skills';

const silent = () => {};

async function withTempDir<T>(run: (root: string) => Promise<T>): Promise<T> {
  const root = await mkdtemp(join(tmpdir(), 'knowlery-cli-'));
  try {
    return await run(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

describe('knowlery init (spec 0.7 f2, §6.1)', () => {
  it('produces the identical file tree to the plugin wizard', async () => {
    await withTempDir(async (cliRoot) => {
      await withTempDir(async (wizardRoot) => {
        await runInit(nodeVaultFs(cliRoot), {
          platform: 'claude-code',
          name: 'My KB',
          prompt: null,
          log: silent,
        });
        await executeSetup(nodeVaultFs(wizardRoot), 'claude-code', 'My KB', () => {});

        // Compare the full tree by content, ignoring only the manifest timestamps.
        const [cliTree, wizardTree] = await Promise.all([listTree(cliRoot), listTree(wizardRoot)]);
        expect(cliTree.keys).toEqual(wizardTree.keys);
        for (const key of cliTree.keys) {
          if (key === '.knowlery/manifest.json') continue;
          expect(cliTree.contents.get(key), key).toEqual(wizardTree.contents.get(key));
        }
      });
    });
  });

  it('refuses a second init without --force and points at sync', async () => {
    await withTempDir(async (root) => {
      const fs = nodeVaultFs(root);
      await runInit(fs, { platform: 'claude-code', name: 'KB', prompt: null, log: silent });
      await expect(
        runInit(fs, { platform: 'claude-code', name: 'KB', prompt: null, log: silent }),
      ).rejects.toThrow(/knowlery sync/);
      await expect(
        runInit(fs, { platform: 'claude-code', name: 'KB', force: true, prompt: null, log: silent }),
      ).resolves.toBeUndefined();
    });
  });

  it('errors deterministically when flags are missing and stdin is not a TTY', async () => {
    await withTempDir(async (root) => {
      const fs = nodeVaultFs(root);
      await expect(
        runInit(fs, { name: 'KB', prompt: null, log: silent }),
      ).rejects.toThrow(/--platform/);
      await expect(
        runInit(fs, { platform: 'claude-code', prompt: null, log: silent }),
      ).rejects.toThrow(/--name/);
    });
  });

  it('prompts interactively when a TTY is available', async () => {
    await withTempDir(async (root) => {
      const answers = ['opencode', 'Prompted KB'];
      await runInit(nodeVaultFs(root), {
        prompt: async () => answers.shift() ?? '',
        log: silent,
      });
      const opencode = JSON.parse(await readFile(join(root, 'opencode.json'), 'utf8')) as { name: string };
      expect(opencode.name).toBe('Prompted KB');
    });
  });
});

describe('knowlery sync (spec 0.7 f2, §6.2)', () => {
  it('rejects an uninitialized directory', async () => {
    await withTempDir(async (root) => {
      await expect(runSync(nodeVaultFs(root), { log: silent })).rejects.toThrow(/knowlery init/);
    });
  });

  it('applies the upgrade migrations to a stale vault and is then a no-op', async () => {
    await withTempDir(async (root) => {
      const fs = nodeVaultFs(root);
      await runInit(fs, { platform: 'claude-code', name: 'KB', prompt: null, log: silent });

      // Make the vault stale: 0.5.0-era fixed-context imports + outdated skill content.
      const claudeMd = await fs.read('.claude/CLAUDE.md');
      await fs.write('.claude/CLAUDE.md', `@../KNOWLEDGE.md\n@../SCHEMA.md\n@../INDEX.base\n${claudeMd.split('\n').slice(1).join('\n')}`);
      await fs.write('.agents/skills/ask/SKILL.md', '# outdated skill');

      const lines: string[] = [];
      await runSync(fs, { log: (line) => lines.push(line) });
      const changed = lines.join('\n');
      expect(changed).toContain('.claude/CLAUDE.md');
      expect(changed).toContain('.agents/skills/ask/SKILL.md');
      expect(await fs.read('.claude/CLAUDE.md')).not.toContain('@../SCHEMA.md');
      expect(await fs.read('.agents/skills/ask/SKILL.md')).toContain('knowlery:query');

      const secondRun: string[] = [];
      await runSync(fs, { log: (line) => secondRun.push(line) });
      expect(secondRun.join('\n')).toContain('No changes');
    });
  });
});

describe('knowlery health (spec 0.7 f2, §6.3)', () => {
  it('passes on a healthy vault and emits parseable json', async () => {
    await withTempDir(async (root) => {
      const fs = nodeVaultFs(root);
      await runInit(fs, { platform: 'claude-code', name: 'KB', prompt: null, log: silent });

      const lines: string[] = [];
      await runHealth(fs, { root, json: true, log: (line) => lines.push(line) });
      const report = JSON.parse(lines.join('\n')) as { healthy: boolean; config: { skillsComplete: { missing: string[] } }; knowledgePages: Record<string, unknown> };
      expect(report.healthy).toBe(true);
      expect(report.config.skillsComplete.missing).toEqual([]);
      expect(Object.keys(report.knowledgePages)).toEqual(['entities', 'concepts', 'comparisons', 'queries']);
    });
  });

  it('fails with exit code 1 when a skill or directory is missing', async () => {
    await withTempDir(async (root) => {
      const fs = nodeVaultFs(root);
      await runInit(fs, { platform: 'claude-code', name: 'KB', prompt: null, log: silent });
      await fs.rmdir(`.agents/skills/${BUNDLED_SKILLS[0].name}`, true);

      const error = await runHealth(fs, { root, log: silent }).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(CliError);
      expect((error as CliError).exitCode).toBe(1);
    });
  });
});

describe('shared sync surface (spec 0.7 f2, §6.4)', () => {
  it('generateClaudeMd stays consistent with what sync converges to', async () => {
    await withTempDir(async (root) => {
      const fs = nodeVaultFs(root);
      await runInit(fs, { platform: 'claude-code', name: 'KB', prompt: null, log: silent });
      await runSync(fs, { log: silent }); // normalizes plain imports into the managed block
      const converged = await fs.read('.claude/CLAUDE.md');
      expect(converged).toContain('@../KNOWLEDGE.md');
      expect(converged).toContain(generateClaudeMd([]).trim());
    });
  });
});

async function listTree(root: string): Promise<{ keys: string[]; contents: Map<string, string> }> {
  const { readdir } = await import('node:fs/promises');
  const keys: string[] = [];
  const contents = new Map<string, string>();

  async function walk(dir: string): Promise<void> {
    const entries = await readdir(join(root, dir), { withFileTypes: true });
    for (const entry of entries) {
      const rel = dir ? `${dir}/${entry.name}` : entry.name;
      if (entry.isDirectory()) await walk(rel);
      else {
        keys.push(rel);
        contents.set(rel, await readFile(join(root, rel), 'utf8'));
      }
    }
  }

  await walk('');
  keys.sort();
  return { keys, contents };
}
