import { afterEach, describe, expect, it } from 'vitest';
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runCli } from '../../src/v2/cli/main';
import { renderConventions } from '../../src/v2/core/conventions';
import type { ExtractionOptions } from '../../src/v2/core/extract';
import { registry as builtinRegistry } from '../../src/v2/core/extract/registry';
import type { HealthResult } from '../../src/v2/core/health';
import { AGENTS_LINES, type InitResult } from '../../src/v2/core/init';
import type { SyncResult } from '../../src/v2/core/sync';
import type { ValidateResult } from '../../src/v2/core/validate';
import { configure, failure, fileState, invoke, jsonRun, makeKb } from './helpers';

const tempDirs: string[] = [];

async function makeEmptyDir(): Promise<string> {
  const dir = await realpath(await mkdtemp(join(tmpdir(), 'knowlery-v2-init-')));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop()!;
    await rm(dir, { recursive: true, force: true });
  }
});

async function runDirect(
  root: string,
  argv: string[],
  extractionOptions: Pick<ExtractionOptions, 'registry' | 'ceiling'> = {},
) {
  let stdout = '';
  let stderr = '';
  const code = await runCli(argv, {
    cwd: root,
    stdout: (text) => { stdout += text; },
    stderr: (text) => { stderr += text; },
  }, extractionOptions);
  return { code, stdout, stderr };
}

async function runDirectJson<T>(
  root: string,
  argv: string[],
  extractionOptions: Pick<ExtractionOptions, 'registry' | 'ceiling'> = {},
): Promise<T & { contract: string; ok: boolean; command: string }> {
  const res = await runDirect(root, [...argv, '--json'], extractionOptions);
  expect(res.code, res.stdout || res.stderr).toBe(0);
  expect(res.stderr).toBe('');
  expect(res.stdout.trimEnd().split('\n')).toHaveLength(1);
  const data = JSON.parse(res.stdout) as T & { contract: string; ok: boolean; command: string };
  expect(data).toMatchObject({ contract: '2.0', ok: true });
  return data;
}

describe('v2 init, sync, and health', () => {
  it('initializes a plain folder, validates cleanly, excludes AGENTS.md from inventory, and is idempotent', async () => {
    const root = await makeEmptyDir();
    await mkdir(join(root, 'Notes'), { recursive: true });
    await writeFile(join(root, 'Notes/a.md'), '# A note\n\nSome text.\n');

    const first = await runDirectJson<InitResult>(root, ['init']);
    expect(first.command).toBe('init');
    expect(first.created).toEqual([
      '.knowlery/config.json',
      'wiki/',
      'wiki/CONVENTIONS.md',
      'wiki/index.md',
      'wiki/log.md',
      'AGENTS.md',
      'CLAUDE.md',
      'GEMINI.md',
      '.agents/skills/knowlery-compile/SKILL.md',
      '.agents/skills/knowlery-maintain/SKILL.md',
      '.agents/skills/knowlery-answer/SKILL.md',
    ]);
    expect(first.kept).toEqual([]);
    expect(first.agents_md).toBe('written');
    expect(first.agents_lines).toEqual([]);

    expect(JSON.parse(await readFile(join(root, '.knowlery/config.json'), 'utf8'))).toEqual({
      kf: '2.0',
      ignore: [],
      mcp: { raw: true },
    });
    expect(await readFile(join(root, 'wiki/CONVENTIONS.md'), 'utf8')).toBe(renderConventions());
    expect(await readFile(join(root, 'AGENTS.md'), 'utf8')).toBe(`${AGENTS_LINES.join('\n')}\n`);

    const val = await runDirectJson<ValidateResult>(root, ['validate']);
    expect(val.counts.pages).toBe(0);
    expect(val.counts.findings).toBe(0);

    const inv = await jsonRun(root, ['inventory']);
    expect(inv.items.map((item) => item.path)).toEqual(['Notes/a.md']);

    const stateAfterFirst = await fileState(root);
    const second = await runDirectJson<InitResult>(root, ['init']);
    expect(second.created).toEqual([]);
    expect(second.kept).toEqual([
      '.knowlery/config.json',
      'wiki/CONVENTIONS.md',
      'wiki/index.md',
      'wiki/log.md',
      'AGENTS.md',
      'CLAUDE.md',
      'GEMINI.md',
      '.agents/skills/knowlery-compile/SKILL.md',
      '.agents/skills/knowlery-maintain/SKILL.md',
      '.agents/skills/knowlery-answer/SKILL.md',
    ]);
    expect(second.agents_md).toBe('kept');
    expect(second.agents_lines).toEqual([]);
    expect(await fileState(root)).toEqual(stateAfterFirst);
  });

  it('keeps an existing AGENTS.md byte-identical and includes the three lines in JSON and text output', async () => {
    const root = await makeEmptyDir();
    const original = 'Existing agent instructions.\n';
    await writeFile(join(root, 'AGENTS.md'), original);

    const res = await runDirectJson<InitResult>(root, ['init']);
    expect(res.agents_md).toBe('kept');
    expect(res.agents_lines).toEqual([...AGENTS_LINES]);
    expect(res.kept).toContain('AGENTS.md');
    expect(await readFile(join(root, 'AGENTS.md'), 'utf8')).toBe(original);

    const textRes = await runDirect(root, ['init']);
    expect(textRes.code).toBe(0);
    expect(textRes.stdout).toContain('Add to AGENTS.md:');
    for (const line of AGENTS_LINES) {
      expect(textRes.stdout).toContain(line);
    }
    expect(await readFile(join(root, 'AGENTS.md'), 'utf8')).toBe(original);
  });

  it('refuses 1.x markers, non-2.0 .knowlery/config.json, and unmanaged wiki/ without writing anything', async () => {
    const withKnowledge = await makeEmptyDir();
    await writeFile(join(withKnowledge, 'KNOWLEDGE.md'), '# Legacy\n');
    await failure(withKnowledge, ['init'], 'unsupported_schema', 1);

    const withV1Config = await makeEmptyDir();
    await configure(withV1Config, { version: '1.6.0' });
    await failure(withV1Config, ['init'], 'unsupported_schema', 1);

    const withWiki = await makeEmptyDir();
    await mkdir(join(withWiki, 'wiki'));
    await writeFile(join(withWiki, 'wiki/custom.md'), '# Existing\n');
    await failure(withWiki, ['init'], 'unsupported_schema', 1);
  });

  it('completes a folder that already has a hand-made valid config and no wiki/', async () => {
    const root = await makeEmptyDir();
    await configure(root, { kf: '2.0', ignore: ['Drafts/**'] });
    const configBefore = await readFile(join(root, '.knowlery/config.json'), 'utf8');

    const res = await runDirectJson<InitResult>(root, ['init']);
    expect(res.kept).toEqual(['.knowlery/config.json']);
    expect(res.created).toEqual([
      'wiki/',
      'wiki/CONVENTIONS.md',
      'wiki/index.md',
      'wiki/log.md',
      'AGENTS.md',
      'CLAUDE.md',
      'GEMINI.md',
      '.agents/skills/knowlery-compile/SKILL.md',
      '.agents/skills/knowlery-maintain/SKILL.md',
      '.agents/skills/knowlery-answer/SKILL.md',
    ]);
    expect(await readFile(join(root, '.knowlery/config.json'), 'utf8')).toBe(configBefore);
  });

  it('syncs CONVENTIONS.md across current, outdated, apply, missing, and create states', async () => {
    const root = await makeEmptyDir();
    await runDirectJson<InitResult>(root, ['init']);

    const current = await invoke(root, ['sync', '--json']);
    expect(current.code).toBe(0);
    expect(JSON.parse(current.stdout)).toMatchObject({
      contract: '2.0',
      ok: true,
      command: 'sync',
      conventions: 'current',
      removed: [],
      added: [],
      removed_more: 0,
      added_more: 0,
    });

    const convPath = join(root, 'wiki/CONVENTIONS.md');
    await writeFile(convPath, `${renderConventions()}A stray line.\n`);

    const outdatedRes = await invoke(root, ['sync', '--json']);
    expect(outdatedRes.code).toBe(0);
    const outdated = JSON.parse(outdatedRes.stdout) as SyncResult & { command: string };
    expect(outdated).toMatchObject({
      command: 'sync',
      conventions: 'outdated',
      removed: ['A stray line.'],
      added: [],
      removed_more: 0,
      added_more: 0,
    });

    const textOutdated = await invoke(root, ['sync']);
    expect(textOutdated.code).toBe(0);
    expect(textOutdated.stdout).toContain('- A stray line.');

    const updated = await runDirectJson<SyncResult>(root, ['sync', '--apply']);
    expect(updated.conventions).toBe('updated');
    expect(await readFile(convPath, 'utf8')).toBe(renderConventions());

    await rm(convPath);
    const missingRes = await invoke(root, ['sync', '--json']);
    expect(missingRes.code).toBe(0);
    expect(JSON.parse(missingRes.stdout)).toMatchObject({
      command: 'sync',
      conventions: 'missing',
    });

    const created = await runDirectJson<SyncResult>(root, ['sync', '--apply']);
    expect(created.conventions).toBe('created');
    expect(await readFile(convPath, 'utf8')).toBe(renderConventions());
  });

  it('reports health on the fixture under 4,096 bytes and null for missing registry extractors', async () => {
    const root = await makeKb();
    tempDirs.push(root);

    const res = await invoke(root, ['health', '--json']);
    expect(res.code).toBe(0);
    expect(res.stderr).toBe('');
    expect(Buffer.byteLength(res.stdout, 'utf8')).toBeLessThan(4096);

    const data = JSON.parse(res.stdout) as HealthResult & { contract: string; ok: boolean; command: string };
    expect(data).toMatchObject({
      contract: '2.0',
      ok: true,
      command: 'health',
      kf: '2.0',
      config: { ignore: 0, mcp_raw: true },
      extractors: {
        markdown: 'markdown@1',
        txt: 'txt@1',
        csv: 'csv@1',
        pdf: 'pdf@1',
        docx: 'docx@1',
        xlsx: 'xlsx@1',
      },
      wiki: {
        pages: 5,
        conventions: 'missing',
        index: 'missing',
        log: 'missing',
      },
      sources: {
        total: 5,
        by_format: { csv: 1, markdown: 2, txt: 2 },
        unsupported: 0,
        ignored: 0,
        symlinks: 0,
      },
      cache: {
        inventory: 'missing',
        text_files: 0,
      },
    });
    expect(['available', 'missing']).toContain(data.pdf_parser);

    const withoutPdf = { ...builtinRegistry };
    delete withoutPdf.pdf;
    const noPdf = await runDirectJson<HealthResult>(root, ['health'], { registry: withoutPdf });
    expect(noPdf.extractors.pdf).toBeNull();
    expect(noPdf.extractors.markdown).toBe('markdown@1');
  });
});
