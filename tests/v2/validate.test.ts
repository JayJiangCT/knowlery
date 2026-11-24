import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { copyFile, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { runCli } from '../../src/v2/cli/main';
import type { ExtractionOptions } from '../../src/v2/core/extract';
import { registry as builtinRegistry } from '../../src/v2/core/extract/registry';
import { parsePage } from '../../src/v2/core/page/parse';
import { WIKI_DIR } from '../../src/v2/core/paths';
import type { ValidateFinding, ValidateResult } from '../../src/v2/core/validate';
import { digest, failure, fileState, invoke, makeKb } from './helpers';

type ValidateJsonResponse = ValidateResult & {
  contract: string;
  ok: boolean;
  command: 'validate';
};

let root: string;
beforeEach(async () => { root = await makeKb(); });
afterEach(async () => { await rm(root, { recursive: true, force: true }); });

async function validateJson(
  argv: string[] = [],
  extractionOptions: Pick<ExtractionOptions, 'registry' | 'ceiling'> = {},
): Promise<ValidateJsonResponse> {
  const before = await fileState(root);
  let stdout = '';
  let stderr = '';
  const code = await runCli(['validate', ...argv, '--json'], {
    cwd: root,
    stdout: (text) => { stdout += text; },
    stderr: (text) => { stderr += text; },
  }, extractionOptions);
  expect(code, stdout || stderr).toBe(0);
  expect(stderr).toBe('');
  expect(stdout.trimEnd().split('\n')).toHaveLength(1);
  expect(await fileState(root)).toEqual(before);
  const data = JSON.parse(stdout) as ValidateJsonResponse;
  expect(data).toMatchObject({ contract: '2.0', ok: true, command: 'validate' });
  return data;
}

describe('v2 validate', () => {
  it('reports zero findings and zero not_checked for the five fixture pages with exit code 0', async () => {
    const data = await validateJson();
    expect(data.counts).toEqual({
      pages: 5,
      findings: 0,
      errors: 0,
      warnings: 0,
      not_checked: 0,
      by_code: {},
    });
    expect(data.items).toEqual([]);
    expect(data.returned).toBe(0);
    expect(data.more).toBe(false);
    expect(data.next).toBeNull();
    expect(data.snapshot).toMatch(/^sha256:[0-9a-f]{64}$/);

    const textRes = await invoke(root, ['validate']);
    expect(textRes.code).toBe(0);
    expect(textRes.stderr).toBe('');
    expect(textRes.stdout).toBe('pages: 5  errors: 0  warnings: 0  not_checked: 0\n');
  });

  it('reports cross-page relation, supersession, dispute, deprecation, link, and attachment findings once at expected locations', async () => {
    // 1. relation_invalid (missing target) + supersede_inconsistent (target not superseded) + link_broken + attachment_outside + attachment_orphan (file)
    await mkdir(join(root, `${WIKI_DIR}/alpha.assets`), { recursive: true });
    await writeFile(join(root, `${WIKI_DIR}/alpha.assets/used.txt`), 'used\n');
    await writeFile(join(root, `${WIKI_DIR}/alpha.assets/unused.txt`), 'unused\n');
    await writeFile(
      join(root, `${WIKI_DIR}/alpha.md`),
      [
        '---',
        'type: concept',
        'title: Alpha',
        'description: Tests relation, supersession target status, links, and attachments.',
        'status: current',
        'created: 2026-10-01',
        'updated: 2026-11-18',
        'related: [does-not-exist]',
        'supersedes: [beta]',
        '---',
        '# Alpha',
        '',
        '## Evidence',
        'Good [own](alpha.assets/used.txt) and [raw](../../Notes/meeting.md) and [broken](missing-page.md) and [outside](record-preservation.assets/checklist.txt).',
      ].join('\n') + '\n',
    );

    // 2. beta: status current (causes alpha's supersede_inconsistent) + dispute_inconsistent (claim #disputed while status not disputed AND no Open about it)
    await writeFile(
      join(root, `${WIKI_DIR}/beta.md`),
      [
        '---',
        'type: concept',
        'title: Beta',
        'description: Target of alpha supersedes and has disputed claim on current page.',
        'status: current',
        'created: 2026-10-01',
        'updated: 2026-11-18',
        '---',
        '# Beta',
        '',
        '## Current',
        '- Disputed claim without disputed status or open item (src: s1) #disputed ^c1',
        '',
        '## Sources',
        '- s1 · `Finance/orders.csv` · sha256:0cba3bf0cb2d6c4762eec5d4f1408cea02d196d6395281d5529fe2953a994830 · row 1',
      ].join('\n') + '\n',
    );

    // 3. gamma: status superseded with nobody superseding it
    await writeFile(
      join(root, `${WIKI_DIR}/gamma.md`),
      [
        '---',
        'type: concept',
        'title: Gamma',
        'description: Superseded with no superseding page.',
        'status: superseded',
        'created: 2026-10-01',
        'updated: 2026-11-18',
        '---',
        '# Gamma',
      ].join('\n') + '\n',
    );

    // 4. cycle-a <-> cycle-b: supersedes cycle (both status: superseded so only cycle fires)
    await writeFile(
      join(root, `${WIKI_DIR}/cycle-a.md`),
      [
        '---',
        'type: concept',
        'title: Cycle A',
        'description: Supersedes cycle-b.',
        'status: superseded',
        'created: 2026-10-01',
        'updated: 2026-11-18',
        'supersedes: [cycle-b]',
        '---',
        '# Cycle A',
      ].join('\n') + '\n',
    );
    await writeFile(
      join(root, `${WIKI_DIR}/cycle-b.md`),
      [
        '---',
        'type: concept',
        'title: Cycle B',
        'description: Supersedes cycle-a.',
        'status: superseded',
        'created: 2026-10-01',
        'updated: 2026-11-18',
        'supersedes: [cycle-a]',
        '---',
        '# Cycle B',
      ].join('\n') + '\n',
    );

    // 5. delta: status disputed with no #disputed claim
    await writeFile(
      join(root, `${WIKI_DIR}/delta.md`),
      [
        '---',
        'type: concept',
        'title: Delta',
        'description: Disputed status with no disputed claim.',
        'status: disputed',
        'created: 2026-10-01',
        'updated: 2026-11-18',
        '---',
        '# Delta',
      ].join('\n') + '\n',
    );

    // 6. epsilon: status deprecated with no deprecated event with a note
    await writeFile(
      join(root, `${WIKI_DIR}/epsilon.md`),
      [
        '---',
        'type: concept',
        'title: Epsilon',
        'description: Deprecated without a note in history.',
        'status: deprecated',
        'created: 2026-10-01',
        'updated: 2026-11-18',
        '---',
        '# Epsilon',
        '',
        '## History',
        '- 2026-11-18 · deprecated · by jay',
      ].join('\n') + '\n',
    );

    // 7. Orphan assets folder with no matching page
    await mkdir(join(root, `${WIKI_DIR}/ghost.assets`), { recursive: true });
    await writeFile(join(root, `${WIKI_DIR}/ghost.assets/pic.txt`), 'orphan\n');

    const data = await validateJson();
    const simplify = (f: ValidateFinding) => ({ path: f.path, line: f.line, code: f.code, severity: f.severity });
    const actual = data.items.map(simplify);

    expect(actual).toEqual([
      { path: `${WIKI_DIR}/alpha.assets/unused.txt`, line: null, code: 'attachment_orphan', severity: 'warning' },
      { path: `${WIKI_DIR}/alpha.md`, line: 1, code: 'relation_invalid', severity: 'error' },
      { path: `${WIKI_DIR}/alpha.md`, line: 1, code: 'supersede_inconsistent', severity: 'error' },
      { path: `${WIKI_DIR}/alpha.md`, line: 14, code: 'attachment_outside', severity: 'error' },
      { path: `${WIKI_DIR}/alpha.md`, line: 14, code: 'link_broken', severity: 'error' },
      { path: `${WIKI_DIR}/beta.md`, line: 12, code: 'dispute_inconsistent', severity: 'error' },
      { path: `${WIKI_DIR}/beta.md`, line: 12, code: 'dispute_inconsistent', severity: 'error' },
      { path: `${WIKI_DIR}/cycle-a.md`, line: 1, code: 'supersede_inconsistent', severity: 'error' },
      { path: `${WIKI_DIR}/cycle-b.md`, line: 1, code: 'supersede_inconsistent', severity: 'error' },
      { path: `${WIKI_DIR}/delta.md`, line: 1, code: 'dispute_inconsistent', severity: 'error' },
      { path: `${WIKI_DIR}/epsilon.md`, line: 1, code: 'deprecate_incomplete', severity: 'error' },
      { path: `${WIKI_DIR}/gamma.md`, line: 1, code: 'supersede_inconsistent', severity: 'error' },
      { path: `${WIKI_DIR}/ghost.assets`, line: null, code: 'attachment_orphan', severity: 'warning' },
    ]);

    expect(data.counts).toEqual({
      pages: 12,
      findings: 13,
      errors: 11,
      warnings: 2,
      not_checked: 0,
      by_code: {
        attachment_orphan: 2,
        attachment_outside: 1,
        deprecate_incomplete: 1,
        dispute_inconsistent: 3,
        link_broken: 1,
        relation_invalid: 1,
        supersede_inconsistent: 4,
      },
    });
    expect(Object.keys(data.counts.by_code)).toEqual([...Object.keys(data.counts.by_code)].sort());
  });

  it('checks source locators, whitespace-normalized quotes, and denied symlink paths', async () => {
    const meetingBytes = await readFile(join(root, 'Notes/meeting.md'));
    const meetingSha = digest(meetingBytes).slice('sha256:'.length);
    await symlink(join(root, 'Notes/meeting.md'), join(root, 'Notes/link-meeting.md'));

    const multiLinePath = join(root, 'Notes/multiline.txt');
    const multiLineBytes = Buffer.from('Alpha   line\n  beta\tline\n');
    await writeFile(multiLinePath, multiLineBytes);
    const multiLineSha = digest(multiLineBytes).slice('sha256:'.length);

    await writeFile(
      join(root, `${WIKI_DIR}/source-checks.md`),
      [
        '---',
        'type: concept',
        'title: Source checks',
        'description: Tests locator, quote normalization, and symlink denial.',
        'status: current',
        'created: 2026-10-01',
        'updated: 2026-11-18',
        '---',
        '# Source checks',
        '',
        '## Sources',
        `- s1 · \`Notes/meeting.md\` · sha256:${meetingSha} · heading Team meeting > Missing heading · "Review the source documents before compiling the wiki."`,
        `- s2 · \`Notes/meeting.md\` · sha256:${meetingSha} · heading Team meeting > Decisions > Next steps · "Quote that does not appear anywhere."`,
        `- s3 · \`Notes/multiline.txt\` · sha256:${multiLineSha} · lines 1-2 · "Alpha line   beta line"`,
        `- s4 · \`Notes/link-meeting.md\` · sha256:${meetingSha} · heading Team meeting > Decisions > Next steps · "Review the source documents before compiling the wiki."`,
        `- s5 · \`Notes/meeting.md\` · sha256:${meetingSha} · heading Team meeting > Decisions > Next steps`,
      ].join('\n') + '\n',
    );

    const data = await validateJson(['--scope', `${WIKI_DIR}/source-checks.md`]);
    expect(data.items.map((f) => ({ line: f.line, code: f.code, severity: f.severity }))).toEqual([
      { line: 12, code: 'locator_not_found', severity: 'error' },
      { line: 13, code: 'quote_not_found', severity: 'error' },
      { line: 15, code: 'source_path_invalid', severity: 'error' },
      { line: 16, code: 'quote_missing', severity: 'error' },
    ]);
  });

  it('reports not_checked for edited, deleted, and unavailable pdf sources without locator or quote errors', async () => {
    // 1. Edit Notes/meeting.md so pinned hashes in record-preservation.md and wiki-compile-overview.md no longer match.
    await writeFile(join(root, 'Notes/meeting.md'), (await readFile(join(root, 'Notes/meeting.md'), 'utf8')) + '\nEdited line.\n');
    // 2. Delete Archive/old.md cited by record-preservation.md (s3).
    await rm(join(root, 'Archive/old.md'));
    // 3. Add a cited .pdf file and run with a registry that has no pdf extractor.
    const pdfBytes = Buffer.from('%PDF-1.4\nfake\n');
    await writeFile(join(root, 'Projects/manual.pdf'), pdfBytes);
    const pdfSha = digest(pdfBytes).slice('sha256:'.length);
    await writeFile(
      join(root, `${WIKI_DIR}/pdf-ref.md`),
      [
        '---',
        'type: concept',
        'title: PDF reference',
        'description: Cites a pdf file.',
        'status: current',
        'created: 2026-10-01',
        'updated: 2026-11-18',
        '---',
        '# PDF reference',
        '',
        '## Current',
        '- Manual describes the procedure (src: s1) ^c1',
        '',
        '## Sources',
        `- s1 · \`Projects/manual.pdf\` · sha256:${pdfSha} · page 1 · "Not in pdf."`,
      ].join('\n') + '\n',
    );

    const noPdfRegistry = { ...builtinRegistry, pdf: undefined };
    const data = await validateJson([], { registry: noPdfRegistry });

    expect(data.counts.errors).toBe(0);
    expect(data.counts.warnings).toBe(0);
    expect(data.counts.findings).toBe(0);
    expect(data.counts.not_checked).toBe(4);
    expect(data.counts.by_code).toEqual({ not_checked: 4 });
    expect(data.items.every((item) => item.code === 'not_checked' && item.severity === 'info')).toBe(true);
    expect(data.items.map((item) => `${item.path}:${item.line}`)).toEqual([
      `${WIKI_DIR}/pdf-ref.md:15`,
      `${WIKI_DIR}/record-preservation.md:29`,
      `${WIKI_DIR}/record-preservation.md:30`,
      `${WIKI_DIR}/wiki-compile-overview.md:20`,
    ]);
  });

  it('skips not_checked for uncited Sources lines while still checking cited ones and matching-pin quotes', async () => {
    const meetingBytes = await readFile(join(root, 'Notes/meeting.md'));
    const meetingSha = digest(meetingBytes).slice('sha256:'.length);
    const staleSha = '0'.repeat(64);

    await writeFile(
      join(root, `${WIKI_DIR}/history-only-source.md`),
      [
        '---',
        'type: concept',
        'title: History only source',
        'description: Old source line cited only from History.',
        'status: current',
        'created: 2026-10-01',
        'updated: 2026-11-18',
        '---',
        '# History only source',
        '',
        '## Current',
        '- Current claim uses the updated pin (src: s2) ^c2',
        '',
        '## Sources',
        `- s1 · \`Notes/meeting.md\` · sha256:${staleSha} · heading Team meeting > Decisions > Next steps · "Old quote."`,
        `- s2 · \`Notes/meeting.md\` · sha256:${meetingSha} · heading Team meeting > Decisions > Next steps · "Review the source documents before compiling the wiki."`,
        `- s3 · \`Notes/meeting.md\` · sha256:${meetingSha} · heading Team meeting > Decisions > Next steps · "Wrong quote on uncited matching pin."`,
        '',
        '## History',
        '- Old claim (src: s1) · superseded 2026-11-18 by ^c2 · source revised ^c1',
      ].join('\n') + '\n',
    );

    const uncited = await validateJson(['--scope', `${WIKI_DIR}/history-only-source.md`]);
    expect(uncited.counts.not_checked).toBe(0);
    expect(uncited.items.map((f) => ({ line: f.line, code: f.code }))).toEqual([
      { line: 17, code: 'quote_not_found' },
    ]);

    await writeFile(
      join(root, `${WIKI_DIR}/history-only-source.md`),
      [
        '---',
        'type: concept',
        'title: History only source',
        'description: Stale source line cited from Current.',
        'status: current',
        'created: 2026-10-01',
        'updated: 2026-11-18',
        '---',
        '# History only source',
        '',
        '## Current',
        '- Current claim still cites s1 (src: s1) ^c1',
        '',
        '## Sources',
        `- s1 · \`Notes/meeting.md\` · sha256:${staleSha} · heading Team meeting > Decisions > Next steps · "Old quote."`,
      ].join('\n') + '\n',
    );

    const cited = await validateJson(['--scope', `${WIKI_DIR}/history-only-source.md`]);
    expect(cited.counts.not_checked).toBe(1);
    expect(cited.items.map((f) => ({ line: f.line, code: f.code, severity: f.severity }))).toEqual([
      { line: 15, code: 'not_checked', severity: 'info' },
    ]);
  });

  it('reports parser problems unchanged for a malformed page copied from bad-pages', async () => {
    const src = join(process.cwd(), 'tests/v2/fixtures/bad-pages/bad-claims-and-open.md');
    await copyFile(src, join(root, `${WIKI_DIR}/bad-claims-and-open.md`));
    const parsed = parsePage(await readFile(src, 'utf8'), 'bad-claims-and-open.md');

    const data = await validateJson(['--scope', `${WIKI_DIR}/bad-claims-and-open.md`]);
    const expected = parsed.problems
      .map((p) => ({ path: `${WIKI_DIR}/bad-claims-and-open.md`, line: p.line, code: p.code, severity: 'error', message: p.message }))
      .sort((a, b) => a.line - b.line || (a.code < b.code ? -1 : a.code > b.code ? 1 : 0));

    for (const exp of expected) {
      expect(data.items).toContainEqual(exp);
    }
  });

  it('filters by --scope and rejects invalid or missing scopes', async () => {
    await rm(join(root, `${WIKI_DIR}/source-policy-notes.md`));
    const scoped = await validateJson(['--scope', `${WIKI_DIR}/record-preservation.md`]);
    expect(scoped.counts.pages).toBe(1);
    expect(scoped.items.length).toBeGreaterThan(0);
    expect(scoped.items.every((item) => item.path === `${WIKI_DIR}/record-preservation.md` || item.path.startsWith(`${WIKI_DIR}/record-preservation.assets/`))).toBe(true);

    await failure(root, ['validate', '--scope', 'Notes'], 'invalid_selector', 1);
    await failure(root, ['validate', '--scope', `${WIKI_DIR}/does-not-exist.md`], 'not_found', 1);
  });

  it('pages through findings with --limit and --snapshot and fails with stale_version on concurrent edit', async () => {
    await copyFile(
      join(process.cwd(), 'tests/v2/fixtures/bad-pages/bad-sources.md'),
      join(root, `${WIKI_DIR}/bad-sources.md`),
    );

    const all = await validateJson();
    expect(all.items.length).toBeGreaterThan(4);

    const collected: ValidateFinding[] = [];
    let offset = 0;
    let snapshot: string | undefined;
    for (;;) {
      const args = ['--limit', '2', '--offset', String(offset)];
      if (snapshot) args.push('--snapshot', snapshot);
      const page = await validateJson(args);
      expect(page.items.length).toBeLessThanOrEqual(2);
      collected.push(...page.items);
      if (!page.more) {
        expect(page.next).toBeNull();
        break;
      }
      expect(page.next).not.toBeNull();
      offset = page.next!.offset;
      snapshot = page.next!.snapshot;
    }
    expect(collected).toEqual(all.items);

    // Text output includes more: line when paginated.
    const textPage = await invoke(root, ['validate', '--limit', '2']);
    expect(textPage.code).toBe(0);
    expect(textPage.stdout).toContain(`more: --offset 2 --snapshot ${all.snapshot}\n`);

    // Edit a page in between -> stale_version.
    await writeFile(join(root, `${WIKI_DIR}/company-ltd.md`), (await readFile(join(root, `${WIKI_DIR}/company-ltd.md`), 'utf8')) + '\n[[bad-wikilink]]\n');
    await failure(root, ['validate', '--limit', '2', '--offset', '2', '--snapshot', all.snapshot], 'stale_version', 1);
  });

  it('ignores special files index.md, log.md, and CONVENTIONS.md', async () => {
    await writeFile(join(root, `${WIKI_DIR}/index.md`), '# Index\n\n[[wikilink-ok-here]]\n');
    await writeFile(join(root, `${WIKI_DIR}/log.md`), 'Unstructured log file.\n');
    await writeFile(join(root, `${WIKI_DIR}/CONVENTIONS.md`), 'Conventions without frontmatter.\n');

    const data = await validateJson();
    expect(data.counts).toEqual({
      pages: 5,
      findings: 0,
      errors: 0,
      warnings: 0,
      not_checked: 0,
      by_code: {},
    });
    expect(data.items).toEqual([]);
  });
});
