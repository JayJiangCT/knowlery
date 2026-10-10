import { describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runReferenceCommand } from '../../src/cli/commands/reference';
import { runStaleCommand } from '../../src/cli/commands/stale';
import { CliError } from '../../src/cli/commands/shared';
import { parseArgs } from '../../src/cli/args';
import { nodeVaultFs } from '../../src/platform/node-fs';

function capture(): { log: (line: string) => void; output: () => string } {
  const lines: string[] = [];
  return { log: (line) => lines.push(line), output: () => lines.join('\n') };
}

function makeWorkspace(initialized: boolean): string {
  const root = mkdtempSync(join(tmpdir(), 'knowlery-refcmd-'));
  if (initialized) writeFileSync(join(root, 'KNOWLEDGE.md'), '# KB\n');
  mkdirSync(join(root, 'teams', 'team-a-kb'), { recursive: true });
  writeFileSync(join(root, 'teams', 'team-a-kb', 'shared.md'), '---\ntitle: Shared\n---\n\nShared.\n');
  mkdirSync(join(root, 'Projects'));
  writeFileSync(join(root, 'Projects', 'mine.md'), '---\ntitle: Mine\n---\n\nMine.\n');
  return root;
}

describe('knowlery reference', () => {
  it('parses as a two-positional command', () => {
    const args = parseArgs(['reference', 'add', 'teams', '--dir', '/x']);
    expect(args.command).toBe('reference');
    expect(args.positionals).toEqual(['add', 'teams']);
  });

  it('add → stale no longer lists the directory; list shows it; remove restores it', async () => {
    const root = makeWorkspace(true);
    const fs = nodeVaultFs(root);
    try {
      const uncooked = async () => {
        const { log, output } = capture();
        await runStaleCommand(root, { json: true, log });
        return (JSON.parse(output()) as { uncookedNotes: { path: string }[] }).uncookedNotes.map((note) => note.path);
      };
      expect(await uncooked()).toEqual(['Projects/mine.md', 'teams/team-a-kb/shared.md']);

      const added = capture();
      await runReferenceCommand(fs, { sub: 'add', dir: 'teams/', log: added.log });
      expect(added.output()).toContain('Marked teams/ as reference material');
      expect(await uncooked()).toEqual(['Projects/mine.md']);

      const listed = capture();
      await runReferenceCommand(fs, { sub: 'list', json: true, log: listed.log });
      expect(JSON.parse(listed.output())).toEqual({ referenceDirs: ['teams'] });

      const removed = capture();
      await runReferenceCommand(fs, { sub: 'remove', dir: 'teams', log: removed.log });
      expect(removed.output()).toContain('Removed teams/');
      expect(await uncooked()).toEqual(['Projects/mine.md', 'teams/team-a-kb/shared.md']);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('usage errors exit 2, operational errors exit 1', async () => {
    const root = makeWorkspace(true);
    const fs = nodeVaultFs(root);
    const silent = () => undefined;
    try {
      await expect(runReferenceCommand(fs, { sub: undefined, log: silent })).rejects.toMatchObject({ exitCode: 2 });
      await expect(runReferenceCommand(fs, { sub: 'frobnicate', log: silent })).rejects.toMatchObject({ exitCode: 2 });
      await expect(runReferenceCommand(fs, { sub: 'add', log: silent })).rejects.toMatchObject({ exitCode: 2 });
      await expect(runReferenceCommand(fs, { sub: 'add', dir: 'entities', log: silent })).rejects.toBeInstanceOf(CliError);
      await expect(runReferenceCommand(fs, { sub: 'add', dir: 'entities', log: silent })).rejects.toMatchObject({ exitCode: 1 });
      await expect(runReferenceCommand(fs, { sub: 'add', dir: 'missing', log: silent })).rejects.toMatchObject({ exitCode: 1 });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('add refuses to create .knowlery/ outside an initialized workspace', async () => {
    const root = makeWorkspace(false);
    try {
      await expect(runReferenceCommand(nodeVaultFs(root), { sub: 'add', dir: 'teams', log: () => undefined }))
        .rejects.toThrow(/not an initialized knowlery workspace/i);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
