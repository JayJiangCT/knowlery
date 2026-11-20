import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { runCli } from '../../src/v2/cli/main';
import { LOCATOR_PAGE_CAP } from '../../src/v2/core/read/page';
import type { ReadRawResult } from '../../src/v2/core/read/raw';
import { buildDocx, wPara, wRun } from './builders/docx';
import { buildPdf } from './builders/pdf';
import { buildXlsx, worksheetXml } from './builders/xlsx';
import { fileState, jsonRun, makeKb } from './helpers';

type ReadJsonResponse = ReadRawResult & { contract: string; ok: boolean; command: string };

let root: string;
beforeEach(async () => { root = await makeKb(); });
afterEach(async () => { await rm(root, { recursive: true, force: true }); });

async function readJson(argv: string[]): Promise<ReadJsonResponse> {
  const before = await fileState(root);
  let stdout = '';
  let stderr = '';
  const code = await runCli(['read', ...argv, '--json'], {
    cwd: root,
    stdout: (text) => { stdout += text; },
    stderr: (text) => { stderr += text; },
  });
  expect(code, stdout || stderr).toBe(0);
  expect(stderr).toBe('');
  expect(stdout.trimEnd().split('\n')).toHaveLength(1);
  expect(await fileState(root)).toEqual(before);
  const data = JSON.parse(stdout) as ReadJsonResponse;
  expect(data).toMatchObject({ contract: '2.0', ok: true, command: 'read', kind: 'raw' });
  return data;
}

async function readFail(argv: string[], expectedCode: string, exit: number): Promise<{ code: string; message: string; recovery: string }> {
  const before = await fileState(root);
  let stdout = '';
  let stderr = '';
  const code = await runCli(['read', ...argv, '--json'], {
    cwd: root,
    stdout: (text) => { stdout += text; },
    stderr: (text) => { stderr += text; },
  });
  expect(code, stdout || stderr).toBe(exit);
  expect(stderr).toBe('');
  expect(stdout.split('\n')).toHaveLength(2);
  expect(await fileState(root)).toEqual(before);
  const data = JSON.parse(stdout) as { contract: string; ok: boolean; error: { code: string; message: string; recovery: string } };
  expect(data).toMatchObject({ contract: '2.0', ok: false, error: { code: expectedCode } });
  return data.error;
}

describe('v2 read & extract integration for docx, xlsx, and pdf', () => {
  it('reads docx outline and heading section, and verifies --expected-version', async () => {
    const stylesXml = [
      '<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/></w:style>',
      '<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/></w:style>',
    ].join('');
    const bytes1 = await buildDocx({
      stylesXml,
      bodyXml: [
        wPara(wRun('Top lead')),
        wPara(wRun('A'), '<w:pStyle w:val="Heading1"/>'),
        wPara(wRun('Section A text')),
        wPara(wRun('B'), '<w:pStyle w:val="Heading2"/>'),
        wPara(wRun('Section B text')),
      ].join(''),
    });
    await writeFile(join(root, 'guide.docx'), bytes1);

    const outline = await readJson(['guide.docx']);
    const lines = outline.text.trimEnd().split('\n');
    expect(lines[0]).toMatch(/^format docx · state ok · 5 units · \d+ bytes$/);
    expect(lines.slice(1).map((line) => line.split('\t')[0])).toEqual([
      'heading (top)',
      'heading A',
      'heading A > B',
    ]);
    for (const line of lines.slice(1)) {
      const [locator, byteStr] = line.split('\t');
      const sec = await readJson(['guide.docx', '--select', locator]);
      expect(sec.total_bytes).toBe(Number(byteStr));
    }

    const section = await readJson(['guide.docx', '--select', 'heading A > B', '--expected-version', outline.version]);
    expect(section.text).toBe('B\n\nSection B text');

    const bytes2 = await buildDocx({ stylesXml, bodyXml: wPara(wRun('Updated doc')) });
    await writeFile(join(root, 'guide.docx'), bytes2);
    await readFail(['guide.docx', '--expected-version', outline.version], 'stale_version', 1);
  });

  it('reads xlsx outline (including hidden and empty sheets), selects ranges and empty sheet, pages wide rows on tabs, and checks --expected-version', async () => {
    const limitsXml = worksheetXml([
      '<row r="1"><c r="A1" t="inlineStr"><is><t>Header</t></is></c></row>',
      '<row r="4"><c r="B4"><v>10</v></c><c r="C4"><v>20</v></c><c r="D4"><v>30</v></c></row>',
    ].join(''));
    const hiddenXml = worksheetXml('<row r="1"><c r="A1" t="inlineStr"><is><t>HiddenVal</t></is></c></row>');
    const emptyXml = worksheetXml('');
    const wideCells = Array.from({ length: 260 }, (_, idx) =>
      `<c t="inlineStr"><is><t>cell_${String(idx).padStart(3, '0')}_${'z'.repeat(50)}</t></is></c>`,
    ).join('');
    const expectedWideRow = Array.from({ length: 260 }, (_, idx) =>
      `cell_${String(idx).padStart(3, '0')}_${'z'.repeat(50)}`,
    ).join('\t');
    const wideXml = worksheetXml(`<row r="1">${wideCells}</row>`);

    const bytes1 = await buildXlsx({
      sheets: [
        { name: 'Limits', sheetXml: limitsXml },
        { name: 'Secret', sheetXml: hiddenXml, hidden: true },
        { name: 'Empty', sheetXml: emptyXml },
        { name: 'Wide', sheetXml: wideXml },
      ],
    });
    await writeFile(join(root, 'data.xlsx'), bytes1);

    const outline = await readJson(['data.xlsx']);
    const lines = outline.text.trimEnd().split('\n');
    expect(lines[0]).toMatch(/^format xlsx · state ok · 4 units · \d+ bytes$/);
    expect(lines[1]).toMatch(/^sheet Limits!A1:D4\t\d+\t2 rows$/);
    expect(lines[2]).toMatch(/^sheet Secret!A1:A1\t\d+\t1 rows\thidden$/);
    expect(lines[3]).toBe('sheet Empty\t0\t0 rows');
    expect(lines[4]).toMatch(/^sheet Wide!A1:IZ1\t\d+\t1 rows$/);

    const cut = await readJson(['data.xlsx', '--select', 'sheet Limits!B4:D4', '--expected-version', outline.version]);
    expect(cut.text).toBe('10\t20\t30');

    const emptyRead = await readJson(['data.xlsx', '--select', 'sheet Empty']);
    expect(emptyRead.text).toBe('');
    expect(emptyRead.total_bytes).toBe(0);

    // Follow `next` on the wide row (> 12,288 bytes)
    const firstPage = await readJson(['data.xlsx', '--select', 'sheet Wide']);
    expect(firstPage.partial).toBe(true);
    expect(firstPage.more).toBe(true);
    expect(firstPage.bytes).toBeLessThanOrEqual(LOCATOR_PAGE_CAP);
    expect(firstPage.text.endsWith('\t')).toBe(true);

    let joined = firstPage.text;
    let next = firstPage.next;
    while (next) {
      const page = await readJson([
        'data.xlsx',
        '--select', next.select,
        '--offset', String(next.offset),
        '--expected-version', next.expected_version,
      ]);
      joined += page.text;
      next = page.next;
    }
    expect(joined).toBe(expectedWideRow);

    const bytes2 = await buildXlsx({
      sheets: [{ name: 'Limits', sheetXml: worksheetXml('<row r="1"><c r="A1"><v>999</v></c></row>') }],
    });
    await writeFile(join(root, 'data.xlsx'), bytes2);
    await readFail(['data.xlsx', '--expected-version', outline.version], 'stale_version', 1);
  });

  it('reads pdf outline and pages, reports problem no_text on partial pdf, rejects scanned pdf, and checks --expected-version', async () => {
    const partialPdf = buildPdf([['Page 1 hello'], [], ['Page 3 world']]);
    await writeFile(join(root, 'partial.pdf'), partialPdf);

    const outline = await readJson(['partial.pdf']);
    const lines = outline.text.trimEnd().split('\n');
    expect(lines[0]).toMatch(/^format pdf · state partial · 2 units · \d+ bytes$/);
    expect(lines[1]).toBe('problem no_text pages 2');
    expect(lines[2]).toMatch(/^page 1\t\d+$/);
    expect(lines[3]).toMatch(/^page 3\t\d+$/);

    const threePdf = buildPdf([['One'], ['Two'], ['Three']]);
    await writeFile(join(root, 'three.pdf'), threePdf);
    const threeOutline = await readJson(['three.pdf']);
    const p2 = await readJson(['three.pdf', '--select', 'page 2', '--expected-version', threeOutline.version]);
    expect(p2.text).toBe('Two');
    const p23 = await readJson(['three.pdf', '--select', 'pages 2-3', '--expected-version', threeOutline.version]);
    expect(p23.text).toBe('Two\n\nThree');

    await writeFile(join(root, 'three.pdf'), buildPdf([['Changed']]));
    await readFail(['three.pdf', '--expected-version', threeOutline.version], 'stale_version', 1);

    const scanned = buildPdf([[], []]);
    await writeFile(join(root, 'scanned.pdf'), scanned);
    const err = await readFail(['scanned.pdf'], 'extraction_unavailable', 1);
    expect(err.message).toContain('no_text');
  });

  it('reports new states in extract --all and inventory for docx, xlsx, and pdf', async () => {
    await writeFile(join(root, 'sample.docx'), await buildDocx({ bodyXml: wPara(wRun('Hello docx')) }));
    await writeFile(join(root, 'sample.xlsx'), await buildXlsx({ sheets: [{ name: 'S1', sheetXml: worksheetXml('<row r="1"><c r="A1"><v>1</v></c></row>') }] }));
    await writeFile(join(root, 'sample.pdf'), buildPdf([['Hello pdf']]));
    await writeFile(join(root, 'scanned.pdf'), buildPdf([[]]));

    const beforeInv = await jsonRun(root, ['inventory']);
    expect(beforeInv.items.find((i) => i.path === 'sample.docx')?.extraction).toBe('pending');
    expect(beforeInv.items.find((i) => i.path === 'sample.xlsx')?.extraction).toBe('pending');
    expect(beforeInv.items.find((i) => i.path === 'sample.pdf')?.extraction).toBe('pending');

    const extracted = await jsonRun(root, ['extract', '--all']) as unknown as {
      counts: Record<string, number>;
      items: { path: string; state: string }[];
    };
    expect(extracted.counts).toMatchObject({ total: 9, ok: 8, unreadable: 1, unavailable: 0 });
    expect(extracted.items.map((i) => [i.path, i.state])).toEqual([['scanned.pdf', 'unreadable']]);

    const afterInv = await jsonRun(root, ['inventory']);
    expect(afterInv.items.find((i) => i.path === 'sample.docx')?.extraction).toBe('ok');
    expect(afterInv.items.find((i) => i.path === 'sample.xlsx')?.extraction).toBe('ok');
    expect(afterInv.items.find((i) => i.path === 'sample.pdf')?.extraction).toBe('ok');
    expect(afterInv.items.find((i) => i.path === 'scanned.pdf')?.extraction).toBe('unreadable');
  });
});
