import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { getExtraction } from '../../src/v2/core/extract';
import { cacheName } from '../../src/v2/core/extract/cache';
import { pdf } from '../../src/v2/core/extract/pdf';
import { parseLocator, renderPieces, resolveLocator } from '../../src/v2/core/locator';
import { buildPdf } from './builders/pdf';
import { fileState, invoke, makeKb } from './helpers';

let root: string;
beforeEach(async () => { root = await makeKb(); });
afterEach(async () => { await rm(root, { recursive: true, force: true }); });

describe('v2 pdf extractor', () => {
  it('extracts three pages with correct page numbers and resolves page 2 and pages 2-3', async () => {
    const bytes = buildPdf([
      ['First page line one', 'First page line two'],
      ['Second page text'],
      ['Third page text'],
    ]);
    await writeFile(join(root, 'three.pdf'), bytes);

    const ex = await getExtraction(root, 'three.pdf');
    expect(ex.state).toBe('ok');
    expect(ex.header?.meta).toEqual({ pages: 3 });
    expect(ex.header?.problems).toEqual([]);
    expect(ex.units).toEqual([
      { i: 0, kind: 'block', page: 1, text: 'First page line one\nFirst page line two' },
      { i: 1, kind: 'block', page: 2, text: 'Second page text' },
      { i: 2, kind: 'block', page: 3, text: 'Third page text' },
    ]);

    expect(renderPieces(resolveLocator(ex, parseLocator('page 2')).pieces)).toBe('Second page text');
    expect(renderPieces(resolveLocator(ex, parseLocator('pages 2-3')).pieces)).toBe('Second page text\n\nThird page text');
  });

  it('marks a scanned pdf (all pages empty) as unreadable with no_text pages 1-2', async () => {
    const bytes = buildPdf([[], []]);
    const extracted = await pdf.extract(bytes);
    expect(extracted.state).toBe('unreadable');
    expect(extracted.meta).toEqual({ pages: 2 });
    expect(extracted.units).toEqual([]);
    expect(extracted.problems).toEqual([{ code: 'no_text', pages: '1-2', detail: 'pages 1-2' }]);
  });

  it('marks one empty page among three as partial with no_text', async () => {
    const bytes = buildPdf([
      ['Alpha page'],
      [],
      ['Gamma page'],
    ]);
    const extracted = await pdf.extract(bytes);
    expect(extracted.state).toBe('partial');
    expect(extracted.meta).toEqual({ pages: 3 });
    expect(extracted.problems).toEqual([{ code: 'no_text', pages: '2', detail: 'pages 2' }]);
    expect(extracted.units).toEqual([
      { i: 0, kind: 'block', page: 1, text: 'Alpha page' },
      { i: 1, kind: 'block', page: 3, text: 'Gamma page' },
    ]);
  });

  it('marks random bytes with a .pdf name as unreadable with parse_error', async () => {
    const random = Buffer.from([0x13, 0x37, 0xde, 0xad, 0xbe, 0xef, 0x00, 0x42, 0x99]);
    await writeFile(join(root, 'corrupt.pdf'), random);
    const ex = await getExtraction(root, 'corrupt.pdf');
    expect(ex.state).toBe('unreadable');
    expect(ex.units).toEqual([]);
    expect(ex.header?.problems[0].code).toBe('parse_error');
    expect(ex.header?.problems[0].detail.length).toBeGreaterThan(0);
  });

  it('produces single-line JSON on stdout and empty stderr for extract --json, works offline, and caches deterministically', async () => {
    const bytes = buildPdf([['Offline PDF content']]);
    await writeFile(join(root, 'clean.pdf'), bytes);
    const before = await fileState(root);

    const origFetch = globalThis.fetch;
    globalThis.fetch = (() => { throw new Error('network forbidden'); }) as typeof fetch;
    try {
      const res = await invoke(root, ['extract', 'clean.pdf', '--json']);
      expect(res.code).toBe(0);
      expect(res.stderr).toBe('');
      expect(res.stdout.trimEnd().split('\n')).toHaveLength(1);
      const parsed = JSON.parse(res.stdout) as { ok: boolean; items: { state: string }[] };
      expect(parsed.ok).toBe(true);
      expect(parsed.items[0].state).toBe('ok');

      const ex1 = await getExtraction(root, 'clean.pdf');
      expect(ex1.cached).toBe(true);
      const cachePath = join(root, '.knowlery/cache/text', cacheName(ex1.sha256!, 'pdf@1'));
      const firstCache = await readFile(cachePath);

      await rm(join(root, '.knowlery/cache'), { recursive: true });
      const ex2 = await getExtraction(root, 'clean.pdf');
      expect(ex2.cached).toBe(false);
      expect(await readFile(cachePath)).toEqual(firstCache);
    } finally {
      globalThis.fetch = origFetch;
    }

    expect(await fileState(root)).toEqual(before);
  });
});
