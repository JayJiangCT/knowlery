import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { getExtraction } from '../../src/v2/core/extract';
import { cacheName } from '../../src/v2/core/extract/cache';
import { xlsx } from '../../src/v2/core/extract/xlsx';
import { parseLocator, renderPieces, resolveLocator } from '../../src/v2/core/locator';
import { buildXlsx, worksheetXml } from './builders/xlsx';
import { fileState, makeKb } from './helpers';

let root: string;
beforeEach(async () => { root = await makeKb(); });
afterEach(async () => { await rm(root, { recursive: true, force: true }); });

describe('v2 xlsx extractor', () => {
  it('extracts shared strings (without rPh), inlineStr, booleans, errors, numbers, dates, quoted-d non-date, formulas, hidden sheets, and missing r', async () => {
    const sharedStringsXml = [
      '<si><t>Tokyo</t><rPh sb="0" eb="2"><t>トウキョウ</t></rPh></si>',
      '<si><r><t>Part </t></r><r><t>Two</t></r></si>',
    ].join('');

    const stylesXml = [
      '<numFmts count="2">',
      '  <numFmt numFmtId="164" formatCode="yyyy-mm-dd hh:mm:ss"/>',
      '  <numFmt numFmtId="165" formatCode="0.00&quot;d&quot;"/>',
      '</numFmts>',
      '<cellXfs count="4">',
      '  <xf numFmtId="0"/>',
      '  <xf numFmtId="14"/>',
      '  <xf numFmtId="164"/>',
      '  <xf numFmtId="165"/>',
      '</cellXfs>',
    ].join('');

    // Row 1: shared string, inlineStr, bool, error, float precision
    // Row 2 (no r): built-in date 14 (45292 = 2024-01-01), custom datetime (45292.5 = 2024-01-01 12:00:00), quoted "d" number (42)
    // Row 4: B4=cached formula, C4=empty, D4=val -> range B4:D4
    const limitsXml = worksheetXml([
      '<row r="1">',
      '  <c r="A1" t="s"><v>0</v></c>',
      '  <c r="B1" t="inlineStr"><is><t>Inline Text</t></is></c>',
      '  <c r="C1" t="b"><v>1</v></c>',
      '  <c r="D1" t="e"><v>#DIV/0!</v></c>',
      '  <c r="E1"><v>0.30000000000000004</v></c>',
      '</row>',
      '<row>',
      '  <c s="1"><v>45292</v></c>',
      '  <c s="2"><v>45292.5</v></c>',
      '  <c s="3"><v>42</v></c>',
      '</row>',
      '<row r="4">',
      '  <c r="B4"><f>SUM(A1:A3)</f><v>100</v></c>',
      '  <c r="D4" t="s"><v>1</v></c>',
      '</row>',
    ].join(''));

    const hiddenXml = worksheetXml('<row r="1"><c r="A1" t="str"><v>Secret</v></c></row>');
    const emptyXml = worksheetXml('');

    const bytes = await buildXlsx({
      sharedStringsXml,
      stylesXml,
      sheets: [
        { name: 'Limits', sheetXml: limitsXml },
        { name: 'HiddenSheet', sheetXml: hiddenXml, hidden: true },
        { name: 'Empty', sheetXml: emptyXml },
      ],
    });

    const extracted = await xlsx.extract(bytes);
    expect(extracted.state).toBe('ok');
    expect(extracted.problems).toEqual([]);
    expect(extracted.meta.sheets).toEqual([
      { name: 'Limits', range: 'A1:E4', rows: 3, hidden: false },
      { name: 'HiddenSheet', range: 'A1:A1', rows: 1, hidden: true },
      { name: 'Empty', range: null, rows: 0, hidden: false },
    ]);

    expect(extracted.units).toEqual([
      { i: 0, kind: 'row', sheet: 'Limits', row: 1, col: 1, text: 'Tokyo\tInline Text\tTRUE\t#DIV/0!\t0.3' },
      { i: 1, kind: 'row', sheet: 'Limits', row: 2, col: 1, text: '2024-01-01\t2024-01-01 12:00:00\t42' },
      { i: 2, kind: 'row', sheet: 'Limits', row: 4, col: 2, text: '100\t\tPart Two' },
      { i: 3, kind: 'row', sheet: 'HiddenSheet', row: 1, col: 1, text: 'Secret' },
    ]);
    // Formula text must appear nowhere
    expect(JSON.stringify(extracted)).not.toContain('SUM(A1:A3)');

    // Test locator resolution via getExtraction
    await writeFile(join(root, 'book.xlsx'), bytes);
    const ex = await getExtraction(root, 'book.xlsx');

    expect(renderPieces(resolveLocator(ex, parseLocator('sheet Limits!B4:D4')).pieces)).toBe('100\t\tPart Two');
    expect(renderPieces(resolveLocator(ex, parseLocator('sheet Limits!B4')).pieces)).toBe('100');
    expect(renderPieces(resolveLocator(ex, parseLocator('sheet Limits')).pieces)).toBe(
      'Tokyo\tInline Text\tTRUE\t#DIV/0!\t0.3\n2024-01-01\t2024-01-01 12:00:00\t42\n100\t\tPart Two',
    );
    expect(resolveLocator(ex, parseLocator('sheet Empty')).pieces).toEqual([]);
    expect(() => resolveLocator(ex, parseLocator('sheet Empty!A1'))).toThrowError(expect.objectContaining({ code: 'not_found' }));
    expect(() => resolveLocator(ex, parseLocator('sheet Nope'))).toThrowError(expect.objectContaining({ code: 'not_found' }));
  });

  it('interprets the same date serial with date1904 epoch', async () => {
    const stylesXml = '<cellXfs count="2"><xf numFmtId="0"/><xf numFmtId="14"/></cellXfs>';
    const sheetXml = worksheetXml('<row r="1"><c r="A1" s="1"><v>45292</v></c></row>');
    const bytes = await buildXlsx({
      stylesXml,
      date1904: true,
      sheets: [{ name: 'Dates', sheetXml }],
    });

    const extracted = await xlsx.extract(bytes);
    expect(extracted.state).toBe('ok');
    // 1904-01-01 + 45292 days = 2028-01-02
    expect(extracted.units[0].text).toBe('2028-01-02');
  });

  it('marks formula cells without cached value as partial with formula_without_value', async () => {
    const sheetXml = worksheetXml([
      '<row r="1"><c r="A1"><v>10</v></c></row>',
      '<row r="2"><c r="A2"><f>A1*2</f></c></row>',
    ].join(''));
    const bytes = await buildXlsx({ sheets: [{ name: 'Calc', sheetXml }] });
    const extracted = await xlsx.extract(bytes);
    expect(extracted.state).toBe('partial');
    expect(extracted.problems).toEqual([{ code: 'formula_without_value', detail: 'Calc: 1' }]);
    expect(extracted.units).toHaveLength(1);
    expect(extracted.units[0].text).toBe('10');
  });

  it('keeps a row wider than 12,288 bytes as a single row unit and extracts offline with deterministic cache', async () => {
    const cellsXml = Array.from({ length: 260 }, (_, idx) =>
      `<c t="inlineStr"><is><t>col_${String(idx).padStart(3, '0')}_${'x'.repeat(50)}</t></is></c>`,
    ).join('');
    const bytes = await buildXlsx({
      sheets: [{ name: 'Wide', sheetXml: worksheetXml(`<row r="1">${cellsXml}</row>`) }],
    });
    await writeFile(join(root, 'wide.xlsx'), bytes);
    const before = await fileState(root);

    const origFetch = globalThis.fetch;
    globalThis.fetch = (() => { throw new Error('network forbidden'); }) as typeof fetch;
    try {
      const first = await getExtraction(root, 'wide.xlsx');
      expect(first.cached).toBe(false);
      expect(first.state).toBe('ok');
      expect(first.units).toHaveLength(1);
      expect(Buffer.byteLength(first.units[0].text)).toBeGreaterThan(12288);

      const cachePath = join(root, '.knowlery/cache/text', cacheName(first.sha256!, 'xlsx@1'));
      const firstCache = await readFile(cachePath);
      expect((await getExtraction(root, 'wide.xlsx')).cached).toBe(true);
      await rm(join(root, '.knowlery/cache'), { recursive: true });
      expect((await getExtraction(root, 'wide.xlsx')).cached).toBe(false);
      expect(await readFile(cachePath)).toEqual(firstCache);
    } finally {
      globalThis.fetch = origFetch;
    }

    expect(await fileState(root)).toEqual(before);
  });
});
