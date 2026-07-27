import { describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, posix } from 'node:path';
import { runInit } from '../../src/cli/commands/init';
import { runBundleExport, runBundleReview, resolveScope } from '../../src/cli/commands/bundle-export';
import { CliError } from '../../src/cli/commands/shared';
import { nodeVaultFs } from '../../src/platform/node-fs';
import { readBundleEntries } from '../../src/core/okf/zip';
import { installBundle, InstallBlockedError, verifyAttachmentIntegrity } from '../../src/core/okf/install';
import { modifiedFiles } from '../../src/core/okf/update-check';
import { readInstalledBundles } from '../../src/core/okf/registry';
import { sha256Bytes } from '../../src/core/okf/hash';
import { classifyEmbedTarget, buildAttachmentIndex } from '../../src/core/okf/attachments';
import { evaluateExportGate, exportTargetDir, readExportScope, resumeExportDefaults } from '../../src/core/okf/export-scope';
import { buildFlatPortableNameMap } from '../../src/core/okf/portability';
import { BundleManifestSchema, type BundleManifest } from '../../src/types';

const silent = () => {};

/**
 * Spec 1.3.1 f1, §5 — attachments travel with the knowledge. Byte-accurate
 * paths need the real fs (the OKF mock's writeBinary is a lossy
 * string-decode), so every test here runs on temp vaults.
 */

// PNG magic + bytes that are NOT valid UTF-8 — a lossy decode+encode
// round trip cannot reproduce these (§5.3's corruption canary).
const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0xff, 0xfe, 0x00, 0x80, 0xc3, 0x28]);
const SKETCH_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x01, 0x02, 0xf0, 0x9f, 0x92, 0xff]);

const VAULT_FILES: Record<string, string> = {
  'concepts/drone-delivery.md':
    '---\ntype: concept\ntitle: Drone Delivery\ndescription: Delivering packages by drone\ndomain: logistics\ncreated: 2026-06-01\nsources:\n  - Idea/route-notes.md\n---\n\nThe flow: ![[flow.png]]. Raw notes in [[Idea/route-notes]].\n',
  'Idea/route-notes.md': '---\ntitle: Route Notes\n---\n\nSketch: ![[route-sketch.png|300]]\n\nSee [[drone-delivery]].\n',
};

async function withVault<T>(
  run: (root: string, workDir: string, fs: ReturnType<typeof nodeVaultFs>) => Promise<T>,
  extraFiles: Record<string, string | Uint8Array> = {},
): Promise<T> {
  const workDir = await mkdtemp(join(tmpdir(), 'knowlery-attach-'));
  const root = join(workDir, 'kb');
  try {
    const all: Record<string, string | Uint8Array> = {
      ...VAULT_FILES,
      'assets/flow.png': PNG_BYTES,
      'pics/route-sketch.png': SKETCH_BYTES,
      ...extraFiles,
    };
    for (const [path, content] of Object.entries(all)) {
      await mkdir(join(root, path, '..'), { recursive: true });
      await writeFile(join(root, path), content);
    }
    return await run(root, workDir, nodeVaultFs(root));
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

async function approveAll(fs: ReturnType<typeof nodeVaultFs>, root: string): Promise<void> {
  const scope = await resolveScope(fs, 'drone-delivery', {});
  await runBundleReview(fs, {
    seed: 'drone-delivery', root, approve: scope.closure.items.map((item) => item.id), flag: [], log: silent,
  });
}

describe('attachment discovery (§5.1)', () => {
  it('resolves |size-suffixed embeds, classifies extensions, reports missing and unsupported', async () => {
    await withVault(async (root, _workDir, fs) => {
      await fs.write('Idea/extra.md', '---\ntitle: Extra\n---\n\n![[ghost.png]] and ![[tool.exe]]\n');
      await fs.write(
        'concepts/drone-delivery.md',
        VAULT_FILES['concepts/drone-delivery.md'].replace('Raw notes', 'Extra in [[Idea/extra]]. Raw notes'),
      );
      const scope = await resolveScope(fs, 'drone-delivery', {});
      const attachments = scope.closure.items.filter((item) => item.kind === 'attachment');
      // flow.png from the seed page; route-sketch.png from the raw source
      // despite its |300 display suffix.
      expect(attachments.map((item) => item.id).sort()).toEqual(['assets/flow.png', 'pics/route-sketch.png']);
      expect(attachments.every((item) => (item.sizeBytes ?? 0) > 0)).toBe(true);
      expect(scope.closure.embedIssues.missing).toEqual([{ owner: 'Idea/extra.md', target: 'ghost.png' }]);
      expect(scope.closure.embedIssues.unsupported).toEqual([{ owner: 'Idea/extra.md', target: 'tool.exe' }]);
    });
  });

  it('an ambiguous basename refuses the export with the candidate list', async () => {
    await withVault(async (root, _workDir, fs) => {
      const error = await runBundleExport(fs, { seed: 'drone-delivery', root, log: silent })
        .then(() => null, (thrown: unknown) => thrown);
      expect(error).toBeInstanceOf(CliError);
      expect((error as CliError).message).toContain('Ambiguous attachment embed');
      expect((error as CliError).message).toContain('a/flow.png');
      expect((error as CliError).message).toContain('assets/flow.png');
      // Nothing exported.
      await expect(stat(join(root, '.knowlery', 'exports'))).rejects.toThrow();
    }, { 'a/flow.png': PNG_BYTES });
  });

  it("a flagged page's attachments never enter scope", async () => {
    await withVault(async (root, _workDir, fs) => {
      await runBundleReview(fs, { seed: 'drone-delivery', root, approve: [], flag: ['Idea/route-notes.md'], log: silent });
      const scope = await resolveScope(fs, 'drone-delivery', {});
      const attachmentIds = scope.closure.items.filter((item) => item.kind === 'attachment').map((item) => item.id);
      expect(attachmentIds).toEqual(['assets/flow.png']); // route-sketch dropped with its flagged owner
    });
  });

  it('classifyEmbedTarget: extension allowlist, md convention, unsupported', () => {
    expect(classifyEmbedTarget('flow.png')).toBe('attachment');
    expect(classifyEmbedTarget('paper.PDF')).toBe('attachment');
    expect(classifyEmbedTarget('Some Note')).toBe('md');
    expect(classifyEmbedTarget('notes/other.md')).toBe('md');
    expect(classifyEmbedTarget('tool.exe')).toBe('unsupported');
  });
});

describe('review gate (§5.2)', () => {
  it('approval hashes bytes; changing the file invalidates it', async () => {
    await withVault(async (root, _workDir, fs) => {
      await approveAll(fs, root);
      await writeFile(join(root, 'assets/flow.png'), new Uint8Array([...PNG_BYTES, 0x01]));
      const scope = await resolveScope(fs, 'drone-delivery', {});
      const flow = scope.closure.items.find((item) => item.id === 'assets/flow.png');
      expect(flow?.status).toBe('unreviewed');
      expect(flow?.reviewNote).toBe('changed');
    });
  });

  it('checklist carries kind, bytes, the eyes line, and the size total', async () => {
    await withVault(async (root, _workDir, fs) => {
      const jsonLines: string[] = [];
      await runBundleReview(fs, { seed: 'drone-delivery', root, approve: [], flag: [], json: true, log: (l) => jsonLines.push(l) });
      const checklist = JSON.parse(jsonLines.join('\n')) as {
        attachmentTotalBytes: number;
        items: Array<{ id: string; kind: string; bytes?: number }>;
      };
      const flow = checklist.items.find((item) => item.id === 'assets/flow.png');
      expect(flow?.kind).toBe('attachment');
      expect(flow?.bytes).toBe(PNG_BYTES.byteLength);
      expect(checklist.attachmentTotalBytes).toBe(PNG_BYTES.byteLength + SKETCH_BYTES.byteLength);

      const lines: string[] = [];
      await runBundleReview(fs, { seed: 'drone-delivery', root, approve: [], flag: [], list: true, log: (l) => lines.push(l) });
      const text = lines.join('\n');
      expect(text).toContain('binary content — no scanner reads pixels; review with your eyes.');
      expect(text).toContain('embedded by: concepts/drone-delivery');
      expect(text).toContain('attachments total:');
    });
  });

  it('the 20MB soft warning fires and nothing blocks', async () => {
    await withVault(async (root, _workDir, fs) => {
      const lines: string[] = [];
      await runBundleReview(fs, { seed: 'drone-delivery', root, approve: [], flag: [], list: true, log: (l) => lines.push(l) });
      expect(lines.join('\n')).toContain('warning: large bundle');
    }, { 'assets/flow.png': new Uint8Array(Buffer.alloc(21 * 1024 * 1024, 7)) });
  });
});

describe('byte integrity end to end (§5.3)', () => {
  async function exportZip(root: string, fs: ReturnType<typeof nodeVaultFs>): Promise<string> {
    await approveAll(fs, root);
    const lines: string[] = [];
    await runBundleExport(fs, { seed: 'drone-delivery', root, zip: true, json: true, log: (l) => lines.push(l) });
    return (JSON.parse(lines.join('\n')) as { zipPath: string }).zipPath;
  }

  async function freshWorkspace(workDir: string): Promise<{ dir: string; fs: ReturnType<typeof nodeVaultFs> }> {
    const dir = join(workDir, 'consumer');
    await runInit(nodeVaultFs(dir), { platform: 'claude-code', name: 'Consumer', prompt: null, log: silent });
    return { dir, fs: nodeVaultFs(dir) };
  }

  it('export → zip → install round-trips bytes hash-identical, manifest verified, hashes registered', async () => {
    await withVault(async (root, workDir, fs) => {
      const zipPath = await exportZip(root, fs);
      const entries = await readBundleEntries(zipPath);
      const manifestEntry = entries.find((entry) => entry.path === 'knowlery-bundle.json')!;
      const manifest = BundleManifestSchema.parse(JSON.parse(manifestEntry.content!));
      expect(manifest.schemaVersion).toBe(2);
      const records = manifest.schemaVersion === 2 ? manifest.attachments : [];
      expect(records.map((record) => record.path).sort()).toEqual(['_attachments/flow.png', '_attachments/route-sketch.png']);

      const consumer = await freshWorkspace(workDir);
      await installBundle(consumer.fs, entries, { source: zipPath });
      const installed = new Uint8Array(await readFile(join(consumer.dir, 'Library', manifest.id, '_attachments/flow.png')));
      expect(sha256Bytes(installed)).toBe(sha256Bytes(PNG_BYTES));
      expect(sha256Bytes(installed)).toBe(records.find((record) => record.path === '_attachments/flow.png')!.sha256);

      const registry = await readInstalledBundles(consumer.fs);
      expect(registry.bundles[manifest.id].fileHashes!['_attachments/flow.png']).toBe(sha256Bytes(PNG_BYTES));
    });
  });

  it('the tamper suite refuses pre-write, unskippably', async () => {
    await withVault(async (root, workDir, fs) => {
      const zipPath = await exportZip(root, fs);
      const clean = await readBundleEntries(zipPath);
      const consumer = await freshWorkspace(workDir);

      const tamperCases: Array<[string, typeof clean]> = [
        ['flipped byte', clean.map((entry) => entry.path === '_attachments/flow.png'
          ? { path: entry.path, bytes: new Uint8Array([...entry.bytes!.slice(0, -1), entry.bytes![entry.bytes!.length - 1] ^ 0xff]) }
          : entry)],
        ['size mismatch', clean.map((entry) => entry.path === '_attachments/flow.png'
          ? { path: entry.path, bytes: new Uint8Array([...entry.bytes!, 0x00]) }
          : entry)],
        ['smuggled unlisted binary', [...clean, { path: '_attachments/extra.png', bytes: PNG_BYTES }]],
        ['listed but missing', clean.filter((entry) => entry.path !== '_attachments/flow.png')],
      ];

      for (const [label, entries] of tamperCases) {
        const before = await snapshotTree(consumer.dir);
        const failure = await installBundle(consumer.fs, entries, { source: zipPath, skipConformanceGate: true, acknowledgeRisks: true })
          .then(() => null, (error: unknown) => error);
        expect(failure, label).toBeInstanceOf(InstallBlockedError);
        expect((failure as InstallBlockedError).reason, label).toBe('attachment-integrity');
        // Pre-write and byte-identical — and the consent flags above prove
        // neither unlocks the integrity gate.
        expect(await snapshotTree(consumer.dir), label).toEqual(before);
      }
    });
  });

  it('a listed-and-hashed hostile path still refuses on containment (§5.7)', async () => {
    await withVault(async (root, workDir, fs) => {
      const zipPath = await exportZip(root, fs);
      const entries = await readBundleEntries(zipPath);
      const evil = { path: '_attachments/../../evil.png', bytes: PNG_BYTES };
      const manifestIdx = entries.findIndex((entry) => entry.path === 'knowlery-bundle.json');
      const manifest = JSON.parse(entries[manifestIdx].content!) as BundleManifest & { attachments: unknown[] };
      manifest.attachments = [
        ...(manifest.attachments ?? []),
        { path: evil.path, bytes: evil.bytes.byteLength, sha256: sha256Bytes(evil.bytes) },
      ];
      const tampered = entries.map((entry, index) => index === manifestIdx
        ? { path: entry.path, content: JSON.stringify(manifest) }
        : entry);

      const consumer = await freshWorkspace(workDir);
      await expect(
        installBundle(consumer.fs, [...tampered, evil], { source: zipPath }),
      ).rejects.toThrow(/unsafe/i);
      const evilOnDisk = await stat(join(workDir, 'evil.png')).then(() => true, () => false);
      expect(evilOnDisk).toBe(false);
    });
  });
});

describe('link depth and raw-source rewrite (§5.4/§5.5)', () => {
  it('embeds rewrite depth-aware and resolve from each file\u2019s own directory', async () => {
    await withVault(async (root, _workDir, fs) => {
      await approveAll(fs, root);
      await runBundleExport(fs, { seed: 'drone-delivery', root, log: silent });
      const base = join(root, '.knowlery/exports');
      const [dirName] = await (await import('node:fs/promises')).readdir(base);
      const page = await readFile(join(base, dirName, 'concepts/drone-delivery.md'), 'utf8');
      expect(page).toContain('![flow.png](../_attachments/flow.png)');

      const rawCopy = await readFile(join(base, dirName, '_sources/Idea/route-notes.md'), 'utf8');
      expect(rawCopy).toContain('![300](../../_attachments/route-sketch.png)');
      // Page wikilinks in the raw copy keep today's behavior — unconverted.
      expect(rawCopy).toContain('[[drone-delivery]]');

      // Asserted by path resolution, not string matching (§5.4).
      expect(posix.normalize(posix.join('concepts', '../_attachments/flow.png'))).toBe('_attachments/flow.png');
      expect(posix.normalize(posix.join('_sources/Idea', '../../_attachments/route-sketch.png'))).toBe('_attachments/route-sketch.png');
    });
  });
});

describe('portability (§5.6)', () => {
  it('Windows-reserved names sanitize; colliding basenames get deterministic suffixes', () => {
    const map = buildFlatPortableNameMap(['docs/CON.png', 'a/diagram.png', 'b/diagram.png']);
    expect(map.get('docs/CON.png')).toBe('_CON.png');
    const a = map.get('a/diagram.png')!;
    const b = map.get('b/diagram.png')!;
    expect(a).not.toBe(b);
    expect([a, b].every((name) => name.startsWith('diagram-') && name.endsWith('.png'))).toBe(true);
    // Deterministic: same set, same result.
    expect(buildFlatPortableNameMap(['b/diagram.png', 'docs/CON.png', 'a/diagram.png'])).toEqual(map);
  });

  it('the emitted embed points at the sanitized name', async () => {
    await withVault(async (root, _workDir, fs) => {
      await fs.write(
        'concepts/drone-delivery.md',
        VAULT_FILES['concepts/drone-delivery.md'].replace('![[flow.png]]', '![[flow.png]] and ![[CON.png]]'),
      );
      await approveAll(fs, root);
      await runBundleExport(fs, { seed: 'drone-delivery', root, log: silent });
      const base = join(root, '.knowlery/exports');
      const [dirName] = await (await import('node:fs/promises')).readdir(base);
      const page = await readFile(join(base, dirName, 'concepts/drone-delivery.md'), 'utf8');
      expect(page).toContain('](../_attachments/_CON.png)');
      await stat(join(base, dirName, '_attachments/_CON.png'));
    }, { 'docs/CON.png': PNG_BYTES });
  });
});

describe('compatibility (§5.8) and the update path (§5.9)', () => {
  it('an attachment-free export stays schemaVersion 1 with no _attachments/', async () => {
    await withVault(async (root, _workDir, fs) => {
      await fs.write('concepts/drone-delivery.md',
        '---\ntype: concept\ntitle: Drone Delivery\ndescription: D\ndomain: logistics\ncreated: 2026-06-01\n---\n\nNo embeds here.\n');
      await fs.write('Idea/route-notes.md', '---\ntitle: Route Notes\n---\n\nNo embeds.\n');
      await approveAll(fs, root);
      await runBundleExport(fs, { seed: 'drone-delivery', root, log: silent });
      const base = join(root, '.knowlery/exports');
      const [dirName] = await (await import('node:fs/promises')).readdir(base);
      const manifest = JSON.parse(await readFile(join(base, dirName, 'knowlery-bundle.json'), 'utf8')) as Record<string, unknown>;
      expect(manifest.schemaVersion).toBe(1);
      expect('attachments' in manifest).toBe(false);
      await expect(stat(join(base, dirName, '_attachments'))).rejects.toThrow();
    });
  });

  it('verifyAttachmentIntegrity flags binaries riding a v1 manifest', () => {
    const v1 = BundleManifestSchema.parse({
      schemaVersion: 1, okfVersion: '0.1', id: 'c.t', title: 'T', version: '1.0.0',
      creator: { name: '', url: '' }, releasedAt: '2026-01-01T00:00:00.000Z', entrypoint: 'index.md',
      contentHash: 'sha256-x', license: 'personal', knowleryVersion: '1.3.1', conceptCount: 0,
    });
    const problems = verifyAttachmentIntegrity(v1, [{ path: '_attachments/x.png', bytes: PNG_BYTES }]);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('not listed in the manifest');
  });

  it('a locally-modified installed attachment blocks with the file named', async () => {
    await withVault(async (root, workDir, fs) => {
      await approveAll(fs, root);
      const lines: string[] = [];
      await runBundleExport(fs, { seed: 'drone-delivery', root, zip: true, json: true, log: (l) => lines.push(l) });
      const zipPath = (JSON.parse(lines.join('\n')) as { zipPath: string }).zipPath;
      const consumerDir = join(workDir, 'consumer');
      await runInit(nodeVaultFs(consumerDir), { platform: 'claude-code', name: 'Consumer', prompt: null, log: silent });
      const consumerFs = nodeVaultFs(consumerDir);
      const result = await installBundle(consumerFs, await readBundleEntries(zipPath), { source: zipPath });

      const registry = await readInstalledBundles(consumerFs);
      const entry = registry.bundles[result.id];
      expect(await modifiedFiles(consumerFs, entry)).toEqual([]);

      await writeFile(join(consumerDir, 'Library', result.id, '_attachments/flow.png'), new Uint8Array([...PNG_BYTES, 0xaa]));
      const changed = await modifiedFiles(consumerFs, entry);
      expect(changed).toHaveLength(1);
      expect(changed[0]).toContain('_attachments/flow.png (edited)');
    });
  });
});

// Acceptance round — the shared pre-export gate both shells run: the
// Obsidian modal's stale-React-state hole (approve, file changes while the
// modal sits open, compile ships unreviewed bytes) is closed by evaluating
// a FRESH closure, whose recomputed hashes already reverted the approval.
describe('the shared pre-export gate', () => {
  it('a post-approval byte change is not ready: the approval reverted and the item is out of the approved set', async () => {
    await withVault(async (root, _workDir, fs) => {
      await approveAll(fs, root);
      const approvedScope = await resolveScope(fs, 'drone-delivery', {});
      expect(evaluateExportGate(approvedScope.closure).ready).toBe(true);

      // The modal-race simulation: bytes change after approval.
      await writeFile(join(root, 'assets/flow.png'), new Uint8Array([...PNG_BYTES, 0x01]));
      const fresh = await resolveScope(fs, 'drone-delivery', {});
      const gate = evaluateExportGate(fresh.closure);
      expect(gate.ready).toBe(false);
      expect(gate.unreviewed.map((item) => item.id)).toEqual(['assets/flow.png']);
      expect(gate.unreviewed[0].reviewNote).toBe('changed');
      expect(gate.approvedAttachmentPaths).toEqual(['pics/route-sketch.png']);
    });
  });

  it('ambiguity makes the gate not ready; approved sets exclude flagged items', async () => {
    await withVault(async (root, _workDir, fs) => {
      await runBundleReview(fs, { seed: 'drone-delivery', root, approve: [], flag: ['Idea/route-notes.md'], log: silent });
      const scope = await resolveScope(fs, 'drone-delivery', {});
      const gate = evaluateExportGate(scope.closure);
      expect(gate.ambiguous.map((issue) => issue.target)).toEqual(['flow.png']);
      expect(gate.ready).toBe(false);
      expect(gate.approvedRawPaths).toEqual([]);
    }, { 'a/flow.png': PNG_BYTES });
  });
});

// Acceptance round 3 (P1): resuming a saved bundle must restore version and
// target dir from ITS state — the modal once kept both derived from the
// default bundle id, so a resumed export wrote into (and with overwrite,
// clobbered) another bundle's directory. The close-modal → resume → export
// path is pinned at the shared derivation both shells now use.
describe('resume defaults (modal P1 regression)', () => {
  it('restores lastVersion and the bundle-specific target dir from the saved scope', async () => {
    await withVault(async (root, _workDir, fs) => {
      await approveAll(fs, root);
      const lines: string[] = [];
      await runBundleExport(fs, { seed: 'drone-delivery', root, bundleVersion: '0.3.0', json: true, log: (l) => lines.push(l) });
      const exported = JSON.parse(lines.join('\n')) as { bundleId: string; targetDir: string };

      // "Close the modal": all that survives is the scope file. "Resume":
      // read it back and derive the defaults the modal restores.
      const saved = (await readExportScope(fs)).bundles[exported.bundleId];
      expect(saved.lastVersion).toBe('0.3.0');
      const defaults = resumeExportDefaults(saved, exported.bundleId);
      expect(defaults.version).toBe('0.3.0');
      expect(defaults.targetDir).toBe(exported.targetDir);
      // Never the default-bundle directory the bug wrote into.
      expect(defaults.targetDir).toContain(exported.bundleId);
    });
  });

  it('a bundle without a recorded version falls back to 0.1.0 under its own id', () => {
    expect(resumeExportDefaults(undefined, 'creator.acceptance.f1')).toEqual({
      version: '0.1.0',
      targetDir: '.knowlery/exports/creator.acceptance.f1-0.1.0',
    });
    expect(exportTargetDir('creator.acceptance.f1', '0.3.0')).toBe('.knowlery/exports/creator.acceptance.f1-0.3.0');
  });
});

describe('attachment index resolution', () => {
  it('exact path beats basename; unique basename resolves; ambiguity reports candidates', async () => {
    await withVault(async (root, _workDir, fs) => {
      const index = await buildAttachmentIndex(fs);
      expect(index.resolve('assets/flow.png')).toEqual({ kind: 'path', path: 'assets/flow.png' });
      expect(index.resolve('route-sketch.png')).toEqual({ kind: 'path', path: 'pics/route-sketch.png' });
      expect(index.resolve('nope.png')).toEqual({ kind: 'missing' });
      const dup = await withDup(fs);
      expect(dup).toBe(true);
    });

    async function withDup(fs: ReturnType<typeof nodeVaultFs>): Promise<boolean> {
      await fs.writeBinary('other/flow.png', PNG_BYTES.buffer.slice(0) as ArrayBuffer);
      const index = await buildAttachmentIndex(fs);
      const resolution = index.resolve('flow.png');
      return resolution.kind === 'ambiguous' && resolution.candidates.sort().join(',') === 'assets/flow.png,other/flow.png';
    }
  });
});

async function snapshotTree(root: string): Promise<Record<string, string>> {
  const { readdir } = await import('node:fs/promises');
  const snapshot: Record<string, string> = {};
  async function walk(dir: string): Promise<void> {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) await walk(full);
      else snapshot[full] = sha256Bytes(new Uint8Array(await readFile(full)));
    }
  }
  await walk(root);
  return snapshot;
}
