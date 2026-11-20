import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { formatReadRawText } from '../../src/v2/cli/commands/read';
import { runCli } from '../../src/v2/cli/main';
import type { ReadCitedResult } from '../../src/v2/core/read/cited';
import { LOCATOR_PAGE_CAP } from '../../src/v2/core/read/page';
import type { ReadRawResult } from '../../src/v2/core/read/raw';
import type { ReadWikiResult } from '../../src/v2/core/read/wiki';
import { digest, fileState, invoke, makeKb } from './helpers';

type WikiJsonResponse = ReadWikiResult & { contract: string; ok: boolean; command: string };
type CitedJsonResponse = ReadCitedResult & { contract: string; ok: boolean; command: string };

let root: string;
beforeEach(async () => { root = await makeKb(); });
afterEach(async () => { await rm(root, { recursive: true, force: true }); });

async function readWikiJson(argv: string[]): Promise<WikiJsonResponse> {
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
  const data = JSON.parse(stdout) as WikiJsonResponse;
  expect(data).toMatchObject({ contract: '2.0', ok: true, command: 'read', kind: 'wiki' });
  return data;
}

async function readCitedJson(argv: string[]): Promise<CitedJsonResponse> {
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
  const data = JSON.parse(stdout) as CitedJsonResponse;
  expect(data).toMatchObject({ contract: '2.0', ok: true, command: 'read', kind: 'cited' });
  return data;
}

async function readFail(argv: string[], expectedCode: string, exit = 1): Promise<{ code: string; message: string; recovery: string }> {
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
  expect(data.error.message.length).toBeGreaterThan(0);
  expect(data.error.recovery.length).toBeGreaterThan(0);
  return data.error;
}

describe('v2 read wiki pages', () => {
  it('reads current (default), history, section:sources, all, and missing sections', async () => {
    const filePath = 'wiki/record-preservation.md';
    const raw = await readFile(join(root, filePath), 'utf8');

    const current = await readWikiJson([filePath]);
    expect(current.select).toBe('current');
    expect(current.version).toBe(digest(raw));
    expect(current.page).toEqual({
      type: 'concept',
      title: 'Record preservation',
      status: 'disputed',
      description: 'Core rule requiring original source records to remain intact and be reviewed before wiki compilation.',
    });
    expect(current.problems).toBe(0);
    expect('format' in current).toBe(false);
    expect('state' in current).toBe(false);
    expect('meta' in current).toBe(false);
    expect(current.text).toBe([
      '## Current',
      '- Original records must be preserved and changes reviewed across all numbered policy clauses (src: s1) ^c2',
      '- Source documents must be reviewed before compiling the wiki (src: s2) ^c3',
      '- Archived notes remain active input for routine compilation (src: s3) #disputed ^c4',
    ].join('\n') + '\n');

    const history = await readWikiJson([filePath, '--select', 'history']);
    expect(history.select).toBe('history');
    expect(history.text).toBe([
      '## History',
      '- Original records should be preserved when practical (src: s1) · superseded 2026-11-18 by ^c2 · wording tightened to match policy clauses ^c1',
      '- Chinese meeting notes are exempt from record checks (src: s4) · retired 2026-11-18 · meeting notes explicitly require checking every record ^c5',
      '- 2026-11-18 · verified · by jay · ^c2 against s1',
      '- 2026-10-02 · created · by knowlery-fixture',
    ].join('\n') + '\n');

    const sources = await readWikiJson([filePath, '--select', 'section:sources']);
    expect(sources.select).toBe('section:sources');
    expect(sources.text.startsWith('## Sources\n- s1 · ')).toBe(true);
    expect(sources.text.trimEnd().split('\n')).toHaveLength(5);

    const all = await readWikiJson([filePath, '--select', 'all']);
    expect(all.select).toBe('all');
    expect(all.text).toBe(raw);

    // Missing section gives empty text, not an error.
    await writeFile(join(root, 'wiki/minimal.md'), [
      '---',
      'type: concept',
      'title: Minimal',
      'description: Page with no Open section.',
      'status: current',
      'created: 2026-11-01',
      'updated: 2026-11-01',
      '---',
      '# Minimal',
      '',
      '## Current',
      '- One claim (src: s1) ^c1',
      '',
    ].join('\n'));
    const missing = await readWikiJson(['wiki/minimal.md', '--select', 'section:Open']);
    expect(missing.select).toBe('section:open');
    expect(missing.text).toBe('');
    expect(missing.bytes).toBe(0);
    expect(missing.total_bytes).toBe(0);
    expect(missing.more).toBe(false);
  });

  it('builds outline with next ids, sources, sections, and relations', async () => {
    const outline = await readWikiJson(['wiki/record-preservation.md', '--select', 'outline']);
    expect(outline.select).toBe('outline');
    const lines = outline.text.trimEnd().split('\n');
    expect(lines[0]).toBe('page record-preservation · concept · disputed · updated 2026-11-18');
    expect(lines).toContain('title: Record preservation');
    expect(lines).toContain('description: Core rule requiring original source records to remain intact and be reviewed before wiki compilation.');
    expect(lines).toContain('as_of: 2026-11-01');
    expect(lines).toContain('aliases: source preservation, original records rule');
    expect(lines).toContain('tags: policy, governance');
    expect(lines).toContain('related: source-policy-notes, wiki-compile-overview');
    expect(lines).toContain('protected: c2');
    expect(lines.some((line) => /^section Current\t3\t\d+$/.test(line))).toBe(true);
    expect(lines.some((line) => /^section Evidence\t\t\d+$/.test(line))).toBe(true);
    expect(lines.some((line) => /^section Open\t1\t\d+$/.test(line))).toBe(true);
    expect(lines.some((line) => /^section Sources\t4\t\d+$/.test(line))).toBe(true);
    expect(lines.some((line) => /^section History\t4\t\d+$/.test(line))).toBe(true);
    expect(lines.filter((line) => line.startsWith('source '))).toEqual([
      'source s1\tProjects/policy notes.txt\tlines 1-3',
      'source s2\tNotes/meeting.md\theading Team meeting > Decisions > Next steps',
      'source s3\tArchive/old.md\theading Archived notes',
      'source s4\tNotes/会议记录.txt\tline 1',
    ]);
    expect(lines[lines.length - 1]).toBe('next: ^c6 ^q2 s5');
  });

  it('pages a 300-claim page cleanly on line boundaries and reconstructs the section', async () => {
    const claimLines = Array.from(
      { length: 300 },
      (_, i) => `- Claim number ${String(i + 1).padStart(3, '0')} documents a long preservation requirement for audit trail verification (src: s1) ^c${i + 1}`,
    );
    const pageText = [
      '---',
      'type: concept',
      'title: Many claims',
      'description: Large generated page for pagination.',
      'status: current',
      'created: 2026-11-01',
      'updated: 2026-11-01',
      '---',
      '# Many claims',
      '',
      '## Current',
      ...claimLines,
      '',
      '## Sources',
      `- s1 · \`Notes/meeting.md\` · sha256:${'a'.repeat(64)} · heading Team meeting · "Review"`,
      '',
    ].join('\n');
    await writeFile(join(root, 'wiki/many-claims.md'), pageText);

    const expectedSection = ['## Current', ...claimLines].join('\n') + '\n';
    let collected = '';
    let pageCount = 0;
    let nextArgs = ['wiki/many-claims.md'];
    while (true) {
      const page = await readWikiJson(nextArgs);
      pageCount++;
      expect(page.bytes).toBeLessThanOrEqual(LOCATOR_PAGE_CAP);
      expect(page.partial).toBe(false);
      expect(page.text.endsWith('\n')).toBe(true);
      collected += page.text;
      if (!page.more) {
        expect(page.next).toBeNull();
        break;
      }
      expect(page.next).not.toBeNull();
      nextArgs = [
        'wiki/many-claims.md',
        '--select', page.next!.select,
        '--offset', String(page.next!.offset),
        '--expected-version', page.next!.expected_version,
      ];
    }
    expect(pageCount).toBeGreaterThan(2);
    expect(collected).toBe(expectedSection);
  });

  it('enforces --expected-version on wiki pages including edits between pages', async () => {
    const claims = Array.from({ length: 200 }, (_, i) => `- Policy clause ${i + 1} with extra detail to cross the 12KB page cap easily (src: s1) ^c${i + 1}`);
    const content = [
      '---',
      'type: concept',
      'title: Versioned',
      'description: Version check page.',
      'status: current',
      'created: 2026-11-01',
      'updated: 2026-11-01',
      '---',
      '# Versioned',
      '',
      '## Current',
      ...claims,
      '',
    ].join('\n');
    await writeFile(join(root, 'wiki/versioned.md'), content);

    const first = await readWikiJson(['wiki/versioned.md']);
    expect(first.more).toBe(true);

    const second = await readWikiJson([
      'wiki/versioned.md',
      '--select', first.next!.select,
      '--offset', String(first.next!.offset),
      '--expected-version', first.version,
    ]);
    expect(second.version).toBe(first.version);

    await readFail(['wiki/versioned.md', '--expected-version', `sha256:${'f'.repeat(64)}`], 'stale_version');

    await writeFile(join(root, 'wiki/versioned.md'), `${content}\n`);
    await readFail([
      'wiki/versioned.md',
      '--select', first.next!.select,
      '--offset', String(first.next!.offset),
      '--expected-version', first.next!.expected_version,
    ], 'stale_version');
  });

  it('reads wiki/log.md with the default selector', async () => {
    const logContent = '# Log\n\n- 2026-11-18 · compiled wiki\n';
    await writeFile(join(root, 'wiki/log.md'), logContent);
    const res = await readWikiJson(['wiki/log.md']);
    expect(res.select).toBe('all');
    expect(res.page).toBeNull();
    expect(res.problems).toBe(0);
    expect(res.text).toBe(logContent);
  });
});

describe('v2 read cited passages', () => {
  it('reads a cited passage with pin match, then pin changed, then stale_version when locator disappears', async () => {
    const matched = await readCitedJson([
      'Notes/meeting.md',
      '--select', 'cited:s2',
      '--from', 'wiki/record-preservation.md',
    ]);
    expect(matched.select).toBe('cited:s2');
    expect(matched.from).toBe('wiki/record-preservation.md');
    expect(matched.key).toBe('s2');
    expect(matched.pin).toBe('match');
    expect(matched.locator).toBe('heading Team meeting > Decisions > Next steps');
    expect(matched.quote).toBe('Review the source documents before compiling the wiki.');
    expect(matched.text).toContain(matched.quote!);
    expect(JSON.stringify(matched)).not.toContain('"verified"');

    const matchedText = await invoke(root, [
      'read', 'Notes/meeting.md', '--select', 'cited:s2', '--from', 'wiki/record-preservation.md',
    ]);
    expect(matchedText.code).toBe(0);
    expect(matchedText.stdout.split('\n')[0]).toContain(' · cited:s2 · pin match · ');
    expect(matchedText.stdout.endsWith('\n')).toBe(true);

    // Append a line to the source: pin becomes changed, passage includes the new line.
    const meetingPath = join(root, 'Notes/meeting.md');
    const original = await readFile(meetingPath, 'utf8');
    await writeFile(meetingPath, `${original}\nOne more line.\n`);

    const changed = await readCitedJson([
      'Notes/meeting.md',
      '--select', 'cited:s2',
      '--from', 'wiki/record-preservation.md',
    ]);
    expect(changed.pin).toBe('changed');
    expect(changed.version).not.toBe(changed.pinned_version);
    expect(changed.text).toContain('One more line.');

    const changedText = await invoke(root, [
      'read', 'Notes/meeting.md', '--select', 'cited:s2', '--from', 'wiki/record-preservation.md',
    ]);
    expect(changedText.stdout.split('\n')[0]).toContain(' · cited:s2 · pin changed · ');

    // Replace file without that heading: stale_version.
    await writeFile(meetingPath, '# Unrelated heading\n\nDifferent content.\n');
    await readFail([
      'Notes/meeting.md',
      '--select', 'cited:s2',
      '--from', 'wiki/record-preservation.md',
    ], 'stale_version');
  });

  it('rejects invalid routing, unknown keys, mismatched paths, denied wiki paths, and missing pages', async () => {
    await writeFile(join(root, 'wiki/log.md'), '# Log\n');

    await readFail(['Notes/meeting.md', '--select', 'cited:s99', '--from', 'wiki/record-preservation.md'], 'not_found');
    const mismatch = await readFail(['Archive/old.md', '--select', 'cited:s2', '--from', 'wiki/record-preservation.md'], 'invalid_selector');
    expect(mismatch.message).toContain('Notes/meeting.md');

    await readFail(['Notes/meeting.md', '--select', 'cited:s2'], 'invalid_selector');
    await readFail(['Notes/meeting.md', '--select', 'outline', '--from', 'wiki/record-preservation.md'], 'invalid_selector');
    await readFail(['Notes/meeting.md', '--select', 'current'], 'invalid_selector');
    await readFail(['wiki/log.md', '--select', 'outline'], 'invalid_selector');
    await readFail(['wiki/record-preservation.assets/checklist.txt'], 'path_denied');
    await readFail(['wiki/does-not-exist.md'], 'not_found');
  });
});

describe('v2 read text formatting: single-quoted more hints and trailing newline', () => {
  it('single-quotes selectors with ! or single quotes in the more: hint', () => {
    const base: ReadRawResult = {
      kind: 'raw',
      path: 'Finance/report.xlsx',
      format: 'xlsx',
      version: `sha256:${'a'.repeat(64)}`,
      select: 'sheet NAME!A1:B2',
      state: 'ok',
      problems: [],
      text: 'col1\tcol2',
      offset: 0,
      bytes: 9,
      total_bytes: 100,
      partial: false,
      more: true,
      next: {
        select: 'sheet NAME!A1:B2',
        offset: 9,
        expected_version: `sha256:${'a'.repeat(64)}`,
      },
      meta: {},
      cache: 'miss',
      warnings: [],
    };
    const formatted = formatReadRawText(base);
    expect(formatted).toContain("more: --select 'sheet NAME!A1:B2' --offset 9");

    const withQuote = formatReadRawText({
      ...base,
      select: "sheet Q1'26!A1:B2",
      next: {
        ...base.next!,
        select: "sheet Q1'26!A1:B2",
      },
    });
    expect(withQuote).toContain("more: --select 'sheet Q1'\\''26!A1:B2' --offset 9");
  });

  it('appends exactly one trailing newline in text mode without changing JSON or doubling existing newlines', async () => {
    const csvJsonRun = await invoke(root, ['read', 'Finance/orders.csv', '--select', 'row 1', '--json']);
    expect(csvJsonRun.code).toBe(0);
    const csvJson = JSON.parse(csvJsonRun.stdout) as ReadRawResult;
    expect(csvJson.text).toBe('1\tCompany, Ltd\t7.00');
    expect(csvJson.bytes).toBe(Buffer.byteLength('1\tCompany, Ltd\t7.00'));

    const csvTextRun = await invoke(root, ['read', 'Finance/orders.csv', '--select', 'row 1']);
    expect(csvTextRun.code).toBe(0);
    expect(csvTextRun.stdout.endsWith('\n')).toBe(true);
    expect(csvTextRun.stdout.endsWith('\n\n')).toBe(false);

    const wikiTextRun = await invoke(root, ['read', 'wiki/record-preservation.md']);
    expect(wikiTextRun.code).toBe(0);
    expect(wikiTextRun.stdout.endsWith('\n')).toBe(true);
    expect(wikiTextRun.stdout.endsWith('\n\n')).toBe(false);
  });
});
