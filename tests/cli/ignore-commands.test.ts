import { describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runIgnoreCommand, runReferenceCommand } from '../../src/cli/commands/reference';
import { runStaleCommand } from '../../src/cli/commands/stale';
import { runQueryCommand } from '../../src/cli/commands/query';
import { buildHealthReport, runHealth } from '../../src/cli/commands/health';
import { parseArgs } from '../../src/cli/args';
import { nodeVaultFs } from '../../src/platform/node-fs';

function capture(): { log: (line: string) => void; output: () => string } {
  const lines: string[] = [];
  return { log: (line) => lines.push(line), output: () => lines.join('\n') };
}

const NOTE = (title: string) => `---\ntitle: ${title}\n---\n\n${title} covers the payout retry policy.\n`;

function makeWorkspace(): string {
  const root = mkdtempSync(join(tmpdir(), 'knowlery-ignorecmd-'));
  writeFileSync(join(root, 'KNOWLEDGE.md'), '# KB\n');
  const files: Record<string, string> = {
    'Projects/mine.md': NOTE('Mine'),
    'archive/old.md': NOTE('Old'),
    'code/app/package.json': '{}',
    'code/app/dist/README.md': NOTE('Built'),
    'code/app/node_modules/dep/README.md': NOTE('Dep'),
  };
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(join(root, path, '..'), { recursive: true });
    writeFileSync(join(root, path), content);
  }
  return root;
}

describe('knowlery ignore', () => {
  it('parses as a two-positional command', () => {
    const args = parseArgs(['ignore', 'add', 'archive', '--dir', '/x']);
    expect(args.command).toBe('ignore');
    expect(args.positionals).toEqual(['add', 'archive']);
  });

  it('add → the directory leaves stale and query; list shows it; remove restores it', async () => {
    const root = makeWorkspace();
    const fs = nodeVaultFs(root);
    try {
      const uncooked = () => {
        const { log, output } = capture();
        runStaleCommand(root, { json: true, log });
        return (JSON.parse(output()) as { uncookedNotes: { path: string }[] }).uncookedNotes.map((note) => note.path).sort();
      };
      const hits = () => {
        const { log, output } = capture();
        runQueryCommand(root, { question: 'payout retry policy', json: true, log });
        return (JSON.parse(output()) as { candidates: { path: string }[] }).candidates.map((c) => c.path).sort();
      };
      // Built-in rules already keep dist/ and node_modules/ out.
      expect(uncooked()).toEqual(['Projects/mine.md', 'archive/old.md']);

      const added = capture();
      await runIgnoreCommand(fs, { sub: 'add', dir: 'archive/', log: added.log });
      expect(added.output()).toContain('Ignoring archive/');
      expect(uncooked()).toEqual(['Projects/mine.md']);
      expect(hits()).toEqual(['Projects/mine.md']);

      const again = capture();
      await runIgnoreCommand(fs, { sub: 'add', dir: 'archive', log: again.log });
      expect(again.output()).toContain('already covered');

      const listed = capture();
      await runIgnoreCommand(fs, { sub: 'list', json: true, log: listed.log });
      expect(JSON.parse(listed.output())).toEqual({ ignoreDirs: ['archive'] });

      // The lists are disjoint, and the CLI says which one holds the directory.
      await expect(runReferenceCommand(fs, { sub: 'add', dir: 'archive', log: () => undefined }))
        .rejects.toMatchObject({ exitCode: 1, message: expect.stringContaining('already an ignored directory') as string });

      const removed = capture();
      await runIgnoreCommand(fs, { sub: 'remove', dir: 'archive', log: removed.log });
      expect(removed.output()).toContain('Stopped ignoring archive/');
      expect(uncooked()).toEqual(['Projects/mine.md', 'archive/old.md']);
      expect(hits()).toEqual(['Projects/mine.md', 'archive/old.md']);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('usage errors exit 2, operational errors exit 1', async () => {
    const root = makeWorkspace();
    const fs = nodeVaultFs(root);
    const silent = () => undefined;
    try {
      await expect(runIgnoreCommand(fs, { sub: undefined, log: silent })).rejects.toMatchObject({ exitCode: 2 });
      await expect(runIgnoreCommand(fs, { sub: 'frobnicate', log: silent })).rejects.toMatchObject({ exitCode: 2 });
      await expect(runIgnoreCommand(fs, { sub: 'list', dir: 'x', log: silent })).rejects.toMatchObject({ exitCode: 2 });
      await expect(runIgnoreCommand(fs, { sub: 'add', log: silent })).rejects.toMatchObject({ exitCode: 2 });
      await expect(runIgnoreCommand(fs, { sub: 'add', dir: 'entities', log: silent })).rejects.toMatchObject({ exitCode: 1 });
      await expect(runIgnoreCommand(fs, { sub: 'add', dir: '.obsidian', log: silent })).rejects.toMatchObject({ exitCode: 1 });
      await expect(runIgnoreCommand(fs, { sub: 'add', dir: 'missing', log: silent })).rejects.toMatchObject({ exitCode: 1 });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe('knowlery health — skipped directories (added 1.6.0)', () => {
  it('reports every non-hidden skip with its reason, and warns about configured dirs that vanished', async () => {
    const root = makeWorkspace();
    const fs = nodeVaultFs(root);
    try {
      await runIgnoreCommand(fs, { sub: 'add', dir: 'archive', log: () => undefined });
      await runReferenceCommand(fs, { sub: 'add', dir: 'Projects', log: () => undefined });

      const report = await buildHealthReport(fs, root);
      expect(report.skipped).toEqual({
        dirs: [
          { path: 'archive', reason: 'config' },
          { path: 'code/app/dist', reason: 'project-output' },
          { path: 'code/app/node_modules', reason: 'builtin' },
        ],
        missingReferenceDirs: [],
        missingIgnoreDirs: [],
      });

      rmSync(join(root, 'archive'), { recursive: true, force: true });
      rmSync(join(root, 'Projects'), { recursive: true, force: true });
      const after = await buildHealthReport(fs, root);
      expect(after.skipped.missingReferenceDirs).toEqual(['Projects']);
      expect(after.skipped.missingIgnoreDirs).toEqual(['archive']);
      // Informational only: a missing configured directory is not an unhealthy workspace.
      expect(after.healthy).toBe(report.healthy);

      const { log, output } = capture();
      await runHealth(fs, { root, log }).catch(() => undefined); // exits 1: this bare workspace lacks skills etc.
      expect(output()).toContain('Skipped directories (not indexed):');
      expect(output()).toContain('code/app/node_modules/ — always skipped');
      expect(output()).toContain('code/app/dist/ — build output beside a project manifest');
      expect(output()).toContain('reference directory Projects/ is configured but does not exist');
      expect(output()).toContain('ignored directory archive/ is configured but does not exist');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('surfaces a malformed config instead of silently scanning everything', async () => {
    const root = makeWorkspace();
    const fs = nodeVaultFs(root);
    try {
      mkdirSync(join(root, '.knowlery'), { recursive: true });
      writeFileSync(join(root, '.knowlery', 'config.json'), '{ not json');
      const report = await buildHealthReport(fs, root);
      expect(report.skipped.configError).toContain('not valid JSON');
      const { log, output } = capture();
      await runHealth(fs, { root, log }).catch(() => undefined);
      expect(output()).toContain('WARNING  .knowlery/config.json is not valid JSON');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
