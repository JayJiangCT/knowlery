import { describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runBundlePublish } from '../../src/cli/commands/bundle-publish';
import { runBundleCommand } from '../../src/cli/commands/bundle';
import { CliError } from '../../src/cli/commands/shared';
import { nodeVaultFs } from '../../src/platform/node-fs';
import type { GhResult } from '../../src/core/okf/publish';
import { ExportScopeFileSchema } from '../../src/types';

const silent = () => {};

/**
 * Spec 0.9 f2, §5: publish safety properties against a scripted gh runner —
 * no network, no real gh. The vault fixture mirrors the bundle-export tests.
 */

const VAULT_FILES: Record<string, string> = {
  'KNOWLEDGE.md': '# KB\n',
  'concepts/drone-delivery.md':
    '---\ntype: concept\ntitle: Drone Delivery\ndescription: Delivering packages by drone\ndomain: logistics\ncreated: 2026-06-01\n---\n\nDrones deliver packages, see [[flight-safety]]. Contact alice@example.com for waivers.\n',
  'concepts/flight-safety.md':
    '---\ntype: concept\ntitle: Flight Safety\ndescription: Safety rules for drone flight\ndomain: logistics\ncreated: 2026-06-02\n---\n\nKeep drones away from airports.\n',
};

async function withVault<T>(run: (root: string) => Promise<T>): Promise<T> {
  const workDir = await mkdtemp(join(tmpdir(), 'knowlery-publish-'));
  const root = join(workDir, 'kb');
  try {
    for (const [path, content] of Object.entries(VAULT_FILES)) {
      await mkdir(join(root, path, '..'), { recursive: true });
      await writeFile(join(root, path), content);
    }
    return await run(root);
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

async function approveAll(root: string): Promise<void> {
  const fs = nodeVaultFs(root);
  await runBundleCommand(fs, {
    sub: 'review', arg: 'drone-delivery', root,
    approve: ['concepts/drone-delivery', 'concepts/flight-safety'], flag: [], log: silent,
  });
}

/** Scripted gh: answers by subcommand, records every call. */
function scriptedGh(overrides: Partial<Record<string, GhResult>> = {}) {
  const calls: string[][] = [];
  const runner = async (args: string[]): Promise<GhResult> => {
    calls.push(args);
    const key = args.slice(0, 2).join(' ');
    if (overrides[key]) return overrides[key];
    switch (key) {
      case 'auth status': return { ok: true, stdout: '' };
      case 'repo view': return { ok: true, stdout: JSON.stringify({ visibility: 'PRIVATE', owner: { type: 'User' } }) };
      case 'release view': return { ok: false, stdout: '', error: 'release not found' };
      case 'release create': return { ok: true, stdout: '' };
      case 'release upload': return { ok: true, stdout: '' };
      case 'repo create': return { ok: true, stdout: '' };
      default: return { ok: true, stdout: '' };
    }
  };
  return { runner, calls };
}

function collector() {
  const lines: string[] = [];
  return { lines, log: (line: string) => lines.push(line) };
}

describe('publish safety properties (spec 0.9 f2, §5)', () => {
  it('§5.1 unreviewed scope: exit 1 with the checklist; gh never invoked', async () => {
    await withVault(async (root) => {
      const gh = scriptedGh();
      const out = collector();
      const error = await runBundlePublish(nodeVaultFs(root), {
        seed: 'drone-delivery', root, repo: 'jay/shelf', prompt: null, log: out.log, gh: gh.runner,
      }).then(() => null, (thrown: unknown) => thrown);

      expect(error).toBeInstanceOf(CliError);
      expect((error as CliError).message).toContain('nothing was published');
      expect(out.lines.join('\n')).toContain('[unreviewed');
      expect(gh.calls).toEqual([]);
    });
  });

  it('§5.2 public + risky approved items without acknowledgment: exit 1 listing them; no release call', async () => {
    await withVault(async (root) => {
      await approveAll(root);
      const gh = scriptedGh();
      const out = collector();
      const error = await runBundlePublish(nodeVaultFs(root), {
        seed: 'drone-delivery', root, repo: 'jay/shelf', public: true, prompt: null, log: out.log, gh: gh.runner,
      }).then(() => null, (thrown: unknown) => thrown);

      expect(error).toBeInstanceOf(CliError);
      expect((error as CliError).message).toContain('--acknowledge-risks');
      const text = out.lines.join('\n');
      expect(text).toContain('permanently public');
      expect(text).toContain('concepts/drone-delivery');
      expect(text).toContain('email: alice@example.com');
      expect(gh.calls.some((call) => call[0] === 'release')).toBe(false);
    });
  });

  it('§5.2 with --acknowledge-risks: proceeds and itemizes the acknowledgment', async () => {
    await withVault(async (root) => {
      await approveAll(root);
      const gh = scriptedGh();
      const out = collector();
      await runBundlePublish(nodeVaultFs(root), {
        seed: 'drone-delivery', root, repo: 'jay/shelf', public: true, acknowledgeRisks: true,
        prompt: null, log: out.log, gh: gh.runner,
      });
      const text = out.lines.join('\n');
      expect(text).toContain('Acknowledged via --acknowledge-risks: concepts/drone-delivery');
      expect(gh.calls.some((call) => call[0] === 'release' && call[1] === 'create')).toBe(true);
    });
  });

  it('§5.3 private by default: missing repo is created with --private; no public toggle anywhere', async () => {
    await withVault(async (root) => {
      await approveAll(root);
      const gh = scriptedGh({ 'repo view': { ok: false, stdout: '', error: 'not found' } });
      // First repo view fails (missing); after creation the runner's default answers again.
      let repoViews = 0;
      const runner = async (args: string[]) => {
        if (args.slice(0, 2).join(' ') === 'repo view') {
          repoViews += 1;
          if (repoViews === 1) return { ok: false, stdout: '', error: 'not found' };
          return { ok: true, stdout: JSON.stringify({ visibility: 'PRIVATE', owner: { type: 'User' } }) };
        }
        return gh.runner(args);
      };
      const out = collector();
      await runBundlePublish(nodeVaultFs(root), {
        seed: 'drone-delivery', root, repo: 'jay/shelf', prompt: null, log: out.log, gh: runner,
      });

      const createCall = gh.calls.find((call) => call[0] === 'repo' && call[1] === 'create');
      expect(createCall).toContain('--private');
      for (const call of gh.calls) expect(call).not.toContain('--public');
      expect(out.lines.join('\n')).toContain('Created jay/shelf (private).');
    });
  });

  it('§5.4 existing tag refused without --force; --force replaces the asset', async () => {
    await withVault(async (root) => {
      await approveAll(root);
      const existing = scriptedGh({ 'release view': { ok: true, stdout: 'exists' } });
      const error = await runBundlePublish(nodeVaultFs(root), {
        seed: 'drone-delivery', root, repo: 'jay/shelf', prompt: null, log: silent, gh: existing.runner,
      }).then(() => null, (thrown: unknown) => thrown);
      expect(error).toBeInstanceOf(CliError);
      expect((error as CliError).message).toContain('already published');
      expect(existing.calls.some((call) => call[1] === 'create' && call[0] === 'release')).toBe(false);
      expect(existing.calls.some((call) => call[1] === 'upload')).toBe(false);

      const forced = scriptedGh({ 'release view': { ok: true, stdout: 'exists' } });
      await runBundlePublish(nodeVaultFs(root), {
        seed: 'drone-delivery', root, repo: 'jay/shelf', force: true, prompt: null, log: silent, gh: forced.runner,
      });
      const upload = forced.calls.find((call) => call[0] === 'release' && call[1] === 'upload');
      expect(upload).toContain('--clobber');
    });
  });

  it('§5.6 no gh: exit 1 with the precomputed manual checklist; nothing else happened', async () => {
    await withVault(async (root) => {
      await approveAll(root);
      const gh = scriptedGh({ 'auth status': { ok: false, stdout: '', error: 'gh-not-installed' } });
      const out = collector();
      const error = await runBundlePublish(nodeVaultFs(root), {
        seed: 'drone-delivery', root, repo: 'jay/shelf', prompt: null, log: out.log, gh: gh.runner,
      }).then(() => null, (thrown: unknown) => thrown);

      expect(error).toBeInstanceOf(CliError);
      const text = out.lines.join('\n');
      expect(text).toContain('https://cli.github.com');
      expect(text).toContain('.knowlery/exports/creator.drone.delivery-0.1.0');
      expect(text).toContain('Tag: creator.drone.delivery-v0.1.0');
      expect(text).toMatch(/sha256-[0-9a-f]{64}/);
      expect(gh.calls.length).toBe(1); // only the auth probe
    });
  });

  it('§5.7 config round trip: first publish persists repo; second run needs no --repo; --repo switches', async () => {
    await withVault(async (root) => {
      await approveAll(root);
      const fs = nodeVaultFs(root);
      const gh1 = scriptedGh();
      await runBundlePublish(fs, { seed: 'drone-delivery', root, repo: 'jay/shelf', prompt: null, log: silent, gh: gh1.runner });

      const scope = ExportScopeFileSchema.parse(JSON.parse(await fs.read('.knowlery/export-scope.json')));
      expect(scope.bundles['creator.drone.delivery'].publish).toEqual({ repo: 'jay/shelf', visibility: 'private' });

      // Second run: no --repo, must reuse; --force because the tag now "exists"? No — scripted gh is stateless, release view still misses.
      const gh2 = scriptedGh();
      await runBundlePublish(fs, { seed: 'drone-delivery', root, prompt: null, log: silent, gh: gh2.runner });
      expect(gh2.calls.some((call) => call.includes('jay/shelf'))).toBe(true);

      const gh3 = scriptedGh();
      await runBundlePublish(fs, { seed: 'drone-delivery', root, repo: 'jay/other', prompt: null, log: silent, gh: gh3.runner });
      const scopeAfter = ExportScopeFileSchema.parse(JSON.parse(await fs.read('.knowlery/export-scope.json')));
      expect(scopeAfter.bundles['creator.drone.delivery'].publish?.repo).toBe('jay/other');
    });
  });

  it('§5.8 audience statement matches visibility and owner type', async () => {
    await withVault(async (root) => {
      await approveAll(root);
      const cases: Array<{ view: GhResult; expect: string }> = [
        {
          view: { ok: true, stdout: JSON.stringify({ visibility: 'PRIVATE', owner: { type: 'Organization' } }) },
          expect: 'members with read access to team/shelf',
        },
        {
          view: { ok: true, stdout: JSON.stringify({ visibility: 'PRIVATE', owner: { type: 'User' } }) },
          expect: 'only you and collaborators',
        },
        {
          view: { ok: true, stdout: JSON.stringify({ visibility: 'PUBLIC', owner: { type: 'User' } }) },
          expect: 'anyone with the link',
        },
      ];
      for (const testCase of cases) {
        const gh = scriptedGh({ 'repo view': testCase.view });
        const out = collector();
        await runBundlePublish(nodeVaultFs(root), {
          seed: 'drone-delivery', root, repo: 'team/shelf', public: testCase.expect.includes('anyone'),
          acknowledgeRisks: true, prompt: null, log: out.log, gh: gh.runner,
        });
        expect(out.lines.join('\n')).toContain(testCase.expect);
      }
    });
  });

  it('release notes carry the install+verify line', async () => {
    await withVault(async (root) => {
      await approveAll(root);
      const gh = scriptedGh();
      await runBundlePublish(nodeVaultFs(root), {
        seed: 'drone-delivery', root, repo: 'jay/shelf', prompt: null, log: silent, gh: gh.runner,
      });
      const create = gh.calls.find((call) => call[0] === 'release' && call[1] === 'create')!;
      const notes = create[create.indexOf('--notes') + 1];
      expect(notes).toContain('knowlery bundle install https://github.com/jay/shelf/releases/download/');
      expect(notes).toMatch(/--verify sha256-[0-9a-f]{64}/);
    });
  });

  it('interactive second gate: typing anything but "publish" cancels', async () => {
    await withVault(async (root) => {
      await approveAll(root);
      const gh = scriptedGh();
      const error = await runBundlePublish(nodeVaultFs(root), {
        seed: 'drone-delivery', root, repo: 'jay/shelf', public: true,
        prompt: async () => 'no', log: silent, gh: gh.runner,
      }).then(() => null, (thrown: unknown) => thrown);
      expect(error).toBeInstanceOf(CliError);
      expect((error as CliError).message).toContain('not acknowledged');
      expect(gh.calls.some((call) => call[0] === 'release')).toBe(false);
    });
  });
});

describe('credential patterns reach the export checklist too (spec 0.9 f2, §5.5)', () => {
  it('a fake token flags at export review time', async () => {
    await withVault(async (root) => {
      const fs = nodeVaultFs(root);
      await fs.write('concepts/deploy-keys.md',
        '---\ntype: concept\ntitle: Deploy Keys\ndescription: How we deploy\ndomain: ops\ncreated: 2026-06-03\n---\n\nToken: ghp_abcdefghijklmnopqrstuvwxyz0123456789 and host 192.168.1.10.\n');
      const out = collector();
      await runBundleCommand(fs, { sub: 'export', arg: 'deploy-keys', root, log: out.log })
        .catch(() => { /* review gate, expected */ });
      const text = out.lines.join('\n');
      expect(text).toContain('!! risk credential:');
      expect(text).toContain('ghp_abcd');
      expect(text).not.toContain('ghp_abcdefghijklmnopqrstuvwxyz0123456789'); // evidence is redacted
      expect(text).toContain('!! risk private-ip: 192.168.1.10');
    });
  });
});
