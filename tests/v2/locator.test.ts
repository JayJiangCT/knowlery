import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { getExtraction } from '../../src/v2/core/extract';
import type { Extraction, Unit } from '../../src/v2/core/extract/types';
import { formatLocator, parseLocator, renderPieces, resolveLocator } from '../../src/v2/core/locator';
import { makeKb } from './helpers';

let root: string;
beforeEach(async () => { root = await makeKb(); });
afterEach(async () => { await rm(root, { recursive: true, force: true }); });
const select = (extraction: Extraction, text: string) => resolveLocator(extraction, parseLocator(text));
function handmade(format: 'pdf' | 'xlsx' | 'docx', meta: Record<string, unknown>, units: Unit[]): Extraction {
  return { sha256: 'sha256:' + '0'.repeat(64), state: 'ok', warnings: [], cached: false, units,
    header: { v: 1, extractor: `${format}@1`, sha256: 'sha256:' + '0'.repeat(64), format, state: 'ok', units: units.length, bytes: units.reduce((sum, unit) => sum + Buffer.byteLength(unit.text), 0), meta, problems: [] } };
}

describe('v2 locator grammar', () => {
  it.each([
    ['heading Decisions > Limits', 'heading Decisions > Limits'], ['heading (top)', 'heading (top)'],
    ['line 3', 'line 3'], ['lines 3-4', 'lines 3-4'], ['lines 5-5', 'line 5'],
    ['row 2', 'row 2'], ['rows 2-3', 'rows 2-3'], ['rows 5-5', 'row 5'],
    ['page 2', 'page 2'], ['pages 2-3', 'pages 2-3'], ['pages 5-5', 'page 5'],
    ['sheet S', 'sheet S'], ['sheet S!B4', 'sheet S!B4'], ['sheet S!B4:D9', 'sheet S!B4:D9'],
    ['sheet With spaces!and!aa4:az9', 'sheet With spaces!and!AA4:AZ9'], ['sheet S!B4:B4', 'sheet S!B4'],
  ])('canonicalises %s', (input, canonical) => {
    expect(formatLocator(parseLocator(input))).toBe(canonical);
    expect(parseLocator(canonical)).toEqual(parseLocator(input));
  });

  it.each(['', 'chapter 1', 'heading ', 'line 0', 'lines 2-1', 'rows -1-3', 'row 1.5', 'pages 9-2', 'page 9007199254740992',
    'sheet ', 'sheet !B4', 'sheet S!A0', 'sheet S!D4:B9', 'sheet S!B9:D4', 'sheet S!B4:', 'line 2x', 'lines 3', 'row 2-3'])('rejects %s', (input) => {
    expect(() => parseLocator(input)).toThrowError(expect.objectContaining({ code: 'invalid_selector' }));
  });
});

describe('v2 locator resolution', () => {
  it('resolves fixture sections with and without descendants against source text', async () => {
    const path = 'Notes/meeting.md';
    const source = await readFile(join(root, path), 'utf8');
    const extraction = await getExtraction(root, path);
    expect(renderPieces(select(extraction, 'heading Team meeting').pieces)).toBe(source.trimEnd().split(/\n\s*\n/).join('\n\n'));
    const last = source.slice(source.indexOf('### Next steps')).trimEnd();
    expect(renderPieces(select(extraction, 'heading Team meeting > Decisions > Next steps').pieces)).toBe(last);
  });

  it('selects duplicated heading paths in order and top blocks only', async () => {
    const source = 'Top text\n\n# Same\nfirst\n## Child\ninside\n# Same\nsecond\n# Sameish\nother\n';
    await writeFile(join(root, 'Notes/meeting.md'), source);
    const extraction = await getExtraction(root, 'Notes/meeting.md');
    const selected = select(extraction, 'heading Same');
    const expected = source.slice(source.indexOf('# Same'), source.indexOf('# Sameish')).trimEnd().split('\n').join('\n\n');
    expect(renderPieces(selected.pieces)).toBe(expected);
    expect(renderPieces(select(extraction, 'heading (top)').pieces)).toBe(source.split('\n')[0]);
    expect(() => select(extraction, 'heading Missing')).toThrowError(expect.objectContaining({ code: 'not_found' }));
  });

  it('trims line selections inside one txt unit and across two units', async () => {
    const path = 'Projects/policy notes.txt';
    await writeFile(join(root, path), 'one\ntwo\nthree\nfour\nfive\n');
    let source = (await readFile(join(root, path), 'utf8')).trimEnd().split('\n');
    let result = select(await getExtraction(root, path), 'lines 3-4');
    expect(result.pieces).toMatchObject([{ start: 3, end: 4 }]);
    expect(renderPieces(result.pieces)).toBe(source.slice(2, 4).join('\n'));
    await writeFile(join(root, path), `one\ntwo\n${'x'.repeat(2040)}\nfour\nfive`);
    source = (await readFile(join(root, path), 'utf8')).split('\n');
    result = select(await getExtraction(root, path), 'lines 3-4');
    expect(result.pieces).toHaveLength(2);
    expect(renderPieces(result.pieces)).toBe(source.slice(2, 4).join('\n'));
    await writeFile(join(root, path), 'one\ntwo\nthree\n\nfive');
    result = select(await getExtraction(root, path), 'lines 3-5');
    expect(renderPieces(result.pieces)).toBe('three\n\nfive');
  });

  it('resolves rows 2-3 using cells in the csv fixture', async () => {
    const source = await readFile(join(root, 'Finance/orders.csv'), 'utf8');
    const expected = source.slice(source.indexOf('2,"Two')).split('\n').slice(0, 3).join('\n')
      .replace('2,"Two\nLines",14.00', '2\tTwo Lines\t14.00').replace('3,Customer 3,21.00', '3\tCustomer 3\t21.00');
    const result = select(await getExtraction(root, 'Finance/orders.csv'), 'rows 2-3');
    expect(renderPieces(result.pieces)).toBe(expected);
  });

  it('clamps line and row ends but rejects missing starts and incompatible forms', async () => {
    await writeFile(join(root, 'a.txt'), Array.from({ length: 12 }, (_, i) => `Line ${i + 1}`).join('\n'));
    const extraction = await getExtraction(root, 'a.txt');
    expect(select(extraction, 'lines 10-99999').locator).toBe('lines 10-12');
    expect(select(extraction, 'lines 12-99999').locator).toBe('line 12');
    expect(() => select(extraction, 'line 13')).toThrowError(expect.objectContaining({ code: 'not_found' }));
    expect(() => select(extraction, 'page 1')).toThrowError(expect.objectContaining({ code: 'invalid_selector' }));
    const csv = await getExtraction(root, 'Finance/orders.csv');
    expect(select(csv, 'rows 199-99999').locator).toBe('rows 199-200');
    expect(() => select(csv, 'row 201')).toThrowError(expect.objectContaining({ code: 'not_found' }));
  });

  it('resolves pdf pages using meta.pages including empty pages', () => {
    const extraction = handmade('pdf', { pages: 4 }, [
      { i: 0, kind: 'block', page: 1, text: 'first' }, { i: 1, kind: 'block', page: 2, text: 'second' },
      { i: 2, kind: 'block', page: 2, text: 'second again' }, { i: 3, kind: 'block', page: 3, text: 'third' },
    ]);
    expect(renderPieces(select(extraction, 'page 2').pieces)).toBe('second\n\nsecond again');
    expect(renderPieces(select(extraction, 'pages 2-3').pieces)).toBe('second\n\nsecond again\n\nthird');
    expect(select(extraction, 'pages 3-999').locator).toBe('pages 3-4');
    expect(select(extraction, 'page 4').pieces).toEqual([]);
    expect(() => select(extraction, 'page 5')).toThrowError(expect.objectContaining({ code: 'not_found' }));
  });

  it('selects sheets, individual cells, and cell ranges with column offsets', () => {
    const extraction = handmade('xlsx', { sheets: ['S', 'Empty', 'A!B'] }, [
      { i: 0, kind: 'row', sheet: 'S', row: 4, col: 1, text: 'a\tb\tc\td\te' },
      { i: 1, kind: 'row', sheet: 'S', row: 5, col: 3, text: 'c5\td5\te5' },
      { i: 2, kind: 'row', sheet: 'S', row: 6, col: 5, text: 'e6' },
      { i: 3, kind: 'row', sheet: 'S', row: 8, col: 1, text: 'a8\t\t\t\te8' },
      { i: 4, kind: 'row', sheet: 'S', row: 9, col: 26, text: 'z9\taa9\tab9' },
      { i: 5, kind: 'row', sheet: 'A!B', row: 4, col: 2, text: 'bang' },
    ]);
    expect(select(extraction, 'sheet S').pieces).toHaveLength(5);
    expect(select(extraction, 'sheet S!B4').pieces).toMatchObject([{ col: 2, row: 4, text: 'b' }]);
    expect(renderPieces(select(extraction, 'sheet S!B4:D9').pieces)).toBe('b\tc\td\nc5\td5');
    expect(renderPieces(select(extraction, 'sheet S!Z9:AB9').pieces)).toBe('z9\taa9\tab9');
    expect(renderPieces(select(extraction, 'sheet A!B!B4').pieces)).toBe('bang');
    expect(select(extraction, 'sheet Empty').pieces).toEqual([]);
    expect(select(extraction, 'sheet S!B4:D99').locator).toBe('sheet S!B4:D9');
    expect(() => select(extraction, 'sheet Missing')).toThrowError(expect.objectContaining({ code: 'not_found' }));
    expect(() => select(extraction, 'sheet S!B10')).toThrowError(expect.objectContaining({ code: 'not_found' }));
    expect(() => select(extraction, 'row 1')).toThrowError(expect.objectContaining({ code: 'invalid_selector' }));
  });

  it('applies heading locators to hand-made docx units', () => {
    const extraction = handmade('docx', {}, [{ i: 0, kind: 'heading', level: 1, path: 'One', text: 'One' }, { i: 1, kind: 'block', path: 'One', text: 'Body' }]);
    expect(renderPieces(select(extraction, 'heading One').pieces)).toBe('One\n\nBody');
    expect(renderPieces([])).toBe('');
  });
});
