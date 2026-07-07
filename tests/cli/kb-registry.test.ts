import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  KbRegistryError,
  addKb,
  ensureVaultRegistered,
  listKbs,
  readKbRegistry,
  registryPath,
  removeKb,
  resolveKb,
  unregisterOwnedVault,
} from '../../src/core/kb-registry';
import { runKbCommand } from '../../src/cli/commands/kb';
import { runFederatedQueryCommand } from '../../src/cli/commands/query';
import { CliError } from '../../src/cli/commands/shared';

const silent = () => {};

/**
 * Spec 1.0 f1, §5: registry safety properties. KNOWLERY_CONFIG_DIR points every
 * test at its own temp registry, so nothing touches the real one.
 */

let workDir: string;

beforeEach(async () => {
  workDir = await mkdtemp(join(tmpdir(), 'knowlery-kbreg-'));
  process.env.KNOWLERY_CONFIG_DIR = join(workDir, 'config');
});

afterEach(async () => {
  delete process.env.KNOWLERY_CONFIG_DIR;
  await rm(workDir, { recursive: true, force: true });
});

async function makeKb(name: string, initialized = true): Promise<string> {
  const dir = join(workDir, name);
  await mkdir(join(dir, 'concepts'), { recursive: true });
  if (initialized) await writeFile(join(dir, 'KNOWLEDGE.md'), '# KB\n');
  return dir;
}

describe('registry file (spec 1.0 f1, §5.2)', () => {
  it('canonicalizes at add-time: a symlinked path stores its real target', async () => {
    const real = await makeKb('real');
    const link = join(workDir, 'link');
    await symlink(real, link);
    const result = await addKb('work', link);
    expect(result.path).toBe(await realpath(real));
  });

  it('rejects reserved and invalid names with the rule spelled out', async () => {
    const dir = await makeKb('a');
    await expect(addKb('*', dir)).rejects.toThrow(/reserved/);
    await expect(addKb('all', dir)).rejects.toThrow(/reserved/);
    await expect(addKb('Work KB', dir)).rejects.toThrow(/must match/);
    await expect(addKb('-lead', dir)).rejects.toThrow(/must match/);
  });

  it('a corrupt registry errors loudly and is never rewritten', async () => {
    await mkdir(join(workDir, 'config'), { recursive: true });
    await writeFile(registryPath(), '{ not json');
    await expect(readKbRegistry()).rejects.toThrow(/NOT reset/);
    await expect(listKbs()).rejects.toThrow(KbRegistryError);
    const dir = await makeKb('b');
    await expect(addKb('b', dir)).rejects.toThrow(KbRegistryError);
    const { readFile } = await import('node:fs/promises');
    expect(await readFile(registryPath(), 'utf8')).toBe('{ not json'); // untouched
  });

  it('duplicate paths warn (returned), never error; remove never touches files', async () => {
    const dir = await makeKb('shared');
    await addKb('one', dir);
    const second = await addKb('two', dir);
    expect(second.alsoRegisteredAs).toEqual(['one']);

    expect(await removeKb('one')).toBe(true);
    expect(await removeKb('one')).toBe(false);
    const { stat } = await import('node:fs/promises');
    expect((await stat(join(dir, 'KNOWLEDGE.md'))).isFile()).toBe(true);
  });

  it('resolveKb errors with the registered names listed', async () => {
    await addKb('work', await makeKb('w'));
    await expect(resolveKb('nope')).rejects.toThrow(/Registered: work/);
  });

  it('kb list reports live states', async () => {
    await addKb('good', await makeKb('good'));
    await addKb('empty', await makeKb('empty', false));
    const gone = await makeKb('gone');
    await addKb('gone', gone);
    await rm(gone, { recursive: true, force: true });

    const listings = await listKbs();
    expect(listings.map((kb) => [kb.name, kb.state])).toEqual([
      ['empty', 'uninitialized'],
      ['gone', 'missing'],
      ['good', 'ok'],
    ]);
  });
});

describe('ownership rule (spec 1.0 f1, §5.4)', () => {
  it('registers once with a slug, records the exact created name, suffixes on collision', async () => {
    const vaultA = await makeKb('vault-a');
    const first = await ensureVaultRegistered(vaultA, 'My Work KB', null);
    expect(first.ownedName).toBe('my-work-kb');
    // Same call again: no churn.
    const again = await ensureVaultRegistered(vaultA, 'My Work KB', first.ownedName);
    expect(again.ownedName).toBe('my-work-kb');
    expect(Object.keys((await readKbRegistry()).kbs)).toEqual(['my-work-kb']);

    const vaultB = await makeKb('vault-b');
    const collided = await ensureVaultRegistered(vaultB, 'My Work KB', null);
    expect(collided.ownedName).toBe('my-work-kb-2');
  });

  it('a pre-registered path takes no ownership, and toggle-off removes nothing', async () => {
    const vault = await makeKb('vault-c');
    await addKb('work', vault); // the user's own entry
    const result = await ensureVaultRegistered(vault, 'Work', null);
    expect(result.ownedName).toBeNull();

    await unregisterOwnedVault(vault, null);
    expect(Object.keys((await readKbRegistry()).kbs)).toEqual(['work']);
  });

  it('toggle-off removes exactly the owned name; a user-repointed entry makes it a no-op', async () => {
    const vault = await makeKb('vault-d');
    const { ownedName } = await ensureVaultRegistered(vault, 'Mine', null);
    await unregisterOwnedVault(vault, ownedName);
    expect(Object.keys((await readKbRegistry()).kbs)).toEqual([]);

    // Re-register, then the user repoints the name elsewhere: no-op on unregister.
    const { ownedName: owned2 } = await ensureVaultRegistered(vault, 'Mine', null);
    const other = await makeKb('vault-e');
    await addKb(owned2!, other);
    await unregisterOwnedVault(vault, owned2);
    expect((await readKbRegistry()).kbs[owned2!].path).toBe(await realpath(other));
  });
});

describe('kb command + federated query (spec 1.0 f1, §5.1/§5.3)', () => {
  it('kb add/list/remove round trip through the command layer', async () => {
    const dir = await makeKb('cmd');
    const lines: string[] = [];
    await runKbCommand({ sub: 'add', name: 'cmd', path: dir, log: (line) => lines.push(line) });
    await runKbCommand({ sub: 'list', log: (line) => lines.push(line) });
    expect(lines.join('\n')).toContain('cmd');
    await runKbCommand({ sub: 'remove', name: 'cmd', log: silent });
    await expect(runKbCommand({ sub: 'remove', name: 'cmd', log: silent })).rejects.toThrow(CliError);
  });

  it('federated query attributes results per KB and skips broken entries with a note', async () => {
    const alpha = await makeKb('alpha');
    await writeFile(join(alpha, 'concepts', 'backpressure.md'),
      '---\ntitle: Backpressure\ntype: concept\ncreated: 2026-01-01\n---\n\nQueues protect the ingest path.\n');
    const beta = await makeKb('beta');
    await writeFile(join(beta, 'concepts', 'gardening.md'),
      '---\ntitle: Gardening\ntype: concept\ncreated: 2026-01-01\n---\n\nCompost and soil.\n');
    await addKb('alpha', alpha);
    await addKb('beta', beta);
    const gone = await makeKb('gone');
    await addKb('gone', gone);
    await rm(gone, { recursive: true, force: true });

    const lines: string[] = [];
    await runFederatedQueryCommand({ question: 'backpressure', log: (line) => lines.push(line) });
    const text = lines.join('\n');
    expect(text).toContain('alpha: concepts/backpressure.md');
    expect(text).not.toContain('beta: ');

    const jsonLines: string[] = [];
    await runFederatedQueryCommand({ question: 'backpressure', json: true, log: (line) => jsonLines.push(line) });
    const parsed = JSON.parse(jsonLines.join('\n')) as {
      verdictByKb: Record<string, string>;
      candidates: Array<{ kb: string; path: string }>;
    };
    expect(parsed.candidates[0]).toMatchObject({ kb: 'alpha', path: 'concepts/backpressure.md' });
    expect(parsed.verdictByKb.gone).toContain('skipped');
  });

  it('all-abstain lists the KBs consulted; empty registry errors helpfully', async () => {
    await addKb('alpha', await makeKb('alpha2'));
    const lines: string[] = [];
    await runFederatedQueryCommand({ question: 'zebra quantum lighthouse', log: (line) => lines.push(line) });
    expect(lines.join('\n')).toContain('consulted: alpha');

    await removeKb('alpha');
    await expect(runFederatedQueryCommand({ question: 'x', log: silent })).rejects.toThrow(/kb add/);
  });
});
