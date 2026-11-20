import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { KF_SCHEMA } from '../../src/v2/schema/kf-2.0';
import { isValidSlug, parsePage } from '../../src/v2/core/page/parse';
import { isPageFile, listPages, readPage } from '../../src/v2/core/page/files';
import { getExtraction } from '../../src/v2/core/extract';
import { parseLocator, resolveLocator } from '../../src/v2/core/locator';
import { makeKb } from './helpers';
import { mkdir, rm, writeFile } from 'node:fs/promises';

const kbFixture = join(process.cwd(), 'tests/v2/fixtures/kb');
const badDir = join(process.cwd(), 'tests/v2/fixtures/bad-pages');

function sha256Hex(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function collapseWs(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

describe('KF 2.0 schema', () => {
  it('survives JSON round-trip unchanged and has exactly the five page types without record', () => {
    expect(JSON.parse(JSON.stringify(KF_SCHEMA))).toEqual(KF_SCHEMA);
    expect(Object.keys(KF_SCHEMA.page_types)).toEqual([
      'source',
      'concept',
      'entity',
      'comparison',
      'synthesis',
    ]);
    expect('record' in KF_SCHEMA.page_types).toBe(false);
  });
});

describe('KF 2.0 clean fixture pages', () => {
  const expectedFiles = [
    'wiki/company-ltd.md',
    'wiki/customer-order-comparison.md',
    'wiki/record-preservation.md',
    'wiki/source-policy-notes.md',
    'wiki/wiki-compile-overview.md',
  ];

  it('parses all five fixture pages cleanly with no problems', async () => {
    const pages = await listPages(kbFixture);
    expect(pages).toEqual(expectedFiles);

    const seenTypes = new Set<string>();
    for (const rel of pages) {
      const parsed = await readPage(kbFixture, rel);
      expect(parsed.problems, `${rel} had problems: ${JSON.stringify(parsed.problems)}`).toEqual([]);
      if (parsed.frontmatter.type) seenTypes.add(parsed.frontmatter.type);
    }
    expect(seenTypes).toEqual(new Set(['source', 'concept', 'entity', 'comparison', 'synthesis']));
  });

  it('checks record-preservation.md field by field against the parsed model', async () => {
    const page = await readPage(kbFixture, 'wiki/record-preservation.md');
    expect(page).toEqual({
      slug: 'record-preservation',
      frontmatter: {
        type: 'concept',
        title: 'Record preservation',
        description: 'Core rule requiring original source records to remain intact and be reviewed before wiki compilation.',
        status: 'disputed',
        created: '2026-10-02',
        updated: '2026-11-18',
        as_of: '2026-11-01',
        aliases: ['source preservation', 'original records rule'],
        tags: ['policy', 'governance'],
        related: ['source-policy-notes', 'wiki-compile-overview'],
        protected: ['c2'],
      },
      extra: {},
      title_line: { text: 'Record preservation', line: 14 },
      sections: [
        { name: 'Current', heading_line: 16, first_line: 17, last_line: 20 },
        { name: 'Evidence', heading_line: 21, first_line: 22, last_line: 23 },
        { name: 'Open', heading_line: 24, first_line: 25, last_line: 26 },
        { name: 'Sources', heading_line: 27, first_line: 28, last_line: 32 },
        { name: 'History', heading_line: 33, first_line: 34, last_line: 37 },
      ],
      claims: [
        {
          id: 'c2',
          text: 'Original records must be preserved and changes reviewed across all numbered policy clauses',
          sources: ['s1'],
          disputed: false,
          line: 17,
        },
        {
          id: 'c3',
          text: 'Source documents must be reviewed before compiling the wiki',
          sources: ['s2'],
          disputed: false,
          line: 18,
        },
        {
          id: 'c4',
          text: 'Archived notes remain active input for routine compilation',
          sources: ['s3'],
          disputed: true,
          line: 19,
        },
      ],
      open: [
        {
          id: 'q1',
          text: 'Does the archived document count as an active source or should it be excluded from routine compilation?',
          about: ['c4'],
          sources: ['s2', 's3'],
          line: 25,
        },
      ],
      sources: [
        {
          key: 's1',
          path: 'Projects/policy notes.txt',
          sha256: '4274ac1d0e3d4be63b54b8fdf913b18634db3423b92022e3cef3fe99691f844e',
          locator: 'lines 1-3',
          quote: 'Policy 1: preserve original records and review changes.',
          line: 28,
        },
        {
          key: 's2',
          path: 'Notes/meeting.md',
          sha256: 'd1208ac88705fafed2c50282fb5460463f8e9e2c56973dfb2cee9eacb8b1e9d0',
          locator: 'heading Team meeting > Decisions > Next steps',
          quote: 'Review the source documents before compiling the wiki.',
          line: 29,
        },
        {
          key: 's3',
          path: 'Archive/old.md',
          sha256: '71a5e0fd0bd57f1387aea68b432edf384b91e0c464adfb120956c87b95a64425',
          locator: 'heading Archived notes',
          quote: 'An older source document.',
          line: 30,
        },
        {
          key: 's4',
          path: 'Notes/会议记录.txt',
          sha256: '52c045fd40420db035ac7994573afc0e19d52b6fafd4a7fd32679e4c251a3381',
          locator: 'line 1',
          quote: '今天讨论知识库的整理工作，保留原始资料并核对每一项记录。',
          line: 31,
        },
      ],
      history: [
        {
          kind: 'claim',
          outcome: 'superseded',
          id: 'c1',
          text: 'Original records should be preserved when practical',
          sources: ['s1'],
          date: '2026-11-18',
          successor: 'c2',
          reason: 'wording tightened to match policy clauses',
          line: 34,
        },
        {
          kind: 'claim',
          outcome: 'retired',
          id: 'c5',
          text: 'Chinese meeting notes are exempt from record checks',
          sources: ['s4'],
          date: '2026-11-18',
          successor: null,
          reason: 'meeting notes explicitly require checking every record',
          line: 35,
        },
        {
          kind: 'event',
          date: '2026-11-18',
          event: 'verified',
          actor: 'jay',
          note: '^c2 against s1',
          line: 36,
        },
        {
          kind: 'event',
          date: '2026-10-02',
          event: 'created',
          actor: 'knowlery-fixture',
          note: null,
          line: 37,
        },
      ],
      evidence: {
        text: 'Both the policy register and the team meeting notes reinforce keeping raw files untouched and checking every record. See [Policy notes source summary](source-policy-notes.md) and the summary checklist in [Preservation checklist](record-preservation.assets/checklist.txt).',
        first_line: 22,
        last_line: 22,
      },
      links: [
        { line: 22, target: 'source-policy-notes.md', image: false, external: false },
        { line: 22, target: 'record-preservation.assets/checklist.txt', image: false, external: false },
      ],
      next: {
        claim: 'c6',
        open: 'q2',
        source: 's5',
      },
      problems: [],
    });
  });

  it('verifies every Sources line in all five pages against real files, sha256, locators, and quotes', async () => {
    const root = await makeKb();
    try {
      const pages = await listPages(root);
      let totalSources = 0;

      for (const rel of pages) {
        const page = await readPage(root, rel);
        for (const src of page.sources) {
          totalSources++;
          const bytes = await readFile(join(root, src.path));
          expect(sha256Hex(bytes), `${rel} ${src.key} sha256`).toBe(src.sha256);

          const extraction = await getExtraction(root, src.path);
          const resolved = resolveLocator(extraction, parseLocator(src.locator));
          expect(resolved.pieces.length, `${rel} ${src.key} locator`).toBeGreaterThan(0);

          if (src.quote !== null) {
            const fileText = collapseWs(bytes.toString('utf8'));
            expect(fileText, `${rel} ${src.key} quote`).toContain(collapseWs(src.quote));
          }
        }
      }
      expect(totalSources).toBeGreaterThanOrEqual(8);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('counts History claim ids when computing next ids', async () => {
    const page = await readPage(kbFixture, 'wiki/record-preservation.md');
    // Highest claim in ## Current is c4, but ## History contains c5.
    expect(page.claims.map((c) => c.id)).toEqual(['c2', 'c3', 'c4']);
    expect(page.next.claim).toBe('c6');
  });

  it('produces the exact same model and line numbers for CRLF line endings', async () => {
    const lfText = await readFile(join(kbFixture, 'wiki/record-preservation.md'), 'utf8');
    const crlfText = lfText.replace(/\n/g, '\r\n');
    expect(parsePage(crlfText, 'record-preservation.md')).toEqual(
      parsePage(lfText, 'record-preservation.md'),
    );
  });
});

describe('KF 2.0 slugs', () => {
  it('accepts valid slugs including Unicode caseless scripts and rejects invalid ones', () => {
    expect(isValidSlug('delivery-limit')).toBe(true);
    expect(isValidSlug('配送上限')).toBe(true);
    expect(isValidSlug('Delivery')).toBe(false);
    expect(isValidSlug('a--b')).toBe(false);
    expect(isValidSlug('a b')).toBe(false);
    expect(isValidSlug('-a')).toBe(false);

    const bad = parsePage(
      '---\ntype: concept\ntitle: T\ndescription: D\nstatus: current\ncreated: 2026-10-01\nupdated: 2026-10-02\n---\n',
      'Delivery.md',
    );
    expect(bad.problems).toEqual([
      expect.objectContaining({ code: 'slug_invalid', line: 1 }),
    ]);

    const zh = parsePage(
      '---\ntype: concept\ntitle: 配送上限\ndescription: D\nstatus: current\ncreated: 2026-10-01\nupdated: 2026-10-02\n---\n',
      '配送上限.md',
    );
    expect(zh.problems).toEqual([]);
    expect(zh.slug).toBe('配送上限');
  });
});

describe('KF 2.0 malformed pages', () => {
  it('reports missing frontmatter at line 1 and still parses the body', async () => {
    const text = await readFile(join(badDir, 'missing-frontmatter.md'), 'utf8');
    const page = parsePage(text, 'missing-frontmatter.md');
    expect(page.problems).toEqual([
      expect.objectContaining({ code: 'frontmatter_invalid', line: 1 }),
    ]);
    expect(page.title_line).toEqual({ text: 'No frontmatter', line: 1 });
    expect(page.claims).toHaveLength(1);
    expect(page.sources).toHaveLength(1);
  });

  it('reports unclosed frontmatter at line 1', async () => {
    const text = await readFile(join(badDir, 'unclosed-frontmatter.md'), 'utf8');
    const page = parsePage(text, 'unclosed-frontmatter.md');
    expect(page.problems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'frontmatter_invalid', line: 1 }),
      ]),
    );
  });

  it('validates frontmatter fields, keeps unknown keys, keeps dates as strings, and checks relations and protected', async () => {
    const text = await readFile(join(badDir, 'bad-frontmatter-fields.md'), 'utf8');
    const page = parsePage(text, 'bad-frontmatter-fields.md');

    expect(page.extra).toEqual({ custom_key: 'keep-me' });
    expect(typeof page.frontmatter.updated).toBe('string');
    expect(page.frontmatter.updated).toBe('2026-11-18');

    const summary = page.problems.map((p) => ({ code: p.code, line: p.line }));
    expect(summary).toEqual([
      { code: 'frontmatter_invalid', line: 1 }, // missing description
      { code: 'frontmatter_invalid', line: 2 }, // type: record
      { code: 'frontmatter_invalid', line: 4 }, // status: archived
      { code: 'frontmatter_invalid', line: 5 }, // created: 2026-13-40
      { code: 'frontmatter_invalid', line: 7 }, // tags: one
      { code: 'frontmatter_invalid', line: 8 }, // nested mapping
      { code: 'relation_invalid', line: 10 }, // BadSlug
      { code: 'relation_invalid', line: 10 }, // self slug
      { code: 'protect_invalid', line: 11 }, // protected: [c9]
    ]);
  });

  it('reports section_order for prose before sections, out-of-order, unknown, and duplicate sections', async () => {
    const text = await readFile(join(badDir, 'bad-sections.md'), 'utf8');
    const page = parsePage(text, 'bad-sections.md');

    const summary = page.problems.map((p) => ({ code: p.code, line: p.line }));
    expect(summary).toEqual([
      { code: 'section_order', line: 10 }, // prose before first section
      { code: 'section_order', line: 15 }, // Current after Sources
      { code: 'section_order', line: 18 }, // Unknown section
      { code: 'section_order', line: 21 }, // Duplicate Sources
    ]);
  });

  it('reports claim_invalid and missing cited sources on exact lines', async () => {
    const text = await readFile(join(badDir, 'bad-claims-and-open.md'), 'utf8');
    const page = parsePage(text, 'bad-claims-and-open.md');

    const summary = page.problems.map((p) => ({ code: p.code, line: p.line }));
    expect(summary).toEqual([
      { code: 'claim_invalid', line: 12 }, // no source list
      { code: 'claim_invalid', line: 13 }, // no id
      { code: 'claim_invalid', line: 14 }, // #urgent tag
      { code: 'claim_invalid', line: 16 }, // duplicate c3
      { code: 'claim_invalid', line: 17 }, // non-list line in Current
      { code: 'source_line_invalid', line: 18 }, // s9 not defined
      { code: 'claim_invalid', line: 21 }, // Open without ^q
      { code: 'claim_invalid', line: 27 }, // c3 reused in History
    ]);
  });

  it('reports source_line_invalid, source_path_invalid, and quote_not_found on exact lines', async () => {
    const text = await readFile(join(badDir, 'bad-sources.md'), 'utf8');
    const page = parsePage(text, 'bad-sources.md');

    const summary = page.problems.map((p) => ({ code: p.code, line: p.line }));
    expect(summary).toEqual([
      { code: 'source_line_invalid', line: 16 }, // duplicate s1
      { code: 'source_line_invalid', line: 17 }, // unparsable line
      { code: 'source_path_invalid', line: 18 }, // ../x.pdf
      { code: 'source_path_invalid', line: 19 }, // /abs.pdf
      { code: 'source_path_invalid', line: 20 }, // wiki/a.md
      { code: 'quote_not_found', line: 21 }, // .pdf without quote
      { code: 'source_line_invalid', line: 23 }, // 201-char quote
    ]);
    // .xlsx line without a quote (s6 on line 22) is accepted cleanly.
    expect(page.sources.find((s) => s.key === 's6')).toMatchObject({
      path: 'Finance/Q4.xlsx',
      locator: 'sheet Limits!B4:D4',
      quote: null,
      line: 22,
    });
  });

  it('reports history_invalid and parses well-formed retired claims', async () => {
    const text = await readFile(join(badDir, 'bad-history.md'), 'utf8');
    const page = parsePage(text, 'bad-history.md');

    const summary = page.problems.map((p) => ({ code: p.code, line: p.line }));
    expect(summary).toEqual([
      { code: 'history_invalid', line: 18 }, // unknown event
      { code: 'history_invalid', line: 19 }, // bad date 2026-02-30
      { code: 'history_invalid', line: 20 }, // successor ^c99 not in page
      { code: 'history_invalid', line: 21 }, // retired without reason
      { code: 'history_invalid', line: 22 }, // random line
    ]);

    const retired = page.history.find((h) => h.kind === 'claim' && h.id === 'c4');
    expect(retired).toEqual({
      kind: 'claim',
      outcome: 'retired',
      id: 'c4',
      text: 'Properly retired claim',
      sources: ['s1'],
      date: '2026-11-18',
      successor: null,
      reason: 'no longer supported',
      line: 23,
    });
  });

  it('detects wikilinks outside code blocks and ignores headings and wikilinks inside code blocks', async () => {
    const text = await readFile(join(badDir, 'wikilinks-and-fences.md'), 'utf8');
    const page = parsePage(text, 'wikilinks-and-fences.md');

    expect(page.sections.map((s) => s.name)).toEqual(['Evidence']);
    expect(page.problems.map((p) => ({ code: p.code, line: p.line }))).toEqual([
      { code: 'wikilink_found', line: 12 },
      { code: 'wikilink_found', line: 12 },
    ]);
    expect(page.links).toEqual([
      { line: 12, target: 'other.md', image: false, external: false },
      { line: 12, target: 'pic.png', image: true, external: false },
      { line: 12, target: 'https://example.com', image: false, external: true },
    ]);
  });

  it('produces identical problems and line numbers under CRLF', async () => {
    const text = await readFile(join(badDir, 'bad-frontmatter-fields.md'), 'utf8');
    const crlf = text.replace(/\n/g, '\r\n');
    expect(parsePage(crlf, 'bad-frontmatter-fields.md')).toEqual(
      parsePage(text, 'bad-frontmatter-fields.md'),
    );
  });
});

describe('KF 2.0 page file helpers', () => {
  it('filters special files and non-md files in isPageFile', () => {
    expect(isPageFile('record-preservation.md')).toBe(true);
    expect(isPageFile('CONVENTIONS.md')).toBe(false);
    expect(isPageFile('index.md')).toBe(false);
    expect(isPageFile('log.md')).toBe(false);
    expect(isPageFile('notes.txt')).toBe(false);
    expect(isPageFile('sub/page.md')).toBe(false);
  });

  it('lists only the five page files in sorted order and excludes special files and folders', async () => {
    const root = await makeKb();
    try {
      await writeFile(join(root, 'wiki/CONVENTIONS.md'), '# Conventions\n');
      await writeFile(join(root, 'wiki/index.md'), '# Index\n');
      await writeFile(join(root, 'wiki/log.md'), '# Log\n');
      await mkdir(join(root, 'wiki/nested'), { recursive: true });
      await writeFile(join(root, 'wiki/nested/ignored.md'), '# Nested\n');

      const pages = await listPages(root);
      expect(pages).toEqual([
        'wiki/company-ltd.md',
        'wiki/customer-order-comparison.md',
        'wiki/record-preservation.md',
        'wiki/source-policy-notes.md',
        'wiki/wiki-compile-overview.md',
      ]);

      await expect(readPage(root, 'wiki/index.md')).rejects.toMatchObject({ code: 'path_denied' });
      await expect(readPage(root, 'wiki/nested/ignored.md')).rejects.toMatchObject({ code: 'path_denied' });
      await expect(readPage(root, 'Notes/meeting.md')).rejects.toMatchObject({ code: 'path_denied' });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
