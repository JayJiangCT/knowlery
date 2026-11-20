import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { lstat, mkdir, readFile, rm, symlink, utimes, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { runCli } from '../../src/v2/cli/main';
import type { ExtractionOptions } from '../../src/v2/core/extract';
import { registry } from '../../src/v2/core/extract/registry';
import type { Extraction, Unit } from '../../src/v2/core/extract/types';
import { buildOutlineLines } from '../../src/v2/core/read/outline';
import { LOCATOR_PAGE_CAP, OUTLINE_PAGE_CAP, outlineSegments, paginateSegments, pieceSegments } from '../../src/v2/core/read/page';
import type { ReadRawResult } from '../../src/v2/core/read/raw';
import { configure, digest, failure, fileState, invoke, makeKb } from './helpers';

type ReadJsonResponse = ReadRawResult & { contract: string; ok: boolean; command: string };

let root: string;
beforeEach(async () => { root = await makeKb(); });
afterEach(async () => { await rm(root, { recursive: true, force: true }); });

async function readJson(argv: string[], options: Pick<ExtractionOptions, 'registry' | 'ceiling'> = {}): Promise<ReadJsonResponse> {
  const before = await fileState(root);
  let stdout = '';
  let stderr = '';
  const code = await runCli(['read', ...argv, '--json'], {
    cwd: root,
    stdout: (text) => { stdout += text; },
    stderr: (text) => { stderr += text; },
  }, options);
  expect(code, stdout || stderr).toBe(0);
  expect(stderr).toBe('');
  expect(stdout.trimEnd().split('\n')).toHaveLength(1);
  expect(await fileState(root)).toEqual(before);
  const data = JSON.parse(stdout) as ReadJsonResponse;
  expect(data).toMatchObject({ contract: '2.0', ok: true, command: 'read', kind: 'raw' });
  return data;
}

async function readFail(argv: string[], expectedCode: string, exit: number, options: Pick<ExtractionOptions, 'registry' | 'ceiling'> = {}): Promise<{ code: string; message: string; recovery: string }> {
  const before = await fileState(root);
  let stdout = '';
  let stderr = '';
  const code = await runCli(['read', ...argv, '--json'], {
    cwd: root,
    stdout: (text) => { stdout += text; },
    stderr: (text) => { stderr += text; },
  }, options);
  expect(code, stdout || stderr).toBe(exit);
  expect(stderr).toBe('');
  expect(stdout.split('\n')).toHaveLength(2);
  expect(await fileState(root)).toEqual(before);
  const data = JSON.parse(stdout) as { contract: string; ok: boolean; error: { code: string; message: string; recovery: string } };
  expect(data).toMatchObject({ contract: '2.0', ok: false, error: { code: expectedCode } });
  expect(data.error.message.length).toBeGreaterThan(0);
  expect(data.error.recovery.length).toBeGreaterThan(0);
  return data.error;
}

function handmade(format: 'pdf' | 'xlsx', meta: Record<string, unknown>, units: Unit[]): Extraction {
  const sha256 = 'sha256:' + 'a'.repeat(64);
  return {
    sha256,
    state: 'ok',
    warnings: [],
    cached: false,
    units,
    header: {
      v: 1,
      extractor: `${format}@1`,
      sha256,
      format,
      state: 'ok',
      units: units.length,
      bytes: units.reduce((sum, unit) => sum + Buffer.byteLength(unit.text), 0),
      meta,
      problems: [],
    },
  };
}

describe('v2 read raw sources: outline and locators', () => {
  it('defaults to outline for markdown, txt, and csv fixtures with exact entry byte sizes', async () => {
    const md = await readJson(['Notes/meeting.md']);
    expect(md.select).toBe('outline');
    expect(md.format).toBe('markdown');
    expect(md.state).toBe('ok');
    expect(md.more).toBe(false);
    expect(md.next).toBeNull();
    const mdLines = md.text.trimEnd().split('\n');
    expect(mdLines[0]).toMatch(/^format markdown · state ok · 4 units · \d+ bytes$/);
    const mdEntries = mdLines.slice(1).map((line) => line.split('\t'));
    expect(mdEntries.map(([locator]) => locator)).toEqual([
      'heading Team meeting',
      'heading Team meeting > Decisions',
      'heading Team meeting > Decisions > Next steps',
    ]);
    for (const [locator, byteStr] of mdEntries) {
      const section = await readJson(['Notes/meeting.md', '--select', locator]);
      expect(section.total_bytes).toBe(Number(byteStr));
      expect(Buffer.byteLength(section.text)).toBe(Number(byteStr));
    }

    const txt = await readJson(['Projects/policy notes.txt']);
    expect(txt.select).toBe('outline');
    const txtLines = txt.text.trimEnd().split('\n');
    expect(txtLines[0]).toMatch(/^format txt · state ok · \d+ units · \d+ bytes$/);
    expect(txtLines[1]).toMatch(/^lines 1-65\t\d+$/);
    const [txtLocator, txtBytes] = txtLines[1].split('\t');
    const txtRead = await readJson(['Projects/policy notes.txt', '--select', txtLocator]);
    expect(txtRead.total_bytes).toBe(Number(txtBytes));

    const csv = await readJson(['Finance/orders.csv']);
    expect(csv.select).toBe('outline');
    const csvLines = csv.text.trimEnd().split('\n');
    expect(csvLines[0]).toMatch(/^format csv · state ok · 200 units · \d+ bytes$/);
    expect(csvLines[1]).toBe('columns: order_id\tcustomer\tamount');
    expect(csvLines[2]).toMatch(/^rows 1-200\t\d+$/);
    const [csvLocator, csvBytes] = csvLines[2].split('\t');
    const csvRead = await readJson(['Finance/orders.csv', '--select', csvLocator]);
    expect(csvRead.total_bytes).toBe(Number(csvBytes));
  });

  it('shows title and description in the outline for a markdown file with frontmatter', async () => {
    const content = [
      '---',
      'title: Quarterly Plan',
      'description: Goals and milestones for Q4',
      '---',
      'Intro paragraph.',
      '',
      '# Goals',
      'Ship v2.',
      '',
    ].join('\n');
    await writeFile(join(root, 'Notes/plan.md'), content);
    const res = await readJson(['Notes/plan.md']);
    const lines = res.text.trimEnd().split('\n');
    expect(lines[1]).toBe('title: Quarterly Plan');
    expect(lines[2]).toBe('description: Goals and milestones for Q4');
    expect(lines[3]).toMatch(/^heading \(top\)\t\d+$/);
    expect(lines[4]).toMatch(/^heading Goals\t\d+$/);
    expect(res.meta).toEqual({ title: 'Quarterly Plan', description: 'Goals and milestones for Q4' });
  });

  it('returns source-derived text and canonical select for markdown, txt, and csv locators', async () => {
    // Markdown: heading (top) and heading <path>
    const mdSource = 'Lead text\n\n# Alpha\nBody A\n\n## Beta\nBody B\n';
    await writeFile(join(root, 'Notes/sections.md'), mdSource);
    const top = await readJson(['Notes/sections.md', '--select', 'heading (top)']);
    expect(top.select).toBe('heading (top)');
    expect(top.text).toBe('Lead text');
    const beta = await readJson(['Notes/sections.md', '--select', 'heading   Alpha > Beta  ']);
    expect(beta.select).toBe('heading Alpha > Beta');
    expect(beta.text).toBe('## Beta\n\nBody B');

    // Txt: line N and lines N-M (including single-line canonicalization)
    const policyRaw = (await readFile(join(root, 'Projects/policy notes.txt'), 'utf8')).trimEnd().split('\n');
    const singleLine = await readJson(['Projects/policy notes.txt', '--select', 'lines 3-3']);
    expect(singleLine.select).toBe('line 3');
    expect(singleLine.text).toBe(policyRaw[2]);
    const rangeLines = await readJson(['Projects/policy notes.txt', '--select', 'lines 2-4']);
    expect(rangeLines.select).toBe('lines 2-4');
    expect(rangeLines.text).toBe(policyRaw.slice(1, 4).join('\n'));

    // CSV: row N and rows N-M
    const ordersRaw = await readFile(join(root, 'Finance/orders.csv'), 'utf8');
    const row1 = await readJson(['Finance/orders.csv', '--select', 'rows 1-1']);
    expect(row1.select).toBe('row 1');
    expect(row1.text).toBe('1\tCompany, Ltd\t7.00');
    const expectedRows23 = ordersRaw
      .slice(ordersRaw.indexOf('2,"Two'))
      .split('\n')
      .slice(0, 3)
      .join('\n')
      .replace('2,"Two\nLines",14.00', '2\tTwo Lines\t14.00')
      .replace('3,Customer 3,21.00', '3\tCustomer 3\t21.00');
    const rows23 = await readJson(['Finance/orders.csv', '--select', 'rows 2-3']);
    expect(rows23.select).toBe('rows 2-3');
    expect(rows23.text).toBe(expectedRows23);
  });
});

describe('v2 read raw sources: paging and UTF-8 / row boundaries', () => {
  it('pages the Chinese fixture text under 12288 bytes and reconstructs the full text', async () => {
    const path = 'Notes/会议记录.txt';
    const expected = (await readFile(join(root, path), 'utf8')).trimEnd();
    let collected = '';
    let pageCount = 0;
    let nextArgs = [path, '--select', 'lines 1-99999'];
    while (true) {
      const page = await readJson(nextArgs);
      pageCount++;
      expect(page.bytes).toBeLessThanOrEqual(LOCATOR_PAGE_CAP);
      expect(Buffer.byteLength(page.text)).toBe(page.bytes);
      expect(page.text).not.toContain('\uFFFD');
      collected += page.text;
      if (!page.more) {
        expect(page.next).toBeNull();
        break;
      }
      expect(page.next).not.toBeNull();
      nextArgs = [
        path,
        '--select', page.next!.select,
        '--offset', String(page.next!.offset),
        '--expected-version', page.next!.expected_version,
      ];
    }
    expect(pageCount).toBeGreaterThan(1);
    expect(collected).toBe(expected);
  });

  it('pages 2000 short Chinese lines with no blank line without any partial page, ending at line ends', async () => {
    const lines = Array.from({ length: 2000 }, (_, i) => `第${i + 1}条记录：保留原始资料`);
    const content = lines.join('\n');
    await writeFile(join(root, 'Notes/many-lines.txt'), content);

    let collected = '';
    let pageCount = 0;
    let nextArgs = ['Notes/many-lines.txt', '--select', 'lines 1-2000'];
    while (true) {
      const page = await readJson(nextArgs);
      pageCount++;
      expect(page.partial).toBe(false);
      expect(page.bytes).toBeLessThanOrEqual(LOCATOR_PAGE_CAP);
      if (page.more) expect(page.text.endsWith('\n')).toBe(true);
      collected += page.text;
      if (!page.more) break;
      nextArgs = [
        'Notes/many-lines.txt',
        '--select', page.next!.select,
        '--offset', String(page.next!.offset),
        '--expected-version', page.next!.expected_version,
      ];
    }
    expect(pageCount).toBeGreaterThan(1);
    expect(collected).toBe(content);
  });

  it('pages one 30000-byte Chinese line as partial pages with no U+FFFD and exact concatenation', async () => {
    const unit = '知'; // 3 UTF-8 bytes
    const line = unit.repeat(10000); // 30,000 UTF-8 bytes
    expect(Buffer.byteLength(line)).toBe(30000);
    await writeFile(join(root, 'Notes/long-line.txt'), line);

    let collected = '';
    let pageCount = 0;
    let nextArgs = ['Notes/long-line.txt', '--select', 'line 1'];
    while (true) {
      const page = await readJson(nextArgs);
      pageCount++;
      expect(page.partial).toBe(true);
      expect(page.bytes).toBeLessThanOrEqual(LOCATOR_PAGE_CAP);
      expect(page.text).not.toContain('\uFFFD');
      collected += page.text;
      if (!page.more) break;
      nextArgs = [
        'Notes/long-line.txt',
        '--select', page.next!.select,
        '--offset', String(page.next!.offset),
        '--expected-version', page.next!.expected_version,
      ];
    }
    expect(pageCount).toBe(3);
    expect(collected).toBe(line);
  });

  it('cuts an oversized csv row on a tab when possible, and on a character for a single giant cell', async () => {
    const header = Array.from({ length: 300 }, (_, i) => `c${i}`).join(',');
    const wideCells = Array.from({ length: 300 }, (_, i) => `val${String(i).padStart(3, '0')}_${'x'.repeat(60)}`);
    const wideCsv = `${header}\n${wideCells.join(',')}\n`;
    expect(Buffer.byteLength(wideCells.join('\t'))).toBeGreaterThan(20000);
    await writeFile(join(root, 'Finance/wide.csv'), wideCsv);

    const firstWide = await readJson(['Finance/wide.csv', '--select', 'row 1']);
    expect(firstWide.partial).toBe(true);
    expect(firstWide.more).toBe(true);
    expect(firstWide.bytes).toBeLessThanOrEqual(LOCATOR_PAGE_CAP);
    expect(firstWide.text.endsWith('\t')).toBe(true);

    let wideCollected = firstWide.text;
    let next = firstWide.next;
    while (next) {
      const page = await readJson([
        'Finance/wide.csv',
        '--select', next.select,
        '--offset', String(next.offset),
        '--expected-version', next.expected_version,
      ]);
      wideCollected += page.text;
      next = page.next;
    }
    expect(wideCollected).toBe(wideCells.join('\t'));

    const giantCell = '汉'.repeat(7000); // 21,000 UTF-8 bytes, no tabs
    await writeFile(join(root, 'Finance/giant-cell.csv'), `col\n${giantCell}\n`);
    const firstGiant = await readJson(['Finance/giant-cell.csv', '--select', 'row 1']);
    expect(firstGiant.partial).toBe(true);
    expect(firstGiant.more).toBe(true);
    expect(firstGiant.bytes).toBeLessThanOrEqual(LOCATOR_PAGE_CAP);
    expect(firstGiant.text).not.toContain('\uFFFD');
    const secondGiant = await readJson([
      'Finance/giant-cell.csv',
      '--select', firstGiant.next!.select,
      '--offset', String(firstGiant.next!.offset),
      '--expected-version', firstGiant.next!.expected_version,
    ]);
    expect(secondGiant.more).toBe(false);
    expect(secondGiant.text).not.toContain('\uFFFD');
    expect(firstGiant.text + secondGiant.text).toBe(giantCell);
  });

  it('pages the outline of a 400-heading markdown file at 4096 bytes on line boundaries', async () => {
    const md = Array.from({ length: 400 }, (_, i) => `# Heading ${String(i + 1).padStart(3, '0')}\n\nParagraph ${i + 1}.`).join('\n\n') + '\n';
    await writeFile(join(root, 'Notes/400-headings.md'), md);

    let collected = '';
    let pageCount = 0;
    let nextArgs = ['Notes/400-headings.md'];
    while (true) {
      const page = await readJson(nextArgs);
      pageCount++;
      expect(page.select).toBe('outline');
      expect(page.partial).toBe(false);
      expect(page.bytes).toBeLessThanOrEqual(OUTLINE_PAGE_CAP);
      expect(page.text.endsWith('\n')).toBe(true);
      collected += page.text;
      if (!page.more) break;
      nextArgs = [
        'Notes/400-headings.md',
        '--select', page.next!.select,
        '--offset', String(page.next!.offset),
        '--expected-version', page.next!.expected_version,
      ];
    }
    expect(pageCount).toBeGreaterThan(2);
    const lines = collected.trimEnd().split('\n');
    expect(lines.filter((line) => line.startsWith('heading Heading '))).toHaveLength(400);
  });

  it('builds outlines and pages hand-made pdf page units and xlsx sheet rows including hidden sheet and empty page', () => {
    const pdfExtraction = handmade('pdf', { pages: 4 }, [
      { i: 0, kind: 'block', page: 1, text: 'Page one text' },
      { i: 1, kind: 'block', page: 3, text: 'Page three part A' },
      { i: 2, kind: 'block', page: 3, text: 'Page three part B' },
    ]);
    const pdfOutline = buildOutlineLines(pdfExtraction);
    expect(pdfOutline).toEqual([
      `format pdf · state ok · 3 units · ${pdfExtraction.header!.bytes} bytes`,
      `page 1\t${Buffer.byteLength('Page one text')}`,
      `page 3\t${Buffer.byteLength('Page three part A\n\nPage three part B')}`,
    ]);
    // Page 2 and Page 4 have no text so they are omitted from outline.
    expect(pdfOutline.some((line) => line.startsWith('page 2\t'))).toBe(false);
    expect(pdfOutline.some((line) => line.startsWith('page 4\t'))).toBe(false);
    const pdfOutlinePage = paginateSegments(outlineSegments(pdfOutline), 0, OUTLINE_PAGE_CAP);
    expect(pdfOutlinePage.more).toBe(false);
    expect(pdfOutlinePage.text).toBe(`${pdfOutline.join('\n')}\n`);

    const xlsxExtraction = handmade('xlsx', {
      sheets: [
        { name: 'Summary', rows: 2, range: 'A1:B2', hidden: false },
        { name: 'Empty', rows: 0, range: null, hidden: false },
        { name: 'Secret', rows: 1, range: 'A1:A1', hidden: true },
      ],
    }, [
      { i: 0, kind: 'row', sheet: 'Summary', row: 1, col: 1, text: 'k\tv' },
      { i: 1, kind: 'row', sheet: 'Summary', row: 2, col: 1, text: 'a\t1' },
      { i: 2, kind: 'row', sheet: 'Secret', row: 1, col: 1, text: 'hidden-value' },
    ]);
    const xlsxOutline = buildOutlineLines(xlsxExtraction);
    expect(xlsxOutline).toEqual([
      `format xlsx · state ok · 3 units · ${xlsxExtraction.header!.bytes} bytes`,
      `sheet Summary!A1:B2\t${Buffer.byteLength('k\tv\na\t1')}\t2 rows`,
      'sheet Empty\t0\t0 rows',
      `sheet Secret!A1:A1\t${Buffer.byteLength('hidden-value')}\t1 rows\thidden`,
    ]);
    const sheetPieces = pieceSegments(xlsxExtraction.units.filter((u) => u.kind === 'row' && u.sheet === 'Summary'));
    const pagedSheet = paginateSegments(sheetPieces, 0, LOCATOR_PAGE_CAP);
    expect(pagedSheet.text).toBe('k\tv\na\t1');
    expect(pagedSheet.more).toBe(false);
  });
});

describe('v2 read raw sources: versioning, offsets, errors, cache, and text format', () => {
  it('enforces --expected-version and fails with stale_version when the file changes between pages', async () => {
    const path = 'Notes/会议记录.txt';
    const first = await readJson([path, '--select', 'lines 1-99999']);
    expect(first.more).toBe(true);

    // Right hash succeeds
    const second = await readJson([
      path,
      '--select', first.next!.select,
      '--offset', String(first.next!.offset),
      '--expected-version', first.version,
    ]);
    expect(second.version).toBe(first.version);

    // Wrong hash fails with stale_version
    await readFail([path, '--expected-version', `sha256:${'f'.repeat(64)}`], 'stale_version', 1);

    // Edit file between pages -> following next fails with stale_version
    await writeFile(join(root, path), 'modified content\n');
    const stale = await readFail([
      path,
      '--select', first.next!.select,
      '--offset', String(first.next!.offset),
      '--expected-version', first.next!.expected_version,
    ], 'stale_version', 1);
    expect(stale.recovery).toContain('--offset');
  });

  it('rejects offsets inside a multi-byte character or beyond the total bytes', async () => {
    const path = 'Notes/utf8.txt';
    await writeFile(join(root, path), '中文测试'); // 12 bytes
    await readFail([path, '--select', 'line 1', '--offset', '1'], 'invalid_selector', 1);
    await readFail([path, '--select', 'line 1', '--offset', '2'], 'invalid_selector', 1);
    await readFail([path, '--select', 'line 1', '--offset', '12'], 'invalid_selector', 1);
    await readFail([path, '--select', 'line 1', '--offset', '999'], 'invalid_selector', 1);
  });

  it('detects content changes even when size and mtime are restored', async () => {
    const path = 'Projects/policy notes.txt';
    const absolute = join(root, path);
    await utimes(absolute, 1700000000, 1700000000);
    const first = await readJson([path, '--select', 'line 1']);
    const info = await lstat(absolute);
    const replacement = 'Z'.repeat(info.size);
    await writeFile(absolute, replacement);
    await utimes(absolute, info.atime, info.mtime);

    const updated = await readJson([path, '--select', 'line 1']);
    expect(updated.version).toBe(digest(replacement));
    expect(updated.version).not.toBe(first.version);
    expect(updated.text).toBe(replacement);

    await readFail([path, '--select', 'line 1', '--expected-version', first.version], 'stale_version', 1);
  });

  it('returns the required error codes for denied, missing, unavailable, unreadable, too_large, and bad selectors', async () => {
    await writeFile(join(root, '.secret.txt'), 'hidden');
    await writeFile(join(root, 'image.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    await writeFile(join(root, 'bad-utf8.txt'), Buffer.from([0xff, 0xfe]));
    await configure(root, { kf: '2.0', ignore: ['Archive/**'] });
    await symlink(join(root, 'Projects/policy notes.txt'), join(root, 'link-file.txt'));
    await symlink(join(root, 'Projects'), join(root, 'link-dir'));
    const outside = join(root, '..', 'outside-knowlery-test.txt');
    await symlink(outside, join(root, 'escape.txt'));

    for (const denied of [
      '../x',
      '.knowlery/config.json',
      '.secret.txt',
      'Archive/old.md',
      'link-file.txt',
      'link-dir/policy notes.txt',
      'escape.txt',
    ]) {
      await readFail([denied], 'path_denied', 1);
    }

    await readFail(['missing.md'], 'not_found', 1);
    await readFail(['image.png'], 'extraction_unavailable', 1);

    const withoutTxt = { ...registry };
    delete withoutTxt.txt;
    await readFail(['Projects/policy notes.txt'], 'extraction_unavailable', 1, { registry: withoutTxt });

    const badUtf8Err = await readFail(['bad-utf8.txt'], 'extraction_unavailable', 1);
    expect(badUtf8Err.message).toContain('encoding');

    await readFail(['Projects/policy notes.txt'], 'limit_reached', 1, { ceiling: 10 });
    await readFail(['Projects/policy notes.txt', '--select', 'page 3'], 'invalid_selector', 1);
    await readFail(['Projects/policy notes.txt', '--select', 'nonsense'], 'invalid_selector', 1);
    await readFail(['Notes/meeting.md', '--select', 'heading Nope'], 'not_found', 1);
    await readFail(['wiki/record-preservation.md'], 'invalid_selector', 1);
  });

  it('serves a partial csv with its problem included', async () => {
    await writeFile(join(root, 'Finance/partial.csv'), 'a,b\n1,2\n3,"unclosed');
    const outline = await readJson(['Finance/partial.csv']);
    expect(outline.state).toBe('partial');
    expect(outline.problems).toHaveLength(1);
    expect(outline.problems[0].code).toBe('unterminated_quote');
    expect(outline.text).toContain('problem unterminated_quote ');

    const rows = await readJson(['Finance/partial.csv', '--select', 'row 1']);
    expect(rows.state).toBe('partial');
    expect(rows.problems[0].code).toBe('unterminated_quote');
    expect(rows.text).toBe('1\t2');
  });

  it('reports cache miss then hit, and still reads when mcp.raw is false', async () => {
    await configure(root, { kf: '2.0', mcp: { raw: false } });
    const first = await readJson(['Notes/meeting.md']);
    expect(first.cache).toBe('miss');
    const second = await readJson(['Notes/meeting.md']);
    expect(second.cache).toBe('hit');
    expect(second.text).toBe(first.text);
  });

  it('formats text output with header line, conditional more: line, empty line, and exact text', async () => {
    // Non-more case (end)
    const endJson = await readJson(['Notes/meeting.md', '--select', 'heading Team meeting > Decisions > Next steps']);
    const endText = await invoke(root, ['read', 'Notes/meeting.md', '--select', 'heading Team meeting > Decisions > Next steps']);
    expect(endText.code).toBe(0);
    expect(endText.stderr).toBe('');
    expect(endText.stdout).toBe(
      `read Notes/meeting.md · ${endJson.version} · heading Team meeting > Decisions > Next steps · bytes 0-${endJson.bytes} of ${endJson.total_bytes} · end\n\n${endJson.text}`,
    );

    // More + partial case
    const line = '汉'.repeat(6000); // 18,000 bytes
    await writeFile(join(root, 'Notes/partial-text.txt'), line);
    const moreJson = await readJson(['Notes/partial-text.txt', '--select', 'line 1']);
    expect(moreJson.more).toBe(true);
    expect(moreJson.partial).toBe(true);
    const moreText = await invoke(root, ['read', 'Notes/partial-text.txt', '--select', 'line 1']);
    expect(moreText.code).toBe(0);
    expect(moreText.stderr).toBe('');
    expect(moreText.stdout).toBe(
      [
        `read Notes/partial-text.txt · ${moreJson.version} · line 1 · bytes 0-${moreJson.bytes} of ${moreJson.total_bytes} · partial · more`,
        `more: --select "line 1" --offset ${moreJson.next!.offset} --expected-version ${moreJson.next!.expected_version}`,
        '',
        moreJson.text,
      ].join('\n'),
    );
  });

  it('rejects invalid CLI invocations for read with exit code 2', async () => {
    await failure(root, ['read'], 'invalid_invocation', 2);
    await failure(root, ['read', 'Notes/meeting.md', 'extra'], 'invalid_invocation', 2);
    await failure(root, ['read', 'Notes/meeting.md', '--expected-version', 'bad'], 'invalid_invocation', 2);
    await failure(root, ['read', 'Notes/meeting.md', '--offset', '-1'], 'invalid_invocation', 2);
    await failure(root, ['read', 'Notes/meeting.md', '--scope', 'Notes'], 'invalid_invocation', 2);
    await failure(root, ['inventory', '--select', 'outline'], 'invalid_invocation', 2);
    await mkdir(join(root, 'empty-dir'));
    await readFail(['empty-dir'], 'extraction_unavailable', 1);
  });
});
